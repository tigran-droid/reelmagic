import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Scissors } from "lucide-react";
import { Slider } from "@/components/ui/slider";

type Props = {
  file?: File | null;
  url?: string;
  start: number;
  end: number | null;
  onChange: (start: number, end: number | null) => void;
};

function fmt(t: number) {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioTrimmer({ file, url, start, end, onChange }: Props) {
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const src = objectUrl ?? url ?? "";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);

  // Initialize end when duration becomes known
  useEffect(() => {
    if (duration > 0 && end == null) onChange(start, duration);
  }, [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loop within trim range during preview
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setNow(a.currentTime);
      const stopAt = end ?? duration;
      if (stopAt && a.currentTime >= stopAt) {
        a.currentTime = start;
        if (!playing) a.pause();
      }
    };
    a.addEventListener("timeupdate", onTime);
    return () => a.removeEventListener("timeupdate", onTime);
  }, [start, end, duration, playing]);

  const effectiveEnd = end ?? duration;

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      if (a.currentTime < start || a.currentTime >= effectiveEnd) a.currentTime = start;
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="bg-background border border-border rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Scissors className="size-4 text-brand" />
        <span className="text-xs font-medium">Trim audio</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {fmt(start)} – {fmt(effectiveEnd)} · {fmt(Math.max(0, effectiveEnd - start))}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration || 0)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="size-9 rounded-full bg-brand text-white flex items-center justify-center shrink-0"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            {duration > 0 && (
              <>
                <div
                  className="absolute top-0 bottom-0 bg-brand/30"
                  style={{
                    left: `${(start / duration) * 100}%`,
                    width: `${((effectiveEnd - start) / duration) * 100}%`,
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground"
                  style={{ left: `${(now / duration) * 100}%` }}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {duration > 0 && (
        <>
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Start</span>
              <span>{fmt(start)}</span>
            </div>
            <Slider
              value={[start]}
              min={0}
              max={duration}
              step={0.1}
              onValueChange={(v) => {
                const s = Math.min(v[0], effectiveEnd - 0.5);
                onChange(s, end);
              }}
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>End</span>
              <span>{fmt(effectiveEnd)}</span>
            </div>
            <Slider
              value={[effectiveEnd]}
              min={0}
              max={duration}
              step={0.1}
              onValueChange={(v) => {
                const e = Math.max(v[0], start + 0.5);
                onChange(start, e);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
