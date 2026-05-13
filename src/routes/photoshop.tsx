import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { SlidersHorizontal, ArrowRight } from "lucide-react";
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

const sections = [
  { title: "Birthday Photos", photos: [birthday, glam, cinema, anime] },
  { title: "Wedding Moments", photos: [wedding, vhs, glam, cinema] },
  { title: "Travel & Scenery", photos: [travel, cinema, anime, vhs] },
  { title: "Portrait Studio", photos: [portrait, glam, vhs, anime] },
  { title: "Everyday Life", photos: [everyday, anime, cinema, vhs] },
];

function Photoshop() {
  return (
    <MobileFrame>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="pt-10 pb-3 px-5 flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-tight">Photoshop</h1>
          <button className="size-8 rounded-full bg-secondary border border-border grid place-items-center">
            <SlidersHorizontal className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <div className="space-y-7 pb-6">
        {sections.map((s) => (
          <section key={s.title}>
            <div className="px-5 mb-2.5 flex justify-between items-center">
              <h3 className="text-sm font-extrabold tracking-tight">{s.title}</h3>
              <button className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary border border-border text-[10px] font-bold text-foreground hover:bg-foreground hover:text-background transition-colors">
                View All <ArrowRight className="size-3" strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex gap-2 px-5 overflow-x-auto no-scrollbar snap-x">
              {s.photos.map((p, i) => (
                <button key={i} className="flex-none w-24 snap-start group">
                  <div className="aspect-[9/16] rounded-xl overflow-hidden bg-secondary ring-1 ring-border shadow-sm transition-transform group-active:scale-95">
                    <img src={p} alt={s.title} loading="lazy" className="w-full h-full object-cover" />
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
