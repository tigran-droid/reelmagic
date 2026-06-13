import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Image as ImageIcon, Plus, Mic, X } from "lucide-react";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: "Local Trends — Magic Studio" },
      { name: "description", content: "Trending AI photo templates." },
    ],
  }),
  component: Trends,
});

type Tile = { cover: string; title: string; hashtags: string[] };

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
        .select("id,title,hashtags,image_url,image_urls")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data.map<Tile>((r) => ({
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

  const open = () => navigate({ to: "/photoshop" });

  return (
    <MobileFrame>
      <div className="min-h-screen bg-[#f5f5f7]">

        {/* ── Header ── */}
        <div className="sticky top-0 z-20 bg-[#f5f5f7]/95 backdrop-blur-sm">
          {/* Tab row */}
          <div className="flex items-center gap-1 px-3 pt-12 md:pt-5 pb-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => navigate({ to: "/photoshop" })}
              className="size-9 grid place-items-center shrink-0 mr-1"
            >
              <X className="size-5 text-black" strokeWidth={2.5} />
            </button>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 px-3 py-2 text-[15px] font-semibold relative transition-colors ${
                  activeTab === tab ? "text-black" : "text-gray-400"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-black" />
                )}
              </button>
            ))}
          </div>

          {/* Pills row */}
          <div className="flex gap-2 px-3 py-2.5 overflow-x-auto no-scrollbar">
            {PILLS.map((pill) => (
              <button
                key={pill}
                onClick={() => setActivePill(pill)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-semibold border transition-all ${
                  activePill === pill
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-gray-200"
                }`}
              >
                {pill}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="px-2.5 pt-1 pb-36">
          {isPending ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-2.5">
                {skeletons.slice(0, 3).map((_, i) => (
                  <div key={i} className="w-full rounded-2xl bg-gray-200 aspect-[3/4] animate-pulse" />
                ))}
              </div>
              <div className="flex flex-col gap-2.5 pt-10">
                {skeletons.slice(3).map((_, i) => (
                  <div key={i} className="w-full rounded-2xl bg-gray-200 aspect-[3/4] animate-pulse" />
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
            <div className="grid grid-cols-2 gap-2.5">
              {/* col 1 — normal */}
              <div className="flex flex-col gap-2.5">
                {col1.map((t, i) => (
                  <TrendCard key={`a-${i}`} tile={t} onClick={open} />
                ))}
              </div>
              {/* col 2 — staggered down */}
              <div className="flex flex-col gap-2.5 pt-10">
                {col2.map((t, i) => (
                  <TrendCard key={`b-${i}`} tile={t} onClick={open} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom input bar ── */}
        <div className="fixed bottom-[72px] md:bottom-4 left-0 right-0 max-w-[480px] mx-auto px-3 z-20">
          <div
            onClick={open}
            className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-md border border-gray-100 cursor-pointer"
          >
            <button className="size-7 grid place-items-center text-black shrink-0">
              <Plus className="size-5" strokeWidth={2.5} />
            </button>
            <span className="flex-1 text-[15px] text-gray-400 select-none">Enter your ideas</span>
            <button className="size-10 grid place-items-center rounded-full bg-black text-white shrink-0">
              <Mic className="size-4" />
            </button>
          </div>
        </div>

      </div>
    </MobileFrame>
  );
}

function TrendCard({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left active:scale-[0.97] transition-transform">
      {/* Image */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-gray-200 aspect-[3/4] shadow-sm">
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
