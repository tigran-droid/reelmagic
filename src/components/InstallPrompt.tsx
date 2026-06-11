import { useEffect, useState } from "react";
import { X, Share, Plus, Download, Smartphone } from "lucide-react";

type Platform = "ios" | "android" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (typeof window !== "undefined" && window.innerWidth >= 1024) return "desktop";
  return "unknown";
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

// ── Full-screen first-launch modal ──────────────────────────────────────────
export function InstallModal() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    if (isStandalone()) return; // already installed
    const seen = localStorage.getItem("install_modal_seen");
    if (seen) return;
    const p = detectPlatform();
    setPlatform(p);
    if (p === "ios" || p === "android") {
      // small delay so the page renders first
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("install_modal_seen", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismiss} />

      {/* sheet */}
      <div className="relative w-full max-w-[480px] bg-[#111] rounded-t-3xl px-6 pt-5 pb-10 shadow-2xl animate-slide-up">
        {/* handle */}
        <div className="mx-auto w-10 h-1 rounded-full bg-white/20 mb-5" />

        {/* close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 size-8 rounded-full bg-white/10 flex items-center justify-center"
        >
          <X className="size-4 text-white/70" />
        </button>

        {/* icon */}
        <div className="flex justify-center mb-5">
          <div className="size-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-xl shadow-purple-500/30">
            <Smartphone className="size-9 text-white" strokeWidth={1.5} />
          </div>
        </div>

        <h2 className="text-center text-2xl font-extrabold text-white mb-2">
          Install Magic Studio
        </h2>
        <p className="text-center text-sm text-white/55 mb-8 leading-relaxed">
          Add to your home screen for the full app&nbsp;experience — no App Store needed.
        </p>

        {platform === "ios" ? <IosSteps /> : <AndroidSteps />}

        <button
          onClick={dismiss}
          className="mt-6 w-full py-3.5 rounded-2xl bg-white/10 text-white/70 text-sm font-semibold"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

function IosSteps() {
  return (
    <div className="space-y-3">
      <Step n={1} icon={<ShareIcon />} label='Tap the Share button' sub='Bottom center of Safari' />
      <Step n={2} icon={<Plus className="size-5 text-white" strokeWidth={2.5} />} label='"Add to Home Screen"' sub='Scroll down in the share sheet' />
      <Step n={3} icon={<Check />} label='Tap "Add"' sub='App appears on your home screen' />
    </div>
  );
}

function AndroidSteps() {
  return (
    <div className="space-y-3">
      <Step n={1} icon={<MenuDots />} label='Tap ⋮ menu in Chrome' sub='Top right corner' />
      <Step n={2} icon={<Download className="size-5 text-white" strokeWidth={2.5} />} label='"Add to Home screen"' sub='Or "Install app" if prompted' />
      <Step n={3} icon={<Check />} label='Tap "Add"' sub='App appears on your home screen' />
    </div>
  );
}

function Step({ n, icon, label, sub }: { n: number; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-4 bg-white/5 rounded-2xl px-4 py-3">
      <div className="size-8 rounded-full bg-violet-600/30 flex items-center justify-center shrink-0">
        <span className="text-xs font-extrabold text-violet-300">{n}</span>
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold text-white">{label}</div>
        <div className="text-xs text-white/45">{sub}</div>
      </div>
      <div className="size-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
    </div>
  );
}

// ── Small install card for Photoshop page ───────────────────────────────────
export function InstallCard() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setDismissed(!!localStorage.getItem("install_card_dismissed"));
  }, []);

  if (dismissed || isStandalone() || platform === "unknown") return null;

  function handleInstall() {
    if (platform === "ios" || platform === "android") {
      setShowModal(true);
    }
  }

  function handleDismiss() {
    localStorage.setItem("install_card_dismissed", "1");
    setDismissed(true);
  }

  return (
    <>
      <div className="mx-5 mb-6 rounded-2xl bg-gradient-to-br from-violet-600/20 to-purple-900/30 border border-violet-500/20 px-4 py-4 flex items-center gap-4">
        <div className="size-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30">
          <Smartphone className="size-5 text-white" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-white leading-tight">Install as App</div>
          <div className="text-xs text-white/50 mt-0.5">Add to home screen for fast access</div>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold shadow"
        >
          Install
        </button>
        <button onClick={handleDismiss} className="shrink-0 size-6 flex items-center justify-center">
          <X className="size-3.5 text-white/40" />
        </button>
      </div>

      {showModal && (
        <InstallGuideModal platform={platform} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

// ── Shared guide modal (used by InstallCard) ─────────────────────────────────
function InstallGuideModal({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-[#111] rounded-t-3xl px-6 pt-5 pb-10 shadow-2xl animate-slide-up">
        <div className="mx-auto w-10 h-1 rounded-full bg-white/20 mb-5" />
        <button onClick={onClose} className="absolute top-4 right-4 size-8 rounded-full bg-white/10 flex items-center justify-center">
          <X className="size-4 text-white/70" />
        </button>
        <h2 className="text-center text-xl font-extrabold text-white mb-6">How to install</h2>
        {platform === "ios" ? <IosSteps /> : <AndroidSteps />}
        <button onClick={onClose} className="mt-6 w-full py-3.5 rounded-2xl bg-white/10 text-white/70 text-sm font-semibold">
          Got it
        </button>
      </div>
    </div>
  );
}

// ── Tiny SVG helpers ──────────────────────────────────────────────────────────
function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MenuDots() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}
