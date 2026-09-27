import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BrainCircuit,
  Terminal,
  Radio,
  Layers,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  AlertTriangle,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentStream, type AgentEvent } from "@/hooks/useAgentStream";
import { AgentCard } from "@/components/AgentCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PIPELINE_NODES = [
  { id: "dispatch", label: "Parallel Dispatch", desc: "OSINT, Market & Geo Recon" },
  { id: "devils_advocate", label: "Devil's Advocate", desc: "Adversarial Challenge Pass" },
  { id: "synthesis", label: "Synthesis Engine", desc: "Evidence Fusion & Briefing" },
  { id: "confidence", label: "Confidence Engine", desc: "Trust & Risk Quantification" },
];

// Model badge colours
const MODEL_COLORS: Record<string, string> = {
  "gemini-1.5-flash": "bg-blue-500/20 text-blue-300 border-blue-500/40",
  "gemini-1.5-pro":   "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

// Agent name → colour
const AGENT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  recon_agent:        { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30" },
  financial_agent:    { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  geopolitical_agent: { text: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30" },
  devils_advocate:    { text: "text-red-400",     bg: "bg-red-500/10",    border: "border-red-500/30" },
  synthesis_agent:    { text: "text-amber-400",   bg: "bg-amber-500/10",  border: "border-amber-500/30" },
};

// ── Rich event row renderer ──────────────────────────────────────────────────
function EventRow({ event }: { event: AgentEvent }) {
  const agentStyle = AGENT_COLORS[event.agentId || ""] || {
    text: "text-foreground/90", bg: "bg-secondary/20", border: "border-border/40",
  };

  if (event.type === "agent_claim") {
    return (
      <div className="p-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground shrink-0">{event.time}</span>
          <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border", agentStyle.text, agentStyle.bg, agentStyle.border)}>
            {event.agentName || event.agentId}
          </span>
          {event.model && (
            <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", MODEL_COLORS[event.model] || "bg-secondary/40 text-muted-foreground border-border/40")}>
              {event.model}
            </span>
          )}
          {event.confidence !== undefined && (
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              CONF {event.confidence}%
            </span>
          )}
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">CLAIM</span>
        </div>
        <p className="text-xs text-foreground/90 leading-snug pl-1">{event.statement || event.text}</p>
        {event.sources && event.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {event.sources.map((s, i) => (
              <span key={i} className="text-[9px] bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded font-mono border border-border/30">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (event.type === "debate_challenge") {
    return (
      <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground shrink-0">{event.time}</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/30">
            Devil's Advocate
          </span>
          <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", MODEL_COLORS["gemini-1.5-pro"] || "")}>
            gemini-1.5-pro
          </span>
          <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded">⚔️ TARGETING</span>
        </div>
        <p className="text-xs text-red-200/90 leading-snug pl-1">{event.text}</p>
        {event.targetAgentName && (
          <p className="text-[10px] text-muted-foreground font-mono pl-1">
            → Challenging <span className="text-red-400">{event.targetAgentName}</span>
          </p>
        )}
      </div>
    );
  }

  if (event.type === "debate_response") {
    return (
      <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground shrink-0">{event.time}</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/30">
            Devil's Advocate
          </span>
          <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">💬 COUNTER-ARGUMENT</span>
        </div>
        <p className="text-xs text-amber-200/90 leading-snug pl-1 italic">
          "{event.challengeText || event.text}"
        </p>
      </div>
    );
  }

  if (event.type === "debate_revision") {
    return (
      <div className="p-2.5 rounded-lg border border-blue-500/25 bg-blue-500/5 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground shrink-0">{event.time}</span>
          <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border", agentStyle.text, agentStyle.bg, agentStyle.border)}>
            {event.agentName || event.agentId}
          </span>
          {event.confidence !== undefined && (
            <span className="text-[10px] font-mono text-blue-400 font-bold">
              REVISED → CONF {event.confidence}%
            </span>
          )}
          <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded">✅ REVISED</span>
        </div>
        <p className="text-xs text-foreground/85 leading-snug pl-1">{event.statement || event.text}</p>
      </div>
    );
  }

  if (event.type === "agent_started") {
    return (
      <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg border border-border/30 bg-secondary/10">
        <span className="text-[10px] text-muted-foreground shrink-0">{event.time}</span>
        <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border", agentStyle.text, agentStyle.bg, agentStyle.border)}>
          {event.agentName || event.agentId}
        </span>
        {event.model && (
          <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", MODEL_COLORS[event.model] || "bg-secondary/40 text-muted-foreground border-border/40")}>
            {event.model}
          </span>
        )}
        <span className="text-xs text-foreground/75">{event.text.replace(/^▶\s*/, "")}</span>
      </div>
    );
  }

  // Default: system / generic rows
  const isChallenge = event.displayType === "challenge";
  const isGraph = event.displayType === "graph";
  return (
    <div className={cn(
      "p-2.5 rounded-lg border flex items-start gap-3",
      isChallenge ? "bg-red-500/10 border-red-500/30 text-red-300" :
      isGraph     ? "bg-purple-500/10 border-purple-500/20 text-purple-300" :
                    "bg-secondary/20 border-border/40 text-foreground/90"
    )}>
      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{event.time}</span>
      <div className="flex-1 text-xs">
        <span className={cn(
          "inline-block px-1.5 mr-2 rounded text-[10px] uppercase font-bold tracking-wider",
          isChallenge ? "bg-red-500/20 text-red-400" :
          isGraph     ? "bg-purple-500/20 text-purple-400" :
                        "bg-blue-500/20 text-blue-400"
        )}>
          {event.displayType}
        </span>
        {event.text}
      </div>
    </div>
  );
}

// ── Debate Transcript Panel ──────────────────────────────────────────────────
function DebateTranscript({ events }: { events: AgentEvent[] }) {
  const debateEvents = events.filter(e =>
    ["debate_challenge", "debate_response", "debate_revision", "agent_claim"].includes(e.type)
  );

  if (debateEvents.length === 0) return null;

  return (
    <Card className="bg-card/40 border-border/60 backdrop-blur-xl shadow-xl">
      <CardHeader className="border-b border-border/50 py-3.5 px-5">
        <CardTitle className="text-sm font-medium flex items-center text-foreground uppercase tracking-wider">
          <MessageSquare className="w-4 h-4 mr-2 text-red-400" />
          Live Debate Transcript
          <Badge variant="outline" className="ml-3 text-[10px] font-mono bg-red-500/10 text-red-400 border-red-500/30">
            {debateEvents.length} EVENTS
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-2">
        {debateEvents.map(ev => (
          <EventRow key={ev.id} event={ev} />
        ))}
      </CardContent>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function QueryExecution() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryText = location.state?.query || "Strategic Threat Vector Analysis";

  const { events, progress, isComplete } = useAgentStream(id);
  const [filterType, setFilterType] = useState<"all" | "agent" | "claim" | "challenge" | "system">("all");
  const [showDebatePanel, setShowDebatePanel] = useState(false);

  // Navigate to results when complete
  useEffect(() => {
    if (isComplete || progress >= 100) {
      const timer = setTimeout(() => {
        navigate(`/results/${id}`, { state: { query: queryText } });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [progress, isComplete, id, navigate, queryText]);

  const activeNodeIndex =
    progress < 25 ? 0 :
    progress < 60 ? 1 :
    progress < 90 ? 2 : 3;

  const filteredEvents = events.filter(e => {
    if (filterType === "all") return true;
    if (filterType === "claim") return e.type === "agent_claim";
    if (filterType === "challenge") return ["debate_challenge", "debate_response", "debate_revision"].includes(e.type);
    return e.displayType === filterType;
  });

  const debateCount = events.filter(e =>
    ["debate_challenge", "debate_response", "debate_revision"].includes(e.type)
  ).length;

  const claimCount = events.filter(e => e.type === "agent_claim").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-16">

      {/* Session Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs font-medium tracking-wide">
              ANALYSIS: RUNNING
            </Badge>
            <span className="text-xs text-muted-foreground">ID: {id}</span>
            {claimCount > 0 && (
              <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                {claimCount} CLAIMS
              </Badge>
            )}
            {debateCount > 0 && (
              <Badge variant="outline" className="text-[10px] font-mono bg-red-500/10 text-red-400 border-red-500/30">
                {debateCount} DEBATE EVENTS
              </Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground line-clamp-1">
            "{queryText}"
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3.5 py-1.5 bg-card border-border/80 text-foreground text-xs font-medium">
            <Radio className="w-3.5 h-3.5 mr-2 text-emerald-400 animate-pulse" />
            MODELS ACTIVE
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/results/${id}`, { state: { query: queryText } })}
            className="text-xs text-muted-foreground hover:text-primary gap-1"
          >
            Skip to Results <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Pipeline Progress */}
      <Card className="bg-card/50 backdrop-blur-xl border-border/60 shadow-lg overflow-hidden">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />
              Intelligence Processing Pipeline
            </span>
            <span className="text-primary font-bold text-sm">{progress}% COMPLETE</span>
          </div>

          <Progress value={progress} className="h-2" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {PIPELINE_NODES.map((node, idx) => {
              const isDone = idx < activeNodeIndex || progress >= 100;
              const isCurrent = idx === activeNodeIndex && progress < 100;
              return (
                <div
                  key={node.id}
                  className={`p-3 rounded-xl border text-xs transition-all duration-300 ${
                    isDone    ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-400" :
                    isCurrent ? "bg-primary/10 border-primary/50 text-foreground ring-1 ring-primary/30 shadow-md" :
                                "bg-card/20 border-border/40 text-muted-foreground opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] uppercase font-bold">STAGE 0{idx + 1}</span>
                    {isDone    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
                     isCurrent ? <BrainCircuit className="w-3.5 h-3.5 text-primary animate-pulse" /> :
                                 <span className="w-2 h-2 rounded-full bg-border" />}
                  </div>
                  <div className="font-semibold text-sm">{node.label}</div>
                  <div className="text-[10px] opacity-75 mt-0.5 line-clamp-1">{node.desc}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Execution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Cols: Live Telemetry Stream */}
        <div className="lg:col-span-2">
          <Card className="h-[520px] flex flex-col bg-card/40 border-border/60 backdrop-blur-xl shadow-xl">
            <CardHeader className="border-b border-border/50 py-3.5 px-5 flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-sm font-medium flex items-center text-foreground uppercase tracking-wider">
                <Terminal className="w-4 h-4 mr-2 text-primary" />
                Real-Time Processing Log
              </CardTitle>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg text-[10px] font-mono">
                {(["all", "agent", "claim", "challenge", "system"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2 py-0.5 rounded capitalize transition-colors ${
                      filterType === t
                        ? "bg-card text-foreground font-bold shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                    {t === "claim" && claimCount > 0 && (
                      <span className="ml-1 text-emerald-400">({claimCount})</span>
                    )}
                    {t === "challenge" && debateCount > 0 && (
                      <span className="ml-1 text-red-400">({debateCount})</span>
                    )}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2 font-mono text-xs">
                  {filteredEvents.length === 0 && (
                    <div className="py-20 flex justify-center">
                      <LoadingSpinner size={36} label="Awaiting agent signals..." />
                    </div>
                  )}
                  {filteredEvents.map(event => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Agent Status Sidebar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Module Status
            </span>
            <span className="text-[10px] font-mono text-emerald-400">STATUS: ACTIVE</span>
          </div>

          <div className="space-y-3">
            <AgentCard
              name="Reconnaissance Module"
              description="DuckDuckGo & SEC Edgar OSINT"
              status={progress >= 25 ? "done" : progress > 5 ? "running" : "idle"}
              progress={Math.min(100, progress * 4)}
            />
            <AgentCard
              name="Financial Module"
              description="yfinance & Commodity Volatility"
              status={progress >= 45 ? "done" : progress > 15 ? "running" : "idle"}
              progress={Math.min(100, Math.max(0, (progress - 15) * 3))}
            />
            <AgentCard
              name="Geopolitical Module"
              description="GDELT & Knowledge Graph Data"
              status={progress >= 60 ? "done" : progress > 25 ? "running" : "idle"}
              progress={Math.min(100, Math.max(0, (progress - 25) * 3))}
            />
            <AgentCard
              name="Devil's Advocate"
              description="Counter-Evidence & Validation"
              status={progress >= 85 ? "done" : progress > 50 ? "running" : "idle"}
              progress={Math.min(100, Math.max(0, (progress - 50) * 3))}
            />
            <AgentCard
              name="Synthesis Module"
              description="Executive Summary Compilation"
              status={progress >= 95 ? "done" : progress > 80 ? "running" : "idle"}
              progress={Math.min(100, Math.max(0, (progress - 80) * 5))}
            />
          </div>

          {/* Active Model Roster */}
          <div className="p-3.5 rounded-xl border border-border/40 bg-card/30 text-xs space-y-2">
            <div className="font-semibold text-foreground/80 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              Active Model Roster
            </div>
            <div className="space-y-1">
              {[
                { name: "Recon", model: "gemini-1.5-flash", color: "text-blue-400" },
                { name: "Financial", model: "gemini-1.5-flash", color: "text-emerald-400" },
                { name: "Geopolitical", model: "gemini-1.5-flash", color: "text-purple-400" },
                { name: "Devil's Advocate", model: "gemini-1.5-pro", color: "text-red-400" },
                { name: "Synthesis", model: "gemini-1.5-pro", color: "text-amber-400" },
              ].map(a => (
                <div key={a.name} className="flex items-center justify-between">
                  <span className={cn("font-mono text-[10px] font-bold", a.color)}>{a.name}</span>
                  <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", MODEL_COLORS[a.model] || "")}>
                    {a.model}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Debate Transcript Panel (collapsible) */}
      {debateCount > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowDebatePanel(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors w-full text-left"
          >
            <MessageSquare className="w-4 h-4 text-red-400" />
            Live Debate Transcript
            <Badge variant="outline" className="text-[10px] font-mono bg-red-500/10 text-red-400 border-red-500/30 ml-1">
              {debateCount} EVENTS
            </Badge>
            {showDebatePanel
              ? <ChevronUp className="w-4 h-4 ml-auto text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />}
          </button>
          {showDebatePanel && <DebateTranscript events={events} />}
        </div>
      )}

    </div>
  );
}
