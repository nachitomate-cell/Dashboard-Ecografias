"use client";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastPayload {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

function emit(message: string, type: ToastType, duration = 3800) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>("app-toast", {
      detail: { id: `${Date.now()}-${Math.random()}`, message, type, duration },
    })
  );
}

export const toast = {
  success: (m: string, d?: number) => emit(m, "success", d),
  error:   (m: string, d?: number) => emit(m, "error",   d),
  warning: (m: string, d?: number) => emit(m, "warning", d),
  info:    (m: string, d?: number) => emit(m, "info",    d),
};
