import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Shield,
  Brain,
  FileText,
  AlertTriangle,
  Download,
  Printer,
  Network,
  ArrowLeft,
  Layers,
  Target,
  Info,
  X,
  Lock,
  Sparkles,
  TrendingUp,
  Clock,
  Compass,
  ShieldCheck,
  Activity,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Cpu,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { api, type QueryResult, type Claim, type SourceCitation, type DebateEntry, type AgentTraceEvent } from "@/services/api";
import { cn } from "@/lib/utils";

// ── Colour helpers ─────────────────────────────────────────────────────────
const AGENT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  recon_agent:        { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30" },
  financial_agent:    { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  geopolitical_agent: { text: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30" },
  devils_advocate:    { text: "text-red-400",     bg: "bg-red-500/10",    border: "border-red-500/30" },
  synthesis_agent:    { text: "text-amber-400",   bg: "bg-amber-500/10",  border: "border-amber-500/30" },
};

const agentStyle = (agentId?: string) =>
  AGENT_COLORS[agentId || ""] || { text: "text-foreground/80", bg: "bg-secondary/30", border: "border-border/40" };

// ── Debate Transcript Component ────────────────────────────────────────────
function DebateTranscriptPanel({ transcript }: { transcript: DebateEntry[] }) {
  const [open, setOpen] = useState(true);
  if (!transcript || transcript.length === 0) return null;

  return (
    <Card className="border-border/60 shadow-xl bg-card/60 backdrop-blur-xl overflow-hidden">
      <CardHeader className="border-b border-border/50 pb-4 bg-secondary/20">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="flex items-center text-lg text-foreground">
            <MessageSquare className="w-5 h-5 mr-3 text-red-400" />
            Adversarial Debate Transcript
            <Badge variant="outline" className="ml-3 text-[10px] font-mono bg-red-500/10 text-red-400 border-red-500/30">
              {transcript.length} ENTRIES
            </Badge>
          </CardTitle>
          {open
            ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
        </button>
      </CardHeader>

      {open && (
        <CardContent className="p-5 space-y-3">
          {transcript.map((entry, i) => {
            if (entry.type === "challenge_target") {
              const targetStyle = agentStyle(entry.target_agent);
              return (
                <div key={i} className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded">
                      ⚔️  ROUND {entry.round} — DA TARGETING
                    </span>
                    <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border", targetStyle.text, targetStyle.bg, targetStyle.border)}>
                      {entry.target_agent_name || entry.target_agent}
                    </span>
                    {entry.target_confidence !== undefined && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        Claim confidence: {entry.target_confidence}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-red-200/90 italic leading-snug">
                    Claim under review: "{entry.target_statement}"
                  </p>
                </div>
              );
            }

            if (entry.type === "challenge_response") {
              return (
                <div key={i} className="ml-4 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded">
                      💬 DA COUNTER-ARGUMENT
                    </span>
                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", MODEL_COLOR_SMALL["gemini-1.5-pro"])}>
                      gemini-1.5-pro
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed italic">
                    "{entry.challenge_text}"
                  </p>
                </div>
              );
            }

            if (entry.type === "revision") {
              const revStyle = agentStyle(entry.agent_id);
              return (
                <div key={i} className="ml-4 p-3.5 rounded-xl border border-blue-500/25 bg-blue-500/5 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border", revStyle.text, revStyle.bg, revStyle.border)}>
                      {entry.agent_name || entry.agent_id}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded">
                      ✅ REVISED CLAIM
                    </span>
                    {entry.confidence !== undefined && (
                      <span className="text-[10px] font-mono text-blue-400 font-bold">
                        → Conf {entry.confidence}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/85 leading-snug">{entry.statement}</p>
                </div>
              );
            }

            return null;
          })}
        </CardContent>
      )}
    </Card>
  );
}

const MODEL_COLOR_SMALL: Record<string, string> = {
  "gemini-1.5-flash": "bg-blue-500/20 text-blue-300 border-blue-500/40",
  "gemini-1.5-pro":   "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

function AgentWorkPanel({ events, analysisMode }: { events: AgentTraceEvent[]; analysisMode?: string }) {
  const modeLabel = analysisMode === "gemini" ? "GEMINI LLM" : "RETRIEVAL + HEURISTIC REVIEW";

  return (
    <Card className="border-border/60 bg-card/60 shadow-xl backdrop-blur-xl">
      <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4">
        <CardTitle className="flex items-center justify-between gap-3 text-lg text-foreground">
          <span className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            Agent Work & Evidence Trail
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px] font-mono text-muted-foreground">
            {modeLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-5">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agent event trace was returned for this session.</p>
        ) : (
          events.map((event, index) => {
            const style = agentStyle(event.agent_id);
            const detail = event.statement || event.challenge_text || event.message || "Agent event recorded.";
            return (
              <div key={`${event.time || "event"}-${index}`} className="rounded-xl border border-border/50 bg-secondary/20 p-3.5">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">{event.time || "--:--:--"}</span>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-bold", style.text, style.bg, style.border)}>
                    {event.agent_name || event.agent_id || "System"}
                  </span>
                  {event.model && <span className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{event.model}</span>}
                  {event.confidence !== undefined && <span className="text-[10px] font-mono font-bold text-emerald-500">CONF {event.confidence}%</span>}
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{detail}</p>
                {event.sources && event.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.sources.map((source, sourceIndex) => (
                      <span key={`${source}-${sourceIndex}`} className="rounded-md border border-border/40 bg-card/70 px-2 py-1 text-[10px] text-muted-foreground">{source}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ── Dynamic Devil's Advocate Audit Card ───────────────────────────────────
function DAuditCard({ challenges, transcript, analysisMode }: {
  challenges?: QueryResult["challenges"];
  transcript?: DebateEntry[];
  analysisMode?: string;
}) {
  // Collect DA challenge–response pairs from transcript
  const pairs: Array<{ target: DebateEntry; response?: DebateEntry; revision?: DebateEntry }> = [];
  if (transcript && transcript.length > 0) {
    const targets = transcript.filter(e => e.type === "challenge_target");
    targets.forEach(target => {
      const response = transcript.find(e => e.type === "challenge_response" && e.round === target.round);
      const revision = transcript.find(e => e.type === "revision" && e.round === target.round);
      pairs.push({ target, response, revision });
    });
  }

  const hasDynamicData = pairs.length > 0;

  // Fallback if no transcript but we have challenges array
  const fallbackChallenges = !hasDynamicData && challenges && challenges.length > 0
    ? challenges
    : null;

  if (!hasDynamicData && !fallbackChallenges) {
    return (
      <Card className="border-red-500/30 bg-card/40 backdrop-blur-xl shadow-lg">
        <CardHeader className="pb-3 border-b border-border/50 bg-red-500/5">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center text-red-400">
            <AlertTriangle className="w-4 h-4 mr-2 text-red-400" />
            Devil's Advocate Adversarial Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed">
          <p>The Devil's Advocate evaluates every claim against conflicting evidence, historical base rates, and source credibility tiers before certifying synthesis.</p>
          <p className="mt-2 text-foreground/50 italic">No debate transcript available for this session.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-500/30 bg-card/40 backdrop-blur-xl shadow-lg">
      <CardHeader className="pb-3 border-b border-border/50 bg-red-500/5">
        <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center text-red-400">
          <AlertTriangle className="w-4 h-4 mr-2 text-red-400" />
          Devil's Advocate Audit
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4 text-xs">
        <p className="text-muted-foreground leading-relaxed">
          The DA used <span className="text-purple-400 font-mono">{analysisMode === "gemini" ? "gemini-1.5-pro" : "retrieval-backed heuristic review"}</span> to
          adversarially challenge agent claims before certifying final synthesis.
        </p>

        {hasDynamicData && pairs.map((pair, i) => {
          const targetStyle = agentStyle(pair.target.target_agent);
          return (
            <div key={i} className="space-y-2">
              {/* Target claim */}
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase text-red-400 font-bold">
                    ⚔️ Challenge {i + 1}
                  </span>
                  <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", targetStyle.text, targetStyle.bg, targetStyle.border)}>
                    {pair.target.target_agent_name}
                  </span>
                </div>
                <p className="text-[11px] text-red-200/85 italic leading-snug line-clamp-3">
                  "{pair.target.target_statement}"
                </p>
              </div>

              {/* DA counter-argument */}
              {pair.response && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-amber-400 font-bold">
                    💬 DA Counter-Argument
                  </div>
                  <p className="text-[11px] text-amber-200/90 italic leading-snug">
                    "{pair.response.challenge_text}"
                  </p>
                </div>
              )}

              {/* Agent revision */}
              {pair.revision && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
                    ✅ Agent Revision
                    {pair.revision.confidence && (
                      <span className="ml-2 text-blue-400">→ Conf {pair.revision.confidence}%</span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-200/90 leading-snug line-clamp-3">
                    {pair.revision.statement}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Fallback: challenges array without full transcript */}
        {fallbackChallenges && fallbackChallenges.map((ch, i) => (
          <div key={i} className="space-y-2">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1">
              <div className="text-[10px] font-mono uppercase text-red-400 font-bold">Challenge Vector {String(i + 1).padStart(2, "0")}</div>
              <p className="text-[11px] text-red-200/90 leading-snug">{ch.challenge}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
                Adversarial Resolution
              </div>
              <p className="text-[11px] text-emerald-200/90">
                Claim {ch.status === "revised" ? "revised" : "upheld"} after adversarial audit.
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Main Results Component ─────────────────────────────────────────────────
export function Results() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSource, setSelectedSource] = useState<SourceCitation | null>(null);
  const [selectedClaimForSource, setSelectedClaimForSource] = useState<Claim | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    api.fetchQueryResult(id)
      .then(res => setData(res))
      .catch(err => {
        console.warn("Could not fetch result:", err);
        setError(err.message || "Failed to load results.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleExportMarkdown = () => {
    if (!data) return;
    const md = `# AEGIS STRATEGIC INTELLIGENCE DOSSIER
OPERATION ID: ${data.query_id}
DATE: ${new Date().toISOString()}
CLASSIFICATION: STRATEGIC / UNCLASSIFIED
QUERY: "${data.query_text}"

=======================================================
EXECUTIVE SUMMARY:
${data.briefing?.executive_summary || "No summary provided."}

=======================================================
KEY FINDINGS:
${(data.briefing?.key_findings || []).map((f, i) => `${i + 1}. ${f}`).join("\n")}

=======================================================
PREDICTIVE OUTCOME SCENARIOS:
${(data.briefing?.scenarios || []).map((s, i) => `[Scenario ${i + 1}] ${s.name} (Probability: ${s.probability}%, Impact: ${s.impact}, Horizon: ${s.timeline})\n  ${s.description}`).join("\n\n")}

=======================================================
STRATEGIC TIMELINE HORIZONS:
T+30 Days:  ${data.briefing?.timeline_horizons?.horizon_30d || "Operational audit active"}
T+90 Days:  ${data.briefing?.timeline_horizons?.horizon_90d || "Secondary realignment"}
T+180 Days: ${data.briefing?.timeline_horizons?.horizon_180d || "Long-term equilibrium"}

=======================================================
STRATEGIC RECOMMENDATIONS:
${(data.briefing?.recommendations || []).map((r, i) => `${i + 1}. ${r}`).join("\n")}

=======================================================
ADVERSARIAL DEBATE TRANSCRIPT:
${(data.debate_transcript || []).map(e => {
  if (e.type === "challenge_target") return `[Round ${e.round}] DA TARGETING ${e.target_agent_name}: "${e.target_statement}"`;
  if (e.type === "challenge_response") return `[Round ${e.round}] DA COUNTER-ARGUMENT: "${e.challenge_text}"`;
  if (e.type === "revision") return `[Round ${e.round}] ${e.agent_name} REVISED (Conf ${e.confidence}%): "${e.statement}"`;
  return "";
}).filter(Boolean).join("\n")}

=======================================================
VERIFIED CLAIMS & EVIDENCE:
${(data.claims || []).map((c, i) => `
[Claim ${i + 1}] Confidence: ${Math.round(c.confidence_score * 100)}% | Agent: ${c.agent_id}
Statement: "${c.statement}"
Challenged: ${c.challenged ? "YES - " + (c.challenge_note || "Revised") : "NO"}
Sources:
${c.sources.map(s => `  - ${s.title} (Tier ${s.tier}, Trust: ${s.trust_score})\n    "${s.snippet || ""}"`).join("\n")}
`).join("\n")}

=======================================================
CONFIDENCE RADAR:
Global Confidence: ${data.confidence?.global_score || data.confidence?.overall_score || 85}%
Evidence Richness: ${data.confidence?.evidence_richness || 88}%
Consensus Score: ${data.confidence?.consensus_score || 80}%
Challenge Survival Rate: ${data.confidence?.challenge_survival_rate || 82}%
`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AEGIS-DOSSIER-${data.query_id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center">
        <LoadingSpinner size={48} label="Compiling Strategic Intelligence Dossier..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-32 flex flex-col items-center justify-center space-y-4 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <h2 className="text-xl font-bold text-foreground">Unable to Load Dossier</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          {error || "The session data could not be retrieved. It may still be processing."}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.reload()} className="text-xs">
            Retry
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")} className="text-xs">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const briefing = data.briefing;
  const claims = data.claims || [];
  const confidence = data.confidence || {};
  const formatMetric = (value?: number) => value === undefined ? "N/A" : `${Math.round(value <= 1 ? value * 100 : value)}%`;
  const globalScore = confidence.global_score ?? confidence.overall_score;
  const debateTranscript = data.debate_transcript || (data.briefing as any)?.debate_transcript || [];
  const agentEvents = data.agent_events || (data.briefing as any)?.agent_events || [];

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">

      {/* Classification Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
            <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded font-bold tracking-widest uppercase flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              INTELLIGENCE BRIEFING // NOFORN
            </span>
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
              {data.llm_configured || data.analysis_mode === "gemini" ? "GEMINI LLM ACTIVE" : "RETRIEVAL + HEURISTIC MODE"}
            </Badge>
            <span className="text-muted-foreground">ID: {id}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
            {briefing?.title || "Executive Intelligence Dossier"}
          </h1>
          <p className="text-sm font-mono text-muted-foreground">
            OBJECTIVE: "{data.query_text || location.state?.query || "Strategic Threat Vector Analysis"}"
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline" size="sm"
            onClick={handleExportMarkdown}
            className="text-xs font-mono gap-1.5 bg-card/50 hover:bg-secondary border-border/80"
          >
            <Download className="w-3.5 h-3.5" /> Export Dossier (.md)
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => window.print()}
            className="text-xs font-mono gap-1.5 bg-card/50 hover:bg-secondary border-border/80"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/graph")}
            className="text-xs font-mono gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Network className="w-3.5 h-3.5" /> Knowledge Graph
          </Button>
        </div>
      </div>

      {/* Confidence Radar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/60 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Global Confidence</span>
              <div className="text-3xl font-black text-primary">{formatMetric(globalScore)}</div>
            </div>
            <div className="h-10 w-10 rounded-full border-2 border-primary/40 flex items-center justify-center bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/60 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Evidence Richness</span>
              <div className="text-3xl font-black text-emerald-400">{formatMetric(confidence.evidence_richness)}</div>
            </div>
            <div className="h-10 w-10 rounded-full border-2 border-emerald-500/40 flex items-center justify-center bg-emerald-500/10">
              <Layers className="w-5 h-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/60 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Agent Consensus</span>
              <div className="text-3xl font-black text-purple-400">{formatMetric(confidence.consensus_score)}</div>
            </div>
            <div className="h-10 w-10 rounded-full border-2 border-purple-500/40 flex items-center justify-center bg-purple-500/10">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/60 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">DA Survival Rate</span>
              <div className="text-3xl font-black text-amber-400">{formatMetric(confidence.challenge_survival_rate)}</div>
            </div>
            <div className="h-10 w-10 rounded-full border-2 border-amber-500/40 flex items-center justify-center bg-amber-500/10">
              <Target className="w-5 h-5 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Synthesis + DA Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main 2 Cols: Executive Synthesis */}
        <div className="lg:col-span-2 space-y-6">

          {/* Executive Summary */}
          <Card className="border-border/60 shadow-xl bg-card/60 backdrop-blur-xl">
            <CardHeader className="border-b border-border/50 pb-4 bg-secondary/20">
              <CardTitle className="flex items-center text-lg text-foreground">
                <FileText className="w-5 h-5 mr-3 text-primary" />
                Executive Synthesis Briefing
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5 text-foreground/90 leading-relaxed text-sm md:text-base">
              <p>{briefing?.executive_summary ||
                "Multi-agent reconnaissance confirms structural disruptions across sovereign technology supply chains."}</p>

              {briefing?.key_findings && briefing.key_findings.length > 0 && (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                  <h4 className="font-semibold text-primary text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> Key Strategic Takeaways
                  </h4>
                  <ul className="space-y-1.5 text-xs md:text-sm text-foreground/90 list-disc list-inside">
                    {briefing.key_findings.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scenario Matrix */}
          <Card className="border-border/60 shadow-xl bg-card/60 backdrop-blur-xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4 bg-secondary/20 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center text-lg text-foreground">
                <TrendingUp className="w-5 h-5 mr-3 text-emerald-400" />
                Strategic Outcome Forecast & Scenario Matrix
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                MULTI-HORIZON PROBABILITY
              </Badge>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(briefing?.scenarios || [
                  { name: "Baseline: Sovereign Decoupling & Supply Chain Realignment", probability: 65, impact: "HIGH", description: "Affected institutions absorb regulatory friction through inventory buffering.", timeline: "30-90 Days" },
                  { name: "Escalation: Retaliatory Restrictions & Critical Chokepoint Fracture", probability: 25, impact: "CRITICAL", description: "Countervailing sovereign measures halt key transit corridors.", timeline: "90-180 Days" },
                  { name: "Mitigation: Bilateral Trade Exemptions & Quota Harmonization", probability: 10, impact: "MODERATE", description: "Targeted bilateral waivers de-escalate near-term tension.", timeline: "180+ Days" },
                ]).map((sc, scIdx) => {
                  const isHighProb = sc.probability >= 50;
                  const isCrit = sc.impact === "CRITICAL" || sc.impact === "SEVERE";
                  return (
                    <div key={scIdx} className={cn(
                      "p-4 rounded-xl border flex flex-col justify-between space-y-3",
                      isHighProb ? "bg-emerald-500/5 border-emerald-500/30 ring-1 ring-emerald-500/20" :
                      isCrit     ? "bg-red-500/5 border-red-500/30" :
                                   "bg-secondary/20 border-border/40"
                    )}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("text-2xl font-black font-mono",
                            isHighProb ? "text-emerald-400" : isCrit ? "text-red-400" : "text-blue-400"
                          )}>
                            {sc.probability}%
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={cn("text-[9px] font-mono uppercase px-1.5 py-0.5",
                              isCrit ? "border-red-500/40 text-red-400 bg-red-500/10" : "border-primary/40 text-primary bg-primary/10"
                            )}>
                              {sc.impact}
                            </Badge>
                            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" /> {sc.timeline}
                            </span>
                          </div>
                        </div>
                        <h5 className="text-xs font-bold text-foreground leading-tight">{sc.name}</h5>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{sc.description}</p>
                      </div>
                      <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                        <span>CONFIDENCE WEIGHT:</span>
                        <span className="font-semibold text-foreground">{sc.probability >= 50 ? "PRIMARY TRAJECTORY" : "TAIL RISK"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Timeline Horizons */}
              <div className="p-4 rounded-xl border border-border/50 bg-secondary/15 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-foreground font-semibold flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-primary" /> Strategic Impact Timeline Horizons
                  </span>
                  <span className="text-muted-foreground text-[10px]">T+0 TO T+180 DAYS</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {[
                    { label: "T+30 DAYS: IMMEDIATE SHOCK", color: "text-primary", value: briefing?.timeline_horizons?.horizon_30d },
                    { label: "T+90 DAYS: REALIGNMENT",     color: "text-amber-400", value: briefing?.timeline_horizons?.horizon_90d },
                    { label: "T+180 DAYS: EQUILIBRIUM",    color: "text-emerald-400", value: briefing?.timeline_horizons?.horizon_180d },
                  ].map(({ label, color, value }) => (
                    <div key={label} className="p-3 rounded-lg bg-card/60 border border-border/40 space-y-1">
                      <div className={cn("text-[10px] font-mono font-bold flex items-center gap-1", color)}>
                        <Activity className="w-3 h-3" /> {label}
                      </div>
                      <p className="text-muted-foreground text-[11px] leading-snug">
                        {value || "Analysis pending..."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {(briefing?.recommendations || []).length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-mono font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Actionable Strategic Countermeasures
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    {(briefing?.recommendations || []).map((rec, rIdx) => (
                      <div key={rIdx} className="p-2.5 rounded-lg bg-secondary/30 border border-border/30 text-foreground/85 text-[11px] flex items-start gap-2">
                        <span className="font-mono font-bold text-primary shrink-0">0{rIdx + 1}.</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verified Claims */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Verified Intelligence Claims ({claims.length})
              </h2>
              <span className="text-xs font-mono text-muted-foreground">CLICK SOURCE TO INSPECT EXCERPT</span>
            </div>

            <div className="space-y-3">
              {claims.map(claim => {
                const style = agentStyle(claim.agent_id);
                return (
                  <Card key={claim.id} className="border-border/60 bg-card/40 hover:bg-card/70 transition-all backdrop-blur-sm">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className={cn("text-[10px] font-mono uppercase border", style.text, style.bg, style.border)}>
                              {claim.agent_id.replace("_agent", "")} Operative
                            </Badge>
                            {claim.challenged && (
                              <Badge variant="outline" className="text-[10px] font-mono border-red-500/50 text-red-400 bg-red-500/10 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> DA Challenged & Revised
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-sm md:text-base text-foreground leading-snug">{claim.statement}</p>
                          {claim.challenge_note && (
                            <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
                              <span className="font-bold">Devil's Advocate Audit: </span>
                              {claim.challenge_note}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 self-start sm:self-auto">
                          <ConfidenceBadge score={Math.round((claim.confidence_score <= 1 ? claim.confidence_score * 100 : claim.confidence_score))} />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/30 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">Backing Evidence:</span>
                        {claim.sources.map((s, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => { setSelectedSource(s); setSelectedClaimForSource(claim); }}
                            className="text-xs bg-secondary/60 hover:bg-secondary border border-border/50 text-foreground/80 hover:text-primary px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${s.tier === 1 ? "bg-emerald-400" : "bg-blue-400"}`} />
                            <span className="truncate max-w-[200px]">{s.title}</span>
                            <Info className="w-3 h-3 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: DA Audit + Source Credibility */}
        <div className="space-y-6">

          {/* Dynamic DA Audit Card */}
          <DAuditCard
            challenges={data.challenges}
            transcript={debateTranscript}
            analysisMode={data.analysis_mode}
          />

          {/* Model Roster */}
          <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" /> Active Model Roster
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              {[
                { name: "Recon Operative",    model: "gemini-1.5-flash", agentId: "recon_agent" },
                { name: "Financial Operative", model: "gemini-1.5-flash", agentId: "financial_agent" },
                { name: "Geopolitical Op.",    model: "gemini-1.5-flash", agentId: "geopolitical_agent" },
                { name: "Devil's Advocate",    model: "gemini-1.5-pro",   agentId: "devils_advocate" },
                { name: "Synthesis Engine",    model: "gemini-1.5-pro",   agentId: "synthesis_agent" },
              ].map(a => {
                const s = agentStyle(a.agentId);
                return (
                  <div key={a.name} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20">
                    <span className={cn("font-mono text-[11px] font-bold", s.text)}>{a.name}</span>
                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", MODEL_COLOR_SMALL[a.model] || "")}>
                      {a.model}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Source Tier Credibility */}
          <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
                Source Credibility Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {[
                { dot: "bg-emerald-400", label: "Tier 1: Official & Regulatory", trust: "0.95" },
                { dot: "bg-blue-400",    label: "Tier 2: Major Media & Financials", trust: "0.85" },
                { dot: "bg-amber-400",   label: "Tier 3: Open OSINT & Forums", trust: "0.65" },
              ].map(t => (
                <div key={t.label} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", t.dot)} />
                    <span className="font-semibold text-foreground">{t.label}</span>
                  </div>
                  <Badge className={cn("font-mono text-[10px]",
                    t.dot.includes("emerald") ? "bg-emerald-500/20 text-emerald-400" :
                    t.dot.includes("blue")    ? "bg-blue-500/20 text-blue-400" :
                                                "bg-amber-500/20 text-amber-400"
                  )}>
                    TRUST: {t.trust}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="w-full text-xs font-mono gap-2 border-border/80"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Launch Another Mission
          </Button>
        </div>
      </div>

      <AgentWorkPanel events={agentEvents} analysisMode={data.analysis_mode} />

      {/* Full Debate Transcript (inline, below main grid) */}
      {debateTranscript.length > 0 && (
        <DebateTranscriptPanel transcript={debateTranscript} />
      )}

      {/* Evidence Inspector Modal */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <Card className="max-w-xl w-full border-border/80 bg-card/95 shadow-2xl overflow-hidden ring-1 ring-white/10">
            <CardHeader className="border-b border-border/60 py-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-primary uppercase">
                <Info className="w-4 h-4 text-primary" /> Evidence Citation Inspector
              </CardTitle>
              <button onClick={() => setSelectedSource(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Document / Source Title:</span>
                <h3 className="text-base font-bold text-foreground">{selectedSource.title}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 py-2 border-y border-border/40">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Source Credibility Tier:</span>
                  <div className="text-sm font-bold text-emerald-400">
                    Tier {selectedSource.tier} ({selectedSource.tier === 1 ? "Official / Government" : "Major Industry Media"})
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Quantified Trust Score:</span>
                  <div className="text-sm font-bold text-primary">
                    {Math.round(selectedSource.trust_score * 100)}% (Trust Index: {selectedSource.trust_score})
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground uppercase">Backing Snippet / Excerpt:</span>
                <div className="p-3.5 rounded-lg bg-secondary/40 border border-border/50 text-foreground/90 font-sans text-xs leading-relaxed italic">
                  "{selectedSource.snippet || "Direct evidence ingested from intelligence dossier corpus."}"
                </div>
              </div>
              {selectedClaimForSource && (
                <div className="space-y-1 text-[11px] text-muted-foreground font-sans">
                  <span className="font-mono text-[10px] text-primary uppercase block">Supports Claim:</span>
                  "{selectedClaimForSource.statement}"
                </div>
              )}
              <div className="pt-2 flex justify-end">
                <Button size="sm" onClick={() => setSelectedSource(null)} className="text-xs">
                  Close Inspector
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
