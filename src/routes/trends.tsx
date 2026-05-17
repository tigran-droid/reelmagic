import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { ChevronLeft, Play } from "lucide-react";
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
];

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

  // split into two columns, offset second column for staggered look
  const col1 = tiles.filter((_, i) => i % 2 === 0);
  const col2 = tiles.filter((_, i) => i % 2 === 1);

  const open = () => navigate({ to: "/feed" });

  return (
    <MobileFrame>
      <div className="bg-white min-h-full">
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md flex items-center gap-2 px-3 py-3 border-b border-black/5">
          <Link to="/tools" className="text-neutral-900 -ml-1 p-1">
            <ChevronLeft className="size-6" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-lg">🇦🇲</span>
            <h1 className="text-neutral-900 text-[16px] font-semibold">Country trends</h1>
          </div>
        </div>

        <div className="px-3 pt-3 pb-6 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-4">
            {col1.map((t, i) => (
              <TrendCard key={`a-${i}`} tile={t} tall={i % 2 === 0} onClick={open} />
            ))}
          </div>
          <div className="flex flex-col gap-4 pt-8">
            {col2.map((t, i) => (
              <TrendCard key={`b-${i}`} tile={t} tall={i % 2 === 1} onClick={open} />
            ))}
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}

function TrendCard({ tile, tall, onClick }: { tile: Tile; tall: boolean; onClick: () => void }) {
  const tagText = tile.hashtags.length
    ? tile.hashtags.slice(0, 3).map((h) => `#${h}`).join(" ")
    : "";
  return (
    <button onClick={onClick} className="w-full text-left active:scale-[0.98] transition-transform">
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-neutral-100 ${
          tall ? "aspect-[3/5]" : "aspect-[3/4]"
        }`}
      >
        <img
          src={tile.cover}
          alt={tile.title}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute top-2 right-2 size-7 rounded-full bg-black/40 backdrop-blur-sm grid place-items-center">
          <Play className="size-3.5 text-white fill-white" />
        </div>
      </div>
      <div className="pt-2">
        <div className="text-neutral-900 text-[13px] font-semibold leading-tight line-clamp-2">
          {tile.title}
        </div>
        {tagText && (
          <div className="text-neutral-500 text-[11px] mt-0.5 truncate">{tagText}</div>
        )}
        {tile.song && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <img
              src={tile.cover}
              alt=""
              className="size-5 rounded-full object-cover"
            />
            <div className="text-neutral-600 text-[11px] truncate">{tile.song}</div>
          </div>
        )}
      </div>
    </button>
  );
}
