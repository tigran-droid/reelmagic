import { X, Sparkles, Zap, Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function PaywallModal({ onClose, onSignIn }: { onClose: () => void; onSignIn: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-[#111] md:rounded-3xl rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl animate-slide-up md:animate-none">
        <div className="md:hidden mx-auto w-10 h-1 rounded-full bg-white/20 mb-5" />

        <button onClick={onClose} className="absolute top-4 right-4 size-8 rounded-full bg-white/10 flex items-center justify-center">
          <X className="size-4 text-white/70" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="relative">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/30">
              <Crown className="size-7 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 size-5 rounded-full bg-violet-600 flex items-center justify-center">
              <Sparkles className="size-3 text-white" />
            </div>
          </div>
        </div>

        <h2 className="text-center text-xl font-extrabold text-white mb-2">
          Out of credits
        </h2>
        <p className="text-center text-sm text-white/50 mb-6 leading-relaxed">
          You've used all your free credits.<br />
          Upgrade to keep creating AI reels & videos.
        </p>

        {/* Credit packs preview */}
        <div className="space-y-2 mb-6">
          <PlanRow
            icon={<Zap className="size-4 text-violet-400" />}
            name="Starter Pack"
            desc="300 credits — ~100 photos or 15 videos"
            badge="$10"
          />
          <PlanRow
            icon={<Crown className="size-4 text-amber-400" />}
            name="Pro Pack"
            desc="1,000 credits — ~333 photos or 50 videos"
            badge="$20"
          />
        </div>

        {/* CTA */}
        <Link
          to="/pricing"
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold shadow-lg shadow-violet-500/30 hover:opacity-90 transition-opacity"
        >
          <Sparkles className="size-4" />
          See pricing plans
        </Link>

        <button
          onClick={onSignIn}
          className="mt-3 w-full py-3 rounded-2xl bg-white/8 text-white/60 text-sm font-semibold hover:bg-white/12 transition-colors"
        >
          Already subscribed? Sign in
        </button>
      </div>
    </div>
  );
}

function PlanRow({ icon, name, desc, badge }: { icon: React.ReactNode; name: string; desc: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3 border border-white/8">
      <div className="size-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{name}</span>
          {badge && (
            <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-500/30 text-violet-300">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[11px] text-white/40 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
