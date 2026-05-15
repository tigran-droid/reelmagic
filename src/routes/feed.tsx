import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
  img: string;
  cover: string;
  title: string;
  hashtags: string[];
  song: string;
  likes: string;
  comments: string;
  audio?: string | null;
};

const globalReels: Reel[] = [
  {
    img: feed1,
    cover: feed1,
    title: "Neon city nights",
    hashtags: ["#cinematic", "#neon", "#aiart"],
    song: "Stardust — Luna",
    likes: "12.4k",
    comments: "432",
  },
  {
    img: glam,
    cover: glam,
    title: "Glam hour glow up",
    hashtags: ["#glam", "#portrait", "#studio"],
    song: "Hot Pink — Synthwave",
    likes: "8.2k",
    comments: "211",
  },
  {
    img: anime,
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
    img: cinema,
    cover: cinema,
    title: "Golden hour, every hour",
    hashtags: ["#local", "#goldenhour", "#film"],
    song: "Sun Sets Twice — Mira",
    likes: "5.6k",
    comments: "98",
  },
  {
    img: glam,
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

  const dbReels = useQuery({
    queryKey: ["feed-reels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map<Reel>((r) => ({
        img: r.image_url,
        cover: r.image_url,
        title: r.title,
        hashtags: r.hashtags ?? [],
        song: r.song ?? "Original audio",
        likes: "0",
        comments: "0",
        audio: r.audio_url,
      }));
    },
  });

  const reels =
    tab === "global"
      ? [...(dbReels.data ?? []), ...globalReels]
      : regionalReels;

  return (
    <MobileFrame immersive>
      <div
        key={tab}
        className="h-dvh overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {reels.map((r, i) => (
          <ReelCard key={i} reel={r} eager={i === 0}>
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
                  disabled
                  aria-disabled="true"
                  className="inline-flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-2xl bg-white text-black text-sm font-semibold shadow-lg shadow-black/20 opacity-70 cursor-not-allowed"
                >
                  <Sparkles className="size-4" />
                  Create yours
                </button>

                <div className="flex items-center gap-2 min-w-0 max-w-[55%]">
                  <span className="text-[11px] text-white/85 truncate">{r.song}</span>
                  <img
                    src={r.cover}
                    alt=""
                    className="size-9 rounded-[6px] object-cover border border-white/25 shadow-md shadow-black/30 shrink-0"
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
  children,
}: {
  reel: Reel;
  eager: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLMediaElement>(null);

  useEffect(() => {
    const el = ref.current;
    const audio = audioRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!audio) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <article
      ref={ref}
      className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-black"
    >
      <img
        src={reel.img}
        alt={reel.title}
        loading={eager ? "eager" : "lazy"}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {reel.audio && (
        /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(reel.audio) ? (
          <video
            ref={audioRef as React.RefObject<HTMLVideoElement>}
            src={reel.audio}
            loop
            preload="auto"
            playsInline
            className="hidden"
          />
        ) : (
          <audio
            ref={audioRef as React.RefObject<HTMLAudioElement>}
            src={reel.audio}
            loop
            preload="auto"
          />
        )
      )}
      {children}
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
