import { Link, useLocation } from "@tanstack/react-router";
import { Video, ImagePlus, MapPin, Sparkles, Wand2 } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Videos", icon: Video },
  { to: "/photoshop", label: "Photoshop", icon: ImagePlus },
  { to: "/trends", label: "Local", icon: MapPin },
] as const;

export function MobileFrame({ children, immersive = false }: { children: ReactNode; immersive?: boolean }) {
  const { pathname } = useLocation();

  return (
    <>
      {/* ── Desktop layout (md+) ── */}
      <div className="hidden md:flex min-h-screen bg-background text-foreground">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-background sticky top-0 h-screen">
          {/* Logo */}
          <div className="px-6 py-7 flex items-center gap-3">
            <div className="size-9 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30">
              <Wand2 className="size-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight leading-none block">Magic Studio</span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide">AI Reel Creator</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 px-3 space-y-1">
            {tabs.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? "bg-brand/10 text-brand"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
                  {label}
                  {active && <div className="ml-auto size-1.5 rounded-full bg-brand" />}
                </Link>
              );
            })}
          </nav>

          {/* Create CTA */}
          <div className="px-4 py-6">
            <Link
              to="/create"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand text-white text-sm font-bold shadow-lg shadow-brand/30 hover:bg-brand/90 transition-colors"
            >
              <Sparkles className="size-4" />
              Create Reel
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className={`flex-1 min-h-screen ${immersive ? "overflow-hidden" : "overflow-y-auto"}`}>
          {children}
        </main>
      </div>

      {/* ── Mobile layout (<md) ── */}
      <div className="md:hidden min-h-dvh bg-background text-foreground flex flex-col relative max-w-[480px] mx-auto overflow-hidden">
        <main className={`flex-1 ${immersive ? "" : "pb-24"} overflow-y-auto no-scrollbar`}>{children}</main>
        <nav
          className={`fixed bottom-0 inset-x-0 max-w-[480px] mx-auto h-20 border-t border-border flex items-center justify-around px-2 ${
            immersive ? "bg-black/80 border-white/5" : "bg-tabbar"
          }`}
        >
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 w-16 transition-colors ${
                  active ? "text-brand" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-medium uppercase tracking-tight">{label}</span>
                {active && <div className="size-1 rounded-full bg-brand -mt-0.5" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
