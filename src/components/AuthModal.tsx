import { useState } from "react";
import { X, Mail, Lock, Sparkles, Eye, EyeOff, Loader2, Coins } from "lucide-react";
import { useAuth, PHOTO_COST, VIDEO_COST, FREE_CREDITS } from "@/lib/auth-context";

type Mode = "login" | "signup";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export function AuthModal({ onClose, defaultMode = "signup" }: { onClose: () => void; defaultMode?: Mode }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    const err = await signInWithGoogle();
    if (err) { setError(err); setGoogleLoading(false); }
    // On success the browser redirects to Google — no need to close modal
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = mode === "signup"
      ? await signUp(email, password)
      : await signIn(email, password);
    setLoading(false);
    if (err) { setError(err); return; }
    if (mode === "signup") { setDone(true); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-[#111] md:rounded-3xl rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl animate-slide-up md:animate-none">
        {/* handle — mobile only */}
        <div className="md:hidden mx-auto w-10 h-1 rounded-full bg-white/20 mb-5" />

        <button onClick={onClose} className="absolute top-4 right-4 size-8 rounded-full bg-white/10 flex items-center justify-center">
          <X className="size-4 text-white/70" />
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-5">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-xl shadow-purple-500/30">
            <Sparkles className="size-6 text-white" />
          </div>
        </div>

        {done ? (
          <div className="text-center space-y-3">
            <h2 className="text-xl font-extrabold text-white">Check your email</h2>
            <p className="text-sm text-white/55 leading-relaxed">
              We sent a confirmation link to <span className="text-white font-semibold">{email}</span>.<br />
              Click the link to activate your account.
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full py-3 rounded-2xl bg-violet-600 text-white text-sm font-bold"
            >
              Got it
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-center text-xl font-extrabold text-white mb-1">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-center text-xs text-white/45 mb-4">
              {mode === "signup"
                ? "No credit card needed"
                : "Sign in to continue creating"}
            </p>

            {/* Free credits welcome — signup only */}
            {mode === "signup" && (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-4 py-3 mb-5">
                <Coins className="size-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-300">
                    {FREE_CREDITS} free credits on sign up
                  </p>
                  <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                    1 photo = {PHOTO_COST} credits &nbsp;·&nbsp; 1 video = {VIDEO_COST} credits
                  </p>
                </div>
              </div>
            )}

            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-white hover:bg-gray-50 text-gray-800 text-sm font-bold transition-colors shadow-sm disabled:opacity-60 mb-4"
            >
              {googleLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30 font-medium">or use email</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              {/* Email */}
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
                <input
                  type="email"
                  placeholder="Email address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/8 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 focus:bg-white/10 transition-all"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/8 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 focus:bg-white/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>

            <p className="text-center text-xs text-white/40 mt-5">
              {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <button
                onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(null); }}
                className="text-violet-400 font-semibold hover:text-violet-300"
              >
                {mode === "signup" ? "Sign in" : "Create account"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
