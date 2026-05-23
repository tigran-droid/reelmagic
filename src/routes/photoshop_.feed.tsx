import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Heart, MessageCircle, Send, Bookmark, Sparkles, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Item = {
  id: string;
  images: string[];
  cover: string;
  title: string;
  hashtags: string[];
  song: string;
  audio?: string | null;
  audioStart: number;
  audioEnd: number | null;
  prompt?: string | null;
};

type FeedItemRow = {
  id: string;
  image_url: string;
  image_urls: string[] | null;
  title: string;
  hashtags: string[] | null;
  song: string | null;
  audio_url: string | null;
  audio_start_sec: number | string | null;
  audio_end_sec: number | string | null;
  prompt?: string | null;
  created_at: string;
};

const FEED_SELECT =
  "id,image_url,image_urls,title,hashtags,song,audio_url,audio_start_sec,audio_end_sec,prompt,created_at";
const FEED_PAGE_SIZE = 120;
const CACHE_TIME_MS = 5 * 60_000;
const UPLOAD_IMAGE_MAX_EDGE = 1024;
const UPLOAD_IMAGE_QUALITY = 0.78;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load selected image"));
    img.src = dataUrl;
  });
}

async function optimizeImageForUpload(file: File): Promise<string> {
  const originalDataUrl = await fileToDataUrl(file);

  try {
    const image = await loadImage(originalDataUrl);
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, UPLOAD_IMAGE_MAX_EDGE / Math.max(longestEdge, 1));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    if (scale === 1 && file.size < 800_000) return originalDataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return originalDataUrl;

    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", UPLOAD_IMAGE_QUALITY);
  } catch {
    return originalDataUrl;
  }
}

export const Route = createFileRoute("/photoshop_/feed")({
  validateSearch: (s: Record<string, unknown>) => ({
    item: typeof s.item === "string" ? s.item : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Photoshop feed — Magic Studio" },
      { name: "description", content: "Scroll the photoshop gallery." },
    ],
  }),
  component: PhotoshopFeed,
});

