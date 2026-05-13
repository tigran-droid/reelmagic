import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Search, Bell, Sparkles, Wand2, Sun, Eraser, Palette, Crop, Layers, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import glam from "@/assets/reel-glam.jpg";
import anime from "@/assets/reel-anime.jpg";
import vhs from "@/assets/reel-vhs.jpg";
import cinema from "@/assets/reel-cinema.jpg";
import avatar from "@/assets/avatar.jpg";

export const Route = createFileRoute("/photoshop")({
  head: () => ({
    meta: [
      { title: "Photoshop — Magic Studio" },
      { name: "description", content: "Edit and beautify your photos with AI presets." },
    ],
  }),
  component: Photoshop,
});

const categories = ["Trending", "Portrait", "Color Pop", "B&W", "Retouch", "Sky"];

const tools = [
  { icon: Sparkles, label: "Enhance" },
  { icon: Sun, label: "Light" },
  { icon: Palette, label: "Color" },
  { icon: Eraser, label: "Cleanup" },
  { icon: Crop, label: "Crop" },
  { icon: Layers, label: "Layers" },
];

const presets = [
  { img: glam, name: "Velvet Glow", tag: "Portrait", uses: "9.4k", ratio: "aspect-[9/16]" },
  { img: cinema, name: "Golden Film", tag: "Cinematic", uses: "6.1k", ratio: "aspect-square" },
  { img: anime, name: "Pop Anime", tag: "Stylize", uses: "4.2k", ratio: "aspect-[9/14]" },
  { img: vhs, name: "Retro Grain", tag: "Vintage", uses: "2.8k", ratio: "aspect-[9/15]" },
  { img: avatar, name: "Studio Skin", tag: "Retouch", uses: "5.7k", ratio: "aspect-[9/16]" },
  { img: glam, name: "Mono Drama", tag: "B&W", uses: "1.9k", ratio: "aspect-square" },
];

