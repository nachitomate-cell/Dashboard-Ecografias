"use client";

import { useState } from "react";
import { Menu, Stethoscope } from "lucide-react";
import Sidebar from "./Sidebar";
import ExportButton from "./ExportButton";
import ToastContainer from "./Toast";
import CommandPalette from "./CommandPalette";
import WelcomeModal from "./WelcomeModal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-20 flex md:hidden items-center gap-3 px-4 h-14 bg-slate-950 border-b border-slate-800 no-print">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <Stethoscope className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-sm font-semibold text-slate-100">Tecnólogo · Ecografía</span>
        </div>
      </div>

      {/* Main flex layout */}
      <div className="flex h-screen overflow-hidden pt-14 md:pt-0">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="flex-1 overflow-y-auto bg-slate-950 bg-mesh">
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>

      <ExportButton />
      <ToastContainer />
      <CommandPalette />
      <WelcomeModal />
    </>
  );
}
