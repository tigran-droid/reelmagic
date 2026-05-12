import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Heart, MessageCircle, Send, Music2, Bookmark } from "lucide-react";
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

const reels = [
  {
    img: feed1,
    user: "@luna_ai",
    caption: "Trying out the new cinematic prompt for city nights. This looks insane.",
    audio: "Original Audio — Stardust",
    likes: "12.4k",
    comments: "432",
    template: "Neon Bloom",
  },
  {
    img: glam,
    user: "@elysia",
    caption: "Glam template hits different ✨ #AIArt",
    audio: "Hot Pink — synthwave mix",
    likes: "8.2k",
    comments: "211",
    template: "Ultra Glow",
  },
  {
    img: anime,
    user: "@kaito.dev",
    caption: "Anime me in Shibuya at 2am 🌃",
    audio: "Tokyo Drift — lo-fi",
    likes: "21.7k",
    comments: "1.1k",
    template: "Cyber City",
  },
  {
    img: cinema,
    user: "@mira",
    caption: "Golden hour, every hour.",
    audio: "Sun Sets Twice — original",
    likes: "5.6k",
    comments: "98",
    template: "16mm Film",
  },
];

function Feed() {
  return (
    <MobileFrame immersive>
      <div className="h-dvh overflow-y-scroll snap-y snap-mandatory no-scrollbar">
        {reels.map((r, i) => (
          <article
            key={i}
            className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-black"
          >
            <img
              src={r.img}
              alt={r.caption}
              loading={i === 0 ? "eager" : "lazy"}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />

            <div className="absolute top-14 left-0 right-0 flex justify-center gap-6 text-sm font-semibold text-white/70">
              <span>Following</span>
              <span className="text-white relative">
                For You
                <div className="absolute -bottom-2 inset-x-2 h-0.5 bg-white rounded-full" />
              </span>
            </div>

            <div className="absolute bottom-28 left-0 right-0 px-5 flex items-end justify-between gap-3">
              <div className="flex-1 text-white space-y-2">
                <p className="font-semibold">{r.user}</p>
                <p className="text-sm text-white/90 max-w-[28ch] leading-snug">{r.caption}</p>
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <Music2 className="size-3.5" />
                  <span className="truncate max-w-[20ch]">{r.audio}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/90 text-brand-foreground text-[11px] font-semibold mt-1">
                  Template · {r.template}
                </div>
              </div>

              <div className="flex flex-col items-center gap-5 text-white">
                <div className="size-11 rounded-full bg-white/15 backdrop-blur-md grid place-items-center border border-white/20">
                  <img src={feed1} alt="" className="size-full rounded-full object-cover" />
                </div>
                <Action icon={<Heart className="size-6" fill="white" />} label={r.likes} />
                <Action icon={<MessageCircle className="size-6" />} label={r.comments} />
                <Action icon={<Bookmark className="size-6" />} label="Save" />
                <Action icon={<Send className="size-6" />} label="Share" />
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