function Photoshop() {
  const [active, setActive] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string>(avatar);
  const [filter, setFilter] = useState({ brightness: 100, contrast: 100, saturate: 100 });

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setSrc(URL.createObjectURL(f));
  };

  return (
    <MobileFrame>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="pt-12 pb-3 px-6 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold tracking-[0.3em] text-muted-foreground uppercase block mb-0.5">
              Photoshop
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">Edit Photos</h1>
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
          const isActive = active ? active === c : i === 0;
          return (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`px-5 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-brand text-brand-foreground shadow-[0_0_20px_color-mix(in_oklab,var(--brand)_40%,transparent)]"
                  : "bg-secondary text-muted-foreground border border-border"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <section className="px-6 mb-8">
        <div className="relative w-full aspect-[1.1/1] rounded-[2.5rem] overflow-hidden bg-card ring-1 ring-border shadow-2xl">
          <img
            src={src}
            alt="Edit preview"
            className="absolute inset-0 w-full h-full object-cover transition-all"
            style={{ filter: `brightness(${filter.brightness}%) contrast(${filter.contrast}%) saturate(${filter.saturate}%)` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

          <div className="absolute top-5 left-5">
            <div className="px-3 py-1 bg-accent text-accent-foreground text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg">
              <Wand2 className="size-3" /> Live Edit
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute top-5 right-5 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full border border-white/40 text-[10px] font-bold text-foreground flex items-center gap-1.5 shadow"
          >
            <ImagePlus className="size-3.5" /> Upload
          </button>

          <div className="absolute bottom-5 left-5 right-5 bg-white/85 backdrop-blur-xl rounded-2xl p-3.5 border border-white/60 shadow-xl space-y-2.5">
            <Slider label="Brightness" value={filter.brightness} onChange={(v) => setFilter({ ...filter, brightness: v })} />
            <Slider label="Contrast" value={filter.contrast} onChange={(v) => setFilter({ ...filter, contrast: v })} />
            <Slider label="Saturation" value={filter.saturate} onChange={(v) => setFilter({ ...filter, saturate: v })} />
          </div>
        </div>

        {/* Tools row */}
        <div className="mt-5 grid grid-cols-6 gap-2">
          {tools.map(({ icon: Icon, label }) => (
            <button key={label} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-secondary border border-border hover:border-brand transition-colors">
              <Icon className="size-4 text-brand" strokeWidth={2.5} />
              <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Presets — staggered grid */}
      <section className="px-6 pb-8">
        <div className="flex justify-between items-end mb-5">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight">Trending presets</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">One-tap looks crafted by AI</p>
          </div>
          <button className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-1 hover:text-foreground transition-colors">
            See all →
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-3">
            {presets.slice(0, 3).map((p, i) => <PresetCard key={i} preset={p} />)}
          </div>
          <div className="flex-1 flex flex-col gap-3 pt-8">
            {presets.slice(3).map((p, i) => <PresetCard key={i} preset={p} />)}
          </div>
        </div>
      </section>

      {/* Browse styles — Asymmetric Mosaic Flow */}
      <section className="px-5 pb-10">
        <div className="flex items-end justify-between mb-5 px-1">
          <h3 className="text-2xl font-extrabold tracking-tight">Browse styles</h3>
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest pb-1">Edit</span>
        </div>

        <div className="relative grid grid-cols-12 gap-3">
          <button className="col-span-12 relative overflow-hidden rounded-[2rem] border border-border aspect-[16/9] shadow-2xl shadow-brand/10 group text-left">
            <img src={glam} alt="Portrait" className="absolute inset-0 w-full h-full object-cover object-[50%_30%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
            <div className="absolute bottom-5 left-6">
              <p className="text-2xl font-extrabold text-white leading-tight">Portrait</p>
              <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/15 mt-2">
                <p className="text-white text-[10px] font-bold uppercase tracking-wider">1.2k presets</p>
              </div>
            </div>
          </button>

          <button className="col-span-7 relative overflow-hidden rounded-[2rem] border border-border aspect-[3/4.5] -mt-4 z-10 shadow-2xl group text-left">
            <img src={cinema} alt="Cinematic" className="absolute inset-0 w-full h-full object-cover object-[70%_50%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5">
              <p className="text-lg font-bold text-white">Cinematic</p>
              <p className="text-white/70 text-[11px] mt-0.5 font-medium">860 looks</p>
            </div>
          </button>

          <button className="col-span-5 relative overflow-hidden rounded-[1.75rem] border border-border aspect-square group text-left">
            <img src={anime} alt="Stylize" className="absolute inset-0 w-full h-full object-cover object-[30%_40%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
            <div className="absolute bottom-3.5 left-4">
              <p className="text-base font-bold text-white">Stylize</p>
              <p className="text-white/70 text-[10px] font-medium">540 looks</p>
            </div>
          </button>

          <button className="col-span-5 col-start-8 relative overflow-hidden rounded-[1.75rem] border border-border aspect-square -mt-6 z-20 shadow-xl group text-left">
            <img src={vhs} alt="Vintage" className="absolute inset-0 w-full h-full object-cover object-[50%_70%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
            <div className="absolute bottom-3.5 left-4">
              <p className="text-base font-bold text-white">Vintage</p>
              <p className="text-white/70 text-[10px] font-medium">410 looks</p>
            </div>
          </button>

          <button className="col-span-12 relative overflow-hidden rounded-[2rem] border border-border aspect-[21/10] -mt-2 shadow-2xl shadow-accent/10 group text-left">
            <img src={anime} alt="Color Pop" className="absolute inset-0 w-full h-full object-cover object-[80%_20%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
            <div className="absolute inset-y-0 left-7 flex flex-col justify-center">
              <p className="text-2xl font-extrabold text-white tracking-tight uppercase italic">Color Pop</p>
              <p className="text-white text-[10px] font-bold tracking-tighter mt-1">620 PRESETS</p>
            </div>
          </button>

          <button className="col-span-12 relative overflow-hidden rounded-[2.25rem] border border-border aspect-square group text-left">
            <img src={glam} alt="Studio" className="absolute inset-0 w-full h-full object-cover object-[50%_80%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-8">
              <p className="text-4xl font-extrabold text-white tracking-tighter">Studio</p>
              <p className="text-white text-sm font-bold mt-2">1.5k creators</p>
            </div>
          </button>
        </div>
      </section>
    </MobileFrame>
  );
}

function PresetCard({ preset }: { preset: { img: string; name: string; tag: string; uses: string; ratio: string } }) {
  return (
    <button className="block w-full text-left">
      <div className={`relative ${preset.ratio} rounded-[2rem] overflow-hidden bg-card border border-border group`}>
        <img src={preset.img} alt={preset.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-bold text-white">
          AI
        </div>
        <div className="absolute bottom-3.5 left-3.5 right-3.5">
          <span className="text-[8px] font-black uppercase tracking-tighter text-brand">{preset.tag}</span>
          <h4 className="text-sm font-bold text-white leading-tight">{preset.name}</h4>
          <p className="text-[9px] text-white/70 font-medium mt-0.5">{preset.uses} uses</p>
        </div>
      </div>
    </button>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground w-20">{label}</span>
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