import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Search, Bell, Play } from "lucide-react";
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

const categories = ["Trending", "Glam", "Cinematic", "Anime", "Retro", "Cyber"];

const featured = {
  video: glam,
  title: "Ultra Glow",
  tag: "Glam · New",
  duration: "0:15",
  uses: "12.4k",
};

type Card = {
  video: string;
  title: string;
  tag: string;
  tagColor: string;
  duration?: string;
  uses?: string;
  ratio: string;
};

const colA: Card[] = [
  { video: anime, title: "Cyber City", tag: "Anime AI", tagColor: "text-brand", duration: "0:20", uses: "8.1k", ratio: "aspect-[9/16]" },
  { video: vhs, title: "Glitch Pulse", tag: "Retro", tagColor: "text-accent", duration: "0:10", uses: "2.4k", ratio: "aspect-square" },
  { video: glam, title: "Neon Bloom", tag: "Glam", tagColor: "text-brand", duration: "0:14", uses: "6.2k", ratio: "aspect-[9/14]" },
];

const colB: Card[] = [
  { video: cinema, title: "Golden Hour", tag: "Cinematic", tagColor: "text-accent", duration: "0:12", uses: "5.4k", ratio: "aspect-[9/15]" },
  { video: vhs, title: "Synthwave", tag: "Retro", tagColor: "text-accent", duration: "0:15", uses: "3.1k", ratio: "aspect-[9/16]" },
  { video: anime, title: "Tokyo 88", tag: "Anime", tagColor: "text-brand", duration: "0:13", uses: "3.5k", ratio: "aspect-square" },
];


function TemplateCard({ card }: { card: Card }) {
  return (
    <button className="block w-full text-left">
      <div className={`relative ${card.ratio} rounded-[2rem] overflow-hidden bg-card border border-border/60 group`}>
        <video
          src=""
          poster={card.video}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        {card.duration && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-bold text-white tabular-nums">
            {card.duration}
          </div>
        )}
        <div className="absolute bottom-3.5 left-3.5 right-3.5">
          <span className={`text-[8px] font-black uppercase tracking-tighter ${card.tagColor}`}>{card.tag}</span>
          <h4 className="text-sm font-bold text-white leading-tight">{card.title}</h4>
          {card.uses && <p className="text-[9px] text-white/60 font-medium mt-0.5">{card.uses} uses</p>}
        </div>
      </div>
    </button>
  );
}

