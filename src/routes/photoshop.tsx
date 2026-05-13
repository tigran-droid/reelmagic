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

const categories = ["Trending", "Portrait", "Color Pop", "B&W", "Retouch", "Sky"];

const featured = {
  img: glam,
  title: "Velvet Glow",
  tag: "Portrait · New",
  edits: "0 edits",
  uses: "9.4k",
};

type Card = {
  img: string;
  title: string;
  tag: string;
  tagColor: string;
  uses?: string;
  ratio: string;
};

const colA: Card[] = [
  { img: anime, title: "Pop Anime", tag: "Stylize", tagColor: "text-brand", uses: "4.2k", ratio: "aspect-[9/16]" },
  { img: vhs, title: "Retro Grain", tag: "Vintage", tagColor: "text-accent", uses: "2.8k", ratio: "aspect-square" },
  { img: glam, title: "Studio Skin", tag: "Retouch", tagColor: "text-brand", uses: "5.7k", ratio: "aspect-[9/14]" },
];

const colB: Card[] = [
  { img: cinema, title: "Golden Film", tag: "Cinematic", tagColor: "text-accent", uses: "6.1k", ratio: "aspect-[9/15]" },
  { img: vhs, title: "Mono Drama", tag: "B&W", tagColor: "text-accent", uses: "1.9k", ratio: "aspect-[9/16]" },
  { img: anime, title: "Color Pop", tag: "Vivid", tagColor: "text-brand", uses: "3.5k", ratio: "aspect-square" },
];

function PresetCard({ card }: { card: Card }) {
  return (
    <button className="block w-full text-left">
      <div className={`relative ${card.ratio} rounded-[2rem] overflow-hidden bg-card border border-border group`}>
        <img
          src={card.img}
          alt={card.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-bold text-white">
          AI
        </div>
        <div className="absolute bottom-3.5 left-3.5 right-3.5">
          <span className={`text-[8px] font-black uppercase tracking-tighter ${card.tagColor}`}>{card.tag}</span>
          <h4 className="text-sm font-bold text-white leading-tight">{card.title}</h4>
          {card.uses && <p className="text-[9px] text-white/70 font-medium mt-0.5">{card.uses} uses</p>}
        </div>
      </div>
    </button>
  );
}

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

      {/* Staggered grid */}
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
            {colA.map((c, i) => <PresetCard key={i} card={c} />)}
          </div>
          <div className="flex-1 flex flex-col gap-3 pt-8">
            {colB.map((c, i) => <PresetCard key={i} card={c} />)}
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
