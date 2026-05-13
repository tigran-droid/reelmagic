import { Link, useLocation } from "@tanstack/react-router";
import { Video, ImagePlus, Play, Wand2 } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Videos", icon: Video },
  { to: "/photoshop", label: "Photoshop", icon: ImagePlus },
  { to: "/feed", label: "Feed", icon: Play },
  { to: "/tools", label: "Tools", icon: Wand2 },
] as const;

export function MobileFrame({ children, immersive = false }: { children: ReactNode; immersive?: boolean }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col relative max-w-[480px] mx-auto overflow-hidden">
      <main className={`flex-1 ${immersive ? "" : "pb-24"} overflow-y-auto no-scrollbar`}>{children}</main>
      <nav
        className={`fixed bottom-0 inset-x-0 max-w-[480px] mx-auto h-20 border-t border-border flex items-center justify-around px-2 backdrop-blur-xl ${
          immersive ? "bg-black/40 border-white/5" : "bg-tabbar"
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
  );
}
