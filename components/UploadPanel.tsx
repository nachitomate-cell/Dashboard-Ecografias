"use client";

import { useCallback, useState, useRef } from "react";
import {
  Upload, FileSpreadsheet, Check, AlertCircle,
  ChevronDown, ChevronUp, TrendingUp, FileText,
  DollarSign, Users, Import, Trash2,
} from "lucide-react";
import clsx from "clsx";
import { parseExcelFile, buildDayReport, type DayReport } from "@/lib/parseExcel";
import { getPrestaciones, getPrecios, getRegistros, saveRegistros, upsertEstadoDia, getTopeConfig, type Registro } from "@/lib/store";
import { toast } from "@/lib/toast";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

const MAX_FILES = 31;

// ── Loading overlay ────────────────────────────────────────────
function LoadingOverlay({ current, total, fileName }: { current: number; total: number; fileName: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-8 flex flex-col items-center gap-6">
        {/* Spinner */}
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#38bdf8" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
              style={{ transition: "stroke-dashoffset 0.4s ease" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-sky-400 tabular-nums">
            {pct}%
          </span>
        </div>

        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-slate-100">Procesando archivos</p>
          <p className="text-sm text-slate-400">{current} de {total} completados</p>
        </div>

        {/* Barra */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-sky-400 rounded-full transition-all duration-400 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Archivo actual */}
        <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-xs text-slate-400 truncate">
            {fileName || "Iniciando…"}
          </p>
        </div>

        {/* Dots animation */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-sky-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Fila de reporte por día ─────────────────────────────────────
function DayCard({ report, onImport, imported, isDuplicate }: {
  report: DayReport;
  onImport: (r: DayReport) => void;
  imported: boolean;
  isDuplicate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const matchPct = report.total > 0 ? Math.round((report.matched / report.total) * 100) : 0;

  return (
    <div className={clsx(
      "rounded-xl border bg-slate-900 overflow-hidden transition-all",
      imported ? "border-emerald-500/20" : isDuplicate ? "border-amber-500/30" : "border-slate-800"
    )}>
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-200">
                {new Date(report.fecha + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
              </p>
              {isDuplicate && !imported && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  ⚠ Ya existe — se sobreescribirá
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 truncate">{report.fileName}</p>
          </div>
        </div>

        <div className="flex items-center gap-5 ml-auto shrink-0">
          <div className="text-center hidden sm:block">
            <p className="text-xs text-slate-600">Atendidos</p>
            <p className="text-sm font-semibold text-slate-200 tabular-nums">{report.total}</p>
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-xs text-slate-600">Match</p>
            <p className={clsx("text-sm font-semibold tabular-nums", matchPct === 100 ? "text-emerald-400" : matchPct >= 80 ? "text-sky-400" : "text-amber-400")}>
              {matchPct}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600">Estimado</p>
            <p className="text-sm font-semibold text-slate-100 tabular-nums">{fmt(report.ingresoEstimado)}</p>
          </div>

          {imported ? (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
              <Check className="w-3 h-3" /> Importado
            </span>
          ) : (
            <button onClick={() => onImport(report)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap">
              <Import className="w-3 h-3" /> Importar
            </button>
          )}

          <button onClick={() => setOpen(!open)}
            className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Detalle expandible */}
      {open && (
        <div className="border-t border-slate-800">
          {report.sinMatchNombres.length > 0 && (
            <div className="px-5 py-3 bg-amber-500/5 border-b border-amber-500/10 flex flex-wrap gap-2 items-center">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-400 font-medium">Sin match:</p>
              {report.sinMatchNombres.map((n) => (
                <span key={n} className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md">{n}</span>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-2 text-slate-600 font-medium">Hora</th>
                  <th className="text-left px-5 py-2 text-slate-600 font-medium">Paciente</th>
                  <th className="text-left px-5 py-2 text-slate-600 font-medium">Examen</th>
                  <th className="text-left px-5 py-2 text-slate-600 font-medium">Prestación</th>
                  <th className="text-right px-5 py-2 text-slate-600 font-medium">Precio</th>
                  <th className="text-left px-5 py-2 text-slate-600 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {report.examenes.map((e, i) => (
                  <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                    <td className="px-5 py-2 text-slate-500 tabular-nums whitespace-nowrap">{e.row.hrLlegada || e.row.hrReserva}</td>
                    <td className="px-5 py-2 text-slate-400 max-w-[140px] truncate" title={e.row.paciente}>{e.row.paciente}</td>
                    <td className="px-5 py-2 text-slate-400 max-w-[160px] truncate" title={e.row.examen}>{e.row.examen}</td>
                    <td className="px-5 py-2 max-w-[160px]">
                      {e.prestacionNombre ? (
                        <span className="text-sky-400 truncate block" title={e.prestacionNombre}>{e.prestacionNombre}</span>
                      ) : (
                        <span className="text-amber-500">Sin match</span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums font-medium text-slate-300">{e.precio > 0 ? fmt(e.precio) : "—"}</td>
                    <td className="px-5 py-2 text-slate-600">{e.row.usuario || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────
export default function UploadPanel() {
  const [reports, setReports] = useState<DayReport[]>([]);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0, fileName: "" });
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      setError(`Máximo ${MAX_FILES} archivos permitidos. Seleccionaste ${files.length}.`);
      return;
    }
    setError(null);
    setLoading(true);

    const prestaciones = getPrestaciones();
    const { nivelCalculo } = getTopeConfig();
    const precios: Record<string, number> = {};
    getPrecios().forEach((p) => {
      if ((p as typeof p & { nivel?: number }).nivel === nivelCalculo) {
        precios[p.prestacionId] = p.precio;
      }
    });
    // fallback: cualquier nivel disponible
    getPrecios().forEach((p) => {
      if (!precios[p.prestacionId]) precios[p.prestacionId] = p.precio;
    });

    const results: DayReport[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setLoadProgress({ current: i, total: files.length, fileName: file.name });
      await new Promise((r) => setTimeout(r, 30)); // allow UI update

      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseExcelFile(buffer, file.name);
        const report = buildDayReport(parsed, prestaciones, precios);
        results.push(report);
      } catch {
        results.push({
          fecha: file.name,
          fileName: file.name,
          total: 0, matched: 0, unmatched: 0, ingresoEstimado: 0,
          examenes: [], sinMatchNombres: [],
          statusCounts: { finAtencion: 0, porRecaudar: 0, ausente: 0, eliminado: 0, enCaja: 0, otros: 0 },
        });
      }
    }

    setLoadProgress({ current: files.length, total: files.length, fileName: "" });
    await new Promise((r) => setTimeout(r, 400));

    results.sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Detectar fechas que ya tienen registros importados
    const existingRegs = getRegistros();
    const dupSet = new Set<string>();
    results.forEach((r) => {
      if (existingRegs.some((reg) => reg.id.startsWith(`imp_${r.fecha}_`))) {
        dupSet.add(r.fecha);
      }
    });
    setDuplicates(dupSet);

    setReports((prev) => {
      const existing = new Map(prev.map((r) => [r.fecha, r]));
      results.forEach((r) => existing.set(r.fecha, r));
      return Array.from(existing.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
    });
    setLoading(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.match(/\.xlsx?$/i));
    processFiles(files);
  }, [processFiles]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    processFiles(files);
    if (fileRef.current) fileRef.current.value = "";
  }, [processFiles]);

  function handleImport(report: DayReport) {
    const existing = getRegistros();
    const newRegs: Registro[] = report.examenes
      .filter((e) => e.prestacionId && e.precio > 0)
      .map((e, i) => ({
        id: `imp_${report.fecha}_${i}_${Date.now()}`,
        prestacionId: e.prestacionId!,
        fecha: report.fecha,
        cantidad: 1,
        precioUnitario: e.precio,
        estado: e.estado,
      }));

    // Eliminar registros previos del mismo día importados, agregar nuevos
    const filtered = existing.filter((r) => !r.id.startsWith(`imp_${report.fecha}_`));
    saveRegistros([...filtered, ...newRegs]);
    upsertEstadoDia({ fecha: report.fecha, ...report.statusCounts });
    setImported((prev) => new Set([...prev, report.fecha]));
    const label = new Date(report.fecha + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" });
    toast.success(`${report.total} exámenes importados — ${label}`);
  }

  function handleImportAll() {
    const pending = reports.filter((r) => !imported.has(r.fecha));
    pending.forEach(handleImport);
    if (pending.length > 1) toast.success(`${pending.length} días importados correctamente`);
  }

  function clearReports() {
    setReports([]);
    setImported(new Set());
    setDuplicates(new Set());
  }

  const totalAtendidos = reports.reduce((s, r) => s + r.total, 0);
  const totalIngreso = reports.reduce((s, r) => s + r.ingresoEstimado, 0);
  const pendientes = reports.filter((r) => !imported.has(r.fecha)).length;

  return (
    <div className="space-y-4">
      {loading && (
        <LoadingOverlay
          current={loadProgress.current}
          total={loadProgress.total}
          fileName={loadProgress.fileName}
        />
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
        className={clsx(
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 cursor-pointer transition-all duration-200",
          dragOver
            ? "border-sky-400 bg-sky-500/10 scale-[1.01]"
            : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/30"
        )}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple
          className="hidden" onChange={handleFileChange} />

        <div className={clsx(
          "flex items-center justify-center w-14 h-14 rounded-2xl border transition-colors",
          dragOver ? "border-sky-400/40 bg-sky-500/10" : "border-slate-700 bg-slate-800/50"
        )}>
          <Upload className={clsx("w-6 h-6 transition-colors", dragOver ? "text-sky-400" : "text-slate-500")} />
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">
            {dragOver ? "Suelta los archivos aquí" : "Arrastra tus archivos o haz clic"}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Archivos .xlsx — hasta {MAX_FILES} a la vez — Formato: DD-MM-YYYY.xlsx
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Resumen + acciones */}
      {reports.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Días cargados", value: reports.length, icon: FileText, color: "sky" },
              { label: "Total atendidos", value: totalAtendidos, icon: Users, color: "violet" },
              { label: "Ingreso estimado", value: fmt(totalIngreso), icon: DollarSign, color: "emerald" },
              { label: "Por importar", value: pendientes, icon: TrendingUp, color: "amber" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center gap-3">
                <div className={clsx("p-2 rounded-lg border",
                  color === "sky" ? "bg-sky-500/10 border-sky-500/20 text-sky-400" :
                  color === "violet" ? "bg-violet-500/10 border-violet-500/20 text-violet-400" :
                  color === "emerald" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                  "bg-amber-500/10 border-amber-500/20 text-amber-400"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{label}</p>
                  <p className="text-sm font-semibold text-slate-200 tabular-nums">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {pendientes > 0 && (
              <button onClick={handleImportAll}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-lg transition-colors">
                <Import className="w-4 h-4" />
                Importar todos ({pendientes})
              </button>
            )}
            <button onClick={clearReports}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-lg transition-all">
              <Trash2 className="w-4 h-4" />
              Limpiar
            </button>
          </div>

          <div className="space-y-3">
            {reports.map((r) => (
              <DayCard key={r.fecha} report={r}
                onImport={handleImport}
                imported={imported.has(r.fecha)}
                isDuplicate={duplicates.has(r.fecha)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
