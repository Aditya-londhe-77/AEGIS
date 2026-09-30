import { Activity, ShieldAlert, History, Settings, Network } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const location = useLocation();

  const links = [
    { name: "Operation Center", href: "/", icon: Activity },
    { name: "Knowledge Graph", href: "/graph", icon: Network },
    { name: "Threat Logs", href: "/history", icon: History },
    { name: "Swarm Config", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/70 bg-card/70 backdrop-blur-xl md:flex">
      <div className="flex h-20 items-center border-b border-border/60 px-6">
        <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">AEGIS</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Intelligence OS</p>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1 p-4">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.href;
          
          return (
            <Link
              key={link.name}
              to={link.href}
              className={cn(
                "group flex items-center rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200",
                isActive 
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="mr-3 h-[18px] w-[18px] transition-transform group-hover:scale-105" />
              {link.name}
            </Link>
          );
        })}
      </nav>
      
      <div className="border-t border-border/60 p-4">
        <div className="rounded-xl border border-border/60 bg-secondary/50 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">System status</p>
          <div className="flex items-center text-sm font-semibold text-emerald-600">
            <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Agents Online
          </div>
        </div>
      </div>
    </aside>
  );
}