function Categories() {
  return (
    <MobileFrame>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="pt-12 pb-3 px-6 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold tracking-[0.3em] text-muted-foreground uppercase block mb-0.5">
              Explore
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
                  : "bg-secondary/60 text-muted-foreground border border-border/60"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Featured */}
      <section className="px-6 mb-10">
        <button className="relative w-full aspect-[1.6/1] rounded-[2.5rem] overflow-hidden bg-card ring-1 ring-border shadow-2xl group text-left">
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

          <div className="absolute top-5 left-5">
            <div className="px-3 py-1 bg-accent text-accent-foreground text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg">
              <span className="size-1.5 bg-accent-foreground rounded-full" /> Featured
            </div>
          </div>

          <div className="absolute top-5 right-5 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-bold text-white tabular-nums">
            {featured.duration}
          </div>

          <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end gap-3">
            <div>
              <span className="text-brand text-[10px] font-black uppercase tracking-widest">{featured.tag}</span>
              <h2 className="text-2xl font-extrabold text-white leading-tight">{featured.title}</h2>
              <p className="text-white/60 text-[10px] font-medium mt-0.5">{featured.uses} creators using</p>
            </div>
            <button className="size-14 bg-brand rounded-2xl grid place-items-center shadow-[0_8px_24px_color-mix(in_oklab,var(--brand)_50%,transparent)] rotate-3 hover:rotate-0 transition-transform">
              <Play className="size-6 fill-brand-foreground text-brand-foreground" />
            </button>
          </div>
        </button>
      </section>

      {/* Staggered grid */}
      <section className="px-6 pb-8">
        <div className="flex justify-between items-end mb-5">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight">Trending now</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Most generated this week</p>
          </div>
          <button className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-1 hover:text-foreground transition-colors">
            See all →
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-3">
            {colA.map((c, i) => <TemplateCard key={i} card={c} />)}
          </div>
          <div className="flex-1 flex flex-col gap-3 pt-8">
            {colB.map((c, i) => <TemplateCard key={i} card={c} />)}
          </div>
        </div>
      </section>

      {/* Browse categories — Asymmetric Mosaic Flow */}
      <section className="px-5 pb-10">
        <div className="flex items-end justify-between mb-5 px-1">
          <h3 className="text-2xl font-extrabold tracking-tight">Browse categories</h3>
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest pb-1">Explore</span>
        </div>

        <div className="relative grid grid-cols-12 gap-3">
          {/* Glam — featured top */}
          <button className="col-span-12 relative overflow-hidden rounded-[2rem] border border-border/60 aspect-[16/9] shadow-2xl shadow-brand/10 group text-left">
            <img src={glam} alt="Glam" className="absolute inset-0 w-full h-full object-cover object-[50%_30%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute bottom-5 left-6">
              <p className="text-2xl font-extrabold text-white leading-tight">Glam</p>
              <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 mt-2">
                <p className="text-brand text-[10px] font-bold uppercase tracking-wider">1.2k reels</p>
              </div>
            </div>
          </button>

          {/* Cinematic — main anchor (tall, overlap up) */}
          <button className="col-span-7 relative overflow-hidden rounded-[2rem] border border-border/60 aspect-[3/4.5] -mt-4 z-10 shadow-2xl shadow-black group text-left">
            <img src={cinema} alt="Cinematic" className="absolute inset-0 w-full h-full object-cover object-[70%_50%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5">
              <p className="text-lg font-bold text-white">Cinematic</p>
              <p className="text-white/60 text-[11px] mt-0.5 font-medium">860 reels</p>
            </div>
          </button>

          {/* Anime — high position */}
          <button className="col-span-5 relative overflow-hidden rounded-[1.75rem] border border-border/60 aspect-square group text-left">
            <img src={anime} alt="Anime" className="absolute inset-0 w-full h-full object-cover object-[30%_40%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-3.5 left-4">
              <p className="text-base font-bold text-white">Anime</p>
              <p className="text-white/60 text-[10px] font-medium">940 reels</p>
            </div>
          </button>

          {/* Retro — middle floating, offset */}
          <button className="col-span-5 col-start-8 relative overflow-hidden rounded-[1.75rem] border border-border/60 aspect-square -mt-6 z-20 shadow-xl group text-left">
            <img src={vhs} alt="Retro" className="absolute inset-0 w-full h-full object-cover object-[50%_70%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-3.5 left-4">
              <p className="text-base font-bold text-white">Retro</p>
              <p className="text-white/60 text-[10px] font-medium">510 reels</p>
            </div>
          </button>

          {/* Cyber — interlocking banner */}
          <button className="col-span-12 relative overflow-hidden rounded-[2rem] border border-border/60 aspect-[21/10] -mt-2 shadow-2xl shadow-accent/10 group text-left">
            <img src={anime} alt="Cyber" className="absolute inset-0 w-full h-full object-cover object-[80%_20%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/40 to-transparent" />
            <div className="absolute inset-y-0 left-7 flex flex-col justify-center">
              <p className="text-2xl font-extrabold text-white tracking-tight uppercase italic">Cyber</p>
              <p className="text-brand text-[10px] font-bold tracking-tighter mt-1">720 REELS COLLECTED</p>
            </div>
          </button>

          {/* Portrait — large foundation */}
          <button className="col-span-12 relative overflow-hidden rounded-[2.25rem] border border-border/60 aspect-square group text-left">
            <img src={glam} alt="Portrait" className="absolute inset-0 w-full h-full object-cover object-[50%_80%] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-8">
              <p className="text-4xl font-extrabold text-white tracking-tighter">Portrait</p>
              <p className="text-brand text-sm font-bold mt-2">1.5k creators</p>
            </div>
          </button>
        </div>
      </section>
    </MobileFrame>
  );
}
