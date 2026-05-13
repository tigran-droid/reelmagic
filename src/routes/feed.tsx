import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Heart, MessageCircle, Send, Bookmark, Sparkles } from "lucide-react";
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
  const reels = tab === "global" ? globalReels : regionalReels;

  return (
    <MobileFrame immersive>
      <div
        key={tab}
        className="h-dvh overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {reels.map((r, i) => (
          <article
            key={i}
            className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-black"
          >
            <img
              src={r.img}
              alt={r.title}
              loading={i === 0 ? "eager" : "lazy"}
              className="absolute inset-0 w-full h-full object-cover"
            />
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
            <div className="absolute right-3 bottom-44 flex flex-col items-center gap-2 text-white">
              <Action icon={<Heart className="size-6" fill="white" />} label={r.likes} />
              <Action icon={<MessageCircle className="size-6" />} label={r.comments} />
              <Action icon={<Send className="size-6" />} label="Share" />
              <Action icon={<Bookmark className="size-6" />} label="Save" />
            </div>

            {/* Bottom info block */}
            <div className="absolute bottom-28 left-0 right-0 px-5 space-y-2.5 text-white">
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
                  className="inline-flex items-center gap-1.5 pl-3 pr-4 py-2 rounded-full bg-white text-black text-xs font-semibold shadow-lg shadow-black/20 opacity-70 cursor-not-allowed"
                >
                  <Sparkles className="size-3.5" />
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
          </article>
        ))}
      </div>
    </MobileFrame>
  );
}

function Action({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex flex-col items-center gap-1">
      <div className="size-11 rounded-full bg-white/10 backdrop-blur-md grid place-items-center border border-white/15 active:scale-95 transition-transform">
        {icon}
      </div>
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}
