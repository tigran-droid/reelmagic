import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Search, Bell, ChevronRight, Video as VideoIcon, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import glam from "@/assets/reel-glam.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Videos — Magic Studio" },
      { name: "description", content: "Browse AI reel templates: glam, cinematic, anime, retro and more." },
    ],
  }),
  component: Categories,
});

type VideoItem = {
  id: string;
  title: string;
  hashtags: string[];
  song: string | null;
  cover_image_url: string;
  sample_video_url: string | null;
  prompt: string;
  position: number;
  created_at: string;
};

function Categories() {
  const navigate = useNavigate();
  const { data: videos, isLoading } = useQuery({
    queryKey: ["home-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_items")
        .select("*")
        .order("position")
        .order("created_at");
      if (error) throw error;
      return data as VideoItem[];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const openVideo = (v: VideoItem) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("video-create:item", JSON.stringify(v));
    }
    navigate({ to: "/video-create" });
  };

  const featured = videos?.[0];

  return (
    <MobileFrame>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="pt-12 pb-3 px-6 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold tracking-[0.3em] text-muted-foreground uppercase block mb-0.5">
              Videos
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">Templates</h1>
          </div>
          <div className="flex gap-2.5">
            <button className="size-10 rounded-full bg-secondary/60 grid place-items-center border border-border/60">
              <Search className="size-4" strokeWidth={2.5} />
            </button>
            <button className="size-10 rounded-full bg-secondary/60 grid place-items-center border border-border/60 relative">
              <Bell className="size-4" strokeWidth={2.5} />
              <span className="absolute top-2 right-2 size-2 rounded-full bg-brand ring-2 ring-background" />
            </button>
          </div>
        </div>
      </header>

      {isLoading && (
        <div className="flex-1 grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (!videos || videos.length === 0) && (
        <div className="px-6 pt-10 text-center">
          <img src={glam} alt="" className="w-full aspect-video object-cover rounded-md opacity-30 mb-4" />
          <p className="text-sm text-muted-foreground">
            No videos yet. Add some in the admin panel.
          </p>
        </div>
      )}

      {!isLoading && featured && (
        <section className="px-6 pt-5 mb-8">
          <button
            onClick={() => openVideo(featured)}
            className="relative w-full aspect-video rounded-md overflow-hidden bg-card ring-1 ring-border shadow-2xl group text-left"
          >
            {featured.sample_video_url ? (
              <video
                src={featured.sample_video_url}
                poster={featured.cover_image_url}
                autoPlay muted loop playsInline
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <img
                src={featured.cover_image_url}
                alt={featured.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <h2 className="text-2xl font-extrabold text-white leading-tight">{featured.title}</h2>
              {featured.song && (
                <p className="text-white/60 text-[10px] font-medium mt-0.5">{featured.song}</p>
              )}
            </div>
          </button>
        </section>
      )}

      {!isLoading && videos && videos.length > 1 && (
        <div className="pb-6">
          <section className="px-5">
            <div className="mb-3 flex justify-between items-center">
              <h3 className="text-[19px] font-extrabold tracking-tight">All videos</h3>
              <button className="flex items-center gap-0.5 px-3 py-1 rounded-full border border-border text-[11px] font-bold text-foreground">
                All <ChevronRight className="size-3" strokeWidth={3} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {videos.slice(1).map((v) => (
                <button
                  key={v.id}
                  onClick={() => openVideo(v)}
                  className="w-full aspect-[9/12] rounded-md overflow-hidden relative bg-secondary ring-1 ring-border text-left"
                >
                  {v.sample_video_url ? (
                    <video
                      src={v.sample_video_url}
                      poster={v.cover_image_url}
                      muted loop playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={v.cover_image_url}
                      alt={v.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="text-white/80 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <VideoIcon className="size-2.5" /> Video
                    </div>
                    <div className="text-white text-sm font-extrabold leading-tight">{v.title}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </MobileFrame>
  );
}
