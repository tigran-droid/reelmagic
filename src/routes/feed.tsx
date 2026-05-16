import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Heart, MessageCircle, Send, Bookmark, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import feed1 from "@/assets/feed-1.jpg";
import glam from "@/assets/reel-glam.jpg";
import anime from "@/assets/reel-anime.jpg";
import cinema from "@/assets/reel-cinema.jpg";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Feed — Magic Studio" },
      { name: "description", content: "Scroll AI-generated reels from creators around the world." },
    ],
  }),
  component: Feed,
});

type Reel = {
  images: string[];
  cover: string;
  title: string;
  hashtags: string[];
  song: string;
  likes: string;
  comments: string;
  audio?: string | null;
  audioStart?: number;
  audioEnd?: number | null;
};

const globalReels: Reel[] = [
  {
    images: [feed1],
    cover: feed1,
    title: "Neon city nights",
    hashtags: ["#cinematic", "#neon", "#aiart"],
    song: "Stardust — Luna",
    likes: "12.4k",
    comments: "432",
  },
  {
    images: [glam],
    cover: glam,
    title: "Glam hour glow up",
    hashtags: ["#glam", "#portrait", "#studio"],
    song: "Hot Pink — Synthwave",
    likes: "8.2k",
    comments: "211",
  },
  {
    images: [anime],
    cover: anime,
    title: "Shibuya at 2am",
    hashtags: ["#anime", "#tokyo", "#night"],
    song: "Tokyo Drift — Lo-fi",
    likes: "21.7k",
    comments: "1.1k",
  },
];

const regionalReels: Reel[] = [
  {
    images: [cinema],
    cover: cinema,
    title: "Golden hour, every hour",
    hashtags: ["#local", "#goldenhour", "#film"],
    song: "Sun Sets Twice — Mira",
    likes: "5.6k",
    comments: "98",
  },
  {
    images: [glam],
    cover: glam,
    title: "Hometown glow",
    hashtags: ["#regional", "#portrait"],
    song: "Local Tape — Aria",
    likes: "3.1k",
    comments: "74",
  },
];

