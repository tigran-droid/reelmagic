import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { MapPin, TrendingUp, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import feed1 from "@/assets/feed-1.jpg";
import glam from "@/assets/reel-glam.jpg";
import anime from "@/assets/reel-anime.jpg";
import cinema from "@/assets/reel-cinema.jpg";
import vhs from "@/assets/reel-vhs.jpg";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: "Country Trends — Armenia" },
      { name: "description", content: "Trending AI reels in Armenia." },
    ],
  }),
  component: Trends,
});

type Tile = { cover: string; title: string; song?: string; hashtags: string[] };

const fallback: Tile[] = [
  { cover: feed1, title: "Neon city nights", song: "Stardust", hashtags: ["neon", "city", "ai"] },
  { cover: glam, title: "Glam hour", song: "Hot Pink", hashtags: ["glam", "beauty"] },
  { cover: anime, title: "Shibuya 2am", song: "Tokyo Drift", hashtags: ["anime", "tokyo"] },
  { cover: cinema, title: "Golden hour", song: "Sun Sets Twice", hashtags: ["cinema", "golden"] },
  { cover: vhs, title: "VHS dreams", song: "Tape Rewind", hashtags: ["vhs", "retro"] },
  { cover: glam, title: "Studio glow", song: "Aria", hashtags: ["studio", "portrait"] },
  { cover: anime, title: "Midnight bloom", song: "Neon Haze", hashtags: ["bloom", "night"] },
  { cover: cinema, title: "Mountain haze", song: "Echo Valley", hashtags: ["nature", "film"] },
];

const trendingTags = ["#aiart", "#glam", "#cinematic", "#anime", "#retro", "#portrait", "#neon", "#vhs"];

function Trends() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["trends-reels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map<Tile>((r) => ({
        cover: (r.image_urls && r.image_urls[0]) || r.image_url,
        title: r.title,
        song: r.song ?? undefined,
        hashtags: r.hashtags ?? [],
      }));
    },
    staleTime: 0,
  });

  const tiles = [...(data ?? []), ...fallback];

  const col1 = tiles.filter((_, i) => i % 2 === 0);
  const col2 = tiles.filter((_, i) => i % 2 === 1);

  // For desktop: 4-column masonry
  const dcol1 = tiles.filter((_, i) => i % 4 === 0);
  const dcol2 = tiles.filter((_, i) => i % 4 === 1);
  const dcol3 = tiles.filter((_, i) => i % 4 === 2);
  const dcol4 = tiles.filter((_, i) => i % 4 === 3);

  const open = () => navigate({ to: "/feed" });

  return (
    <MobileFrame>
      {/* ── Desktop header ── */}
      <header className="hidden md:block sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <MapPin className="size-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Local Trends</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span>🇦🇲</span> Armenia · Updated just now
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-orange-400" />
            <span className="text-sm font-semibold text-muted-foreground">Trending now</span>
          </div>
        </div>

        {/* Trending tags */}
        <div className="px-8 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
          {trendingTags.map((tag) => (
            <span
              key={tag}
              className="shrink-0 px-3 py-1 rounded-full bg-secondary text-xs font-semibold text-foreground border border-border hover:bg-brand/10 hover:text-brand hover:border-brand/30 cursor-pointer transition-colors"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      {/* ── Mobile header ── */}
      <div className="md:hidden sticky top-0 z-10 bg-background/90 backdrop-blur-md flex items-center gap-2 px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">🇦🇲</span>
          <h1 className="text-[16px] font-semibold">Country trends</h1>
        </div>
      </div>

      {/* ── Desktop masonry grid ── */}
      <div className="hidden md:block px-8 pt-6 pb-10">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="size-4 text-brand" />
          <span className="text-sm font-bold text-foreground">Top reels in your region</span>
          <span className="ml-auto text-xs text-muted-foreground">{tiles.length} reels</span>
        </div>
        <div className="grid grid-cols-4 gap-4 items-start">
          <div className="flex flex-col gap-4">
            {dcol1.map((t, i) => <TrendCard key={`d1-${i}`} tile={t} onClick={open} />)}
          </div>
          <div className="flex flex-col gap-4 mt-8">
            {dcol2.map((t, i) => <TrendCard key={`d2-${i}`} tile={t} onClick={open} />)}
          </div>
          <div className="flex flex-col gap-4">
            {dcol3.map((t, i) => <TrendCard key={`d3-${i}`} tile={t} onClick={open} />)}
          </div>
          <div className="flex flex-col gap-4 mt-12">
            {dcol4.map((t, i) => <TrendCard key={`d4-${i}`} tile={t} onClick={open} />)}
          </div>
        </div>
      </div>

      {/* ── Mobile masonry grid ── */}
      <div className="md:hidden px-3 pt-3 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-4">
            {col1.map((t, i) => <TrendCard key={`a-${i}`} tile={t} onClick={open} />)}
          </div>
          <div className="flex flex-col gap-4 pt-10">
            {col2.map((t, i) => <TrendCard key={`b-${i}`} tile={t} onClick={open} />)}
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}

function TrendCard({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left group active:scale-[0.98] transition-transform"
    >
      <div className="relative w-full overflow-hidden rounded-xl bg-secondary aspect-[9/16] shadow-sm ring-1 ring-border">
        <img
          src={tile.cover}
          alt={tile.title}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        {tile.hashtags.length > 0 && (
          <div className="absolute top-2 left-2">
            <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
              #{tile.hashtags[0]}
            </span>
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2">
          <div className="text-white text-[12px] font-bold leading-tight line-clamp-2">{tile.title}</div>
        </div>
      </div>
      {tile.song && (
        <div className="flex items-center gap-1.5 mt-2 px-0.5">
          <img src={tile.cover} alt="" className="size-5 rounded-full object-cover shrink-0" />
          <div className="text-muted-foreground text-[11px] truncate">{tile.song}</div>
        </div>
      )}
    </button>
  );
}
