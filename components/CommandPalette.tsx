"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, BarChart2, GitCompare, Settings, HardDrive,
  Search, ArrowRight, FileSpreadsheet, Download, TrendingUp,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  kbd?: string;
}

function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return { open, setOpen };
}

export default function CommandPalette() {
  const router = useRouter();
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => { setOpen(false); setQuery(""); setCursor(0); }, [setOpen]);

  const commands: Command[] = [
    { id: "diario",       label: "Ir a Diario",           description: "Resumen diario y carga de archivos HIS",   icon: Activity,        action: () => router.push("/diario"),        kbd: "D" },
    { id: "mensual",      label: "Ir a Mensual",           description: "Resumen mensual, meta y liquidación",      icon: BarChart2,       action: () => router.push("/mensual"),       kbd: "M" },
    { id: "verificacion", label: "Ir a Verificación",      description: "Comparar HIS vs liquidación por período",  icon: GitCompare,      action: () => router.push("/comparacion"),   kbd: "V" },
    { id: "tendencia",    label: "Ir a Tendencia",         description: "Evolución histórica multi-mes",            icon: TrendingUp,      action: () => router.push("/tendencia"),     kbd: "T" },
    { id: "config",       label: "Ir a Configuración",     description: "Prestaciones, precios, nivel y meta",      icon: Settings,        action: () => router.push("/configuracion"), kbd: "," },
    { id: "uso",          label: "Ir a Almacenamiento",    description: "Uso del localStorage y limpiar datos",     icon: HardDrive,       action: () => router.push("/uso"),           kbd: "S" },
    { id: "carga",        label: "Cargar Excel HIS",       description: "Importar archivos de trabajo diario",      icon: FileSpreadsheet, action: () => { close(); router.push("/diario"); } },
    { id: "export-json",  label: "Exportar backup JSON",   description: "Descarga todos los datos del dashboard",   icon: Download,        action: () => { close(); window.dispatchEvent(new CustomEvent("export-json")); } },
    { id: "export-csv",   label: "Exportar registros CSV", description: "Descarga registros para Excel/Sheets",     icon: Download,        action: () => { close(); window.dispatchEvent(new CustomEvent("export-csv"));  } },
  ];

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : commands;

  useEffect(() => { setCursor(0); }, [query]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return; }
    if (e.key === "Enter" && filtered[cursor]) { filtered[cursor].action(); close(); return; }

    // Single-key shortcuts — only when search is empty and no modifier keys
    if (!query && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      const match = commands.find((c) => c.kbd === e.key.toUpperCase() || c.kbd === e.key);
      if (match) {
        e.preventDefault();
        match.action();
        close();
      }
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      onClick={close}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-slate-950/80 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar acciones..."
            className="flex-1 bg-transparent text-slate-200 placeholder-slate-600 text-sm outline-none"
          />
          <kbd className="text-xs text-slate-600 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="py-2 max-h-80 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-sm text-slate-600 text-center py-8">Sin resultados</p>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            const active = i === cursor;
            return (
              <button
                key={cmd.id}
                onClick={() => { cmd.action(); close(); }}
                onMouseEnter={() => setCursor(i)}
                className={[
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  active ? "bg-sky-500/10" : "hover:bg-slate-800/50",
                ].join(" ")}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${active ? "bg-sky-500/15 border-sky-500/30 text-sky-400" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${active ? "text-slate-100" : "text-slate-300"}`}>{cmd.label}</p>
                  {cmd.description && <p className="text-xs text-slate-600 truncate">{cmd.description}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {cmd.kbd && (
                    <kbd className="text-xs text-slate-600 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono">{cmd.kbd}</kbd>
                  )}
                  {active && <ArrowRight className="w-3.5 h-3.5 text-sky-400" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1"><kbd className="bg-slate-800 border border-slate-700 px-1 py-0.5 rounded font-mono">↑↓</kbd> navegar</span>
            <span className="flex items-center gap-1"><kbd className="bg-slate-800 border border-slate-700 px-1 py-0.5 rounded font-mono">↵</kbd> abrir</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
            <span>para abrir</span>
          </div>
        </div>
      </div>
    </div>
  );
}
