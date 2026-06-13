import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  Loader2,
  Sparkles,
  Upload,
  Video as VideoIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { useAuth, VIDEO_COST } from "@/lib/auth-context";
import { AuthModal } from "@/components/AuthModal";
import { PaywallModal } from "@/components/PaywallModal";

export const Route = createFileRoute("/video-create")({
  head: () => ({
    meta: [
      { title: "Create Video — Magic Studio" },
      { name: "description", content: "Recreate any video template with your own photo using AI." },
    ],
  }),
  component: VideoCreatePage,
});

type VideoItem = {
  id: string;
  title: string;
  hashtags: string[];
  song: string | null;
  cover_image_url: string;
  sample_video_url: string | null;
  prompt: string;
};

type Phase = "upload" | "photo" | "video" | "done" | "error";

const ITEM_KEY = "video-create:item";
const USER_IMAGES_KEY = "video-create:userImages";
const UPLOAD_IMAGE_MAX_EDGE = 1536;
const UPLOAD_IMAGE_QUALITY = 0.82;
const VIDEO_DURATION_SECONDS = 5;
const VIDEO_RESOLUTION = "480p";

function uid() { return Math.random().toString(36).slice(2); }

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
      i.onerror = () => rej(new Error("load"));
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
  } catch { return raw; }
}

/**
 * Build a motion-focused prompt for the WAN image-to-video model.
 * The template's `prompt` field is written for Gemini photo generation (scene/identity),
 * NOT for video animation. WAN 2.5 needs motion language.
 */
