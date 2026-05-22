"use client";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastPayload {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
}

export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
}

function emit(message: string, type: ToastType, opts?: ToastOptions | number) {
  if (typeof window === "undefined") return;
  const duration = typeof opts === "number" ? opts : (opts?.duration ?? 3800);
  const action   = typeof opts === "number" ? undefined : opts?.action;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>("app-toast", {
      detail: { id: `${Date.now()}-${Math.random()}`, message, type, duration, action },
    })
  );
}

export const toast = {
  success: (m: string, opts?: ToastOptions | number) => emit(m, "success", opts),
  error:   (m: string, opts?: ToastOptions | number) => emit(m, "error",   opts),
  warning: (m: string, opts?: ToastOptions | number) => emit(m, "warning", opts),
  info:    (m: string, opts?: ToastOptions | number) => emit(m, "info",    opts),
};
