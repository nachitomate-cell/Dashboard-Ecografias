"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import type { ToastPayload, ToastType } from "@/lib/toast";

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
};

const STYLES: Record<ToastType, { border: string; icon: string; bar: string }> = {
  success: { border: "border-emerald-500/30", icon: "text-emerald-400", bar: "bg-emerald-400" },
  error:   { border: "border-red-500/30",     icon: "text-red-400",     bar: "bg-red-400"     },
  warning: { border: "border-amber-500/30",   icon: "text-amber-400",   bar: "bg-amber-400"   },
  info:    { border: "border-sky-500/30",      icon: "text-sky-400",     bar: "bg-sky-400"     },
};

interface ActiveToast extends ToastPayload {
  exiting: boolean;
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 320);
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      const { id, message, type, duration } = (e as CustomEvent<ToastPayload>).detail;
      setToasts((prev) => [...prev.slice(-4), { id, message, type, duration, exiting: false }]);
      setTimeout(() => remove(id), duration);
    }
    window.addEventListener("app-toast", handler);
    return () => window.removeEventListener("app-toast", handler);
  }, [remove]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        const s    = STYLES[t.type];
        return (
          <div
            key={t.id}
            style={{ animationDuration: "0.3s" }}
            className={[
              "pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-[360px]",
              "rounded-xl border bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-slate-950/60",
              s.border,
              t.exiting ? "animate-slide-out-right" : "animate-slide-in-right",
            ].join(" ")}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.icon}`} />
            <p className="text-sm text-slate-200 flex-1 leading-snug">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-slate-600 hover:text-slate-300 transition-colors mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
            {/* progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden">
              <div
                className={`h-full ${s.bar} opacity-40`}
                style={{ animation: `toast-shrink ${t.duration}ms linear forwards` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
