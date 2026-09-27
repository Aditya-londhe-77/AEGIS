import asyncio
import logging
from datetime import datetime
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END

from app.shared.schemas import AgentRequest, Claim, AgentResponse
from app.shared.constants import MAX_DEBATE_ROUNDS

from app.agents.recon import ReconAgent
from app.agents.financial import FinancialAgent
from app.agents.geopolitical import GeopoliticalAgent
from app.agents.devil_advocate import DevilsAdvocateAgent
from app.agents.synthesis import SynthesisAgent
from app.confidence.engine import ConfidenceEngine

logger = logging.getLogger(__name__)

# ── Agent registry: id → (class, display name, model name) ──────────────────
AGENT_REGISTRY = {
    "recon_agent":       (ReconAgent,       "Reconnaissance Operative", "gemini-1.5-flash"),
    "financial_agent":   (FinancialAgent,   "Financial Operative",       "gemini-1.5-flash"),
    "geopolitical_agent":(GeopoliticalAgent,"Geopolitical Operative",    "gemini-1.5-flash"),
}

def _now() -> str:
    return datetime.utcnow().strftime("%H:%M:%S")

class OrchestratorState(TypedDict):
    request: AgentRequest
    all_claims: List[Claim]
    agent_responses: Dict[str, AgentResponse]
    challenges: List[Dict[str, Any]]
    round_count: int
    final_briefing: Dict[str, Any]
    confidence_metrics: Dict[str, Any]
    # Rich event log broadcast to WS clients
    agent_events: List[Dict[str, Any]]
    debate_transcript: List[Dict[str, Any]]


async def dispatch_agents(state: OrchestratorState):
    req = state["request"]
    round_count = state.get("round_count", 0)
    challenges = state.get("challenges", [])
    agent_events: List[Dict[str, Any]] = list(state.get("agent_events", []))
    debate_transcript: List[Dict[str, Any]] = list(state.get("debate_transcript", []))

    agent_map = {
        agent_id: cls()
        for agent_id, (cls, _, _) in AGENT_REGISTRY.items()
    }

    if round_count == 0 or not challenges:
        # ── Initial parallel dispatch ──────────────────────────────────────────
        logger.info(f"LangGraph: Initial parallel dispatch for query: '{req.query}'")

        # Announce which agents are starting and with which model
        for agent_id, (_, display_name, model_name) in AGENT_REGISTRY.items():
            agent_events.append({
                "type": "agent_started",
                "time": _now(),
                "agent_id": agent_id,
                "agent_name": display_name,
                "model": model_name,
                "message": f"▶ {display_name} ({model_name}) deployed — gathering intelligence..."
            })

        tasks = [agent.run(req) for agent in agent_map.values()]
        responses = await asyncio.gather(*tasks)

        all_claims: List[Claim] = []
        agent_resp_dict: Dict[str, AgentResponse] = {}

        for r in responses:
            agent_resp_dict[r.agent_id] = r
            all_claims.extend(r.claims)

            # Emit each claim as its own event
            _, display_name, model_name = AGENT_REGISTRY.get(
                r.agent_id,
                (None, r.agent_id, "gemini-1.5-flash")
            )
            for c in r.claims:
                agent_events.append({
                    "type": "agent_claim",
                    "time": _now(),
                    "agent_id": r.agent_id,
                    "agent_name": display_name,
                    "model": model_name,
                    "claim_id": c.id,
                    "statement": c.statement,
                    "confidence": round(c.confidence_score * 100),
                    "sources": [s.title for s in c.sources],
                    "message": (
                        f"📋 [{display_name}] Claim (conf. {round(c.confidence_score*100)}%): "
                        f"{c.statement[:160]}{'...' if len(c.statement) > 160 else ''}"
                    )
                })

    else:
        # ── Targeted debate re-run ─────────────────────────────────────────────
        logger.info(f"LangGraph: Re-running challenged agents in debate round {round_count + 1}")
        all_claims = list(state.get("all_claims", []))
        agent_resp_dict = dict(state.get("agent_responses", {}))
        challenged_agent_ids = set(c.get("agent_id") for c in challenges)

        for agent_id in challenged_agent_ids:
            if agent_id in agent_map:
                _, display_name, model_name = AGENT_REGISTRY.get(
                    agent_id, (None, agent_id, "gemini-1.5-flash")
                )
                agent_events.append({
                    "type": "agent_revising",
                    "time": _now(),
                    "agent_id": agent_id,
                    "agent_name": display_name,
                    "model": model_name,
                    "message": f"🔄 [{display_name}] Revising claims in response to Devil's Advocate challenge..."
                })

                agent = agent_map[agent_id]
                agent_challenges = [c for c in challenges if c.get("agent_id") == agent_id]
                revised_resp = await agent.challenge_review(req, agent_challenges)
                agent_resp_dict[agent_id] = revised_resp

                for rev_claim in revised_resp.claims:
                    for idx, existing in enumerate(all_claims):
                        if existing.id == rev_claim.id:
                            all_claims[idx] = rev_claim

                    agent_events.append({
                        "type": "debate_revision",
                        "time": _now(),
                        "agent_id": agent_id,
                        "agent_name": display_name,
                        "model": model_name,
                        "claim_id": rev_claim.id,
                        "statement": rev_claim.statement,
                        "confidence": round(rev_claim.confidence_score * 100),
                        "message": (
                            f"✅ [{display_name}] Revised Claim (conf. {round(rev_claim.confidence_score*100)}%): "
                            f"{rev_claim.statement[:160]}{'...' if len(rev_claim.statement) > 160 else ''}"
                        )
                    })

                    # Add to debate transcript
                    debate_transcript.append({
                        "round": round_count + 1,
                        "type": "revision",
                        "agent_id": agent_id,
                        "agent_name": display_name,
                        "statement": rev_claim.statement,
                        "confidence": round(rev_claim.confidence_score * 100),
                    })

    return {
        "all_claims": all_claims,
        "agent_responses": agent_resp_dict,
        "round_count": round_count + 1,
        "agent_events": agent_events,
        "debate_transcript": debate_transcript,
    }


