import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Send, 
  Cpu, 
  Crosshair, 
  Sliders, 
  Database, 
  Radio, 
  Flame, 
  Compass, 
  Zap, 
  ArrowRight,
  ShieldAlert,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";

const PRESET_SCENARIOS = [
  {
    id: "sc-1",
    tag: "SEMICONDUCTORS & LITHOGRAPHY",
    title: "Multilateral Lithography & Packaging Chokepoints",
    query: "Analyze the impact of expanded ASML ArFi DUV lithography export licensing on Chinese sub-7nm foundry capacity and NVIDIA H20 accelerator substitution.",
    activeAgents: ["recon", "financial", "geopolitical"],
    impactLevel: "CRITICAL",
    icon: Cpu
  },
  {
    id: "sc-2",
    tag: "REGULATORY COMPLIANCE",
    title: "EU AI Act High-Risk Governance & Cloud Liability",
    query: "Assess compliance exposure for US cloud hyperscalers under EU AI Act Regulation 2024/1689 Annex III high-risk models and turnover penalty thresholds.",
    activeAgents: ["recon", "geopolitical"],
    impactLevel: "HIGH",
    icon: ShieldAlert
  },
  {
    id: "sc-3",
    tag: "DEFENSE SUPPLY CHAIN",
    title: "Gallium/Germanium Dual-Use Export Restrictions",
    query: "Evaluate defense supply chain disruption from Chinese dual-use export permits on Gallium and Germanium for AESA radar systems and satellite solar arrays.",
    activeAgents: ["financial", "geopolitical"],
    impactLevel: "HIGH",
    icon: Flame
  },
  {
    id: "sc-4",
    tag: "MARITIME GEOPOLITICS",
    title: "Taiwan Strait War-Risk Maritime Surcharges",
    query: "Forecast commercial container routing delays and war-risk insurance premium spikes resulting from coordinated maritime quarantine exercises in the Taiwan Strait.",
    activeAgents: ["recon", "financial", "geopolitical"],
    impactLevel: "SEVERE",
    icon: Compass
  }
];

const SWARM_OPERATIVES = [
  { 
    id: "recon", 
    name: "Recon Agent", 
    role: "OSINT & Regulatory Scraper",
    tools: ["DuckDuckGo", "SEC Edgar", "ChromaDB RAG"],
    color: "text-blue-400", 
    border: "border-blue-500/40",
    bg: "bg-blue-500/10" 
  },
  { 
    id: "financial", 
    name: "Financial Agent", 
    role: "Market & Commodity Dynamics",
    tools: ["Yahoo Finance", "Spot Commodities", "GraphRAG"],
    color: "text-emerald-400", 
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10" 
  },
  { 
    id: "geopolitical", 
    name: "Geopolitical Agent", 
    role: "Policy, Alliances & Sanctions",
    tools: ["GDELT Project", "RSS Intel", "Neo4j Traversal"],
    color: "text-purple-400", 
    border: "border-purple-500/40",
    bg: "bg-purple-500/10" 
  },
];

