import { useEffect, useState } from "react";
import { Activity, History, Network, Radio, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header() {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toISOString().replace("T", " ").slice(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="z-20 flex min-h-20 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Left: Tactical Threat Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
          </span>
          Elevated surveillance
        </div>

        <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
          <Radio className="h-3.5 w-3.5 animate-pulse text-primary" />
          <span>Live intelligence swarm</span>
        </div>
      </div>

      <nav className="flex items-center gap-1 md:hidden" aria-label="Primary navigation">
        {[
          { href: "/", label: "Operation Center", icon: Activity },
          { href: "/graph", label: "Knowledge Graph", icon: Network },
          { href: "/history", label: "Threat Logs", icon: History },
          { href: "/settings", label: "Swarm Config", icon: Settings },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} to={href} title={label} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <Icon className="h-4 w-4" />
          </Link>
        ))}
      </nav>

      {/* Center/Right: Live UTC Clock & Telemetry Quick Actions */}
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-xs font-semibold text-foreground/80">{timeStr || "SYSTEM CLOCK"}</div>
          <div className="flex items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Telemetry encrypted
          </div>
        </div>

        <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />

        <div className="flex items-center gap-2">
          <Link to="/graph">
            <Badge 
              variant="outline" 
              className="cursor-pointer gap-1.5 border-border/80 bg-card text-foreground transition-all hover:bg-secondary"
            >
              <Network className="w-3 h-3 text-primary" />
              <span className="hidden md:inline">Knowledge Graph</span>
            </Badge>
          </Link>

          <Link to="/history">
            <Badge 
              variant="outline" 
              className="cursor-pointer gap-1.5 border-border/80 bg-card text-foreground transition-all hover:bg-secondary"
            >
              <History className="w-3 h-3 text-emerald-400" />
              <span className="hidden md:inline">Threat Logs</span>
            </Badge>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
