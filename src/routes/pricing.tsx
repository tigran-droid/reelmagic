import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Check, Sparkles, Zap, Crown, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Magic Studio" },
      { name: "description", content: "Choose your Magic Studio plan." },
    ],
  }),
  component: Pricing,
});

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    icon: <Sparkles className="size-5 text-white/60" />,
    color: "bg-white/10",
    features: ["3 AI generations", "Standard queue", "Watermarked exports"],
    cta: "Current plan",
    disabled: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "Coming soon",
    period: "",
    icon: <Zap className="size-5 text-violet-300" />,
    color: "bg-gradient-to-br from-violet-600/30 to-purple-700/30",
    border: "border-violet-500/40",
    badge: "Most popular",
    features: [
      "Unlimited generations",
      "Priority processing",
      "HD exports (no watermark)",
      "All styles & filters",
    ],
    cta: "Notify me",
    highlight: true,
  },
  {
    id: "studio",
    name: "Studio",
    price: "Coming soon",
    period: "",
    icon: <Crown className="size-5 text-amber-400" />,
    color: "bg-gradient-to-br from-amber-500/20 to-orange-600/20",
    border: "border-amber-500/30",
    features: [
      "Everything in Pro",
      "API access",
      "Team seats (up to 5)",
      "Analytics dashboard",
      "Priority support",
    ],
    cta: "Notify me",
  },
];

function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [notified, setNotified] = useState<string[]>([]);

  function handleCta(planId: string) {
    if (planId === "free") return;
    if (!user) { setShowAuth(true); return; }
    setNotified((p) => [...p, planId]);
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-400 text-xs font-bold mb-4">
            <Sparkles className="size-3" /> Pricing
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Simple pricing</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Start free. Upgrade when you're ready.
          </p>
        </div>

        <div className="space-y-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-5 ${plan.color} ${plan.border ?? "border-border"}`}
            >
              {plan.badge && (
                <div className="absolute -top-2.5 left-5 px-3 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                  {plan.badge}
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center">
                    {plan.icon}
                  </div>
                  <div>
                    <div className="font-extrabold text-foreground">{plan.name}</div>
                    <div className="text-xs text-muted-foreground">{plan.price}{plan.period}</div>
                  </div>
                </div>
              </div>

              <ul className="space-y-2 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground/80">
                    <Check className="size-3.5 text-green-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCta(plan.id)}
                disabled={plan.disabled || notified.includes(plan.id)}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  plan.highlight
                    ? "bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20"
                    : "bg-secondary border border-border text-foreground hover:bg-secondary/80"
                } disabled:opacity-50 disabled:cursor-default`}
              >
                {notified.includes(plan.id) ? "✓ We'll notify you!" : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Paid plans launching soon. Get notified when they go live.
        </p>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} defaultMode="signup" />}
    </MobileFrame>
  );
}
