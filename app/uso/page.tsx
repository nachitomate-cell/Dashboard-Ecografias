"use client";

import { useEffect, useState, useCallback } from "react";
import { HardDrive, Database, RefreshCw, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { getStorageUsage, clearAllData, type StorageEntry } from "@/lib/store";
import clsx from "clsx";

function fmtBytes(b: number): string {
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

const APP_KEYS = [
  "ecografia_registros",
  "ecografia_liquidaciones",
  "ecografia_estados_dia",
  "ecografia_prestaciones",
  "ecografia_precios",
  "ecografia_tope_config",
] as const;

const KEY_COLORS: Record<string, string> = {
  "ecografia_registros":    "#38bdf8",
  "ecografia_liquidaciones":"#818cf8",
  "ecografia_estados_dia":  "#a78bfa",
  "ecografia_prestaciones": "#34d399",
  "ecografia_precios":      "#fb923c",
  "ecografia_tope_config":  "#64748b",
};
const KEY_LABELS: Record<string, string> = {
  "ecografia_registros":    "Registros HIS",
  "ecografia_liquidaciones":"Liquidaciones",
  "ecografia_estados_dia":  "Estados por día",
  "ecografia_prestaciones": "Prestaciones",
  "ecografia_precios":      "Precios",
  "ecografia_tope_config":  "Configuración",
};
const KEY_ICONS: Record<string, string> = {
  "ecografia_registros":    "Historial de atenciones importadas",
  "ecografia_liquidaciones":"Liquidaciones mensuales importadas",
  "ecografia_estados_dia":  "Conteo de estados por día (Fin, PorRec, Ausente...)",
  "ecografia_prestaciones": "Catálogo de prestaciones",
  "ecografia_precios":      "Tabla de precios por nivel (Arancel MLE 2026)",
  "ecografia_tope_config":  "Meta mensual y porcentaje de acuerdo",
};

export default function UsoPage() {
  const [data, setData] = useState<{ entries: StorageEntry[]; totalBytes: number; limitBytes: number } | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);
  const [cleared, setCleared] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setData(getStorageUsage());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function clearKey(key: string) {
    setClearing(key);
    setTimeout(() => {
      localStorage.removeItem(key);
      setClearing(null);
      setCleared(key);
      refresh();
      setTimeout(() => setCleared(null), 2000);
    }, 400);
  }

  function clearAll() {
    clearAllData(); // usa la función centralizada que borra TODAS las claves de la app
    refresh();
  }

  if (!data) return null;

  const pct = Math.min((data.totalBytes / data.limitBytes) * 100, 100);
  const statusColor = pct > 80 ? "text-red-400" : pct > 50 ? "text-amber-400" : "text-emerald-400";
  const barColor   = pct > 80 ? "#f87171"  : pct > 50 ? "#fbbf24"  : "#34d399";

  const appKeysSet = new Set(APP_KEYS as readonly string[]);
  const appEntries = data.entries.filter((e) => appKeysSet.has(e.key));
  const otherEntries = data.entries.filter((e) => !appKeysSet.has(e.key));

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Uso de Almacenamiento</h1>
          <p className="text-sm text-slate-500 mt-0.5">LocalStorage del navegador</p>
        </div>
        <button onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg transition-all">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Gauge principal */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 border border-slate-700">
            <HardDrive className="w-6 h-6 text-slate-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-end justify-between mb-2">
              <p className="text-sm font-medium text-slate-300">Almacenamiento total usado</p>
              <p className={clsx("text-sm font-bold tabular-nums", statusColor)}>{pct.toFixed(1)}%</p>
            </div>
            {/* Barra segmentada */}
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: barColor }} />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-slate-600">
              <span>{fmtBytes(data.totalBytes)} usados</span>
              <span>{fmtBytes(data.limitBytes - data.totalBytes)} libres · límite {fmtBytes(data.limitBytes)}</span>
            </div>
          </div>
        </div>

        {pct > 80 && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Almacenamiento casi lleno. Considera limpiar registros antiguos.
          </div>
        )}
        {pct <= 20 && data.totalBytes > 0 && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Almacenamiento en buen estado.
          </div>
        )}
      </div>

      {/* Desglose por clave de la app */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            <p className="text-sm font-medium text-slate-300">Dashboard Ecografía</p>
          </div>
          <button onClick={clearAll}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 border border-slate-700 hover:border-red-500/30 px-3 py-1.5 rounded-lg transition-all">
            <Trash2 className="w-3 h-3" /> Limpiar todo
          </button>
        </div>

        {APP_KEYS.length > 0 && (
          <div className="divide-y divide-slate-800/60">
            {APP_KEYS.map((key) => {
              const entry = appEntries.find((e) => e.key === key);
              const bytes = entry?.bytes ?? 0;
              const rowPct = data.totalBytes > 0 ? (bytes / data.limitBytes) * 100 : 0;
              const color = KEY_COLORS[key] ?? "#64748b";
              const isClearingThis = clearing === key;
              const isClearedThis = cleared === key;

              return (
                <div key={key} className="px-5 py-4 hover:bg-slate-800/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ background: color }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200">{KEY_LABELS[key] ?? key}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{KEY_ICONS[key] ?? ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm tabular-nums font-medium text-slate-400">{fmtBytes(bytes)}</p>
                      <button
                        onClick={() => clearKey(key)}
                        disabled={bytes === 0 || isClearingThis}
                        className={clsx(
                          "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all",
                          isClearedThis
                            ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                            : bytes === 0
                            ? "text-slate-700 border-slate-800 cursor-not-allowed"
                            : "text-slate-500 hover:text-red-400 border-slate-700 hover:border-red-500/30"
                        )}
                      >
                        {isClearedThis
                          ? <><CheckCircle className="w-3 h-3" /> Limpiado</>
                          : isClearingThis
                          ? <><RefreshCw className="w-3 h-3 animate-spin" /> ...</>
                          : <><Trash2 className="w-3 h-3" /> Limpiar</>}
                      </button>
                    </div>
                  </div>
                  {bytes > 0 && (
                    <div className="mt-3 ml-6 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(rowPct, 0.5)}%`, background: color, opacity: 0.7 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {appEntries.length === 0 && (
          <div className="px-5 py-8 text-center text-slate-600 text-sm">
            No hay datos guardados aún.
          </div>
        )}
      </div>

      {/* Otras claves del navegador */}
      {otherEntries.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <p className="text-sm font-medium text-slate-500">Otros datos del navegador</p>
          </div>
          <div className="divide-y divide-slate-800/60">
            {otherEntries.map((e) => (
              <div key={e.key} className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/10">
                <p className="text-xs text-slate-600 font-mono truncate max-w-xs">{e.key}</p>
                <p className="text-xs text-slate-600 tabular-nums shrink-0 ml-4">{fmtBytes(e.bytes)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-slate-700 text-center">
        El límite de localStorage varía por navegador. Chrome y Edge permiten ~5–10 MB por origen.
        Los datos persisten hasta que se limpie el caché o se eliminen manualmente.
      </p>
    </div>
  );
}
