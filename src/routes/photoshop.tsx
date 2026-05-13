import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Search, Bell, Wand2, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
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

const categories = ["Trending", "Glam", "Nature", "Street", "Portrait", "B&W"];

const featured = {
  img: glam,
  title: "Velvet Glow",
  tag: "Portrait · New",
  edits: "0 edits",
  uses: "9.4k",
};

const everyday = [
  { img: glam, name: "Sunlight Glow" },
  { img: cinema, name: "Grainy Film" },
  { img: anime, name: "Urban Soft" },
  { img: vhs, name: "Warm Pastel" },
];

const portraits = [
  { img: glam, name: "B&W Class", active: true },
  { img: cinema, name: "Deep Focus" },
  { img: anime, name: "Vivid Skin" },
  { img: vhs, name: "Studio" },
];

const travel = [
  { img: cinema, name: "Alpine" },
  { img: vhs, name: "Mist" },
  { img: anime, name: "Coast" },
];

function Photoshop() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string>(featured.img);
  const [filter, setFilter] = useState({ brightness: 100, contrast: 100, saturate: 100 });

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setSrc(URL.createObjectURL(f));
  };

  return (
    <MobileFrame>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="pt-12 pb-3 px-6 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold tracking-[0.3em] text-muted-foreground uppercase block mb-0.5">
              Photoshop
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">Presets</h1>
          </div>
          <div className="flex gap-2.5">
            <button className="size-10 rounded-full bg-secondary grid place-items-center border border-border">
              <Search className="size-4" strokeWidth={2.5} />
            </button>
            <button className="size-10 rounded-full bg-secondary grid place-items-center border border-border relative">
              <Bell className="size-4" strokeWidth={2.5} />
              <span className="absolute top-2 right-2 size-2 rounded-full bg-brand ring-2 ring-background" />
            </button>
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto px-6 py-5 no-scrollbar">
        {categories.map((c, i) => {
          const active = i === 0;
          return (
            <button
              key={c}
              className={`px-5 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-colors ${
                active
                  ? "bg-brand text-brand-foreground shadow-[0_0_20px_color-mix(in_oklab,var(--brand)_40%,transparent)]"
                  : "bg-secondary text-muted-foreground border border-border"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Featured — editable photo */}
      <section className="px-6 mb-10">
        <div className="relative w-full aspect-[1.6/1] rounded-[2.5rem] overflow-hidden bg-card ring-1 ring-border shadow-2xl group text-left">
          <img
            src={src}
            alt={featured.title}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-300"
            style={{ filter: `brightness(${filter.brightness}%) contrast(${filter.contrast}%) saturate(${filter.saturate}%)` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

          <div className="absolute top-5 left-5">
            <div className="px-3 py-1 bg-accent text-accent-foreground text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg">
              <Wand2 className="size-3" /> Live Edit
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute top-5 right-5 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-full border border-white/40 text-[10px] font-bold text-foreground flex items-center gap-1.5 shadow"
          >
            <ImagePlus className="size-3.5" /> Change
          </button>

          <div className="absolute bottom-5 left-5 right-5 bg-white/90 backdrop-blur-xl rounded-2xl p-3 border border-white/60 shadow-xl space-y-2">
            <Slider label="Light" value={filter.brightness} onChange={(v) => setFilter({ ...filter, brightness: v })} />
            <Slider label="Contrast" value={filter.contrast} onChange={(v) => setFilter({ ...filter, contrast: v })} />
            <Slider label="Color" value={filter.saturate} onChange={(v) => setFilter({ ...filter, saturate: v })} />
          </div>
        </div>
      </section>

      {/* Everyday Moments — soft rectangle row */}
      <section className="mt-6 mb-8">
        <div className="px-6 flex justify-between items-end mb-4">
          <h3 className="text-lg font-extrabold tracking-tight">Everyday Moments</h3>
          <span className="text-[11px] font-bold text-brand">View All</span>
        </div>
        <div className="flex gap-4 px-6 overflow-x-auto no-scrollbar snap-x">
          {everyday.map((p, i) => (
            <button key={i} className="flex-none w-32 snap-start text-left">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden mb-2 bg-secondary">
                <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">{p.name}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Portrait Styles — circles */}
      <section className="mb-8">
        <div className="px-6 flex justify-between items-end mb-4">
          <h3 className="text-lg font-extrabold tracking-tight">Portrait Styles</h3>
        </div>
        <div className="flex gap-6 px-6 overflow-x-auto no-scrollbar">
          {portraits.map((p, i) => (
            <button key={i} className="flex-none text-center">
              <div className={`size-20 rounded-full overflow-hidden p-1 mb-2 border-2 ${p.active ? "border-brand/50" : "border-secondary"}`}>
                <img src={p.img} alt={p.name} className="w-full h-full object-cover rounded-full" />
              </div>
              <p className={`text-[10px] font-bold uppercase tracking-tight ${p.active ? "text-foreground" : "text-muted-foreground"}`}>{p.name}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Travel & Scenery — squares with overlay caption */}
      <section className="mb-12">
        <div className="px-6 flex justify-between items-end mb-4">
          <h3 className="text-lg font-extrabold tracking-tight">Travel & Scenery</h3>
        </div>
        <div className="flex gap-3 px-6 overflow-x-auto no-scrollbar">
          {travel.map((p, i) => (
            <button key={i} className="flex-none w-[160px] aspect-square rounded-xl overflow-hidden relative bg-secondary">
              <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/40 backdrop-blur-md rounded text-[9px] font-bold text-white uppercase">
                {p.name}
              </div>
            </button>
          ))}
        </div>
      </section>
    </MobileFrame>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground w-16">{label}</span>
      <input
        type="range"
        min={0}
        max={200}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-brand h-1"
      />
      <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-8 text-right">{value}</span>
    </div>
  );
}
