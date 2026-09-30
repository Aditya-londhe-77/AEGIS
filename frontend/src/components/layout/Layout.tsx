import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Layout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_hsl(30_100%_96%_/_0.8),transparent_38%)] dark:bg-[radial-gradient(circle_at_top_right,_hsl(214_50%_20%_/_0.45),transparent_38%)]" />
          <div className="relative z-10 mx-auto min-h-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
