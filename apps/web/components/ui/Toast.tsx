"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export const useToast = () => useContext(ToastContext);

// Tone is conveyed by an icon glyph and border as well as colour.
const TONES: Record<Tone, { box: string; icon: string }> = {
  success: { box: "border-primary bg-primary-50 text-primary-dark", icon: "✓" },
  error: { box: "border-chili bg-chili-50 text-chili-dark", icon: "!" },
  info: { box: "border-monsoon bg-monsoon-50 text-monsoon-dark", icon: "i" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((cur) => cur.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = Date.now() + Math.random();
      setItems((cur) => [...cur.slice(-2), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((it) => (
          <div
            key={it.id}
            className={`pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-card border px-4 py-3 shadow-raised ${TONES[it.tone].box}`}
          >
            <span aria-hidden="true" className="mt-0.5 font-bold">
              {TONES[it.tone].icon}
            </span>
            <p className="flex-1 text-sm font-medium">{it.message}</p>
            <button
              type="button"
              onClick={() => dismiss(it.id)}
              aria-label={t("common.dismiss")}
              className="-m-2 min-h-touch min-w-touch text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
