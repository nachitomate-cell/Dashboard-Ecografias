"use client";

import ToastContainer from "./Toast";
import CommandPalette from "./CommandPalette";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer />
      <CommandPalette />
    </>
  );
}