function Feed() {
  const [tab, setTab] = useState<"global" | "regional">("global");
  const [activeIndex, setActiveIndex] = useState(0);
  const [needsTapIndex, setNeedsTapIndex] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();

  const startCreate = (reel: Reel) => {
    try {
      sessionStorage.setItem(
        "create:draft",
        JSON.stringify({
          images: reel.images,
          cover: reel.cover,
          title: reel.title,
          hashtags: reel.hashtags,
        }),
      );
    } catch {
      // ignore storage errors
    }
    navigate({ to: "/create" });
  };

  const dbReels = useQuery({
    queryKey: ["feed-reels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map<Reel>((r) => {
        const imgs =
          r.image_urls && r.image_urls.length > 0
            ? r.image_urls
            : [r.image_url];
        return {
          images: imgs,
          cover: imgs[0],
          title: r.title,
          hashtags: r.hashtags ?? [],
          song: r.song ?? "Original audio",
          likes: "0",
          comments: "0",
          audio: r.audio_url,
          audioStart: Number(r.audio_start_sec ?? 0),
          audioEnd: r.audio_end_sec != null ? Number(r.audio_end_sec) : null,
        };
      });
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const reels =
    tab === "global"
      ? [...(dbReels.data ?? []), ...globalReels]
      : regionalReels;
  const activeReel = reels[activeIndex];
  const activeAudioUrl = activeReel?.audio ?? null;
  const activeAudioStart = activeReel?.audioStart ?? 0;
  const activeAudioEnd = activeReel?.audioEnd ?? null;

  useEffect(() => {
    setActiveIndex(0);
    setNeedsTapIndex(null);
    scrollerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [tab]);

  useEffect(() => {
    const audioUrl = activeAudioUrl;

    if (!audioUrl) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }

    const existing = audioRef.current;
    if (existing) {
      existing.pause();
      existing.currentTime = 0;
    }

    const player = new Audio(audioUrl);
    player.loop = false;
    player.preload = "auto";
    audioRef.current = player;

    const startAt = activeAudioStart || 0;
    const onLoaded = () => {
      try { player.currentTime = startAt; } catch { /* noop */ }
    };
    const onTime = () => {
      const stopAt = activeAudioEnd ?? player.duration;
      if (stopAt && player.currentTime >= stopAt) {
        player.currentTime = startAt;
        player.play().catch(() => {});
      }
    };
    player.addEventListener("loadedmetadata", onLoaded);
    player.addEventListener("timeupdate", onTime);

    player.play().then(() => {
      setNeedsTapIndex((current) => (current === activeIndex ? null : current));
    }).catch(() => {
      setNeedsTapIndex(activeIndex);
    });

    return () => {
      player.removeEventListener("loadedmetadata", onLoaded);
      player.removeEventListener("timeupdate", onTime);
      player.pause();
      player.currentTime = 0;
      if (audioRef.current === player) {
        audioRef.current = null;
      }
    };
  }, [activeAudioUrl, activeAudioStart, activeAudioEnd, activeIndex, reels.length]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || reels.length === 0) return;
    const nextIndex = Math.round(el.scrollTop / el.clientHeight);
    const clamped = Math.max(0, Math.min(reels.length - 1, nextIndex));
    if (clamped !== activeIndex) {
      setActiveIndex(clamped);
      setNeedsTapIndex(null);
    }
  };

  const handleToggleAudio = (index: number) => {
    const currentAudio = audioRef.current;
    if (index !== activeIndex) {
      setActiveIndex(index);
      setNeedsTapIndex(null);
      return;
    }

    if (!currentAudio) return;

    if (currentAudio.paused) {
      currentAudio.currentTime = activeAudioStart || 0;
      currentAudio.play().then(() => {
        setNeedsTapIndex(null);
      }).catch(() => {
        setNeedsTapIndex(index);
      });
      return;
    }

    currentAudio.pause();
    setNeedsTapIndex(index);
  };

  return (
    <MobileFrame immersive>
      <div
        ref={scrollerRef}
        key={tab}
        onScroll={handleScroll}
        className="h-dvh overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {reels.map((r, i) => (
          <ReelCard
            key={`${r.cover}-${i}`}
            reel={r}
            eager={i === 0}
            needsTap={needsTapIndex === i}
            onToggleAudio={() => handleToggleAudio(i)}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/50" />

            {/* Top tabs */}
            <div className="absolute top-14 left-0 right-0 flex justify-center gap-8 text-sm font-semibold">
              {(["global", "regional"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative capitalize ${tab === t ? "text-white" : "text-white/60"}`}
                >
                  {t}
                  {tab === t && (
                    <div className="absolute -bottom-2 inset-x-2 h-0.5 bg-white rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Right action rail — grouped tight */}
            <div className="absolute right-3 bottom-44 flex flex-col items-center gap-4 text-white">
              <Action icon={<Heart className="size-7" fill="white" />} label={r.likes} />
              <Action icon={<MessageCircle className="size-7" />} label={r.comments} />
              <Action icon={<Send className="size-7" />} label="Share" />
              <Action icon={<Bookmark className="size-7" />} label="Save" />
            </div>

            {/* Bottom info block */}
            <div className="absolute bottom-28 left-0 right-0 px-5 space-y-3 text-white">
              <p className="text-[17px] font-semibold leading-tight tracking-tight drop-shadow">
                {r.title}
              </p>
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-white/85">
                {r.hashtags.map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startCreate(r);
                  }}
                  className="inline-flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-2xl bg-white text-black text-sm font-semibold shadow-lg shadow-black/20 active:scale-95 transition-transform"
                >
                  <Sparkles className="size-4" />
                  Create yours
                </button>

                <div className="flex items-center gap-2 min-w-0 max-w-[55%]">
                  <span className="text-[11px] text-white/85 truncate animate-[pulse_1.6s_ease-in-out_infinite]">
                    ♪ {r.song}
                  </span>
                  <img
                    src={r.cover}
                    alt=""
                    className="size-9 rounded-full object-cover border border-white/30 shadow-md shadow-black/30 shrink-0 animate-[spin_5s_linear_infinite]"
                  />
                </div>
              </div>
            </div>
          </ReelCard>
        ))}
      </div>
    </MobileFrame>
  );
}

function ReelCard({
  reel,
  eager,
  needsTap,
  onToggleAudio,
  children,
}: {
  reel: Reel;
  eager: boolean;
  needsTap: boolean;
  onToggleAudio: () => void;
  children: React.ReactNode;
}) {
  return (
    <article
      onClick={onToggleAudio}
      className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-black"
    >
      <PhotoCarousel reel={reel} eager={eager} />
      {children}
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

function PhotoCarousel({ reel, eager }: { reel: Reel; eager: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = reel.images.length;

  // Auto-advance every 2.5s if more than one photo
  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const next = (index + 1) % count;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 2500);
    return () => clearInterval(id);
  }, [index, count]);

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
            className="w-full h-full flex-shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {count > 1 && (
        <div className="absolute bottom-[152px] left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-10">
          {reel.images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}

