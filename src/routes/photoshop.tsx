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
        <div className="pt-12 pb-4 px-6 flex items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">Photoshop</h1>
          <button className="size-9 rounded-full bg-secondary border border-border grid place-items-center">
            <SlidersHorizontal className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <div className="space-y-10 pb-6">
        {sections.map((s) => (
          <section key={s.title}>
            <div className="px-6 mb-3 flex justify-between items-end">
              <h3 className="text-lg font-extrabold tracking-tight">{s.title}</h3>
              <span className="text-[11px] font-bold text-brand">View All</span>
            </div>
            <div className="flex gap-3 px-6 overflow-x-auto no-scrollbar snap-x">
              {s.photos.map((p, i) => (
                <button key={i} className="flex-none w-40 snap-start">
                  <div className="aspect-[9/16] rounded-2xl overflow-hidden bg-secondary">
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