function PhotoshopFeed() {
  const navigate = useNavigate();
  const { item: targetId } = useSearch({ from: "/photoshop_/feed" });
  const [activeIndex, setActiveIndex] = useState(0);
  const [needsTapIndex, setNeedsTapIndex] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Item | null>(null);
  const didJumpRef = useRef(false);

  const q = useQuery({
    queryKey: ["photoshop-feed", targetId ?? null],
    queryFn: async () => {
      const feedQuery = supabase
        .from("photoshop_items")
        .select(FEED_SELECT)
        .order("created_at", { ascending: false })
        .range(0, FEED_PAGE_SIZE - 1);

      const [feedRes, targetRes] = await Promise.all([
        feedQuery,
        targetId
          ? supabase.from("photoshop_items").select(FEED_SELECT).eq("id", targetId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (feedRes.error) throw feedRes.error;
      if (targetRes.error) throw targetRes.error;

      const rows = [...((feedRes.data ?? []) as FeedItemRow[])];
      const targetRow = targetRes.data as FeedItemRow | null;
      if (targetRow && !rows.some((r) => r.id === targetRow.id)) {
        rows.unshift(targetRow);
      }

      return rows.map<Item>((r) => {
        const imgs = r.image_urls && r.image_urls.length > 0 ? r.image_urls : [r.image_url];
        return {
          id: r.id,
          images: imgs,
          cover: imgs[0],
          title: r.title,
          hashtags: r.hashtags ?? [],
          song: r.song ?? "Original audio",
          audio: r.audio_url,
          audioStart: Number(r.audio_start_sec ?? 0),
          audioEnd: r.audio_end_sec != null ? Number(r.audio_end_sec) : null,
          prompt: r.prompt ?? null,
        };
      });
    },
    staleTime: CACHE_TIME_MS,
    gcTime: CACHE_TIME_MS * 2,
    refetchOnWindowFocus: false,
  });

  const items = q.data ?? [];
  const active = items[activeIndex];

  // Jump to target item on first load
  useEffect(() => {
    if (didJumpRef.current || !targetId || items.length === 0) return;
    const idx = items.findIndex((i) => i.id === targetId);
    if (idx >= 0) {
      didJumpRef.current = true;
      setActiveIndex(idx);
      requestAnimationFrame(() => {
        const el = scrollerRef.current;
        if (el) el.scrollTo({ top: idx * el.clientHeight, behavior: "auto" });
      });
    }
  }, [items, targetId]);

  // Audio
  useEffect(() => {
    if (!active?.audio) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }
    audioRef.current?.pause();
    const player = new Audio(active.audio);
    audioRef.current = player;
    const startAt = active.audioStart || 0;
    const onLoaded = () => { try { player.currentTime = startAt; } catch { /* noop */ } };
    const onTime = () => {
      const stopAt = active.audioEnd ?? player.duration;
      if (stopAt && player.currentTime >= stopAt) {
        player.currentTime = startAt;
        player.play().catch(() => {});
      }
    };
    player.addEventListener("loadedmetadata", onLoaded);
    player.addEventListener("timeupdate", onTime);
    player.play().then(() => setNeedsTapIndex(null)).catch(() => setNeedsTapIndex(activeIndex));
    return () => {
      player.removeEventListener("loadedmetadata", onLoaded);
      player.removeEventListener("timeupdate", onTime);
      player.pause();
    };
  }, [active?.audio, active?.audioStart, active?.audioEnd, activeIndex]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || items.length === 0) return;
    const next = Math.round(el.scrollTop / el.clientHeight);
    const clamped = Math.max(0, Math.min(items.length - 1, next));
    if (clamped !== activeIndex) {
      setActiveIndex(clamped);
      setNeedsTapIndex(null);
    }
  };

  const startCreate = (it: Item) => {
    try {
      sessionStorage.setItem("create:draft", JSON.stringify({
        images: it.images, cover: it.cover, title: it.title, hashtags: it.hashtags,
        prompt: it.prompt ?? null,
      }));
    } catch { /* noop */ }
    pendingRef.current = it;
    fileInputRef.current?.click();
  };

  const onPickUserPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    e.target.value = "";
    if (files.length === 0) return;
    const dataUrls = await Promise.all(files.map(optimizeImageForUpload));
    sessionStorage.setItem("create:userImages", JSON.stringify(dataUrls));
    sessionStorage.setItem("create:autoRun", "1");
    navigate({ to: "/create" });
  };

  const toggleAudio = (i: number) => {
    if (i !== activeIndex) { setActiveIndex(i); return; }
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setNeedsTapIndex(null)).catch(() => setNeedsTapIndex(i));
    } else {
      a.pause();
      setNeedsTapIndex(i);
    }
  };

  if (items.length === 0) {
    return (
      <MobileFrame immersive>
        <div className="h-dvh flex items-center justify-center text-white/70 text-sm">
          {q.isLoading ? "Loading…" : "No photoshop content yet."}
        </div>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame immersive>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onPickUserPhotos} className="hidden" />
      <button
        onClick={() => navigate({ to: "/photoshop" })}
        className="fixed top-4 left-4 z-50 size-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
        aria-label="Back"
      >
        <ArrowLeft className="size-5" />
      </button>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="h-dvh overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {items.map((r, i) => (
          <ReelCard
            key={r.id}
            reel={r}
            eager={i === 0}
            visible={Math.abs(i - activeIndex) <= 1}
            active={i === activeIndex}
            needsTap={needsTapIndex === i}
            onToggleAudio={() => toggleAudio(i)}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/50" />
            <div className="absolute right-3 bottom-44 flex flex-col items-center gap-4 text-white">
              <Action icon={<Heart className="size-7" fill="white" />} label="0" />
              <Action icon={<MessageCircle className="size-7" />} label="0" />
              <Action icon={<Send className="size-7" />} label="Share" />
              <Action icon={<Bookmark className="size-7" />} label="Save" />
            </div>
            <div className="absolute bottom-28 left-0 right-0 px-5 space-y-3 text-white">
              <p className="text-[17px] font-semibold leading-tight tracking-tight drop-shadow">{r.title}</p>
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-white/85">
                {r.hashtags.map((h) => (<span key={h}>{h}</span>))}
              </div>
              <div className="flex items-center justify-between gap-3 pt-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); startCreate(r); }}
                  className="inline-flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-2xl bg-white text-black text-sm font-semibold shadow-lg shadow-black/20 active:scale-95 transition-transform"
                >
                  <Sparkles className="size-4" />
                  Create yours
                </button>
                <div className="flex items-center gap-2 min-w-0 max-w-[55%]">
                  <span className="text-[11px] text-white/85 truncate animate-[pulse_1.6s_ease-in-out_infinite]">♪ {r.song}</span>
                  <img src={r.cover} alt="" className="size-9 rounded-full object-cover border border-white/30 shadow-md shadow-black/30 shrink-0 animate-[spin_5s_linear_infinite]" />
                </div>
              </div>
            </div>
          </ReelCard>
        ))}
      </div>
    </MobileFrame>
  );
}

function ReelCard({ reel, eager, visible, active, needsTap, onToggleAudio, children }: {
  reel: Item; eager: boolean; visible: boolean; active: boolean; needsTap: boolean; onToggleAudio: () => void; children: React.ReactNode;
}) {
  return (
    <article onClick={onToggleAudio} className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-black">
      {visible ? (
        <>
          <PhotoCarousel reel={reel} eager={eager} active={active} />
          {children}
        </>
      ) : null}
      {needsTap && reel.audio && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm">
            Tap to play sound
          </div>
        </div>
      )}
    </article>
  );
}

function Action({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}

function PhotoCarousel({ reel, eager, active }: { reel: Item; eager: boolean; active: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = reel.images.length;
  useEffect(() => {
    if (count <= 1 || !active) return;
    const id = setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const next = (index + 1) % count;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 2500);
    return () => clearInterval(id);
  }, [index, count, active]);
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };
  return (
    <>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar"
      >
        {reel.images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={reel.title}
            loading={eager && i === 0 ? "eager" : "lazy"}
            decoding="async"
            className="w-full h-full flex-shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {count > 1 && (
        <div className="absolute bottom-[152px] left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-10">
          {reel.images.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
          ))}
        </div>
      )}
    </>
  );
}