async def devils_advocate_review(state: OrchestratorState):
    agent_events: List[Dict[str, Any]] = list(state.get("agent_events", []))
    debate_transcript: List[Dict[str, Any]] = list(state.get("debate_transcript", []))
    all_claims = state.get("all_claims", [])
    round_count = state.get("round_count", 1)

    # Announce DA starting
    agent_events.append({
        "type": "agent_started",
        "time": _now(),
        "agent_id": "devils_advocate",
        "agent_name": "Devil's Advocate",
        "model": "gemini-1.5-pro",
        "message": "⚔️  Devil's Advocate (gemini-1.5-pro) initiating adversarial challenge pass..."
    })

    # Find the target claim (what DA will challenge)
    target_claim: Optional[Claim] = None
    for claim in all_claims:
        if not claim.challenged:
            target_claim = claim
            break
    if not target_claim and all_claims:
        target_claim = sorted(all_claims, key=lambda c: c.confidence_score)[0]

    if target_claim:
        _, target_agent_display, _ = AGENT_REGISTRY.get(
            target_claim.agent_id, (None, target_claim.agent_id, "")
        )
        agent_events.append({
            "type": "debate_challenge",
            "time": _now(),
            "agent_id": "devils_advocate",
            "agent_name": "Devil's Advocate",
            "model": "gemini-1.5-pro",
            "target_claim_id": target_claim.id,
            "target_agent": target_claim.agent_id,
            "target_agent_name": target_agent_display,
            "target_statement": target_claim.statement,
            "message": (
                f"🎯 Devil's Advocate targeting [{target_agent_display}] claim: "
                f"\"{target_claim.statement[:140]}{'...' if len(target_claim.statement) > 140 else ''}\""
            )
        })
        debate_transcript.append({
            "round": round_count,
            "type": "challenge_target",
            "agent_id": "devils_advocate",
            "agent_name": "Devil's Advocate",
            "target_agent": target_claim.agent_id,
            "target_agent_name": target_agent_display,
            "target_statement": target_claim.statement,
            "target_confidence": round(target_claim.confidence_score * 100),
        })

    # Run the actual DA review
    da_agent = DevilsAdvocateAgent()
    da_response = await da_agent.run_review(state["request"], all_claims)

    challenges = da_response.get("challenges", [])
    updated_claims = da_response.get("updated_claims", all_claims)

    # Emit the DA's actual challenge text
    for ch in challenges:
        challenge_text = ch.get("challenge_text", "")
        challenged_agent_id = ch.get("agent_id", "")
        _, challenged_agent_display, _ = AGENT_REGISTRY.get(
            challenged_agent_id, (None, challenged_agent_id, "")
        )

        agent_events.append({
            "type": "debate_response",
            "time": _now(),
            "agent_id": "devils_advocate",
            "agent_name": "Devil's Advocate",
            "model": "gemini-1.5-pro",
            "claim_id": ch.get("claim_id"),
            "challenge_text": challenge_text,
            "message": f"💬 Devil's Advocate counter-argument: \"{challenge_text}\""
        })

        debate_transcript.append({
            "round": round_count,
            "type": "challenge_response",
            "agent_id": "devils_advocate",
            "agent_name": "Devil's Advocate",
            "challenged_agent": challenged_agent_id,
            "challenged_agent_name": challenged_agent_display,
            "challenge_text": challenge_text,
        })

    logger.info(f"LangGraph: Devil's Advocate produced {len(challenges)} challenge(s)")

    return {
        "challenges": challenges,
        "all_claims": updated_claims,
        "agent_events": agent_events,
        "debate_transcript": debate_transcript,
    }


