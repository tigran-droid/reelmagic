import { useState } from "react";
import { X, Mail, Lock, Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Mode = "login" | "signup";

export function AuthModal({ onClose, defaultMode = "signup" }: { onClose: () => void; defaultMode?: Mode }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
            <p className="text-center text-xs text-white/45 mb-6">
              {mode === "signup"
                ? "Get 3 free AI generations — no credit card needed"
                : "Sign in to continue creating"}
            </p>

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
