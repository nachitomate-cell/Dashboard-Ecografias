"use client";

import { useRef, useState, useEffect } from "react";
import { Download, FileJson, FileText, X, Check, Upload, AlertTriangle } from "lucide-react";
import {
  getRegistros, getPrestaciones, getPrecios, getLiquidaciones, getEstadosDia, getTopeConfig,
  saveRegistros, savePrestaciones, savePrecios, saveLiquidaciones, saveTopeConfig, upsertEstadoDia,
  type Registro, type Prestacion, type PrecioPrestacion, type Liquidacion, type EstadoDia, type TopeConfig,
} from "@/lib/store";
import clsx from "clsx";

interface BackupPayload {
  version: number;
  exportadoEn: string;
  prestaciones: Prestacion[];
  precios: PrecioPrestacion[];
  registros: Registro[];
  liquidaciones: Liquidacion[];
  estadosDia: EstadoDia[];
  topeConfig: TopeConfig;
}

const BACKUP_KEY = "ecografia_last_backup";

function daysSinceBackup(): number | null {
  try {
    const ts = localStorage.getItem(BACKUP_KEY);
    if (!ts) return null;
    const diff = Date.now() - new Date(ts).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  } catch { return null; }
}

export default function ExportButton() {
  const [open, setOpen]           = useState(false);
  const [done, setDone]           = useState<"json" | "csv" | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<"idle" | "ok" | "error">("idle");
  const [restoreMsg, setRestoreMsg]       = useState("");
  const [backupDays, setBackupDays]       = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBackupDays(daysSinceBackup());
  }, [open]);

  function triggerDone(type: "json" | "csv") {
    setDone(type);
    setTimeout(() => { setDone(null); setOpen(false); }, 1500);
  }

  function exportJSON() {
    const payload: BackupPayload = {
      version: 2,
      exportadoEn: new Date().toISOString(),
      prestaciones: getPrestaciones(),
      precios:      getPrecios(),
      registros:    getRegistros(),
      liquidaciones: getLiquidaciones(),
      estadosDia:   getEstadosDia(),
      topeConfig:   getTopeConfig(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    download(blob, `ecografia_backup_${today()}.json`);
    try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch { /* ignore */ }
    setBackupDays(0);
    triggerDone("json");
  }

  function exportCSV() {
    const registros    = getRegistros();
    const prestaciones = getPrestaciones();

    const nombrePrest    = (id: string) => prestaciones.find((p) => p.id === id)?.nombre ?? id;
    const categoriaPrest = (id: string) => prestaciones.find((p) => p.id === id)?.categoria ?? "";

    const header = ["ID", "Fecha", "Prestacion", "Categoria", "Estado", "Orden", "Cantidad", "Precio Unitario", "Total"];
    const rows = registros
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((r) => [
        r.id,
        r.fecha,
        nombrePrest(r.prestacionId),
        categoriaPrest(r.prestacionId),
        r.estado ?? "finAtencion",
        r.orden ?? "",
        r.cantidad,
        r.precioUnitario,
        r.precioUnitario * r.cantidad,
      ]);

    const total = rows.reduce((s, r) => s + (r[8] as number), 0);
    rows.push(["", "", "", "", "", "", "", "TOTAL", total]);

    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${c}"`).join(","))
      .join("\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    download(blob, `ecografia_registros_${today()}.csv`);
    triggerDone("csv");
  }

  function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const payload = JSON.parse(ev.target?.result as string) as Partial<BackupPayload>;
        // Validación básica
        if (!payload.version || !Array.isArray(payload.registros)) {
          throw new Error("Archivo inválido o formato incorrecto");
        }
        // Restaurar datos
        if (payload.prestaciones) savePrestaciones(payload.prestaciones);
        if (payload.precios)      savePrecios(payload.precios);
        if (payload.registros)    saveRegistros(payload.registros);
        if (payload.liquidaciones) saveLiquidaciones(payload.liquidaciones);
        if (payload.topeConfig)   saveTopeConfig(payload.topeConfig as TopeConfig);
        // estadosDia: upsert cada uno
        if (Array.isArray(payload.estadosDia)) {
          payload.estadosDia.forEach((d: EstadoDia) => upsertEstadoDia(d));
        }
        const nRegs = payload.registros?.length ?? 0;
        const nLiqs = payload.liquidaciones?.length ?? 0;
        setRestoreStatus("ok");
        setRestoreMsg(`Restaurado: ${nRegs} registros · ${nLiqs} liquidaciones`);
        setTimeout(() => {
          setRestoreStatus("idle");
          setOpen(false);
          window.location.reload();
        }, 2000);
      } catch (err) {
        setRestoreStatus("error");
        setRestoreMsg(err instanceof Error ? err.message : "Error al leer el archivo");
        setTimeout(() => setRestoreStatus("idle"), 3000);
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function today() {
    return new Date().toISOString().split("T")[0];
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-slate-200">Exportar / Restaurar</p>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-2">
            {/* JSON completo */}
            <button
              onClick={exportJSON}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150",
                done === "json"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-700 hover:border-sky-500/30 hover:bg-sky-500/5 text-slate-300 hover:text-sky-400"
              )}
            >
              {done === "json" ? <Check className="w-5 h-5 shrink-0" /> : <FileJson className="w-5 h-5 shrink-0 text-sky-400" />}
              <div>
                <p className="text-sm font-medium">{done === "json" ? "Descargado" : "Backup completo (JSON)"}</p>
                <p className="text-xs text-slate-500 mt-0.5">Registros, liquidaciones, precios, config</p>
              </div>
            </button>

            {/* CSV */}
            <button
              onClick={exportCSV}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150",
                done === "csv"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-700 hover:border-violet-500/30 hover:bg-violet-500/5 text-slate-300 hover:text-violet-400"
              )}
            >
              {done === "csv" ? <Check className="w-5 h-5 shrink-0" /> : <FileText className="w-5 h-5 shrink-0 text-violet-400" />}
              <div>
                <p className="text-sm font-medium">{done === "csv" ? "Descargado" : "Exportar CSV"}</p>
                <p className="text-xs text-slate-500 mt-0.5">Registros para Excel / Google Sheets</p>
              </div>
            </button>

            {/* Restaurar */}
            <div className="border-t border-slate-800 pt-2 mt-1">
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
              <button
                onClick={() => fileRef.current?.click()}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150",
                  restoreStatus === "ok"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : restoreStatus === "error"
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-slate-700 hover:border-amber-500/30 hover:bg-amber-500/5 text-slate-400 hover:text-amber-400"
                )}
              >
                {restoreStatus === "ok"
                  ? <Check className="w-5 h-5 shrink-0" />
                  : restoreStatus === "error"
                  ? <AlertTriangle className="w-5 h-5 shrink-0" />
                  : <Upload className="w-5 h-5 shrink-0 text-amber-400" />}
                <div>
                  <p className="text-sm font-medium">
                    {restoreStatus === "ok" ? "Restaurado" : restoreStatus === "error" ? "Error" : "Restaurar desde backup"}
                  </p>
                  <p className="text-xs mt-0.5 opacity-70">
                    {restoreStatus !== "idle" ? restoreMsg : "Carga un archivo .json generado aquí"}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40 space-y-2">
            {(backupDays === null || backupDays >= 7) && (
              <div className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                backupDays === null
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
              )}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {backupDays === null
                  ? "Sin backup registrado. Exporta el backup JSON para proteger tus datos."
                  : `Último backup hace ${backupDays} días. Se recomienda hacerlo cada semana.`}
              </div>
            )}
            {backupDays !== null && backupDays < 7 && (
              <p className="text-xs text-slate-600">
                Último backup hace {backupDays === 0 ? "menos de un día" : `${backupDays} día${backupDays > 1 ? "s" : ""}`}.
              </p>
            )}
            <p className="text-xs text-slate-600">
              Los datos se exportan desde el almacenamiento local de este navegador.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "fixed bottom-6 right-6 z-50 relative flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg transition-all duration-200 font-medium text-sm",
          open
            ? "bg-slate-700 text-slate-300 shadow-slate-900/60"
            : "bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/30 hover:shadow-sky-400/40 hover:scale-105"
        )}
      >
        <Download className="w-4 h-4" />
        Exportar
        {/* Backup warning badge */}
        {!open && backupDays !== null && backupDays >= 7 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-slate-950 flex items-center justify-center text-[9px] font-bold text-slate-900">
            !
          </span>
        )}
        {!open && backupDays === null && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-slate-950 flex items-center justify-center text-[9px] font-bold text-white">
            !
          </span>
        )}
      </button>
    </>
  );
}
