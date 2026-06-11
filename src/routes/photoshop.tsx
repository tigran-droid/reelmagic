import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { InstallCard } from "@/components/InstallPrompt";
import { ChevronRight, Sparkles, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/photoshop")({
  head: () => ({
    meta: [
      { title: "Photoshop — Magic Studio" },
      { name: "description", content: "Edit and beautify your photos with AI presets." },
    ],
  }),
  component: Photoshop,
});

type ItemRow = {
  id: string;
  section_id: string;
  title: string;
  hashtags: string[];
  song: string | null;
  image_url: string;
  image_urls: string[];
  position: number;
  created_at: string;
};
type SectionRow = {
  id: string;
  title: string;
  position: number;
  created_at: string;
};

const SECTION_SELECT = "id,title,position,created_at";
const ITEM_SELECT = "id,section_id,title,hashtags,song,image_url,image_urls,position,created_at";
const MAX_SECTIONS = 20;
const MAX_ITEMS = 240;
const CACHE_TIME_MS = 5 * 60_000;

function Photoshop() {
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ["photoshop-sections"],
    queryFn: async () => {
      const [secRes, itemRes] = await Promise.all([
        supabase
          .from("photoshop_sections")
          .select(SECTION_SELECT)
          .order("position")
          .order("created_at")
          .limit(MAX_SECTIONS),
        supabase
          .from("photoshop_items")
          .select(ITEM_SELECT)
          .order("position")
          .order("created_at")
          .limit(MAX_ITEMS),
      ]);
      if (secRes.error) throw secRes.error;
      if (itemRes.error) throw itemRes.error;
      const itemsBySection = new Map<string, ItemRow[]>();
      for (const item of itemRes.data as ItemRow[]) {
        const sectionItems = itemsBySection.get(item.section_id) ?? [];
        sectionItems.push(item);
        itemsBySection.set(item.section_id, sectionItems);
      }
      const sections = (secRes.data as SectionRow[]).map((s) => ({
        ...s,
        items: itemsBySection.get(s.id) ?? [],
      }));
      return sections;
    },
    staleTime: CACHE_TIME_MS,
    gcTime: CACHE_TIME_MS * 2,
    refetchOnWindowFocus: false,
  });

  const sections = q.data ?? [];
  // Featured: first item of first two non-empty sections
  const featured = sections
    .map((s) => s.items[0])
    .filter(Boolean)
    .slice(0, 2);

  const goItem = (id: string) => navigate({ to: "/photoshop/feed", search: { item: id } });

  return (
    <MobileFrame>
      <header className="px-5 pt-8 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Photoshop</h1>
        <button className="size-9 rounded-full bg-secondary border border-border flex items-center justify-center">
          <SlidersHorizontal className="size-4" strokeWidth={2.5} />
        </button>
      </header>

      {featured.length > 0 && (
        <section className="px-5 pt-3 pb-5">
          <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x">
            {featured.map((f, i) => (
              <button
                key={f.id}
                onClick={() => goItem(f.id)}
                className="flex-none w-56 aspect-[5/4] rounded-md overflow-hidden relative bg-secondary snap-start ring-1 ring-border"
              >
                <img
                  src={f.image_url}
                  alt={f.title}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={i === 0 ? "high" : "auto"}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                <div className="absolute top-3 left-3">
                  <div className="px-2.5 py-1 bg-white rounded-full text-[10px] font-extrabold text-foreground flex items-center gap-1 shadow">
                    <Sparkles className="size-3" /> {i === 0 ? "Pro" : "New"}
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 right-3 text-left">
                  <div className="text-white text-base font-extrabold leading-tight">{f.title}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <InstallCard />

      <div className="space-y-7 pb-6">
        {sections.map((s) => (
          <section key={s.id} className="px-5">
            <div className="mb-3 flex justify-between items-center">
              <h3 className="text-[19px] font-extrabold tracking-tight">{s.title}</h3>
              <button className="flex items-center gap-0.5 px-3 py-1 rounded-full border border-border text-[11px] font-bold text-foreground">
                All <ChevronRight className="size-3" strokeWidth={3} />
              </button>
            </div>
            {s.items.length === 0 ? (
              <div className="text-xs text-muted-foreground">No photos yet.</div>
            ) : (
              <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x">
                {s.items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => goItem(p.id)}
                    className="flex-none w-32 aspect-[5/6] snap-start rounded-md overflow-hidden relative bg-secondary ring-1 ring-border"
                  >
                    <img
                      src={p.image_url}
                      alt={p.title}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-left">
                      <div className="text-white text-sm font-extrabold leading-tight">{p.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
        {sections.length === 0 && !q.isLoading && (
          <div className="px-5 text-sm text-muted-foreground">
            No sections yet. Add some from the admin panel.
          </div>
        )}
      </div>
    </MobileFrame>
  );
}
