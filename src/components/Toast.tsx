import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { Coins, X } from "lucide-react";

type Toast = { id: number; message: string; sub?: string };

type ToastCtx = { show: (message: string, sub?: string) => void };
const Ctx = createContext<ToastCtx>({ show: () => {} });

export function useToast() { return useContext(Ctx); }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, sub?: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, sub }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 bg-[#1a1a1a] border border-amber-500/30 text-white px-4 py-3 rounded-2xl shadow-2xl animate-slide-down min-w-[260px] max-w-xs"
          >
            <div className="size-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <Coins className="size-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">{t.message}</p>
              {t.sub && <p className="text-xs text-white/50 mt-0.5">{t.sub}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-white/30 hover:text-white/60 shrink-0">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
