import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Check, Sparkles, Zap, Crown, ArrowLeft, Coins } from "lucide-react";
import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { useAuth, PHOTO_COST, VIDEO_COST } from "@/lib/auth-context";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Magic Studio" },
      { name: "description", content: "Choose your Magic Studio plan." },
    ],
  }),
  component: Pricing,
});

const packs = [
  {
    id: "free",
    name: "Free starter",
    price: "$0",
    credits: 10,
    icon: <Sparkles className="size-5 text-white/60" />,
    color: "bg-white/5",
    border: "border-border",
    features: [
      `10 free credits on sign up`,
      `1 photo = ${PHOTO_COST} credits`,
      `1 video = ${VIDEO_COST} credits`,
      "No credit card needed",
    ],
    cta: "Current plan",
    disabled: true,
  },
  {
    id: "starter",
    name: "Starter Pack",
    price: "$10",
    credits: 300,
    icon: <Zap className="size-5 text-violet-300" />,
    color: "bg-gradient-to-br from-violet-600/20 to-purple-700/20",
    border: "border-violet-500/40",
    badge: "Most popular",
    features: [
      "300 credits",
      `≈ ${Math.floor(300 / PHOTO_COST)} photos or ${Math.floor(300 / VIDEO_COST)} videos`,
      "Credits never expire",
      "Priority processing",
    ],
    cta: "Buy for $10",
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro Pack",
    price: "$20",
    credits: 1000,
    icon: <Crown className="size-5 text-amber-400" />,
    color: "bg-gradient-to-br from-amber-500/15 to-orange-600/15",
    border: "border-amber-500/30",
    badge: "Best value",
    features: [
      "1,000 credits",
      `≈ ${Math.floor(1000 / PHOTO_COST)} photos or ${Math.floor(1000 / VIDEO_COST)} videos`,
      "Credits never expire",
      "Priority processing",
      "50% cheaper per credit",
    ],
    cta: "Buy for $20",
  },
];

function Pricing() {
  const { user, credits } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [notified, setNotified] = useState<string[]>([]);

  function handleCta(packId: string) {
    if (packId === "free") return;
    if (!user) { setShowAuth(true); return; }
    // Payment not yet integrated — collect interest for now
    setNotified((p) => [...p, packId]);
  }

  return (
    <MobileFrame>
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="absolute top-4 left-4 z-10 size-9 rounded-full bg-secondary border border-border flex items-center justify-center"
        aria-label="Back"
      >
        <ArrowLeft className="size-4" />
      </button>

      <div className="px-5 pt-16 pb-10 max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-400 text-xs font-bold mb-4">
            <Coins className="size-3" /> Credits
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Buy credits</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Pay once, use anytime. Credits never expire.
          </p>
        </div>

        {/* Current balance pill — only when signed in */}
        {user && (
          <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20">
            <Coins className="size-4 text-violet-400" />
            <span className="text-sm font-bold text-violet-300">
              {credits} credit{credits !== 1 ? "s" : ""} remaining
            </span>
          </div>
        )}

        {/* How credits work */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">How it works</p>
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
              <Sparkles className="size-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Photo generation = {PHOTO_COST} credits</p>
              <p className="text-xs text-muted-foreground">AI face swap / style recreation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
              <Zap className="size-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Video generation = {VIDEO_COST} credits</p>
              <p className="text-xs text-muted-foreground">Full AI video from your photo</p>
            </div>
          </div>
        </div>

        {/* Packs */}
        <div className="space-y-4">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className={`relative rounded-2xl border p-5 ${pack.color} ${pack.border}`}
            >
              {pack.badge && (
                <div className={`absolute -top-2.5 left-5 px-3 py-0.5 rounded-full text-white text-[10px] font-extrabold uppercase tracking-wider ${pack.id === "pro" ? "bg-amber-500" : "bg-violet-600"}`}>
                  {pack.badge}
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center">
                    {pack.icon}
                  </div>
                  <div>
                    <div className="font-extrabold text-foreground">{pack.name}</div>
                    <div className="text-xs text-muted-foreground">{pack.price}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold tabular-nums">{pack.credits.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">credits</div>
                </div>
              </div>

              <ul className="space-y-2 mb-5">
                {pack.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground/80">
                    <Check className="size-3.5 text-green-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCta(pack.id)}
                disabled={pack.disabled || notified.includes(pack.id)}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  pack.highlight
                    ? "bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20"
                    : pack.id === "pro"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 shadow-lg shadow-amber-500/20"
                    : "bg-secondary border border-border text-foreground"
                } disabled:opacity-50 disabled:cursor-default`}
              >
                {notified.includes(pack.id) ? "✓ We'll notify you when live!" : pack.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Payment integration coming soon. Click a pack to be notified when it launches.
        </p>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} defaultMode="signup" />}
    </MobileFrame>
  );
}
