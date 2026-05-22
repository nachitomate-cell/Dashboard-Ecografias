"use client";

import ToastContainer from "./Toast";
import CommandPalette from "./CommandPalette";
import WelcomeModal from "./WelcomeModal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer />
      <CommandPalette />
      <WelcomeModal />
    </>
  );
}
