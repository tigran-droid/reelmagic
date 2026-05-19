import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  Loader2,
  Mic,
  Plus,
  Send,
  Sparkles,
  X,
  History,
  MessageSquarePlus,
  Video as VideoIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/video-create")({
  head: () => ({
    meta: [
      { title: "Create Video — Magic Studio" },
      {
        name: "description",
        content: "Recreate any video template with your own photo using AI.",
      },
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

type ChatMessage =
  | { id: string; role: "user"; kind: "images"; images: string[] }
  | { id: string; role: "user"; kind: "text"; text: string }
  | { id: string; role: "assistant"; kind: "ref"; templateUrl: string; label: string }
  | { id: string; role: "assistant"; kind: "status"; text: string }
  | { id: string; role: "assistant"; kind: "image"; imageDataUrl: string; caption?: string }
  | { id: string; role: "assistant"; kind: "video"; videoUrl: string }
  | { id: string; role: "assistant"; kind: "error"; text: string };

const ITEM_KEY = "video-create:item";
const USER_IMAGES_KEY = "video-create:userImages";
const VIDEO_MODELS = [
  "veo-3.1-fast-generate-preview",
  "veo-3.1-lite-generate-preview",
  "veo-3.0-fast-generate-001",
] as const;
const UPLOAD_IMAGE_MAX_EDGE = 1536;
const UPLOAD_IMAGE_QUALITY = 0.82;

function uid() {
  return Math.random().toString(36).slice(2);
}

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

    if (scale === 1 && file.size < 1_500_000) return originalDataUrl;

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

function VideoCreatePage() {
  const navigate = useNavigate();
  const [item, setItem] = useState<VideoItem | null>(null);
  const [userImages, setUserImages] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const didStart = useRef(false);

  // Hydrate from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(ITEM_KEY);
      if (!raw) {
        navigate({ to: "/" });
        return;
      }
      setItem(JSON.parse(raw) as VideoItem);
    } catch {
      navigate({ to: "/" });
    }
  }, [navigate]);

  // Seed conversation (intro + ref to template)
  useEffect(() => {
    if (!item) return;
    setMessages([
      {
        id: uid(),
        role: "assistant",
        kind: "ref",
        templateUrl: item.cover_image_url,
        label: `Create your version of "${item.title}"`,
      },
    ]);
  }, [item]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const runFullGeneration = async (imgs: string[]) => {
    if (!item || imgs.length === 0) return;
    setBusy(true);
    let statusId = uid();
    setMessages((m) => [
      ...m,
      { id: statusId, role: "assistant", kind: "status", text: "Optimizing photos and generating your photo…" },
    ]);

    try {
      // STEP 1 — image
      const { data: imgData, error: imgErr } = await supabase.functions.invoke(
        "generate-from-template",
        {
          body: { templateUrl: item.cover_image_url, userImages: imgs },
        },
      );
      if (imgErr) {
        let msg = imgErr.message || "Image generation failed";
        try {
          const ctx = (imgErr as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.clone().json();
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (imgData?.fallback && imgData?.error) throw new Error(imgData.error);
      if (imgData?.error) throw new Error(imgData.error);
      const imageDataUrl: string | undefined = imgData?.imageDataUrl;
      if (!imageDataUrl) throw new Error("No image returned");

      // Show the generated image, then move into the video phase
      setMessages((m) =>
        m
          .filter((x) => x.id !== statusId)
          .concat({
            id: uid(),
            role: "assistant",
            kind: "image",
            imageDataUrl,
            caption: "Photo ready — now generating your video…",
          }),
      );

      statusId = uid();
      setMessages((m) => [
        ...m,
        {
          id: statusId,
          role: "assistant",
          kind: "status",
          text: "Generating your video — this takes 30–90 seconds…",
        },
      ]);

      // STEP 2 — start video generation with model fallback
      const maxMs = 5 * 60 * 1000;
      let videoUrl: string | null = null;
      let lastVideoError = "Video generation failed";

      for (let modelIndex = 0; modelIndex < VIDEO_MODELS.length && !videoUrl; modelIndex += 1) {
        const model = VIDEO_MODELS[modelIndex];

        setMessages((m) =>
          m.map((message) =>
            message.id === statusId
              ? {
                  ...message,
                  text:
                    modelIndex === 0
                      ? "Generating your video — this takes 30–90 seconds…"
                      : "Retrying video generation with another model…",
                }
              : message,
          ),
        );

        const { data: startData, error: startErr } = await supabase.functions.invoke(
          "generate-video",
          {
            body: { action: "start", imageDataUrl, prompt: item.prompt, model },
          },
        );
        if (startErr) throw new Error(startErr.message || "Video start failed");
        if (startData?.error) throw new Error(startData.error);
        const operationName: string | undefined = startData?.operationName;
        if (!operationName) throw new Error("No operation name returned");

        const startTs = Date.now();
        let shouldTryNextModel = false;

        while (Date.now() - startTs < maxMs) {
          await new Promise((r) => setTimeout(r, 6000));
          const { data: pollData, error: pollErr } = await supabase.functions.invoke(
            "generate-video",
            { body: { action: "poll", operationName } },
          );
          if (pollErr) throw new Error(pollErr.message || "Polling failed");

          if (pollData?.done) {
            if (pollData.videoUrl) {
              videoUrl = pollData.videoUrl;
              break;
            }

            lastVideoError = pollData?.error || "Video generation finished but no URL returned";
            if (pollData?.filtered && pollData?.retryable && modelIndex < VIDEO_MODELS.length - 1) {
              shouldTryNextModel = true;
              break;
            }

            throw new Error(lastVideoError);
          }
        }

        if (videoUrl) break;
        if (shouldTryNextModel) continue;
        if (Date.now() - startTs >= maxMs) {
          lastVideoError = "Video generation timed out";
          throw new Error(lastVideoError);
        }
      }

      if (!videoUrl) throw new Error(lastVideoError);

      setMessages((m) =>
        m
          .filter((x) => x.id !== statusId)
          .concat({ id: uid(), role: "assistant", kind: "video", videoUrl: videoUrl! }),
      );
    } catch (e) {
      const text = e instanceof Error ? e.message : "Failed";
      const friendlyText = /timed out/i.test(text)
        ? "Image generation took too long. Try 1–2 clear face photos and avoid very large uploads."
        : text;
      setMessages((m) =>
        m
          .filter((x) => x.id !== statusId)
          .concat({ id: uid(), role: "assistant", kind: "error", text: friendlyText }),
      );
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    e.target.value = "";
    if (files.length === 0) return;
    const urls = await Promise.all(files.map(optimizeImageForUpload));
    setUserImages(urls);
    sessionStorage.setItem(USER_IMAGES_KEY, JSON.stringify(urls));
    setMessages((m) => [
      ...m,
      { id: uid(), role: "user", kind: "images", images: urls },
    ]);
    if (!didStart.current) didStart.current = true;
    await runFullGeneration(urls);
  };

  const slugTitle = useMemo(
    () => (item?.title ?? "video").replace(/\s+/g, "-").toLowerCase(),
    [item?.title],
  );

  if (!item) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasUploaded = userImages.length > 0;

  return (
    <div className="relative h-dvh flex flex-col bg-[oklch(0.97_0.01_240)] text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="size-9 -ml-2 grid place-items-center rounded-full text-foreground/80 active:bg-black/5"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-3">
          <button type="button" className="size-9 grid place-items-center rounded-md text-foreground/80 active:bg-black/5" aria-label="New chat">
            <MessageSquarePlus className="size-[22px]" />
          </button>
          <button type="button" className="relative size-9 grid place-items-center rounded-md text-foreground/80 active:bg-black/5" aria-label="History">
            <History className="size-[22px]" />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500" />
          </button>
        </div>
      </header>

      <p className="text-center text-[13px] text-muted-foreground pb-3">
        AI-generated video. Please double-check.
      </p>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} filenameBase={slugTitle} />
        ))}

        {!hasUploaded && !busy && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={() => pickerRef.current?.click()}
              className="inline-flex items-center gap-2 bg-black text-white text-sm font-semibold rounded-full px-5 py-3 shadow-lg"
            >
              <VideoIcon className="size-4" />
              Create yours — upload photo
            </button>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-3 pt-2 pb-4 bg-transparent">
        <input
          ref={pickerRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPick}
          className="hidden"
        />
        <div className="flex items-center gap-2 bg-white rounded-full pl-3 pr-1.5 py-1.5 shadow-sm border border-black/5">
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            disabled={busy}
            className="size-9 grid place-items-center rounded-full text-foreground/70 active:bg-black/5 disabled:opacity-40"
            aria-label="Attach photos"
          >
            <Plus className="size-5" />
          </button>
          <input
            readOnly
            placeholder={hasUploaded ? "Generating video…" : "Tap + to upload your photo"}
            className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground/70"
          />
          <button
            type="button"
            className="size-9 grid place-items-center rounded-full text-foreground/70 active:bg-black/5"
            aria-label="Voice"
            disabled
          >
            <Mic className="size-5" />
          </button>
          <button
            type="button"
            disabled
            className="size-10 grid place-items-center rounded-full bg-black text-white disabled:opacity-50"
            aria-label={busy ? "Generating" : "Send"}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  filenameBase,
}: {
  msg: ChatMessage;
  filenameBase: string;
}) {
  if (msg.role === "user" && msg.kind === "images") {
    return (
      <div className="flex justify-end">
        <div className="relative">
          <div
            className="grid gap-1 rounded-2xl overflow-hidden bg-black"
            style={{
              gridTemplateColumns: `repeat(${Math.min(msg.images.length, 2)}, minmax(0, 1fr))`,
              width: msg.images.length > 1 ? 200 : 120,
            }}
          >
            {msg.images.map((src, i) => (
              <img key={i} src={src} alt="" className="aspect-square object-cover" />
            ))}
          </div>
          {msg.images.length > 1 && (
            <span className="absolute top-1.5 left-1.5 text-[11px] font-semibold text-white bg-black/60 rounded px-1.5">
              {msg.images.length}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === "user" && msg.kind === "text") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-white rounded-2xl px-3.5 py-2.5 text-[15px] shadow-sm border border-black/5">
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.role === "assistant" && msg.kind === "ref") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-white rounded-2xl p-2.5 shadow-sm border border-black/5 flex items-center gap-2.5">
          <span className="text-foreground/40 text-lg leading-none">↳</span>
          <img src={msg.templateUrl} alt="" className="size-9 rounded-md object-cover" />
          <span className="text-[15px] text-foreground pr-1">{msg.label}</span>
        </div>
      </div>
    );
  }

  if (msg.role === "assistant" && msg.kind === "status") {
    return (
      <div className="flex">
        <div className="rounded-2xl bg-white border border-black/5 px-3.5 py-3 shadow-sm flex items-center gap-2.5 text-[15px]">
          <Sparkles className="size-4 text-sky-500 animate-pulse" />
          <span className="font-semibold text-sky-500">{msg.text}</span>
        </div>
      </div>
    );
  }

  if (msg.role === "assistant" && msg.kind === "image") {
    return (
      <div className="flex">
        <div className="rounded-2xl overflow-hidden bg-black w-[220px]">
          <img src={msg.imageDataUrl} alt="Generated" className="w-full aspect-[3/4] object-cover" />
          {msg.caption && (
            <p className="px-3 py-2 text-[12px] text-white/80 bg-black">{msg.caption}</p>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === "assistant" && msg.kind === "video") {
    return (
      <div className="flex">
        <div className="relative rounded-2xl overflow-hidden bg-black w-[260px]">
          <video
            src={msg.videoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full aspect-[9/16] object-cover"
          />
          <a
            href={msg.videoUrl}
            download={`${filenameBase}.mp4`}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 text-foreground text-[11px] font-semibold shadow"
          >
            <Download className="size-3.5" />
            Save
          </a>
        </div>
      </div>
    );
  }

  if (msg.role === "assistant" && msg.kind === "error") {
    return (
      <div className="flex">
        <div className="max-w-[85%] rounded-2xl bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 text-[14px] flex items-start gap-2">
          <X className="size-4 mt-0.5 shrink-0" />
          <span>{msg.text}</span>
        </div>
      </div>
    );
  }

  return null;
}