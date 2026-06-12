import { createContext, useContext, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// ── Credit economy ───────────────────────────────────────────────────────────
export const FREE_CREDITS = 10;   // credits each new user starts with
export const PHOTO_COST = 3;      // credits per photo generation
export const VIDEO_COST = 20;     // credits per video generation

// Admin emails (must match SETUP_CREDITS.sql)
const ADMIN_EMAILS = ["tigran@aheadofthewave.ai", "tigrangregoryan@gmail.com"];

// ── Auth context ─────────────────────────────────────────────────────────────

type AuthCtx = {
  user: User | null;
  loading: boolean;
  credits: number;
  isAdmin: boolean;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Spend credits after a successful generation. Returns true on success. */
  deductCredits: (amount: number) => Promise<boolean>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  credits: 0,
  isAdmin: false,
  signUp: async () => null,
  signIn: async () => null,
  signInWithGoogle: async () => null,
  signOut: async () => {},
  refreshProfile: async () => {},
  deductCredits: async () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) {
      setCredits(0);
      setIsAdmin(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("credits, is_admin")
      .eq("id", u.id)
      .maybeSingle();

    if (error || !data) {
      // Profile row may not exist yet (trigger lag). Fall back to email check.
      setCredits(0);
      setIsAdmin(ADMIN_EMAILS.includes((u.email ?? "").toLowerCase()));
      return;
    }
    setCredits(data.credits ?? 0);
    setIsAdmin(!!data.is_admin);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      void loadProfile(u);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null;
      setUser(u);
      void loadProfile(u);
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(user);
  }, [loadProfile, user]);

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

  async function deductCredits(amount: number): Promise<boolean> {
    const { data, error } = await supabase.rpc("deduct_credits", { p_amount: amount });
    if (error) {
      // Re-sync so the UI shows the true balance.
      await refreshProfile();
      return false;
    }
    if (typeof data === "number") setCredits(data);
    return true;
  }

  return (
    <Ctx.Provider
      value={{
        user, loading, credits, isAdmin,
        signUp, signIn, signInWithGoogle, signOut,
        refreshProfile, deductCredits,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
