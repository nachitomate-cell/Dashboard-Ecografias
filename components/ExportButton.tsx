"use client";

import { useState } from "react";
import { Download, FileJson, FileText, X, Check } from "lucide-react";
import { getRegistros, getPrestaciones, getPrecios } from "@/lib/store";
import clsx from "clsx";

export default function ExportButton() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<"json" | "csv" | null>(null);

  function triggerDone(type: "json" | "csv") {
    setDone(type);
    setTimeout(() => { setDone(null); setOpen(false); }, 1500);
  }

  function exportJSON() {
    const payload = {
      exportadoEn: new Date().toISOString(),
      prestaciones: getPrestaciones(),
      precios: getPrecios(),
      registros: getRegistros(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    download(blob, `ecografia_datos_${today()}.json`);
    triggerDone("json");
  }

  function exportCSV() {
    const registros = getRegistros();
    const prestaciones = getPrestaciones();

    const nombrePrest = (id: string) => prestaciones.find((p) => p.id === id)?.nombre ?? id;
    const categoriaPrest = (id: string) => prestaciones.find((p) => p.id === id)?.categoria ?? "";

    const header = ["ID", "Fecha", "Prestacion", "Categoria", "Cantidad", "Precio Unitario", "Total"];
    const rows = registros
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((r) => [
        r.id,
        r.fecha,
        nombrePrest(r.prestacionId),
        categoriaPrest(r.prestacionId),
        r.cantidad,
        r.precioUnitario,
        r.precioUnitario * r.cantidad,
      ]);

    const total = rows.reduce((s, r) => s + (r[6] as number), 0);
    rows.push(["", "", "", "", "", "TOTAL", total]);

    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${c}"`).join(","))
      .join("\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    download(blob, `ecografia_registros_${today()}.csv`);
    triggerDone("csv");
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-72 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-slate-200">Exportar datos</p>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-2">
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
                <p className="text-sm font-medium">{done === "json" ? "Descargado" : "Exportar JSON"}</p>
                <p className="text-xs text-slate-500 mt-0.5">Todos los datos completos</p>
              </div>
            </button>

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
                <p className="text-xs text-slate-500 mt-0.5">Registros para Excel / Sheets</p>
              </div>
            </button>
          </div>

          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40">
            <p className="text-xs text-slate-600">
              Los datos se exportan desde el almacenamiento local de este navegador.
            </p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg transition-all duration-200 font-medium text-sm",
          open
            ? "bg-slate-700 text-slate-300 shadow-slate-900/60"
            : "bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/30 hover:shadow-sky-400/40 hover:scale-105"
        )}
      >
        <Download className="w-4 h-4" />
        Exportar
      </button>
    </>
  );
}