async def synthesis(state: OrchestratorState):
    agent_events: List[Dict[str, Any]] = list(state.get("agent_events", []))
    debate_transcript: List[Dict[str, Any]] = list(state.get("debate_transcript", []))
    all_claims = state.get("all_claims", [])

    agent_events.append({
        "type": "agent_started",
        "time": _now(),
        "agent_id": "synthesis_agent",
        "agent_name": "Synthesis Engine",
        "model": "gemini-1.5-pro",
        "message": "🧠 Synthesis Engine (gemini-1.5-pro) compiling multi-horizon strategic dossier..."
    })

    synthesis_agent = SynthesisAgent()
    briefing = await synthesis_agent.compile_briefing(state["request"], all_claims)

    confidence_engine = ConfidenceEngine()
    metrics = confidence_engine.global_confidence(all_claims)

    agent_events.append({
        "type": "synthesis_complete",
        "time": _now(),
        "agent_id": "synthesis_agent",
        "agent_name": "Synthesis Engine",
        "model": "gemini-1.5-pro",
        "total_claims": len(all_claims),
        "global_score": metrics.get("global_score", 0),
        "message": (
            f"✅ Synthesis complete — {len(all_claims)} claims validated, "
            f"global confidence {metrics.get('global_score', 0)}%"
        )
    })

    logger.info(f"LangGraph: Synthesis completed with global confidence score: {metrics.get('global_score')}")

    return {
        "final_briefing": briefing,
        "confidence_metrics": metrics,
        "agent_events": agent_events,
        "debate_transcript": debate_transcript,
    }


def should_continue(state: OrchestratorState):
    challenges = state.get("challenges", [])
    round_count = state.get("round_count", 1)
    max_rounds = state.get("request").max_rounds if state.get("request") else MAX_DEBATE_ROUNDS

    if len(challenges) > 0 and round_count < max_rounds:
        return "dispatch_agents"
    return "synthesis"


def create_workflow():
    workflow = StateGraph(OrchestratorState)

    workflow.add_node("dispatch_agents", dispatch_agents)
    workflow.add_node("devils_advocate_review", devils_advocate_review)
    workflow.add_node("synthesis", synthesis)

    workflow.set_entry_point("dispatch_agents")
    workflow.add_edge("dispatch_agents", "devils_advocate_review")
    workflow.add_conditional_edges("devils_advocate_review", should_continue, {
        "dispatch_agents": "dispatch_agents",
        "synthesis": "synthesis"
    })
    workflow.add_edge("synthesis", END)

    return workflow.compile()
