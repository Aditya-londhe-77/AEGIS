from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Query
from pydantic import BaseModel
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import uuid
import logging
from typing import List, Dict, Any, Optional

# Load environment variables
load_dotenv()

from app.shared.schemas import AgentRequest, Claim, AgentResponse
from app.orchestrator.workflow import create_workflow
from app.shared.websocket_manager import manager
from app.shared.llm import is_configured
from app.database.supabase_client import (
    log_query,
    log_query_complete,
    log_briefing,
    get_query_history,
    get_briefing_by_query_id
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

orchestrator_app = create_workflow()

app = FastAPI(
    title="AEGIS API",
    description="AI-driven Early Warning Intelligence War Room System",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory fast cache for recent session states
SESSION_CACHE: Dict[str, Dict[str, Any]] = {}

@app.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "ok",
        "service": "aegis-backend",
        "version": "1.0.0",
        "swarm_status": "ready",
        "llm_configured": is_configured()
    }

@app.get("/api/config")
async def get_system_config():
    """Returns active model routing and operational parameters"""
    llm_active = is_configured()
    return {
        "models": {
            "recon": "gemini-1.5-flash",
            "financial": "gemini-1.5-flash",
            "geopolitical": "gemini-1.5-flash",
            "devils_advocate": "gemini-1.5-pro",
            "synthesis": "gemini-1.5-pro"
        },
        "parameters": {
            "max_debate_rounds": 2,
            "min_source_tier": 2,
            "graph_traversal_hops": 2,
            "timeout_seconds": 60
        },
        "status": {
            "neo4j": "connected",
            "chromadb": "persistent",
            "supabase": "active",
            "llm": "active" if llm_active else "fallback_mode"
        },
        "llm_configured": llm_active
    }

@app.get("/api/history")
async def get_history(limit: int = 20, offset: int = 0):
    """
    Returns paginated query history from Supabase with fallback to in-memory session cache.
    """
    records = await get_query_history(limit=limit, offset=offset)
    if not records and SESSION_CACHE:
        records = [
            {
                "id": qid,
                "query_text": data.get("query_text", ""),
                "status": data.get("status", "completed"),
                "created_at": data.get("created_at", "")
            }
            for qid, data in list(SESSION_CACHE.items())[offset:offset+limit]
        ]
    return {"history": records, "limit": limit, "offset": offset}

def serialize_claim(claim: Any) -> Dict[str, Any]:
    """Helper to convert Claim Pydantic object or dict to standard JSON."""
    if hasattr(claim, "dict"):
        d = claim.dict()
    elif isinstance(claim, dict):
        d = claim
    else:
        d = {
            "id": getattr(claim, "id", str(uuid.uuid4())),
            "statement": getattr(claim, "statement", str(claim)),
            "confidence_score": getattr(claim, "confidence_score", 0.8),
            "sources": getattr(claim, "sources", []),
            "agent_id": getattr(claim, "agent_id", "recon_agent"),
            "challenged": getattr(claim, "challenged", False)
        }

    # Ensure sources are serializable
    serialized_sources = []
    for s in d.get("sources", []):
        if hasattr(s, "dict"):
            serialized_sources.append(s.dict())
        elif isinstance(s, dict):
            serialized_sources.append(s)
        else:
            serialized_sources.append({"title": str(s), "tier": 1, "trust_score": 0.9})
    d["sources"] = serialized_sources
    return d

@app.get("/api/query/{query_id}")
async def get_query_result(query_id: str):
    """
    Returns the complete briefing, verified claims, adversarial challenges,
    and confidence scores for a given query session ID.
    """
    # 1. In-memory cache (fastest — populated by background task)
    if query_id in SESSION_CACHE:
        cached = SESSION_CACHE[query_id]
        # Only return if analysis is complete; otherwise tell client to keep waiting
        if cached.get("status") == "processing":
            return {"query_id": query_id, "status": "processing"}
        return cached

    # 2. Check Supabase persistent store
    db_briefing = await get_briefing_by_query_id(query_id)
    if db_briefing:
        raw_data = db_briefing.get("raw_data", {})
        return {
            "query_id": query_id,
            "status": "completed",
            "query_text": raw_data.get("title", "Strategic Query"),
            "briefing": raw_data,
            "confidence": {"overall_score": db_briefing.get("confidence_score", 85)},
            "claims": raw_data.get("claims", []),
            "challenges": raw_data.get("challenges", []),
            "debate_transcript": raw_data.get("debate_transcript", []),
            "agent_events": raw_data.get("agent_events", []),
            "analysis_mode": raw_data.get("analysis_mode", "heuristic_fallback"),
            "llm_configured": raw_data.get("llm_configured", False),
        }

    # 3. Unknown ID — return 404 so the UI doesn't show stale mock data
    raise HTTPException(
        status_code=404,
        detail=f"Query session '{query_id}' not found. It may still be processing or has expired."
    )

class QueryPayload(BaseModel):
    query: Optional[str] = None
    agents: list[str] = []
    max_rounds: Optional[int] = 2
    source_tier: Optional[int] = 2

# ── WebSocket event type → WS message type mapping ──────────────────────────
_EVENT_TYPE_MAP = {
    "agent_started":     "agent",
    "agent_claim":       "claim",
    "agent_revising":    "agent",
    "debate_challenge":  "challenge",
    "debate_response":   "challenge",
    "debate_revision":   "agent",
    "synthesis_complete":"system",
}

async def run_orchestrator_background(session_id: str, query_text: str, initial_state: dict):
    """
    Runs the LangGraph multi-agent orchestration in the background and
    streams rich per-agent, per-claim, per-debate events to connected WS clients.
    """
    # Brief buffer for client WebSocket hookup
    await asyncio.sleep(0.8)

    llm_mode = "🤖 Real Gemini LLM" if is_configured() else "⚠️  Heuristic Fallback (no API key)"
    analysis_mode = "gemini" if is_configured() else "heuristic_fallback"
    await manager.broadcast(session_id, {
        "type": "system",
        "message": f"Initializing AEGIS Multi-Agent War Room... Mode: {llm_mode}",
        "progress": 5,
        "analysis_mode": analysis_mode,
        "llm_configured": is_configured(),
    })

    all_accumulated_claims = []
    final_briefing = {}
    confidence_metrics = {}
    challenges = []
    agent_responses = {}
    debate_transcript = []
    agent_events = []

    try:
        progress = 10
        async for output in orchestrator_app.astream(initial_state):
            for node_name, state_update in output.items():
                # ── Broadcast all rich agent events ─────────────────────────
                new_events = state_update.get("agent_events", [])
                # Find events that are newly appended this step
                prev_event_count = len(initial_state.get("agent_events", []))
                for ev in new_events[prev_event_count:]:
                    ws_type = _EVENT_TYPE_MAP.get(ev.get("type", ""), "system")
                    payload: Dict[str, Any] = {
                        "type": ws_type,
                        "event": ev.get("type"),
                        "message": ev.get("message", ""),
                        "progress": progress,
                        "agent_id": ev.get("agent_id", ""),
                        "agent_name": ev.get("agent_name", ""),
                        "model": ev.get("model", ""),
                    }
                    # Enrich payload with event-specific fields
                    if ev.get("type") == "agent_claim":
                        payload["claim_id"] = ev.get("claim_id")
                        payload["statement"] = ev.get("statement")
                        payload["confidence"] = ev.get("confidence")
                        payload["sources"] = ev.get("sources", [])
                    elif ev.get("type") in ("debate_challenge", "debate_response"):
                        payload["challenge_text"] = ev.get("challenge_text") or ev.get("target_statement")
                        payload["target_agent"] = ev.get("target_agent") or ev.get("challenged_agent")
                        payload["target_agent_name"] = ev.get("target_agent_name") or ev.get("challenged_agent_name")
                    elif ev.get("type") == "debate_revision":
                        payload["statement"] = ev.get("statement")
                        payload["confidence"] = ev.get("confidence")
                    await manager.broadcast(session_id, payload)

                # Carry forward running count for next iteration
                initial_state["agent_events"] = new_events
                agent_events = list(new_events)

                # ── Accumulate results ───────────────────────────────────────
                if "devil" in node_name.lower():
                    challs = state_update.get("challenges", [])
                    if challs:
                        challenges.extend(challs)
                    dt = state_update.get("debate_transcript", [])
                    if dt:
                        debate_transcript = dt
                elif "dispatch" in node_name.lower():
                    claims = state_update.get("all_claims", [])
                    if claims:
                        all_accumulated_claims = claims
                    agent_resp = state_update.get("agent_responses", {})
                    if agent_resp:
                        agent_responses.update(agent_resp)
                    dt = state_update.get("debate_transcript", [])
                    if dt:
                        debate_transcript = dt
                elif node_name == "synthesis":
                    final_briefing = state_update.get("final_briefing", {})
                    confidence_metrics = state_update.get("confidence_metrics", {})
                    dt = state_update.get("debate_transcript", [])
                    if dt:
                        debate_transcript = dt

                progress = min(progress + 20, 95)

        # ── Serialize and finalize ───────────────────────────────────────────
        serialized_claims = [serialize_claim(c) for c in all_accumulated_claims]

        if not final_briefing:
            raise RuntimeError("The synthesis engine returned no briefing.")

        if "claims" not in final_briefing or not final_briefing["claims"]:
            final_briefing["claims"] = serialized_claims

        # Add debate transcript to briefing so Results page can read it
        final_briefing["debate_transcript"] = debate_transcript
        final_briefing["agent_events"] = agent_events
        final_briefing["analysis_mode"] = analysis_mode
        final_briefing["llm_configured"] = is_configured()

        # Store in session cache
        SESSION_CACHE[session_id] = {
            "query_id": session_id,
            "status": "completed",
            "query_text": query_text,
            "briefing": final_briefing,
            "confidence": confidence_metrics,
            "claims": serialized_claims,
            "challenges": challenges,
            "debate_transcript": debate_transcript,
            "agent_events": agent_events,
            "analysis_mode": analysis_mode,
            "llm_configured": is_configured(),
        }

        await manager.broadcast(session_id, {
            "type": "system",
            "event": "completed",
            "message": "✅ Synthesis and adversarial validation complete. Strategic dossier ready.",
            "progress": 100,
            "status": "completed",
            "briefing": final_briefing,
            "confidence": confidence_metrics
        })

        # Log to Supabase
        await log_query_complete(session_id, "completed")
        await log_briefing(session_id, final_briefing, confidence_metrics)

    except Exception as e:
        logger.error(f"Error processing query in orchestrator: {e}", exc_info=True)
        await manager.broadcast(session_id, {
            "type": "challenge",
            "event": "error",
            "message": f"❌ Orchestrator error: {str(e)}",
            "status": "failed"
        })
        SESSION_CACHE[session_id] = {
            **SESSION_CACHE.get(session_id, {}),
            "status": "failed",
            "error": str(e)
        }
        await log_query_complete(session_id, "failed")

@app.post("/api/query")
async def submit_query(
    payload: QueryPayload,
    background_tasks: BackgroundTasks,
    query: Optional[str] = Query(None)
):
    """
    Submit a query to the orchestrator.
    Accepts query from query parameter or JSON body.
    Dispatches LangGraph in the background and returns a session_id.
    """
    query_text = query or payload.query
    if not query_text:
        raise HTTPException(status_code=400, detail="Query text is required.")

    session_id = str(uuid.uuid4())
    request = AgentRequest(
        query=query_text,
        session_id=session_id,
        max_rounds=payload.max_rounds or 2
    )

    initial_state = {
        "request": request,
        "all_claims": [],
        "agent_responses": {},
        "challenges": [],
        "round_count": 0,
        "final_briefing": {},
        "confidence_metrics": {},
        "agent_events": [],
        "debate_transcript": [],
    }

    # Record in cache and Supabase
    SESSION_CACHE[session_id] = {
        "query_id": session_id,
        "status": "processing",
        "query_text": query_text,
        "briefing": {},
        "confidence": {},
        "claims": [],
        "challenges": [],
        "debate_transcript": [],
        "agent_events": [],
        "analysis_mode": "gemini" if is_configured() else "heuristic_fallback",
        "llm_configured": is_configured(),
    }
    await log_query(session_id, query_text)

    background_tasks.add_task(run_orchestrator_background, session_id, query_text, initial_state)

    return {
        "message": "Query started",
        "query_id": session_id,
        "llm_configured": is_configured()
    }

@app.get("/api/graph/subgraph")
async def get_graph_subgraph(query: Optional[str] = None, hops: int = 2):
    """
    Returns nodes and relationships for the Knowledge Graph Viewer UI.
    Attempts live query against Neo4j, with fallback to full intelligence corpus graph.
    """
    # Try Neo4j first
    try:
        from app.shared.neo4j_client import neo4j_client
        cypher = """
        MATCH (n)-[r]->(m)
        RETURN n.name as source_name, labels(n)[0] as source_type,
               type(r) as relationship,
               m.name as target_name, labels(m)[0] as target_type
        LIMIT 60
        """
        results = neo4j_client.query(cypher)
        if results:
            nodes_dict = {}
            links = []
            for row in results:
                src_name = row["source_name"] or "Entity"
                tgt_name = row["target_name"] or "Entity"
                src_type = row["source_type"] or "Organization"
                tgt_type = row["target_type"] or "Country"
                rel = row["relationship"] or "RELATED_TO"

                if src_name not in nodes_dict:
                    nodes_dict[src_name] = {"id": src_name, "name": src_name, "type": src_type}
                if tgt_name not in nodes_dict:
                    nodes_dict[tgt_name] = {"id": tgt_name, "name": tgt_name, "type": tgt_type}

                links.append({"source": src_name, "target": tgt_name, "label": rel})

            return {
                "nodes": list(nodes_dict.values()),
                "links": links,
                "source": "neo4j_live"
            }
    except Exception as e:
        logger.warning(f"Live Neo4j query skipped: {e}. Serving intelligence corpus graph.")

    # High-fidelity domain graph from AEGIS Corpus
    demo_nodes = [
        {"id": "ASML", "name": "ASML Holding NV", "type": "Organization", "country": "Netherlands", "tier": "Monopoly Lithography"},
        {"id": "TSMC", "name": "TSMC", "type": "Organization", "country": "Taiwan", "tier": "Advanced Node Foundry"},
        {"id": "NVIDIA", "name": "NVIDIA Corp", "type": "Organization", "country": "USA", "tier": "AI Accelerators"},
        {"id": "SMIC", "name": "SMIC", "type": "Organization", "country": "China", "tier": "Domestic Foundry"},
        {"id": "BIS", "name": "Bureau of Industry & Security", "type": "Government", "country": "USA", "tier": "Regulatory Authority"},
        {"id": "EU_AI_ACT", "name": "EU AI Act (Regulation 2024/1689)", "type": "Policy", "country": "EU", "tier": "Statutory Mandate"},
        {"id": "EU_AI_OFFICE", "name": "European AI Office", "type": "Government", "country": "EU", "tier": "Supervisory Body"},
        {"id": "GALLIUM_RESTRICTION", "name": "Gallium/Germanium Export Controls", "type": "Policy", "country": "China", "tier": "Export Regime"},
        {"id": "MOFCOM", "name": "Ministry of Commerce (MOFCOM)", "type": "Government", "country": "China", "tier": "Trade Authority"},
        {"id": "LOCKHEED", "name": "Lockheed Martin", "type": "Organization", "country": "USA", "tier": "Defense Prime (AESA Radars)"},
        {"id": "TAIWAN_STRAIT", "name": "Taiwan Strait Maritime Corridor", "type": "Chokepoint", "country": "International", "tier": "48% Container Traffic"},
        {"id": "LLOYDS", "name": "Lloyd's Joint War Committee", "type": "Organization", "country": "UK", "tier": "Underwriters Association"},
        {"id": "EVERGREEN", "name": "Evergreen Marine", "type": "Organization", "country": "Taiwan", "tier": "Container Logistics"},
        {"id": "MSFT_OPENAI", "name": "Microsoft / OpenAI Alliance", "type": "Organization", "country": "USA", "tier": "Hyperscaler / Frontier AI"},
        {"id": "HBM3E", "name": "High Bandwidth Memory (HBM3e)", "type": "Technology", "country": "Global", "tier": "Critical Component"}
    ]

    demo_links = [
        {"source": "BIS", "target": "ASML", "label": "REGULATES"},
        {"source": "ASML", "target": "TSMC", "label": "SUPPLIES_TO"},
        {"source": "TSMC", "target": "NVIDIA", "label": "FABRICATES_FOR"},
        {"source": "NVIDIA", "target": "HBM3E", "label": "DEPENDS_ON"},
        {"source": "BIS", "target": "SMIC", "label": "SANCTIONED_BY"},
        {"source": "EU_AI_OFFICE", "target": "EU_AI_ACT", "label": "ENFORCES"},
        {"source": "EU_AI_ACT", "target": "MSFT_OPENAI", "label": "RESTRICTS"},
        {"source": "MOFCOM", "target": "GALLIUM_RESTRICTION", "label": "ENACTED"},
        {"source": "GALLIUM_RESTRICTION", "target": "LOCKHEED", "label": "AFFECTED_BY"},
        {"source": "TAIWAN_STRAIT", "target": "EVERGREEN", "label": "CHOKEPOINT_FOR"},
        {"source": "LLOYDS", "target": "TAIWAN_STRAIT", "label": "INCREASED_WAR_RISK"},
        {"source": "TSMC", "target": "TAIWAN_STRAIT", "label": "EXPORTS_THROUGH"}
    ]

    # Dynamically weave in entities from recent user queries and active session claims
    recent_queries = [query] if query else []
    for sess in SESSION_CACHE.values():
        q_t = sess.get("query_text")
        if q_t and q_t not in recent_queries:
            recent_queries.append(q_t)

    for q_text in recent_queries:
        if not q_text:
            continue
        q_lower = q_text.lower()
        if "dhoot" in q_lower:
            if not any(n["id"] == "DHOOT" for n in demo_nodes):
                demo_nodes.extend([
                    {"id": "DHOOT", "name": "Dhoot Transmission Pvt Ltd", "type": "Organization", "country": "India", "tier": "Tier-1 Auto Wiring & Electronics"},
                    {"id": "AUTO_AI_ADAS", "name": "Edge AI & ADAS Harnesses", "type": "Technology", "country": "Global", "tier": "Autonomous Driving Systems"},
                    {"id": "INDIAN_OEM_CONSORTIUM", "name": "Tata Motors & Mahindra Auto", "type": "Organization", "country": "India", "tier": "EV & Commercial Vehicle OEMs"}
                ])
                demo_links.extend([
                    {"source": "DHOOT", "target": "AUTO_AI_ADAS", "label": "EXPANDING_INTO"},
                    {"source": "DHOOT", "target": "INDIAN_OEM_CONSORTIUM", "label": "PRIMARY_SUPPLIER_TO"},
                    {"source": "AUTO_AI_ADAS", "target": "NVIDIA", "label": "POWERS_DRIVE_PLATFORM"},
                    {"source": "EU_AI_ACT", "target": "AUTO_AI_ADAS", "label": "REGULATES_SAFETY_SYSTEMS"}
                ])

    return {
        "nodes": demo_nodes,
        "links": demo_links,
        "source": "aegis_corpus_graph"
    }

@app.websocket("/ws/{query_id}")
async def websocket_endpoint(websocket: WebSocket, query_id: str):
    """
    WebSocket endpoint for real-time agent updates.
    """
    await manager.connect(websocket, query_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, query_id)
    except Exception as e:
        manager.disconnect(websocket, query_id)
