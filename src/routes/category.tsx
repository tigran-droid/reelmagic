import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Image as ImageIcon, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/category")({
  validateSearch: (s: Record<string, unknown>) => ({
    section: typeof s.section === "string" ? s.section : "",
  }),
  head: () => ({
    meta: [
      { title: "Category — Magic Studio" },
      { name: "description", content: "All templates in this category." },
    ],
  }),
  component: Category,
});

type Tile = { id: string; cover: string; title: string };

function Category() {
  const navigate = useNavigate();
  const { section } = useSearch({ from: "/category" });

  const { data, isPending } = useQuery({
    queryKey: ["category", section],
    enabled: !!section,
    queryFn: async () => {
      const [secRes, itemRes] = await Promise.all([
        supabase.from("photoshop_sections").select("title").eq("id", section).maybeSingle(),
        supabase
          .from("photoshop_items")
          .select("id,title,image_url,image_urls,position,created_at")
          .eq("section_id", section)
          .order("position")
          .order("created_at"),
      ]);
      if (itemRes.error) throw itemRes.error;
      const tiles = (itemRes.data ?? []).map<Tile>((r) => ({
        id: r.id,
        cover: (r.image_urls && r.image_urls[0]) || r.image_url,
        title: r.title,
      }));
      return { title: (secRes.data as { title?: string } | null)?.title ?? "Category", tiles };
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  const title = data?.title ?? "Category";
  const tiles = data?.tiles ?? [];
  const skeletons = Array.from({ length: 10 });

  const open = (id: string) => navigate({ to: "/photoshop/feed", search: { item: id, from: undefined } });

  return (
    <MobileFrame>
      <div className="min-h-screen bg-[#f5f5f7]">

        {/* ── Header (Local-page style) ── */}
        <div className="sticky top-0 z-20 bg-[#f5f5f7]/98 backdrop-blur-md border-b border-black/5">
          <div className="px-4 md:px-5 pt-12 md:pt-5 pb-4 max-w-[1280px] mx-auto w-full flex items-center gap-3">
            <button
              onClick={() => navigate({ to: "/photoshop" })}
              className="size-9 -ml-1 rounded-full flex items-center justify-center text-gray-700 hover:bg-black/5 shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 truncate">{title}</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">All templates in this category</p>
            </div>
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
              <p className="text-sm font-semibold text-gray-500">No templates here yet</p>
              <p className="text-xs text-gray-400">Add some from the admin panel</p>
            </div>
          ) : (
            <div className="columns-2 md:columns-4 lg:columns-5 gap-1.5 md:gap-3">
              {tiles.map((t) => (
                <CategoryCard key={t.id} tile={t} onClick={() => open(t.id)} />
              ))}
            </div>
          )}
        </div>

      </div>
    </MobileFrame>
  );
}

function CategoryCard({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-1.5 md:mb-3 break-inside-avoid w-full text-left active:scale-[0.97] transition-transform">
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

        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
          <Wand2 className="size-2.5 text-white" strokeWidth={2.5} />
          <span className="text-white text-[9px] font-bold tracking-wide">Magic</span>
        </div>
      </div>

      <p className="mt-1.5 px-0.5 text-[13px] font-semibold text-gray-900 leading-tight line-clamp-1">
        {tile.title}
      </p>
    </button>
  );
}
