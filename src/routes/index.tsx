import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { AuthModal } from "@/components/AuthModal";
import { PaywallModal } from "@/components/PaywallModal";
import { useAuth, VIDEO_COST } from "@/lib/auth-context";
import {
  Search, Bell, ChevronRight, Video as VideoIcon, Loader2,
  Upload, X, Coins, Clock,
} from "lucide-react";
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

const UPLOAD_IMAGE_MAX_EDGE = 1536;
const UPLOAD_IMAGE_QUALITY = 0.82;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

async function optimizeImage(file: File): Promise<string> {
  const raw = await fileToDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("load failed"));
      i.src = raw;
    });
    const scale = Math.min(1, UPLOAD_IMAGE_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight, 1));
    if (scale === 1 && file.size < 1_500_000) return raw;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", UPLOAD_IMAGE_QUALITY);
  } catch {
    return raw;
  }
}

// ── Upload sheet ──────────────────────────────────────────────────────────────

function VideoUploadSheet({
  template,
  onClose,
}: {
  template: VideoItem;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { user, credits } = useAuth();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 1);
    e.target.value = "";
    if (!files.length) return;

    if (!user) { setShowAuth(true); return; }
    if (credits < VIDEO_COST) { setShowPaywall(true); return; }

    setLoading(true);
    try {
      const urls = await Promise.all(files.map(optimizeImage));
      sessionStorage.setItem("video-create:item", JSON.stringify(template));
      sessionStorage.setItem("video-create:userImages", JSON.stringify(urls));
      navigate({ to: "/video-create" });
    } catch {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto bg-background rounded-t-3xl overflow-hidden shadow-2xl">
        {/* Handle + close */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="w-10 h-1 rounded-full bg-border mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <div />
          <button onClick={onClose} className="size-8 grid place-items-center rounded-full bg-secondary text-muted-foreground ml-auto">
            <X className="size-4" />
          </button>
        </div>

        {/* Template preview */}
        <div className="px-5 pb-3">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black">
            {template.sample_video_url ? (
              <video
                src={template.sample_video_url}
                poster={template.cover_image_url}
                autoPlay muted loop playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img src={template.cover_image_url} alt={template.title} className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-4">
              <p className="text-white font-extrabold text-lg leading-tight">{template.title}</p>
              {template.song && (
                <p className="text-white/60 text-[11px]">{template.song}</p>
              )}
            </div>
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-4 px-5 py-3 border-y border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-amber-500" />
            <span><strong className="text-foreground">{VIDEO_COST}</strong> credits</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>~2 minutes to generate</span>
          </div>
          <div className="ml-auto text-xs text-muted-foreground font-medium">
            {credits} credits left
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pt-5 pb-8">
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Upload a clear photo of yourself — the AI will place you in this video style.
          </p>

          <button
            onClick={() => pickerRef.current?.click()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-brand hover:bg-brand/90 text-white font-bold text-base py-4 rounded-2xl shadow-lg shadow-brand/30 transition-colors disabled:opacity-70"
          >
            {loading
              ? <><Loader2 className="size-5 animate-spin" /> Preparing…</>
              : <><Upload className="size-5" /> Upload your photo</>
            }
          </button>
        </div>

        <input ref={pickerRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} defaultMode="signup" />}
      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          onSignIn={() => { setShowPaywall(false); setShowAuth(true); }}
        />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function Categories() {
  const [selected, setSelected] = useState<VideoItem | null>(null);

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

  const featured = videos?.[0];

  return (
    <MobileFrame>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="pt-12 md:pt-8 pb-3 px-6 flex justify-between items-center">
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
            onClick={() => setSelected(featured)}
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
            {/* "Use this" pill */}
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-black text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow">
              <Upload className="size-3" />
              Use this
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {videos.slice(1).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  className="w-full aspect-[9/12] rounded-md overflow-hidden relative bg-secondary ring-1 ring-border text-left group"
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

      {selected && (
        <VideoUploadSheet template={selected} onClose={() => setSelected(null)} />
      )}
    </MobileFrame>
  );
}
