import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const FREE_LIMIT = 3;
const USAGE_PREFIX = "usage_v1_";

export function getUsageCount(userId: string): number {
  try {
    return parseInt(localStorage.getItem(USAGE_PREFIX + userId) ?? "0", 10);
  } catch {
    return 0;
  }
}

export function incrementUsage(userId: string): number {
  const next = getUsageCount(userId) + 1;
  try {
    localStorage.setItem(USAGE_PREFIX + userId, String(next));
  } catch { /* noop */ }
  return next;
}

export function hasReachedLimit(userId: string): boolean {
  return getUsageCount(userId) >= FREE_LIMIT;
}

export const FREE_GENERATION_LIMIT = FREE_LIMIT;

// ── Auth context ─────────────────────────────────────────────────────────────

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  signUp: async () => null,
  signIn: async () => null,
  signInWithGoogle: async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signInWithGoogle() {
    const redirectTo = "https://reelmagic.tigran-1ab.workers.dev/";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { access_type: "offline", prompt: "select_account" } },
    });
    return error?.message ?? null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return <Ctx.Provider value={{ user, loading, signUp, signIn, signInWithGoogle, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