export function Dashboard() {
  const [query, setQuery] = useState("");
  const [activeAgents, setActiveAgents] = useState(["recon", "financial", "geopolitical"]);
  const [maxRounds, setMaxRounds] = useState(2);
  const [minTier, setMinTier] = useState(2);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const toggleAgent = (id: string) => {
    setActiveAgents(prev => 
      prev.includes(id) 
        ? (prev.length > 1 ? prev.filter(a => a !== id) : prev) 
        : [...prev, id]
    );
  };

  const handleSelectScenario = (scenario: typeof PRESET_SCENARIOS[0]) => {
    setQuery(scenario.query);
    setActiveAgents(scenario.activeAgents);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const response = await api.submitQuery(query, activeAgents, {
        max_rounds: maxRounds,
        source_tier: minTier
      });
      navigate(`/query/${response.query_id}`, { 
        state: { query, agents: activeAgents, maxRounds, minTier } 
      });
    } catch (err) {
      console.warn("Backend submit fallback: generating local session ID", err);
      const mockQueryId = "sess_" + Math.random().toString(36).substring(2, 9);
      navigate(`/query/${mockQueryId}`, { 
        state: { query, agents: activeAgents, maxRounds, minTier } 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-16 animate-in fade-in duration-700">
      
      {/* Tactical Hero & Mission Statement */}
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs tracking-wider uppercase font-medium">
          <Database className="w-3.5 h-3.5" />
          Strategic Intelligence Platform
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-slate-100 dark:to-slate-400">
          Global Intelligence & Threat Analysis
        </h1>
        
        <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          Leverage specialized intelligence models to analyze claims, cross-examine data across multiple domains, and generate reliable, confidence-scored insights.
        </p>
      </div>

      {/* Main Command Input Box */}
      <Card className="border-border/60 bg-card/75 backdrop-blur-2xl shadow-xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5 transition-all focus-within:ring-primary/40 focus-within:border-primary/50">
        <CardContent className="p-4 md:p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative flex items-center">
              <div className="absolute left-4 text-muted-foreground">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your analysis objective (e.g. 'Analyze the impact of semiconductor export restrictions')..."
                className="w-full pl-12 pr-36 h-16 bg-background/50 border-border/40 text-base md:text-lg focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground/60 rounded-xl transition-colors"
              />
              <Button 
                type="submit" 
                disabled={!query.trim() || isSubmitting}
                className="absolute right-2 h-12 px-6 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/20 transition-all active:scale-95 gap-2"
              >
                <span>{isSubmitting ? "Running..." : "Run Analysis"}</span>
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 px-1 text-xs text-muted-foreground font-medium">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-foreground/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Devil's Advocate Active
                </span>
                <span className="flex items-center gap-1.5 text-foreground/80">
                  <Database className="w-3.5 h-3.5 text-primary" />
                  Knowledge Graph Active
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-primary hover:underline cursor-pointer transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                {showAdvanced ? "Hide Advanced Options" : "Advanced Options"}
              </button>
            </div>

            {/* Expandable Advanced Controls */}
            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-border/40 text-xs animate-in slide-in-from-top-2">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-medium uppercase tracking-wider">Adversarial Debate Rounds</label>
                  <select
                    value={maxRounds}
                    onChange={(e) => setMaxRounds(Number(e.target.value))}
                    className="w-full bg-secondary/50 border border-border/60 rounded-md px-3 py-2 text-foreground font-mono"
                  >
                    <option value={1}>1 Round (Fast Briefing ~25s)</option>
                    <option value={2}>2 Rounds (Deep Adversarial Review ~45s)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-medium uppercase tracking-wider">Minimum Source Credibility</label>
                  <select
                    value={minTier}
                    onChange={(e) => setMinTier(Number(e.target.value))}
                    className="w-full bg-secondary/50 border border-border/60 rounded-md px-3 py-2 text-foreground font-mono"
                  >
                    <option value={1}>Tier 1 Only (Govt / Official Filings)</option>
                    <option value={2}>Tier 1 & 2 (Official + Major Global Media)</option>
                    <option value={3}>All Tiers (Include Open Blogs / OSINT)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-medium uppercase tracking-wider">GraphRAG Traversal Depth</label>
                  <select className="w-full bg-secondary/50 border border-border/60 rounded-md px-3 py-2 text-foreground font-mono">
                    <option value={1}>1-Hop Direct Relations</option>
                    <option value={2}>2-Hop Multi-Actor Transitive Expansion</option>
                  </select>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Operative Swarm Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              Active Intelligence Modules
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Select the specialized modules you want to include in this analysis.</p>
          </div>
          <span className="text-sm text-primary font-medium">{activeAgents.length} of 3 Selected</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SWARM_OPERATIVES.map((agent) => {
            const isActive = activeAgents.includes(agent.id);
            return (
              <div
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={cn(
                  "cursor-pointer rounded-xl border p-4 transition-all duration-300 flex flex-col justify-between select-none relative overflow-hidden",
                  isActive
                    ? `${agent.border} bg-card/80 shadow-lg ring-1 ring-white/10`
                    : "border-border/40 bg-card/20 opacity-50 hover:opacity-80"
                )}
              >
                {isActive && (
                  <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-primary/20 to-transparent pointer-events-none" />
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={cn("font-bold text-sm", agent.color)}>{agent.name}</span>
                    <Badge variant="outline" className={cn("text-[10px] font-mono", isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "text-muted-foreground")}>
                      {isActive ? "ACTIVE" : "STANDBY"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{agent.role}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap gap-1">
                  {agent.tools.map((tool) => (
                    <span key={tool} className="text-[10px] bg-secondary/60 text-foreground/80 px-2 py-0.5 rounded font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preset Strategic Threat Scenarios */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              Example Scenarios
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Try one of our pre-built scenarios to see the platform in action.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRESET_SCENARIOS.map((sc) => {
            const Icon = sc.icon;
            return (
              <Card
                key={sc.id}
                onClick={() => handleSelectScenario(sc)}
                className="border-border/50 bg-card/40 hover:bg-card/70 hover:border-primary/40 cursor-pointer transition-all duration-300 group hover:shadow-lg backdrop-blur-sm"
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-wider font-semibold text-primary">
                      {sc.tag}
                    </span>
                    <Badge className={cn(
                      "text-[10px] font-mono",
                      sc.impactLevel === "CRITICAL" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                      sc.impactLevel === "SEVERE" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                      "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    )}>
                      {sc.impactLevel}
                    </Badge>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-secondary/50 text-foreground/90 shrink-0 group-hover:text-primary transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {sc.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {sc.query}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-xs text-primary font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                    <span>Load & Deploy Scenario</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

    </div>
  );
}
