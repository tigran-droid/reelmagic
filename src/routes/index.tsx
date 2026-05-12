import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Search, Bell, Play, Flame, TrendingUp } from "lucide-react";
import glam from "@/assets/reel-glam.jpg";
import anime from "@/assets/reel-anime.jpg";
import vhs from "@/assets/reel-vhs.jpg";
import cinema from "@/assets/reel-cinema.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Explore Templates — Magic Studio" },
      { name: "description", content: "Browse AI reel templates: glam, cinematic, anime, retro and more." },
    ],
  }),
  component: Categories,
});

const categories = [
  { label: "Trending", icon: Flame },
  { label: "Glam" },
  { label: "Cinematic" },
  { label: "Anime" },
  { label: "Retro" },
  { label: "Cyber" },
];

const featured = {
  video: glam,
  title: "Ultra Glow",
  tag: "Glam · New",
  duration: "0:15",
  uses: "12.4k",
};

const sections = [
  {
    title: "Trending now",
    subtitle: "Most generated this week",
    items: [
      { video: anime, title: "Cyber City", tag: "Anime AI", duration: "0:20", uses: "8.1k" },
      { video: cinema, title: "Golden Hour", tag: "Cinematic", duration: "0:15", uses: "5.4k" },
      { video: vhs, title: "VHS Memory", tag: "Retro", duration: "0:12", uses: "3.2k" },
    ],
  },
  {
    title: "Cinematic",
    subtitle: "Film-grade looks",
    items: [
      { video: cinema, title: "Golden Hour", tag: "16mm Film", duration: "0:18", uses: "4.7k" },
      { video: glam, title: "Neon Bloom", tag: "Night City", duration: "0:15", uses: "9.3k" },
      { video: vhs, title: "Polaroid", tag: "Memory", duration: "0:10", uses: "2.1k" },
    ],
  },
  {
    title: "Retro vibe",
    subtitle: "Throwback aesthetics",
    items: [
      { video: vhs, title: "90s Camcorder", tag: "VHS", duration: "0:14", uses: "6.8k" },
      { video: glam, title: "Disco Night", tag: "Glam", duration: "0:16", uses: "4.0k" },
      { video: anime, title: "Tokyo 88", tag: "Anime", duration: "0:13", uses: "3.5k" },
    ],
  },
];

function Categories() {
  return (
    <MobileFrame>
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="pt-12 px-5 pb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/80">Explore</p>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">Templates</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="size-10 grid place-items-center rounded-full bg-secondary/60 border border-border/60">
              <Search className="size-4" />
            </button>
            <button className="size-10 grid place-items-center rounded-full bg-secondary/60 border border-border/60 relative">
              <Bell className="size-4" />
              <span className="absolute top-2 right-2 size-1.5 rounded-full bg-brand" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-3">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((c, i) => {
              const Icon = c.icon;
              const active = i === 0;
              return (
                <button
                  key={c.label}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-colors border ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border/60 hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="size-3.5" />}
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Featured hero */}
      <section className="px-5 pt-5">
        <button className="relative w-full aspect-[16/10] rounded-3xl overflow-hidden text-left ring-1 ring-white/10 shadow-[0_20px_60px_-20px_hsl(0_0%_0%/0.6)]">
          <video
            src=""
            poster={featured.video}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-md text-[10px] font-semibold text-white/90 uppercase tracking-wider border border-white/10">
            <TrendingUp className="size-3 text-brand" /> Featured
          </div>
          <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white tabular-nums">
            {featured.duration}
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 mb-1">{featured.tag}</p>
              <h2 className="text-2xl font-semibold text-white leading-tight">{featured.title}</h2>
              <p className="text-[11px] text-white/70 mt-1">{featured.uses} creators using</p>
            </div>
            <div className="size-12 grid place-items-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/30">
              <Play className="size-5 fill-current" />
            </div>
          </div>
        </button>
      </section>

      <div className="pt-8 pb-4 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <div className="flex items-end justify-between mb-3 px-5">
              <div>
                <h2 className="text-base font-semibold tracking-tight">{section.title}</h2>
                <p className="text-[11px] text-muted-foreground">{section.subtitle}</p>
              </div>
              <button className="text-[11px] text-muted-foreground font-medium hover:text-foreground transition-colors">
                See all →
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar px-5 pb-1">
              {section.items.map((item, i) => (
                <button key={i} className="relative group text-left shrink-0 w-[42vw] max-w-[180px]">
                  <div className="relative w-full aspect-[9/14] rounded-2xl overflow-hidden bg-card ring-1 ring-white/10">
                    <video
                      src=""
                      poster={item.video}
                      muted
                      loop
                      playsInline
                      preload="none"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/0 to-black/20" />

                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white tabular-nums">
                      {item.duration}
                    </div>
                    <div className="absolute top-2 left-2 size-7 grid place-items-center rounded-full bg-white/15 backdrop-blur-md border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="size-3 fill-white text-white" />
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 right-2.5">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-white/60 mb-0.5">{item.tag}</p>
                      <p className="text-sm font-semibold text-white leading-tight truncate">{item.title}</p>
                      <p className="text-[10px] text-white/60 mt-0.5">{item.uses} uses</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </MobileFrame>
  );
}
