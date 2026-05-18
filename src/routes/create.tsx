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
} from "lucide-react";
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
};

type ChatMessage =
  | { id: string; role: "user"; kind: "images"; images: string[] }
  | { id: string; role: "user"; kind: "text"; text: string }
  | { id: string; role: "assistant"; kind: "ref"; templateUrl: string; label: string }
  | { id: string; role: "assistant"; kind: "status"; text: string; progress?: number }
  | { id: string; role: "assistant"; kind: "result"; imageDataUrl: string }
  | { id: string; role: "assistant"; kind: "error"; text: string };

const DRAFT_KEY = "create:draft";
const USER_IMAGES_KEY = "create:userImages";
const AUTORUN_KEY = "create:autoRun";

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

function CreatePage() {
  const navigate = useNavigate();
  const [reel, setReel] = useState<DraftReel | null>(null);
  const [userImages, setUserImages] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moreInputRef = useRef<HTMLInputElement>(null);
  const didAutoRun = useRef(false);

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
    setBusy(true);
    const statusId = uid();
    setMessages((m) => [
      ...m,
      {
        id: statusId,
        role: "assistant",
        kind: "status",
        text: promptText
          ? "Recreating with your notes…"
          : "Recreating your photo…",
      },
    ]);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "generate-from-template",
        {
          body: {
            templateUrl,
            userImages: imgs,
            ...(promptText ? { prompt: promptText } : {}),
          },
        },
      );
      if (fnErr) {
        let msg = fnErr.message || "Generation failed";
        try {
          const ctx = (fnErr as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.clone().json();
            if (body?.error) msg = body.error;
          }
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      if (data?.fallback && data?.error) throw new Error(data.error);
      if (data?.error) throw new Error(data.error);
      if (!data?.imageDataUrl) throw new Error("No image returned");
      setMessages((m) =>
        m
          .filter((x) => x.id !== statusId)
          .concat({
            id: uid(),
            role: "assistant",
            kind: "result",
            imageDataUrl: data.imageDataUrl,
          }),
      );
    } catch (e) {
      const text = e instanceof Error ? e.message : "Failed";
      setMessages((m) =>
        m
          .filter((x) => x.id !== statusId)
          .concat({ id: uid(), role: "assistant", kind: "error", text }),
      );
    } finally {
      setBusy(false);
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || userImages.length === 0) return;
    setInput("");
    setMessages((m) => [
      ...m,
      { id: uid(), role: "user", kind: "text", text },
    ]);
    await runGeneration(userImages, text);
  };

  const onPickMore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    e.target.value = "";
    if (files.length === 0) return;
    const urls = await Promise.all(files.map(fileToDataUrl));
    setUserImages(urls);
    sessionStorage.setItem(USER_IMAGES_KEY, JSON.stringify(urls));
    setMessages((m) => [
      ...m,
      { id: uid(), role: "user", kind: "images", images: urls },
    ]);
    await runGeneration(urls);
  };

  const slugTitle = useMemo(
    () => (reel?.title ?? "creation").replace(/\s+/g, "-").toLowerCase(),
    [reel?.title],
  );

  if (!reel) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative h-dvh flex flex-col bg-[oklch(0.97_0.01_240)] text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={() => navigate({ to: "/feed" })}
          className="size-9 -ml-2 grid place-items-center rounded-full text-foreground/80 active:bg-black/5"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="size-9 grid place-items-center rounded-md text-foreground/80 active:bg-black/5"
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-[22px]" />
          </button>
          <button
            type="button"
            className="relative size-9 grid place-items-center rounded-md text-foreground/80 active:bg-black/5"
            aria-label="History"
          >
            <History className="size-[22px]" />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500" />
          </button>
        </div>
      </header>

      <p className="text-center text-[13px] text-muted-foreground pb-3">
        Responses are AI-generated. Please double-check.
      </p>

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
        className="px-3 pt-2 pb-4 bg-transparent"
      >
        <input
          ref={moreInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPickMore}
          className="hidden"
        />
        <div className="flex items-center gap-2 bg-white rounded-full pl-3 pr-1.5 py-1.5 shadow-sm border border-black/5">
          <button
            type="button"
            onClick={() => moreInputRef.current?.click()}
            className="size-9 grid place-items-center rounded-full text-foreground/70 active:bg-black/5"
            aria-label="Attach photos"
          >
            <Plus className="size-5" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your ideas"
            className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground/70"
            disabled={busy}
          />
          <button
            type="button"
            className="size-9 grid place-items-center rounded-full text-foreground/70 active:bg-black/5"
            aria-label="Voice"
          >
            <Mic className="size-5" />
          </button>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="size-10 grid place-items-center rounded-full bg-black text-white disabled:opacity-50"
            aria-label={busy ? "Generating" : "Send"}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
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
          <img
            src={msg.templateUrl}
            alt="Reference reel"
            className="size-9 rounded-md object-cover"
          />
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

  if (msg.role === "assistant" && msg.kind === "result") {
    return (
      <div className="flex">
        <div className="relative rounded-2xl overflow-hidden bg-black w-[260px]">
          <img
            src={msg.imageDataUrl}
            alt="Generated"
            className="w-full aspect-[3/4] object-cover"
          />
          <a
            href={msg.imageDataUrl}
            download={`${filenameBase}.png`}
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