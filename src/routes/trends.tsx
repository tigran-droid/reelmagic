import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Image as ImageIcon } from "lucide-react";

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

function Trends() {
  const navigate = useNavigate();

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
  const skeletons = Array.from({ length: 10 });

  const open = (id: string) => navigate({ to: "/photoshop/feed", search: { item: id, from: "local" } });

  return (
    <MobileFrame>
      <div className="min-h-screen bg-[#f5f5f7]">

        {/* ── Header ── */}
        <div className="sticky top-0 z-20 bg-[#f5f5f7]/98 backdrop-blur-md border-b border-black/5">
          <div className="px-4 md:px-5 pt-12 md:pt-5 pb-4 max-w-[1280px] mx-auto w-full">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Local</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">Trending AI photo templates</p>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="mx-auto max-w-[1280px] px-1.5 md:px-5 pt-1.5 md:pt-5 pb-36 md:pb-10">
          {isPending ? (
            <div className="columns-2 md:columns-4 lg:columns-5 gap-1.5 md:gap-3">
              {skeletons.map((_, i) => (
                <div
                  key={i}
                  className="mb-1.5 md:mb-3 break-inside-avoid w-full rounded-lg bg-gray-200 aspect-[9/16] animate-pulse"
                />
              ))}
            </div>
          ) : tiles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <ImageIcon className="size-10 text-gray-300" />
              <p className="text-sm font-semibold text-gray-500">No templates yet</p>
              <p className="text-xs text-gray-400">Add some from the admin panel</p>
            </div>
          ) : (
            <div className="columns-2 md:columns-4 lg:columns-5 gap-1.5 md:gap-3">
              {tiles.map((t) => (
                <TrendCard key={t.id} tile={t} onClick={() => open(t.id)} />
              ))}
            </div>
          )}
        </div>


      </div>
    </MobileFrame>
  );
}

function TrendCard({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-1.5 md:mb-3 break-inside-avoid w-full text-left active:scale-[0.97] transition-transform">
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