function buildVideoPrompt(item: VideoItem): string {
  const motion = [
    "cinematic slow zoom in",
    "subtle natural hair movement",
    "gentle breathing",
    "smooth camera drift",
    "soft bokeh background",
    "realistic cloth motion",
    "photorealistic",
    "high quality",
  ].join(", ");

  // Add brief style hint from template title (e.g. "Glam" → "glam style")
  const titleHint = item.title ? `, ${item.title.toLowerCase()} style` : "";
  return motion + titleHint;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ── Main page ─────────────────────────────────────────────────────────────────

function VideoCreatePage() {
  const navigate = useNavigate();
  const { user, credits, deductCredits } = useAuth();

  const [item, setItem] = useState<VideoItem | null>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null); // preview of uploaded photo
  const [showAuth, setShowAuth] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);
  const didStart = useRef(false);

  // Load template from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(ITEM_KEY);
      if (!raw) { navigate({ to: "/" }); return; }
      setItem(JSON.parse(raw) as VideoItem);
    } catch { navigate({ to: "/" }); }
  }, [navigate]);

  // Auto-start if photos were placed in sessionStorage by the upload modal
  useEffect(() => {
    if (!item || didStart.current) return;
    const raw = sessionStorage.getItem(USER_IMAGES_KEY);
    if (!raw) return;
    try {
      const imgs = JSON.parse(raw) as string[];
      sessionStorage.removeItem(USER_IMAGES_KEY);
      if (imgs.length > 0) {
        setUserPhoto(imgs[0]);
        void runGeneration(item, imgs);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const runGeneration = async (tmpl: VideoItem, imgs: string[]) => {
    if (didStart.current) return;
    if (!user) { setShowAuth(true); return; }
    if (credits < VIDEO_COST) { setShowPaywall(true); return; }

    didStart.current = true;

    try {
      // ── Step 1: Gemini photo generation ───────────────────────────────────
      setPhase("photo");
      const imgData = await invokeEdgeFunction<
        { templateUrl: string; userImages: string[] },
        { imageDataUrl?: string; error?: string; fallback?: boolean }
      >("generate-from-template", {
        body: { templateUrl: tmpl.cover_image_url, userImages: imgs },
      });

      if (imgData?.error) throw new Error(imgData.error);
      if (!imgData?.imageDataUrl) throw new Error("Photo generation returned no image. Please try again.");

      // ── Step 2: WAN 2.5 video generation ──────────────────────────────────
      setPhase("video");
      const videoPrompt = buildVideoPrompt(tmpl);

      const startData = await invokeEdgeFunction<
        { action: string; imageDataUrl: string; prompt: string; duration: number; resolution: string },
        { operationName?: string; statusUrl?: string; responseUrl?: string; error?: string }
      >("generate-video", {
        body: {
          action: "start",
          imageDataUrl: imgData.imageDataUrl,
          prompt: videoPrompt,
          duration: VIDEO_DURATION_SECONDS,
          resolution: VIDEO_RESOLUTION,
        },
      });

      if (startData?.error) throw new Error(startData.error);
      if (!startData?.operationName) throw new Error("Video generation failed to start.");

      // Poll until done (max 5 minutes)
      const maxMs = 5 * 60 * 1000;
      const startTs = Date.now();
      let videoUrl: string | null = null;

      while (Date.now() - startTs < maxMs) {
        await sleep(6000);
        const pollData = await invokeEdgeFunction<
          { action: string; operationName: string; statusUrl?: string; responseUrl?: string },
          { done?: boolean; videoUrl?: string; error?: string }
        >("generate-video", {
          body: {
            action: "poll",
            operationName: startData.operationName,
            statusUrl: startData.statusUrl,
            responseUrl: startData.responseUrl,
          },
        });

        if (pollData?.done) {
          if (pollData.videoUrl) { videoUrl = pollData.videoUrl; break; }
          throw new Error(pollData.error || "Video generation finished without a result.");
        }
      }

      if (!videoUrl) throw new Error("Video generation timed out. Please try again.");

      // Deduct credits only after success
      void deductCredits(VIDEO_COST);
      setResultUrl(videoUrl);
      setPhase("done");

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setErrorMsg(msg.replace(/function error \d+:/i, "").trim());
      setPhase("error");
      didStart.current = false; // allow retry
    }
  };

  // Fallback upload handler (if user navigates directly to /video-create without using the modal)
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 1);
    e.target.value = "";
    if (!files.length || !item || didStart.current) return;
    if (!user) { setShowAuth(true); return; }
    if (credits < VIDEO_COST) { setShowPaywall(true); return; }
    const urls = await Promise.all(files.map(optimizeImage));
    setUserPhoto(urls[0]);
    void runGeneration(item, urls);
  };

  const retry = () => {
    setPhase("upload");
    setErrorMsg(null);
    setResultUrl(null);
    setUserPhoto(null);
    didStart.current = false;
  };

  if (!item) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const slugTitle = item.title.replace(/\s+/g, "-").toLowerCase();

  return (
    <div className="relative min-h-dvh flex flex-col bg-background text-foreground">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} defaultMode="signup" />}
      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          onSignIn={() => { setShowPaywall(false); setShowAuth(true); }}
        />
      )}

      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="size-9 grid place-items-center rounded-full text-foreground/70 hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Creating video from</p>
          <p className="text-sm font-bold truncate">{item.title}</p>
        </div>
        {/* Template thumbnail */}
        <div className="size-10 rounded-lg overflow-hidden bg-black shrink-0">
          <img src={item.cover_image_url} alt="" className="w-full h-full object-cover" />
        </div>
      </header>

      <input ref={pickerRef} type="file" accept="image/*" onChange={onPick} className="hidden" />

      {/* ── Upload phase (fallback — should normally skip via modal) ── */}
      {phase === "upload" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          {/* Template preview */}
          <div className="w-full max-w-sm aspect-video rounded-2xl overflow-hidden bg-black shadow-xl">
            {item.sample_video_url ? (
              <video src={item.sample_video_url} poster={item.cover_image_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
            ) : (
              <img src={item.cover_image_url} alt={item.title} className="w-full h-full object-cover" />
            )}
          </div>

          <div className="text-center">
            <h2 className="text-xl font-extrabold mb-1">{item.title}</h2>
            <p className="text-sm text-muted-foreground">Upload a clear photo of yourself to get started</p>
          </div>

          <button
            onClick={() => pickerRef.current?.click()}
            className="flex items-center gap-3 bg-brand text-white font-bold text-base px-8 py-4 rounded-2xl shadow-lg shadow-brand/30 hover:bg-brand/90 transition-colors"
          >
            <Upload className="size-5" />
            Upload your photo
          </button>
        </div>
      )}

      {/* ── Generating phases ── */}
      {(phase === "photo" || phase === "video") && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          {/* Side-by-side: template + user photo */}
          <div className="flex items-center gap-4 w-full max-w-sm">
            <div className="flex-1 aspect-square rounded-2xl overflow-hidden bg-black">
              <img src={item.cover_image_url} alt="Template" className="w-full h-full object-cover opacity-70" />
              <p className="sr-only">Template</p>
            </div>
            <div className="text-muted-foreground font-bold text-2xl">+</div>
            <div className="flex-1 aspect-square rounded-2xl overflow-hidden bg-secondary border-2 border-brand">
              {userPhoto ? (
                <img src={userPhoto} alt="Your photo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center">
                  <Upload className="size-6 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Step progress */}
          <div className="w-full max-w-sm space-y-3">
            <StepRow
              number={1}
              label="Styling your photo with the template"
              active={phase === "photo"}
              done={phase !== "photo"}
            />
            <StepRow
              number={2}
              label="Animating your photo into a video"
              active={phase === "video"}
              done={false}
            />
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-xs">
            This takes about 2 minutes. Keep this page open.
          </p>
        </div>
      )}

      {/* ── Done phase ── */}
      {phase === "done" && resultUrl && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-5 py-6">
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="size-5" />
            <span className="font-bold text-sm">Your video is ready!</span>
          </div>

          {/* Video player */}
          <div className="relative w-full max-w-xs aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-2xl">
            <video
              src={resultUrl}
              controls
              autoPlay
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <a
              href={resultUrl}
              download={`${slugTitle}-${uid()}.mp4`}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm shadow-lg shadow-brand/30"
            >
              <Download className="size-4" />
              Save video
            </a>
            <button
              onClick={() => navigate({ to: "/" })}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-border text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              <VideoIcon className="size-4" />
              Try another template
            </button>
          </div>
        </div>
      )}

      {/* ── Error phase ── */}
      {phase === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
          <div className="size-16 rounded-full bg-red-100 dark:bg-red-900/20 grid place-items-center">
            <AlertCircle className="size-8 text-red-500" />
          </div>
          <div>
            <p className="font-bold text-base mb-2">Generation failed</p>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{errorMsg}</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={retry}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm"
            >
              <RefreshCw className="size-4" />
              Try again
            </button>
            <button
              onClick={() => navigate({ to: "/" })}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-border text-sm font-semibold text-foreground"
            >
              Pick a different template
            </button>
          </div>
        </div>
      )}

      {/* Bottom credit indicator — only visible during generation */}
      {(phase === "photo" || phase === "video") && (
        <div className="px-6 pb-6 pt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-brand animate-pulse" />
          <span>Using <strong>{VIDEO_COST} credits</strong> · {credits} remaining</span>
        </div>
      )}
    </div>
  );
}

// ── Step row component ────────────────────────────────────────────────────────

function StepRow({ number, label, active, done }: {
  number: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
      active
        ? "border-brand/40 bg-brand/5"
        : done
          ? "border-green-500/30 bg-green-500/5"
          : "border-border bg-secondary/30 opacity-50"
    }`}>
      <div className={`size-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
        active
          ? "bg-brand text-white"
          : done
            ? "bg-green-500 text-white"
            : "bg-secondary text-muted-foreground"
      }`}>
        {done ? <CheckCircle2 className="size-4" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : number}
      </div>
      <span className={`text-sm font-medium ${active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
