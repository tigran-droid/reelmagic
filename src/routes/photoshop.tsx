import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Aperture, ChevronRight, Sparkles, SlidersHorizontal } from "lucide-react";
import birthday from "@/assets/photo-birthday.jpg";
import wedding from "@/assets/photo-wedding.jpg";
import travel from "@/assets/photo-travel.jpg";
import portrait from "@/assets/photo-portrait.jpg";
import everyday from "@/assets/photo-everyday.jpg";
import glam from "@/assets/reel-glam.jpg";
import anime from "@/assets/reel-anime.jpg";
import vhs from "@/assets/reel-vhs.jpg";
import cinema from "@/assets/reel-cinema.jpg";

export const Route = createFileRoute("/photoshop")({
  head: () => ({
    meta: [
      { title: "Photoshop — Magic Studio" },
      { name: "description", content: "Edit and beautify your photos with AI presets." },
    ],
  }),
  component: Photoshop,
});

const featured = [
  { img: portrait, badge: "Pro", kind: "Photoshoot", title: "Effortless icon" },
  { img: wedding, badge: "gio", kind: "Photoshoot", title: "Power flow" },
];

const sections = [
  {
    title: "Business headshot",
    kind: "Photoshoot",
    items: [
      { img: portrait, name: "Pure focus" },
      { img: glam, name: "Noir grace" },
      { img: wedding, name: "Power flow" },
      { img: cinema, name: "Studio light" },
    ],
  },
  {
    title: "Popular photoshoots",
    kind: "One shot",
    items: [
      { img: glam, name: "Color analysis" },
      { img: anime, name: "Hand drawn" },
      { img: vhs, name: "Photobooth" },
      { img: birthday, name: "Candle glow" },
    ],
  },
  {
    title: "Studio",
    kind: "Photoshoot",
    items: [
      { img: portrait, name: "Crimson" },
      { img: glam, name: "Soft shadow" },
      { img: cinema, name: "Backlit" },
      { img: wedding, name: "Window" },
    ],
  },
  {
    title: "Travel & Scenery",
    kind: "One shot",
    items: [
      { img: travel, name: "Golden peak" },
      { img: cinema, name: "Coastline" },
      { img: anime, name: "Misty" },
      { img: vhs, name: "Dunes" },
    ],
  },
  {
    title: "Everyday Life",
    kind: "Photoshoot",
    items: [
      { img: everyday, name: "Window light" },
      { img: anime, name: "Morning" },
      { img: cinema, name: "Quiet" },
      { img: birthday, name: "Warm" },
    ],
  },
];

function Photoshop() {
  return (
    <MobileFrame>
      {/* Header */}
      <header className="px-5 pt-8 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Photoshop</h1>
        <button className="size-9 rounded-full bg-secondary border border-border flex items-center justify-center">
          <SlidersHorizontal className="size-4" strokeWidth={2.5} />
        </button>
      </header>

      {/* Featured top row */}
      <section className="px-5 pt-3 pb-5">
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x">
          {featured.map((f, i) => (
            <button key={i} className="flex-none w-56 aspect-[5/4] rounded-lg overflow-hidden relative bg-secondary snap-start ring-1 ring-border">
              <img src={f.img} alt={f.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
              <div className="absolute top-3 left-3">
                {f.badge === "Pro" ? (
                  <div className="px-2.5 py-1 bg-white rounded-full text-[10px] font-extrabold text-foreground flex items-center gap-1 shadow">
                    <Sparkles className="size-3" /> Pro
                  </div>
                ) : (
                  <div className="text-white text-2xl font-black tracking-tight drop-shadow">{f.badge}</div>
                )}
              </div>
              <div className="absolute bottom-3 left-3 right-3 text-left">
                <div className="text-white/80 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <Aperture className="size-2.5" /> {f.kind}
                </div>
                <div className="text-white text-base font-extrabold leading-tight">{f.title}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Sections */}
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
                <button key={i} className="flex-none w-32 aspect-[4/5] snap-start rounded-lg overflow-hidden relative bg-secondary ring-1 ring-border">
                  <img src={p.img} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-left">
                    <div className="text-white/80 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <Aperture className="size-2.5" /> {s.kind}
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
