"use client";

import { X, HelpCircle } from "lucide-react";

export interface HelpSection {
  icon?: string;
  heading: string;
  body: string | string[];
  highlight?: "sky" | "emerald" | "amber" | "violet" | "red";
}

interface HelpModalProps {
  title: string;
  subtitle?: string;
  sections: HelpSection[];
  onClose: () => void;
}

const HIGHLIGHT_STYLES: Record<string, { border: string; iconBg: string }> = {
  sky:     { border: "border-sky-500/20",     iconBg: "bg-sky-500/10 text-sky-400"     },
  emerald: { border: "border-emerald-500/20", iconBg: "bg-emerald-500/10 text-emerald-400" },
  amber:   { border: "border-amber-500/20",   iconBg: "bg-amber-500/10 text-amber-400"  },
  violet:  { border: "border-violet-500/20",  iconBg: "bg-violet-500/10 text-violet-400" },
  red:     { border: "border-red-500/20",     iconBg: "bg-red-500/10 text-red-400"      },
  default: { border: "border-slate-800",      iconBg: "bg-slate-800 text-slate-400"      },
};

export default function HelpModal({ title, subtitle, sections, onClose }: HelpModalProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/70 pointer-events-auto animate-fade-in">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sections */}
          <div className="p-5 space-y-3">
            {sections.map((s, i) => {
              const styles = HIGHLIGHT_STYLES[s.highlight ?? "default"];
              return (
                <div key={i} className={`rounded-xl border ${styles.border} bg-slate-800/30 p-4`}>
                  <div className="flex items-start gap-3">
                    {s.icon && (
                      <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-base shrink-0 ${styles.iconBg}`}>
                        {s.icon}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 mb-1.5">{s.heading}</p>
                      {Array.isArray(s.body) ? (
                        <ul className="space-y-1.5">
                          {s.body.map((line, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-slate-400 leading-relaxed">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 pb-5 flex justify-center">
            <button
              onClick={onClose}
              className="px-8 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Small inline "?" trigger button used on every page header     */
/* ────────────────────────────────────────────────────────────── */
interface HelpButtonProps {
  onClick: () => void;
}
export function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      title="Ayuda sobre esta página"
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-sky-400 border border-slate-700 hover:border-sky-500/30 hover:bg-sky-500/5 rounded-lg transition-all"
    >
      <HelpCircle className="w-3.5 h-3.5" />
      Ayuda
    </button>
  );
}
