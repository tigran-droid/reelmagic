import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  Sparkles,
  Upload,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create your version — Magic Studio" },
      {
        name: "description",
        content: "Pick a template, drop in your photos, and let AI put you in the scene.",
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

const DRAFT_KEY = "create:draft";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

type Job = {
  templateUrl: string;
  status: "pending" | "running" | "done" | "error";
  result?: string;
  error?: string;
};

function CreatePage() {
  const navigate = useNavigate();
  const [reel, setReel] = useState<DraftReel | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set([0]));
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);

  // Load draft from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) {
        navigate({ to: "/feed" });
        return;
      }
      const parsed = JSON.parse(raw) as DraftReel;
      setReel(parsed);
      setSelected(new Set([0]));
    } catch {
      navigate({ to: "/feed" });
    }
  }, [navigate]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []).slice(0, 4);
    setFiles(list);
    setJobs([]);
  };

  const toggleSelect = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!reel) return;
    setSelected(new Set(reel.images.map((_, i) => i)));
  };

  const canGenerate = reel && files.length > 0 && selected.size > 0 && !busy;

  const onGenerate = async () => {
    if (!reel || !canGenerate) return;
    setBusy(true);
    const targets = Array.from(selected).map((i) => reel.images[i]);
    const initial: Job[] = targets.map((t) => ({ templateUrl: t, status: "pending" }));
    setJobs(initial);

    try {
      const dataUrls = await Promise.all(files.map(fileToDataUrl));

      await Promise.all(
        targets.map(async (templateUrl, idx) => {
          setJobs((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], status: "running" };
            return next;
          });
          try {
            const { data, error: fnErr } = await supabase.functions.invoke(
              "generate-from-template",
              { body: { templateUrl, userImages: dataUrls } },
            );
            if (fnErr) throw fnErr;
            if (data?.error) throw new Error(data.error);
            if (!data?.imageDataUrl) throw new Error("No image returned");
            setJobs((prev) => {
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                status: "done",
                result: data.imageDataUrl,
              };
              return next;
            });
          } catch (e) {
            setJobs((prev) => {
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                status: "error",
                error: e instanceof Error ? e.message : "Failed",
              };
              return next;
            });
          }
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const resetResults = () => {
    setJobs([]);
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

  const hasResults = jobs.length > 0;

  return (
    <div className="relative min-h-dvh bg-background text-foreground overflow-x-hidden">
      {/* Ambient gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-90"
        style={{
          background:
            "radial-gradient(60% 40% at 15% 0%, oklch(0.92 0.08 320 / 0.55), transparent 60%), radial-gradient(50% 50% at 95% 10%, oklch(0.9 0.1 240 / 0.45), transparent 60%), radial-gradient(60% 60% at 50% 100%, oklch(0.95 0.08 60 / 0.35), transparent 65%)",
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/60 border-b border-border/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            to="/feed"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to feed
          </Link>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="size-3.5" />
            Magic Studio
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 pb-32 pt-6 sm:pt-10 space-y-10">
        {/* Title block */}
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Recreate this look
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
            {reel.title}
          </h1>
          {reel.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground pt-1">
              {reel.hashtags.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
          )}
        </section>

        {/* Step 1 — pick templates */}
        <section className="space-y-4">
          <StepHeader
            n={1}
            title={
              reel.images.length > 1
                ? "Pick which shots to recreate"
                : "Your template"
            }
            subtitle={
              reel.images.length > 1
                ? `Choose one or more of the ${reel.images.length} shots in this reel.`
                : "We'll keep this exact look, pose, and vibe."
            }
            action={
              reel.images.length > 1 ? (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-semibold text-foreground underline underline-offset-4 decoration-foreground/40 hover:decoration-foreground"
                >
                  Select all {reel.images.length}
                </button>
              ) : null
            }
          />

          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.min(reel.images.length, 3)}, minmax(0, 1fr))`,
            }}
          >
            {reel.images.map((src, i) => {
              const isOn = selected.has(i);
              return (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => reel.images.length > 1 && toggleSelect(i)}
                  className={`group relative aspect-[3/4] rounded-2xl overflow-hidden ring-1 transition-all ${
                    isOn
                      ? "ring-2 ring-foreground shadow-xl shadow-foreground/15 scale-[0.99]"
                      : "ring-border hover:ring-foreground/40"
                  }`}
                  aria-pressed={isOn}
                >
                  <img
                    src={src}
                    alt={`Template ${i + 1}`}
                    className={`absolute inset-0 size-full object-cover transition ${
                      isOn ? "" : "opacity-80 group-hover:opacity-100"
                    }`}
                  />
                  <div
                    className={`absolute inset-0 transition ${
                      isOn
                        ? "bg-gradient-to-t from-black/40 via-transparent to-transparent"
                        : "bg-black/10"
                    }`}
                  />
                  <div className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-widest bg-black/55 text-white px-1.5 py-0.5 rounded">
                    Shot {i + 1}
                  </div>
                  {reel.images.length > 1 && (
                    <div
                      className={`absolute top-2 right-2 size-7 rounded-full grid place-items-center transition ${
                        isOn
                          ? "bg-foreground text-background"
                          : "bg-white/85 text-foreground/70"
                      }`}
                    >
                      {isOn ? <Check className="size-4" /> : null}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {reel.images.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {selected.size} of {reel.images.length} selected · we'll generate{" "}
              {selected.size} image{selected.size > 1 ? "s" : ""}.
            </p>
          )}
        </section>

        {/* Step 2 — upload your photos */}
        <section className="space-y-4">
          <StepHeader
            n={2}
            title="Upload your photos"
            subtitle="Upload 3–4 photos for best face accuracy. More angles = better likeness."
          />

          <label className="block">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onPick}
              className="hidden"
              disabled={busy}
            />
            <div className="border-2 border-dashed border-border rounded-3xl py-10 px-4 flex flex-col items-center gap-2 text-center cursor-pointer hover:border-foreground/40 hover:bg-secondary/40 transition-all">
              <div className="size-12 rounded-2xl bg-foreground text-background grid place-items-center mb-1">
                <Upload className="size-5" />
              </div>
              <span className="text-base font-semibold">
                {files.length > 0
                  ? `${files.length} photo${files.length > 1 ? "s" : ""} ready`
                  : "Tap to upload"}
              </span>
              <span className="text-xs text-muted-foreground">
                3–4 photos recommended · JPG or PNG
              </span>
            </div>
          </label>

          {/* Photo tips for best identity match */}
          <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground">📸 For best face accuracy:</p>
            <ul className="space-y-1 pl-1">
              <li>• 1 clear front-facing photo (good lighting)</li>
              <li>• 1 slight side angle (3/4 view)</li>
              <li>• 1 with a different expression (smiling)</li>
              <li>• Avoid sunglasses, heavy filters, or group photos</li>
            </ul>
          </div>

          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {previews.map((p, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-border group"
                >
                  <img src={p} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setFiles((prev) => prev.filter((_, j) => j !== i));
                    }}
                    className="absolute top-1 right-1 size-6 rounded-full bg-black/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove photo"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Results */}
        {hasResults && (
          <section className="space-y-4">
            <StepHeader
              n={3}
              title="Your versions"
              subtitle={
                busy
                  ? "Generating — this usually takes 5–15 seconds per shot."
                  : "Tap to download or try again."
              }
              action={
                !busy ? (
                  <button
                    type="button"
                    onClick={resetResults}
                    className="text-xs font-semibold text-foreground underline underline-offset-4 decoration-foreground/40 hover:decoration-foreground"
                  >
                    Start over
                  </button>
                ) : null
              }
            />

            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.min(jobs.length, 3)}, minmax(0, 1fr))`,
              }}
            >
              {jobs.map((job, i) => (
                <ResultCard
                  key={i}
                  job={job}
                  index={i}
                  filenameBase={slugTitle}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Sticky generate bar */}
      <div className="fixed bottom-0 inset-x-0 z-20 backdrop-blur-xl bg-background/80 border-t border-border/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {selected.size} shot{selected.size > 1 ? "s" : ""} ·{" "}
            {files.length} photo{files.length === 1 ? "" : "s"}
          </div>
          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            className="flex-1 sm:flex-none sm:min-w-[280px] inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-foreground text-background text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform shadow-lg shadow-foreground/20"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating {jobs.filter((j) => j.status === "done").length}/
                {jobs.length}…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate {selected.size > 1 ? `${selected.size} versions` : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepHeader({
  n,
  title,
  subtitle,
  action,
}: {
  n: number;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          <span className="size-5 grid place-items-center rounded-full bg-foreground text-background text-[10px]">
            {n}
          </span>
          Step {n}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function ResultCard({
  job,
  index,
  filenameBase,
}: {
  job: Job;
  index: number;
  filenameBase: string;
}) {
  return (
    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden ring-1 ring-border bg-secondary">
      {job.status === "done" && job.result ? (
        <>
          <img
            src={job.result}
            alt={`Result ${index + 1}`}
            className="absolute inset-0 size-full object-cover"
          />
          <a
            href={job.result}
            download={`${filenameBase}-${index + 1}.png`}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-background/90 text-foreground text-[11px] font-semibold shadow-md backdrop-blur"
          >
            <Download className="size-3.5" />
            Save
          </a>
        </>
      ) : job.status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 gap-2">
          <div className="size-10 rounded-full bg-destructive/10 text-destructive grid place-items-center">
            <X className="size-5" />
          </div>
          <p className="text-[11px] font-medium text-destructive line-clamp-3">
            {job.error}
          </p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
          {job.status === "running" ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <ImageIcon className="size-6 opacity-60" />
          )}
          <span className="text-[11px] font-semibold uppercase tracking-widest">
            {job.status === "running" ? "Creating" : "Queued"}
          </span>
        </div>
      )}
    </div>
  );
}
