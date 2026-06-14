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
  Square,
  X,
  History,
  MessageSquarePlus,
} from "lucide-react";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { useAuth, PHOTO_COST } from "@/lib/auth-context";
import { AuthModal } from "@/components/AuthModal";
import { PaywallModal } from "@/components/PaywallModal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create — Magic Studio" },
      {
        name: "description",
        content: "Chat-style AI studio: drop your photo and recreate any reel.",
      },
    ],
  }),
  component: CreatePage,
});

type DraftReel = {
  images: string[];
  cover: string;
  title: string;
  hashtags: string[];
  prompt?: string | null;
};

type ChatMessage =
  | { id: string; role: "user"; kind: "images"; images: string[] }
  | { id: string; role: "user"; kind: "text"; text: string }
  | { id: string; role: "assistant"; kind: "ref"; templateUrl: string; label: string }
  | {
      id: string;
      role: "assistant";
      kind: "status";
      text: string;
      progress?: number;
      templateUrl?: string;
      userPreview?: string;
    }
  | { id: string; role: "assistant"; kind: "result"; imageDataUrl: string }
  | { id: string; role: "assistant"; kind: "error"; text: string };

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const DRAFT_KEY = "create:draft";
const USER_IMAGES_KEY = "create:userImages";
const AUTORUN_KEY = "create:autoRun";
const UPLOAD_IMAGE_MAX_EDGE = 1024;
const UPLOAD_IMAGE_QUALITY = 0.78;
const LEGACY_DEFAULT_PROMPT_MARKER = "You will receive multiple images.";

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

function getCustomPrompt(prompt?: string | null) {
  const trimmed = prompt?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith(LEGACY_DEFAULT_PROMPT_MARKER)) return undefined;
  return trimmed;
}

