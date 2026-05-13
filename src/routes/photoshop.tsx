import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { SlidersHorizontal } from "lucide-react";
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
  { title: "Birthday Photos", photos: [glam, cinema, anime] },
  { title: "Wedding Moments", photos: [vhs, glam, cinema] },
  { title: "Travel & Scenery", photos: [cinema, anime] },
  { title: "Portrait Studio", photos: [glam, vhs, anime] },
  { title: "Everyday Life", photos: [anime, cinema, vhs] },
];

function Photoshop() {
  return (
    <MobileFrame>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="pt-10 pb-3 px-5 flex items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-tight">Photoshop</h1>
          <button className="size-7 rounded-full bg-secondary border border-border grid place-items-center">
            <SlidersHorizontal className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <div className="space-y-6 pb-6">
        {sections.map((s) => (
          <section key={s.title}>
            <div className="px-5 mb-2 flex justify-between items-end">
              <h3 className="text-sm font-extrabold tracking-tight">{s.title}</h3>
              <span className="text-[10px] font-bold text-brand">View All</span>
            </div>
            <div className="flex gap-2 px-5 overflow-x-auto no-scrollbar snap-x">
              {s.photos.map((p, i) => (
                <button key={i} className="flex-none w-24 snap-start">
                  <div className="aspect-[9/16] rounded-xl overflow-hidden bg-secondary">
                    <img src={p} alt={s.title} className="w-full h-full object-cover" />
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
