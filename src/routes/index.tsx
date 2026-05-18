import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Search, Bell, ChevronRight, Video as VideoIcon } from "lucide-react";
import glam from "@/assets/reel-glam.jpg";
import anime from "@/assets/reel-anime.jpg";
import vhs from "@/assets/reel-vhs.jpg";
import cinema from "@/assets/reel-cinema.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Videos — Magic Studio" },
      { name: "description", content: "Browse AI reel templates: glam, cinematic, anime, retro and more." },
    ],
  }),
  component: Categories,
});

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
    kind: "Reel",
    items: [
      { img: anime, name: "Cyber City" },
      { img: vhs, name: "Glitch Pulse" },
      { img: glam, name: "Neon Bloom" },
      { img: cinema, name: "Golden Hour" },
    ],
  },
  {
    title: "Glam & Portrait",
    kind: "Glam",
    items: [
      { img: glam, name: "Ultra Glow" },
      { img: glam, name: "Soft Pink" },
      { img: cinema, name: "Backlit" },
      { img: anime, name: "Studio" },
    ],
  },
  {
    title: "Cinematic",
    kind: "Film",
    items: [
      { img: cinema, name: "Golden Hour" },
      { img: cinema, name: "Noir" },
      { img: vhs, name: "Wide" },
      { img: glam, name: "Drift" },
    ],
  },
  {
    title: "Anime & Retro",
    kind: "Reel",
    items: [
      { img: anime, name: "Tokyo 88" },
      { img: vhs, name: "Synthwave" },
      { img: anime, name: "Shibuya" },
      { img: vhs, name: "VHS Tape" },
    ],
  },
  {
    title: "Cyber & Future",
    kind: "Cyber",
    items: [
      { img: anime, name: "Neon Grid" },
      { img: vhs, name: "Hologram" },
      { img: glam, name: "Chrome" },
      { img: cinema, name: "Skyline" },
    ],
  },
];

function Categories() {
  return (
    <MobileFrame>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="pt-12 pb-3 px-6 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold tracking-[0.3em] text-muted-foreground uppercase block mb-0.5">
              Videos
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">Templates</h1>
          </div>
          <div className="flex gap-2.5">
            <button className="size-10 rounded-full bg-secondary/60 grid place-items-center border border-border/60">
              <Search className="size-4" strokeWidth={2.5} />
            </button>
            <button className="size-10 rounded-full bg-secondary/60 grid place-items-center border border-border/60 relative">
              <Bell className="size-4" strokeWidth={2.5} />
              <span className="absolute top-2 right-2 size-2 rounded-full bg-brand ring-2 ring-background" />
            </button>
          </div>
        </div>
      </header>

      {/* Featured */}
      <section className="px-6 pt-5 mb-8">
        <button className="relative w-full aspect-[9/12] rounded-md overflow-hidden bg-card ring-1 ring-border shadow-2xl group text-left">
          <video
            src=""
            poster={featured.video}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

          <div className="absolute bottom-6 left-6 right-6">
            <div>
              <span className="text-brand text-[10px] font-black uppercase tracking-widest">{featured.tag}</span>
              <h2 className="text-2xl font-extrabold text-white leading-tight">{featured.title}</h2>
              <p className="text-white/60 text-[10px] font-medium mt-0.5">{featured.uses} creators using</p>
            </div>
          </div>
        </button>
      </section>

      {/* Sections — Photoshop-style horizontal rails */}
      <div className="space-y-7 pb-6">
        {sections.map((s) => (
          <section key={s.title} className="px-5">
            <div className="mb-3 flex justify-between items-center">
              <h3 className="text-[19px] font-extrabold tracking-tight">{s.title}</h3>
              <button className="flex items-center gap-0.5 px-3 py-1 rounded-full border border-border text-[11px] font-bold text-foreground">
                All <ChevronRight className="size-3" strokeWidth={3} />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x">
              {s.items.map((p, i) => (
                <button key={i} className="flex-none w-32 aspect-[9/12] snap-start rounded-md overflow-hidden relative bg-secondary ring-1 ring-border">
                  <img src={p.img} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-left">
                    <div className="text-white/80 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <VideoIcon className="size-2.5" /> {s.kind}
                    </div>
                    <div className="text-white text-sm font-extrabold leading-tight">{p.name}</div>
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