function getLatestResultImage(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && msg.kind === "result") {
      return msg.imageDataUrl;
    }
  }
  return null;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function CreatePage() {
  const navigate = useNavigate();
  const { user, credits, deductCredits } = useAuth();
  const [reel, setReel] = useState<DraftReel | null>(null);
  const [userImages, setUserImages] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stagedImages, setStagedImages] = useState<string[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moreInputRef = useRef<HTMLInputElement>(null);
  const didAutoRun = useRef(false);
  const generationTokenRef = useRef(0);

  const canAfford = credits >= PHOTO_COST;

  // Hydrate from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawReel = sessionStorage.getItem(DRAFT_KEY);
      const rawImgs = sessionStorage.getItem(USER_IMAGES_KEY);
      if (!rawReel) {
        navigate({ to: "/feed" });
        return;
      }
      const parsedReel = JSON.parse(rawReel) as DraftReel;
      setReel(parsedReel);
      const imgs = rawImgs ? (JSON.parse(rawImgs) as string[]) : [];
      setUserImages(imgs);
    } catch {
      navigate({ to: "/feed" });
    }
  }, [navigate]);

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const templateUrl = reel?.images[0];

  const runGeneration = async (
    imgs: string[],
    promptText?: string,
  ) => {
    if (!reel || !templateUrl || imgs.length === 0) return;

    // Auth gate — must be signed in
    if (!user) {
      setShowAuth(true);
      return;
    }

    // Credit gate — need enough credits for a photo
    if (credits < PHOTO_COST) {
      setShowPaywall(true);
      return;
    }

    // Each generation gets a unique token; stopGeneration() increments the
    // counter, making any in-flight generation's token stale so its callbacks
    // are silently ignored.
    const token = ++generationTokenRef.current;
    setBusy(true);
    const statusId = uid();
    const trimmedPrompt = promptText?.trim();
    const editImageDataUrl = trimmedPrompt ? getLatestResultImage(messages) : null;
    const customPrompt = trimmedPrompt || getCustomPrompt(reel.prompt);
    const requestTemplateUrl = editImageDataUrl ?? templateUrl;
    const requestUserImages = editImageDataUrl ? [editImageDataUrl] : imgs;
    setMessages((m) => [
      ...m,
      {
        id: statusId,
        role: "assistant",
        kind: "status",
        text: promptText
          ? "Recreating with your notes…"
          : "Recreating your photo…",
        templateUrl: requestTemplateUrl,
        userPreview: requestUserImages[0],
      },
    ]);
    try {
      const data = await invokeEdgeFunction<
        {
          action: "start";
          templateUrl: string;
          userImages: string[];
          prompt?: string;
          editImageDataUrl?: string;
        },
        {
          operationName?: string;
          imageDataUrl?: string;
          error?: string;
          fallback?: boolean;
        }
      >(
        "generate-from-template",
        {
          body: {
            action: "start",
            templateUrl: requestTemplateUrl,
            userImages: requestUserImages,
            ...(customPrompt ? { prompt: customPrompt } : {}),
            ...(editImageDataUrl ? { editImageDataUrl } : {}),
          },
        },
      );
      if (data?.fallback && data?.error) throw new Error(data.error);
      if (data?.error) throw new Error(data.error);

      let imageDataUrl = data.imageDataUrl;
      if (!imageDataUrl && data.operationName) {
        const maxMs = 6 * 60 * 1000;
        const startedAt = Date.now();
        while (Date.now() - startedAt < maxMs) {
          await wait(3500);
          const pollData = await invokeEdgeFunction<
            { action: "poll"; operationName: string },
            {
              done?: boolean;
              imageDataUrl?: string;
              error?: string;
              fallback?: boolean;
            }
          >("generate-from-template", {
            body: { action: "poll", operationName: data.operationName },
          });

          if (!pollData.done) continue;
          if (pollData.error) throw new Error(pollData.error);
          imageDataUrl = pollData.imageDataUrl;
          break;
        }
      }

      if (!imageDataUrl) {
        throw new Error("Image generation is still processing. Please try again in a moment.");
      }

      // If the user stopped this generation, discard the result silently.
      if (generationTokenRef.current !== token) return;

      setMessages((m) =>
        m
          .filter((x) => x.id !== statusId)
          .concat({
            id: uid(),
            role: "assistant",
            kind: "result",
            imageDataUrl,
          }),
      );
      // Charge credits for the successful generation
      void deductCredits(PHOTO_COST);

      // Save to user gallery (fire-and-forget — don't block the UI)
      if (user) {
        void (async () => {
          try {
            // Upload image to storage
            const blob = dataUrlToBlob(imageDataUrl);
            const path = `${user.id}/${crypto.randomUUID()}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("user-images")
              .upload(path, blob, { contentType: "image/jpeg" });
            if (upErr) return;
            await supabase.from("user_images").insert({
              user_id: user.id,
              image_url: path,
              template_title: reel?.title ?? null,
            });
          } catch { /* silent — gallery save is non-critical */ }
        })();
      }
    } catch (e) {
      if (generationTokenRef.current !== token) return;
      const text = e instanceof Error ? e.message : "Failed";
      setMessages((m) =>
        m
          .filter((x) => x.id !== statusId)
          .concat({ id: uid(), role: "assistant", kind: "error", text }),
      );
    } finally {
      if (generationTokenRef.current === token) {
        setBusy(false);
      }
    }
  };

  // Seed the conversation + auto-run once reel + user images are loaded
  useEffect(() => {
    if (!reel || userImages.length === 0) return;
    if (didAutoRun.current) return;
    didAutoRun.current = true;

    const seeded: ChatMessage[] = [
      {
        id: uid(),
        role: "user",
        kind: "images",
        images: userImages,
      },
      {
        id: uid(),
        role: "assistant",
        kind: "ref",
        templateUrl: reel.images[0],
        label: "Create an image like this",
      },
    ];
    setMessages(seeded);

    const shouldRun = sessionStorage.getItem(AUTORUN_KEY) === "1";
    if (shouldRun) {
      sessionStorage.removeItem(AUTORUN_KEY);
      // tiny delay so the UI paints the seeded messages first
      setTimeout(() => {
        void runGeneration(userImages);
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel, userImages]);

  const stopGeneration = () => {
    generationTokenRef.current++;
    setBusy(false);
    // Remove the in-progress status bubble
    setMessages((m) => m.filter((x) => !(x.role === "assistant" && x.kind === "status")));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Stop button: clicking Send while busy cancels the current generation
    if (busy) {
      stopGeneration();
      return;
    }

    const text = input.trim();
    const hasStaged = stagedImages.length > 0;
    if (!hasStaged && !text) return;

    setInput("");

    if (hasStaged) {
      // Commit the staged images as the new user reference
      const imgs = stagedImages;
      setStagedImages([]);
      setUserImages(imgs);
      sessionStorage.setItem(USER_IMAGES_KEY, JSON.stringify(imgs));
      const newMsgs: ChatMessage[] = [
        { id: uid(), role: "user", kind: "images", images: imgs },
      ];
      if (text) newMsgs.push({ id: uid(), role: "user", kind: "text", text });
      setMessages((m) => [...m, ...newMsgs]);
      await runGeneration(imgs, text || undefined);
    } else {
      // Text-only message — re-generate with the current user images
      if (userImages.length === 0) return;
      setMessages((m) => [
        ...m,
        { id: uid(), role: "user", kind: "text", text },
      ]);
      await runGeneration(userImages, text);
    }
  };

  // "+" just stages the images — they aren't sent until the user presses Send
  const onPickMore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (busy) return; // block while generating
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    e.target.value = "";
    if (files.length === 0) return;
    const urls = await Promise.all(files.map(optimizeImageForUpload));
    setStagedImages(urls);
  };

  const slugTitle = useMemo(
    () => (reel?.title ?? "creation").replace(/\s+/g, "-").toLowerCase(),
    [reel?.title],
  );

  if (!reel) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#0f0f11]">
        <Loader2 className="size-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="relative h-dvh flex flex-col bg-[#0f0f11] text-white">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} defaultMode="signup" />}
      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          onSignIn={() => { setShowPaywall(false); setShowAuth(true); }}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-white/5">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="size-9 -ml-2 grid place-items-center rounded-full text-white/70 active:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="size-9 grid place-items-center rounded-xl text-white/70 active:bg-white/10"
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-[22px]" />
          </button>
          <button
            type="button"
            className="relative size-9 grid place-items-center rounded-xl text-white/70 active:bg-white/10"
            aria-label="History"
          >
            <History className="size-[22px]" />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-violet-400" />
          </button>
        </div>
      </header>

      <p className="text-center text-[12px] text-white/30 py-1.5">
        Responses are AI-generated. Please double-check.
      </p>

      {/* Usage / auth indicator */}
      {!user ? (
        <div className="mx-4 mb-3 flex items-center justify-between bg-violet-950/60 border border-violet-500/20 rounded-2xl px-4 py-2.5">
          <div className="text-xs text-violet-300 font-semibold">Sign in to start generating</div>
          <button
            onClick={() => setShowAuth(true)}
            className="text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign in
          </button>
        </div>
      ) : canAfford ? (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-violet-950/40 border border-violet-500/15 rounded-2xl px-4 py-2">
          <Sparkles className="size-3.5 text-violet-400 shrink-0" />
          <span className="text-xs text-violet-300 font-medium">
            <span className="font-extrabold text-white">{credits}</span> credit{credits !== 1 ? "s" : ""} left
          </span>
          <span className="ml-auto text-[11px] text-violet-400 font-semibold">
            {PHOTO_COST} per photo
          </span>
        </div>
      ) : (
        <div className="mx-4 mb-3 flex items-center justify-between bg-orange-950/50 border border-orange-500/20 rounded-2xl px-4 py-2.5">
          <div className="text-xs text-orange-300 font-semibold">
            Not enough credits ({credits} left)
          </div>
          <button
            onClick={() => setShowPaywall(true)}
            className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Chat scroller */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pb-4 space-y-3"
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} filenameBase={slugTitle} />
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="px-3 pt-2 pb-5"
      >
        <input
          ref={moreInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPickMore}
          className="hidden"
        />

        {/* Staged image previews */}
        {stagedImages.length > 0 && (
          <div className="flex gap-2 mb-2 px-1">
            {stagedImages.map((src, i) => (
              <div key={i} className="relative size-16 rounded-2xl overflow-hidden ring-1 ring-violet-500/40 shrink-0">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setStagedImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/80 text-white flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 bg-[#1c1c26] rounded-2xl pl-3 pr-1.5 py-1.5 ring-1 ring-white/8">
          <button
            type="button"
            onClick={() => !busy && moreInputRef.current?.click()}
            disabled={busy}
            className="size-9 grid place-items-center rounded-xl text-white/50 hover:text-white/80 hover:bg-white/8 disabled:opacity-30 transition-colors"
            aria-label="Attach photos"
          >
            <Plus className="size-5" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={busy ? "Generating…" : "Enter your ideas"}
            className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-white/30"
            disabled={busy}
          />
          <button
            type="button"
            className="size-9 grid place-items-center rounded-xl text-white/50 disabled:opacity-30"
            aria-label="Voice"
            disabled={busy}
          >
            <Mic className="size-5" />
          </button>
          <button
            type="submit"
            disabled={!busy && !input.trim() && stagedImages.length === 0}
            className={`size-10 grid place-items-center rounded-xl text-white transition-all ${
              busy
                ? "bg-red-500/90 active:bg-red-600"
                : "bg-gradient-to-br from-violet-600 to-pink-500 disabled:opacity-30 shadow-lg shadow-violet-900/40"
            }`}
            aria-label={busy ? "Stop" : "Send"}
          >
            {busy ? (
              <Square className="size-4 fill-white" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </form>
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
              <img
                key={i}
                src={src}
                alt=""
                className="aspect-square object-cover"
              />
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
        <div className="max-w-[80%] bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[15px] text-white shadow-lg shadow-violet-900/30">
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.role === "assistant" && msg.kind === "ref") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-[#1e1e2a] rounded-2xl rounded-tr-md p-2.5 ring-1 ring-white/8 flex items-center gap-2.5">
          <span className="text-white/30 text-lg leading-none">↳</span>
          <img
            src={msg.templateUrl}
            alt="Reference reel"
            className="size-9 rounded-xl object-cover"
          />
          <span className="text-[15px] text-white/90 pr-1">{msg.label}</span>
        </div>
      </div>
    );
  }

  if (msg.role === "assistant" && msg.kind === "status") {
    return <GenerationStatusBubble msg={msg} />;
  }

  if (msg.role === "assistant" && msg.kind === "result") {
    return <GeneratedImageBubble imageDataUrl={msg.imageDataUrl} filenameBase={filenameBase} />;
  }

  if (msg.role === "assistant" && msg.kind === "error") {
    return (
      <div className="flex">
        <div className="max-w-[85%] rounded-2xl bg-red-950/60 ring-1 ring-red-500/30 text-red-300 px-3.5 py-2.5 text-[14px] flex items-start gap-2">
          <X className="size-4 mt-0.5 shrink-0" />
          <span>{msg.text}</span>
        </div>
      </div>
    );
  }

  return null;
}

function GenerationStatusBubble({
  msg,
}: {
  msg: Extract<ChatMessage, { role: "assistant"; kind: "status" }>;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stages = [
    "Preparing your photos",
    "Reading the template style",
    "Blending your identity",
    "Painting the final details",
    "Almost ready",
  ];
  const stage = stages[Math.min(stages.length - 1, Math.floor(seconds / 8))];
  const progress = Math.min(92, 12 + seconds * 4);
  const previewSrc = msg.userPreview ?? msg.templateUrl;
  const previewOpacity = Math.min(0.86, 0.18 + seconds * 0.04);
  const previewBlur = Math.max(3, 18 - seconds * 0.8);

  return (
    <div className="flex">
      <div className="w-[286px] rounded-[28px] bg-[#1a1a24] ring-1 ring-white/8 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="relative size-10 shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-violet-900/60" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400 animate-spin" />
            <Sparkles className="absolute inset-0 m-auto size-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-violet-300 leading-tight">
              {seconds < 2 ? msg.text : stage}
            </div>
            <div className="text-[11px] text-white/30 mt-0.5">
              Keep this screen open
            </div>
          </div>
        </div>

        {previewSrc && seconds >= 2 && (
          <div className="px-3 pb-3">
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#0d0d14]">
              <img
                src={previewSrc}
                alt=""
                className="absolute inset-0 size-full object-cover transition-all duration-700"
                style={{
                  opacity: previewOpacity,
                  filter: `blur(${previewBlur}px) saturate(1.1)`,
                  transform: "scale(1.08)",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-violet-950/70 via-transparent to-black/40" />
              <div className="absolute inset-x-4 bottom-4">
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] font-semibold text-white/70">
                  Generating…
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratedImageBubble({
  imageDataUrl,
  filenameBase,
}: {
  imageDataUrl: string;
  filenameBase: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
      <div className="flex">
        <div className="relative rounded-2xl overflow-hidden bg-black w-[260px]">
          {!loaded && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-sky-50">
              <Loader2 className="size-6 animate-spin text-sky-500" />
            </div>
          )}
          <img
            src={imageDataUrl}
            alt="Generated"
            onLoad={() => setLoaded(true)}
            onClick={() => loaded && setLightbox(true)}
            className={`w-full aspect-[3/4] object-cover transition-all duration-1000 cursor-zoom-in ${
              loaded ? "opacity-100 blur-0 scale-100" : "opacity-30 blur-xl scale-105"
            }`}
          />
          <a
            href={imageDataUrl}
            download={`${filenameBase}.png`}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 text-foreground text-[11px] font-semibold shadow"
          >
            <Download className="size-3.5" />
            Save
          </a>
        </div>
      </div>

      {/* Fullscreen lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[999] bg-black/95 flex flex-col items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 size-10 rounded-full bg-white/10 text-white flex items-center justify-center"
            onClick={() => setLightbox(false)}
          >
            <X className="size-5" />
          </button>
          <img
            src={imageDataUrl}
            alt="Generated"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[90dvh] object-contain rounded-xl shadow-2xl"
          />
          <a
            href={imageDataUrl}
            download={`${filenameBase}.png`}
            onClick={(e) => e.stopPropagation()}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold shadow"
          >
            <Download className="size-4" />
            Save photo
          </a>
        </div>
      )}
    </>
  );
}
