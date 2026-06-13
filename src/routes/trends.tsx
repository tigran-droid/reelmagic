import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Image as ImageIcon, X } from "lucide-react";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: "Local Trends — Magic Studio" },
      { name: "description", content: "Trending AI photo templates." },
    ],
  }),
  component: Trends,
});

type Tile = { id: string; cover: string; title: string; hashtags: string[] };

const TABS = ["All", "Photo", "AI trends", "Portrait"];
const PILLS = ["For You", "Trending", "New", "Cinematic", "Retro", "Anime"];

function Trends() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("All");
  const [activePill, setActivePill] = useState("For You");

  const { data, isPending } = useQuery({
    queryKey: ["trends-reels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reels")
        .select("id,title,hashtags,image_url,image_urls,created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data.map<Tile>((r) => ({
        id: r.id,
        cover: (r.image_urls && r.image_urls[0]) || r.image_url,
        title: r.title,
        hashtags: r.hashtags ?? [],
      }));
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  const tiles = data ?? [];
  const col1 = tiles.filter((_, i) => i % 2 === 0);
  const col2 = tiles.filter((_, i) => i % 2 === 1);
  const skeletons = Array.from({ length: 6 });

  const open = (id: string) => navigate({ to: "/photoshop/feed", search: { item: id, from: "local" } });

  return (
    <MobileFrame>
      <div className="min-h-screen bg-[#f5f5f7]">

        {/* ── Header ── */}
        <div className="sticky top-0 z-20 bg-[#f5f5f7]/98 backdrop-blur-md border-b border-black/5">
          {/* Tab row */}
          <div className="flex items-center px-4 pt-12 md:pt-5 border-b border-black/5">
            {/* X close button */}
            <button
              onClick={() => navigate({ to: "/photoshop" })}
              className="size-8 grid place-items-center shrink-0 mr-3 rounded-full bg-black/6 text-black active:bg-black/10 transition-colors"
            >
              <X className="size-4" strokeWidth={2.5} />
            </button>

            {/* Tabs */}
            <div className="flex items-end flex-1 overflow-x-auto no-scrollbar gap-0">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 px-3.5 pb-2.5 pt-1 text-[14px] font-semibold relative transition-colors ${
                    activeTab === tab ? "text-black" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-black" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Pills row */}
          <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto no-scrollbar">
            {PILLS.map((pill) => (
              <button
                key={pill}
                onClick={() => setActivePill(pill)}
                className={`shrink-0 px-3.5 py-1 rounded-full text-[12.5px] font-semibold transition-all ${
                  activePill === pill
                    ? "bg-black text-white shadow-sm"
                    : "bg-white text-gray-700 border border-gray-200 shadow-sm"
                }`}
              >
                {pill}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="px-1.5 pt-1.5 pb-36">
          {isPending ? (
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex flex-col gap-1.5">
                {skeletons.slice(0, 3).map((_, i) => (
                  <div key={i} className="w-full rounded-lg bg-gray-200 aspect-[9/16] animate-pulse" />
                ))}
              </div>
              <div className="flex flex-col gap-1.5 pt-10">
                {skeletons.slice(3).map((_, i) => (
                  <div key={i} className="w-full rounded-lg bg-gray-200 aspect-[9/16] animate-pulse" />
                ))}
              </div>
            </div>
          ) : tiles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <ImageIcon className="size-10 text-gray-300" />
              <p className="text-sm font-semibold text-gray-500">No templates yet</p>
              <p className="text-xs text-gray-400">Add some from the admin panel</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {/* col 1 — normal */}
              <div className="flex flex-col gap-1.5">
                {col1.map((t, i) => (
                  <TrendCard key={`a-${i}`} tile={t} onClick={() => open(t.id)} />
                ))}
              </div>
              {/* col 2 — staggered down */}
              <div className="flex flex-col gap-1.5 pt-10">
                {col2.map((t, i) => (
                  <TrendCard key={`b-${i}`} tile={t} onClick={() => open(t.id)} />
                ))}
              </div>
            </div>
          )}
        </div>


      </div>
    </MobileFrame>
  );
}

function TrendCard({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left active:scale-[0.97] transition-transform">
      {/* Image */}
      <div className="relative w-full rounded-lg overflow-hidden bg-gray-200 aspect-[9/16] shadow-sm">
        {tile.cover ? (
          <img
            src={tile.cover}
            alt={tile.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="size-8 text-gray-300" />
          </div>
        )}

        {/* Magic Studio watermark — top left */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
          <Wand2 className="size-2.5 text-white" strokeWidth={2.5} />
          <span className="text-white text-[9px] font-bold tracking-wide">Magic</span>
        </div>

        {/* Template icon — top right */}
        <div className="absolute top-2 right-2 size-6 rounded-lg bg-black/30 backdrop-blur-sm grid place-items-center">
          <ImageIcon className="size-3 text-white" />
        </div>
      </div>

      {/* Title below image — dark text on light bg */}
      <p className="mt-1.5 px-0.5 text-[13px] font-semibold text-gray-900 leading-tight line-clamp-1">
        {tile.title}
      </p>
    </button>
  );
}
