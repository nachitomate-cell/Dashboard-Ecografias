"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload, FileSpreadsheet, Building2, User, Calendar,
  DollarSign, FileText, TrendingUp, Percent,
  ChevronDown, ChevronUp, Trash2, Check, AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line,
} from "recharts";
import {
  parseLiquidacionExcel,
  calcularResumenExamenes,
  calcularResumenFinanciadores,
  calcularResumenDiario,
  type ResumenFinanciador,
} from "@/lib/parseLiquidacion";
import { toast } from "@/lib/toast";
import {
  getLiquidaciones, addLiquidacion, deleteLiquidacion,
  type Liquidacion,
} from "@/lib/store";

const COLORS = ["#38bdf8","#818cf8","#34d399","#fb923c","#f472b6","#a78bfa","#facc15","#4ade80","#f87171","#c084fc","#67e8f9","#86efac"];
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function periodoLabel(p: string) {
  const [y, m] = p.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1] ?? m} ${y}`;
}

// ── Loading ───────────────────────────────────────────────────────
function LoadingCard({ fileName }: { fileName: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
      <div className="w-80 rounded-2xl border border-slate-700 bg-slate-900 p-8 flex flex-col items-center gap-5 shadow-2xl">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8 text-sky-400" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500" />
          </span>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-slate-100">Procesando liquidación</p>
          <p className="text-xs text-slate-500 max-w-[200px] truncate" title={fileName}>{fileName}</p>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-sky-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tooltip custom ────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{name: string; value: number; color: string}>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl space-y-0.5">
      {label && <p className="text-slate-400 mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold tabular-nums">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ── Reporte de una liquidación ────────────────────────────────────
function LiquidacionReport({ liq, onDelete }: { liq: Liquidacion; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const examenes    = calcularResumenExamenes(liq);
  const financiadores = calcularResumenFinanciadores(liq);
  const diario      = calcularResumenDiario(liq);

  const totalValor    = liq.rows.reduce((s, r) => s + r.valor, 0);
  const totalHonorario = liq.rows.reduce((s, r) => s + r.aPago, 0);
  const pctReal = totalValor > 0 ? (totalHonorario / totalValor * 100).toFixed(1) : "0";

  const pieData = examenes.slice(0, 8).map((e, i) => ({
    name: e.examen.replace(/ECOTOMOGRAFIA\s*/i, "").replace(/^DE PARTES BLANDAS\s*/i, "PB ").trim() || e.examen,
    value: e.honorarioTotal,
    color: COLORS[i % COLORS.length],
  }));

  const finData = financiadores.slice(0, 8).map((f) => ({
    name: f.financiador.split(" ")[0],
    fullName: f.financiador,
    valor: f.valorTotal,
    honorario: f.honorarioTotal,
    cantidad: f.cantidad,
  }));

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">{periodoLabel(liq.periodo)}</p>
            <p className="text-xs text-slate-500 truncate">{liq.fileName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setExpanded(!expanded)}
            className="p-2 text-slate-500 hover:text-slate-300 border border-slate-700 rounded-lg transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {confirmDelete ? (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-red-400">¿Eliminar?</span>
              <button onClick={onDelete} className="px-2 py-1 bg-red-500 hover:bg-red-400 text-white text-xs rounded-lg transition-colors">Sí</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-slate-400 border border-slate-700 text-xs rounded-lg transition-colors">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="p-2 text-slate-500 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-lg transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-5 space-y-5">
          {/* Info profesional */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: User, label: "Profesional", value: liq.profesional },
              { icon: Building2, label: "Empresa", value: liq.empresa },
              { icon: Calendar, label: "Período", value: periodoLabel(liq.periodo) },
              { icon: Percent, label: "Acuerdo", value: `${liq.acuerdoPct}% (real: ${pctReal}%)` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 text-slate-600" />
                  <p className="text-xs text-slate-600">{label}</p>
                </div>
                <p className="text-sm font-medium text-slate-300 truncate" title={value}>{value}</p>
              </div>
            ))}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-violet-400" />
                <p className="text-xs text-slate-500">Prestaciones</p>
              </div>
              <p className="text-2xl font-bold text-slate-100 tabular-nums">{liq.rows.length}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-sky-400" />
                <p className="text-xs text-slate-500">Valor total</p>
              </div>
              <p className="text-2xl font-bold text-slate-100 tabular-nums">{fmtShort(totalValor)}</p>
              <p className="text-xs text-slate-600 mt-0.5 tabular-nums">{fmt(totalValor)}</p>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <p className="text-xs text-sky-500">Honorario ({liq.acuerdoPct}%)</p>
              </div>
              <p className="text-2xl font-bold text-sky-400 tabular-nums">{fmtShort(totalHonorario)}</p>
              <p className="text-xs text-sky-600 mt-0.5 tabular-nums">{fmt(totalHonorario)}</p>
            </div>
          </div>

          {/* Gráfico diario */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">Honorario diario</p>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={diario} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradHon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={fmtShort} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="honorario" name="Honorario" fill="#38bdf8" fillOpacity={0.3} radius={[3,3,0,0]} maxBarSize={24} />
                <Line type="monotone" dataKey="honorario" name="Honorario" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Pie + Financiadores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie por examen */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">Por tipo de examen</p>
              <div className="flex gap-4 items-center">
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={2} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [fmt(v), ""]}
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-slate-400 truncate flex-1" title={d.name}>{d.name}</span>
                      <span className="text-xs text-slate-500 tabular-nums shrink-0">{fmtShort(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Barras por financiador */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">Por financiador</p>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={finData} layout="vertical" margin={{ top: 0, right: 8, left: 60, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtShort} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number, _n: string, p: { payload?: ResumenFinanciador & { fullName: string; cantidad: number } }) => [
                      `${fmt(v)} · ${p.payload?.cantidad ?? 0} prestaciones`,
                      p.payload?.fullName ?? "",
                    ] as [string, string]}
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }}
                  />
                  <Bar dataKey="honorario" name="Honorario" fill="#818cf8" radius={[0,3,3,0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla detallada */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <button onClick={() => setShowTable(!showTable)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/20 transition-colors">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Detalle por prestación</p>
              {showTable ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
            </button>
            {showTable && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-t border-b border-slate-800">
                      <th className="text-left px-4 py-2 text-slate-600 font-medium">Examen</th>
                      <th className="text-center px-4 py-2 text-slate-600 font-medium">N°</th>
                      <th className="text-right px-4 py-2 text-slate-600 font-medium">Valor total</th>
                      <th className="text-right px-4 py-2 text-slate-600 font-medium">Honorario</th>
                      <th className="text-right px-4 py-2 text-slate-600 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examenes.map((e, i) => (
                      <tr key={e.examen} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                        <td className="px-4 py-2 text-slate-300 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="truncate max-w-xs" title={e.examen}>{e.examen}</span>
                        </td>
                        <td className="px-4 py-2 text-center text-slate-500 tabular-nums">{e.cantidad}</td>
                        <td className="px-4 py-2 text-right text-slate-400 tabular-nums">{fmt(e.valorTotal)}</td>
                        <td className="px-4 py-2 text-right text-sky-400 font-medium tabular-nums">{fmt(e.honorarioTotal)}</td>
                        <td className="px-4 py-2 text-right text-slate-500 tabular-nums">{e.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-700 bg-slate-800/30 font-semibold">
                      <td className="px-4 py-2.5 text-slate-200">Total</td>
                      <td className="px-4 py-2.5 text-center text-slate-300 tabular-nums">{liq.rows.length}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">{fmt(totalValor)}</td>
                      <td className="px-4 py-2.5 text-right text-sky-300 tabular-nums">{fmt(totalHonorario)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums">{pctReal}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────────
export default function LiquidacionPanel() {
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>(() => getLiquidaciones());
  const [loading, setLoading]   = useState(false);
  const [loadFile, setLoadFile] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: File[]) => {
    const xlsxFiles = files.filter((f) => f.name.match(/\.xlsx?$/i));
    if (!xlsxFiles.length) { setError("Solo se aceptan archivos .xlsx"); return; }
    setError(null);

    for (const file of xlsxFiles) {
      setLoadFile(file.name);
      setLoading(true);
      await new Promise((r) => setTimeout(r, 80));
      try {
        const buf = await file.arrayBuffer();
        const liq = parseLiquidacionExcel(buf, file.name);
        addLiquidacion(liq);
        setLiquidaciones(getLiquidaciones());
        setJustSaved(liq.id);
        setTimeout(() => setJustSaved(null), 2500);
        toast.success(`Liquidación importada — ${liq.profesional} · ${liq.rows.length} registros`);
      } catch (e) {
        setError(`Error al leer ${file.name}: ${e}`);
        toast.error(`No se pudo leer ${file.name}`);
      }
      setLoading(false);
      setLoadFile("");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
    if (fileRef.current) fileRef.current.value = "";
  }, [processFiles]);

  function handleDelete(id: string) {
    deleteLiquidacion(id);
    setLiquidaciones(getLiquidaciones());
    toast.warning("Liquidación eliminada");
  }

  return (
    <div className="space-y-5">
      {loading && <LoadingCard fileName={loadFile} />}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
        className={clsx(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 cursor-pointer transition-all duration-200",
          dragOver ? "border-violet-400 bg-violet-500/10 scale-[1.01]" : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/20"
        )}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={handleChange} />
        <div className={clsx("flex items-center justify-center w-12 h-12 rounded-xl border transition-colors",
          dragOver ? "border-violet-400/40 bg-violet-500/10" : "border-slate-700 bg-slate-800/50")}>
          <Upload className={clsx("w-5 h-5 transition-colors", dragOver ? "text-violet-400" : "text-slate-500")} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">
            {dragOver ? "Suelta la liquidación aquí" : "Arrastra o haz clic para subir"}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Excel de liquidación de honorarios · Formato Medicenter / HIS
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </div>
        )}
      </div>

      {justSaved && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl w-fit">
          <Check className="w-4 h-4" /> Liquidación guardada en almacenamiento local
        </div>
      )}

      {liquidaciones.length === 0 && !loading && (
        <div className="text-center py-12 text-slate-600 text-sm">
          No hay liquidaciones cargadas aún.
        </div>
      )}

      {/* Reportes */}
      <div className="space-y-4">
        {[...liquidaciones]
          .sort((a, b) => b.periodo.localeCompare(a.periodo))
          .map((liq) => (
            <LiquidacionReport key={liq.id} liq={liq} onDelete={() => handleDelete(liq.id)} />
          ))}
      </div>
    </div>
  );
}
