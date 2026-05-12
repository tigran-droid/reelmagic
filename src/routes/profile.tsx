import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Plus, Settings, Upload } from "lucide-react";
import { useState } from "react";
import avatar from "@/assets/avatar.jpg";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Magic Studio" },
      { name: "description", content: "Your photos, your reels, your AI." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const [tab, setTab] = useState<"photos" | "generated">("photos");
  const photos = Array.from({ length: 5 });

  return (
    <MobileFrame>
      <header className="pt-12 px-6 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold">@you</h1>
        <button className="size-9 rounded-full bg-secondary grid place-items-center">
          <Settings className="size-4" />
        </button>
      </header>

      <div className="px-6 mt-2">
        <div className="flex items-center gap-5">
          <div className="size-20 rounded-full bg-card outline outline-2 outline-offset-2 outline-brand/40 overflow-hidden">
            <img src={avatar} alt="Avatar" loading="lazy" className="size-full object-cover" />
          </div>
          <div className="flex-1 grid grid-cols-3 gap-2 text-center">
            <Stat value="12" label="Reels" />
            <Stat value="2.4k" label="Views" />
            <Stat value="318" label="Fans" />
          </div>
        </div>

        <div className="mt-5">
          <h2 className="text-base font-semibold">Ava Carter</h2>
          <p className="text-sm text-muted-foreground">Digital artist · Making AI reels ✨</p>
        </div>

        <button className="mt-5 w-full py-3.5 rounded-2xl bg-brand text-brand-foreground font-semibold flex items-center justify-center gap-2">
          <Upload className="size-4" />
          Upload Photos
        </button>
      </div>

      <div className="mt-6 px-6 flex gap-6 border-b border-border">
        {(["photos", "generated"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium relative capitalize ${
              tab === t ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {t === "photos" ? "Your Photos" : "Generated"}
            {tab === t && <div className="absolute -bottom-px inset-x-0 h-0.5 bg-brand" />}
          </button>
        ))}
      </div>

      <div className="px-6 mt-3 grid grid-cols-3 gap-1.5 pb-6">
        {photos.map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-card border border-border grid place-items-center"
          >
            <span className="text-[10px] text-muted-foreground">0{i + 1}</span>
          </div>
        ))}
        <button className="aspect-square rounded-lg bg-card border border-dashed border-border grid place-items-center text-muted-foreground hover:text-brand hover:border-brand transition-colors">
          <Plus className="size-5" />
        </button>
      </div>
    </MobileFrame>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-base font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
