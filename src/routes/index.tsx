import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Sparkles } from "lucide-react";
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

const categories = ["All Styles", "Glam", "Cinematic", "Anime", "Retro", "Cyber"];

const sections = [
  {
    title: "Trending Reels",
    items: [
      { img: glam, title: "Ultra Glow", tag: "Glam" },
      { img: anime, title: "Cyber City", tag: "Anime AI" },
    ],
  },
  {
    title: "Cinematic",
    items: [
      { img: cinema, title: "Golden Hour", tag: "16mm" },
      { img: vhs, title: "VHS Memory", tag: "Retro" },
    ],
  },
  {
    title: "Retro Vibe",
    items: [
      { img: vhs, title: "90s Camcorder", tag: "VHS" },
      { img: glam, title: "Neon Bloom", tag: "Glam" },
    ],
  },
];

function Categories() {
  return (
    <MobileFrame>
      <header className="pt-12 px-6 pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1 flex items-center gap-1.5">
          <Sparkles className="size-3 text-brand" /> AI Generation
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Magic Studio</h1>
      </header>

      <div className="px-6 mb-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map((c, i) => (
            <button
              key={c}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                i === 0
                  ? "bg-brand text-brand-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h2>
              <button className="text-xs text-brand font-medium">See all</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {section.items.map((item, i) => (
                <button key={i} className="relative group text-left">
                  <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-card outline outline-1 -outline-offset-1 outline-white/10">
                    <img
                      src={item.img}
                      alt={item.title}
                      loading="lazy"
                      width={576}
                      height={1024}
                      className="w-full h-full object-cover transition-transform group-active:scale-95"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-2xl pointer-events-none" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[10px] uppercase tracking-widest text-white/60">{item.tag}</p>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
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
