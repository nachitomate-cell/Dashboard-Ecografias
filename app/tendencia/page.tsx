"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, DollarSign,
  BarChart2, Target, AlertTriangle, CheckCircle,
} from "lucide-react";
import { getRegistros, getLiquidaciones, getTopeConfig } from "@/lib/store";
import HelpModal, { HelpButton, type HelpSection } from "@/components/HelpModal";

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function periodoLabel(p: string) {
  const [y, m] = p.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

interface MonthData {
  periodo: string;
  label: string;
  hisExams: number;
  hisValor: number;
  hisAPago: number;
  liqAPago: number | null;
  hasLiq: boolean;
  delta: number | null;        // liq - his (only when hasLiq)
  pctDelta: number | null;
  topeAlcanzado: boolean;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    icon: "📈",
    heading: "Qué muestra este gráfico",
    highlight: "sky",
    body: [
      "Cada barra representa un mes: azul = A Pago estimado desde HIS, verde = A Pago real de la liquidación.",
      "La línea punteada marca tu tope mensual configurado.",
      "Si no hay liquidación cargada para un mes, solo aparece la barra HIS.",
    ],
  },
  {
    icon: "📊",
    heading: "Cómo leer la tabla",
    highlight: "violet",
    body: [
      "HIS A Pago est.: ingreso estimado = valor HIS × % acuerdo configurado.",
      "Liq A Pago: lo que realmente te pagaron (requiere liquidación cargada).",
      "Diferencia: liq − estimado. Negativo = posible subpago. Positivo = pago sobre lo esperado.",
      "✓ Verde: diferencia ≤ 5%. ⚠ Naranja: diferencia > 5%. ✗ Rojo: diferencia > 10%.",
    ],
  },
  {
    icon: "💡",
    heading: "Cómo obtener más meses",
    highlight: "amber",
    body: [
      "Importa los archivos HIS de meses anteriores en 'Diario → Cargar Excel'.",
      "Carga las liquidaciones de cada mes en 'Mensual → Liquidación'.",
      "La tendencia mostrará automáticamente todos los meses con datos disponibles.",
    ],
  },
];

export default function TendenciaPage() {
  const [rawRegistros, setRawRegistros] = useState<ReturnType<typeof getRegistros>>([]);
  const [rawLiqs,      setRawLiqs]      = useState<ReturnType<typeof getLiquidaciones>>([]);
  const [tope,         setTope]         = useState(6_300_000);
  const [acuerdoPct,   setAcuerdoPct]   = useState(37);
  const [showHelp,     setShowHelp]     = useState(false);

  useEffect(() => {
    const registros = getRegistros();
    const liqs      = getLiquidaciones();
    const cfg       = getTopeConfig();
    setRawRegistros(registros);
    setRawLiqs(liqs);
    setTope(cfg.montoCLP);
    setAcuerdoPct(cfg.acuerdoPct);
  }, []);

  const rows = useMemo<MonthData[]>(() => {
    const hisPeriods = new Set(rawRegistros.map((r) => r.fecha.slice(0, 7)));
    const liqPeriods = new Set(rawLiqs.map((l) => l.periodo));
    const allPeriods = [...new Set([...hisPeriods, ...liqPeriods])].sort();

    return allPeriods.map((periodo) => {
      const regs = rawRegistros.filter((r) => r.fecha.startsWith(periodo));
      const hisValor = regs.reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
      const hisAPago = Math.round(hisValor * acuerdoPct / 100);

      const liq = rawLiqs.find((l) => l.periodo === periodo);
      const liqAPago = liq ? liq.rows.reduce((s, r) => s + r.aPago, 0) : null;

      const delta = liq && hisAPago > 0 ? liqAPago! - hisAPago : null;
      const pctDelta = delta !== null && hisAPago > 0 ? (delta / hisAPago) * 100 : null;

      return {
        periodo,
        label: periodoLabel(periodo),
        hisExams: regs.length,
        hisValor,
        hisAPago,
        liqAPago,
        hasLiq: !!liq,
        delta,
        pctDelta,
        topeAlcanzado: (liqAPago ?? hisAPago) >= tope,
      };
    }).slice(-12); // last 12 months max
  }, [rawRegistros, rawLiqs, acuerdoPct, tope]);

  const hasAnyLiq = rows.some((r) => r.hasLiq);
  const topeColor = "#64748b";

  // Summary stats
  const liqRows = rows.filter((r) => r.hasLiq);
  const avgDelta = liqRows.length > 0
    ? liqRows.reduce((s, r) => s + (r.pctDelta ?? 0), 0) / liqRows.length
    : null;
  const totalHisAPago = rows.reduce((s, r) => s + r.hisAPago, 0);
  const totalLiqAPago = liqRows.reduce((s, r) => s + (r.liqAPago ?? 0), 0);
  const mesesSobreTope = rows.filter((r) => r.topeAlcanzado).length;

  const CustomTooltip = ({
    active, payload, label,
  }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs shadow-2xl min-w-[180px]">
        <p className="text-slate-300 font-semibold mb-2">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-slate-400">{p.name}</span>
            </div>
            <span className="font-semibold text-slate-200 tabular-nums">{fmtShort(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (rows.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        {showHelp && (
          <HelpModal title="Ayuda — Tendencia" subtitle="Análisis histórico multi-mes" sections={HELP_SECTIONS} onClose={() => setShowHelp(false)} />
        )}
        <div className="flex items-start justify-between gap-3 mb-8">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Tendencia</h1>
            <p className="text-sm text-slate-500 mt-0.5">Evolución histórica de honorarios</p>
          </div>
          <HelpButton onClick={() => setShowHelp(true)} />
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-14 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl border border-slate-700 bg-slate-800 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-slate-500" />
          </div>
          <div>
            <p className="text-slate-300 font-medium">Sin datos históricos</p>
            <p className="text-sm text-slate-600 mt-1 max-w-xs">
              Importa archivos HIS en <a href="/diario" className="text-sky-400 hover:underline">Diario</a> para
              ver la tendencia mensual de ingresos y honorarios.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {showHelp && (
        <HelpModal title="Ayuda — Tendencia" subtitle="Análisis histórico multi-mes" sections={HELP_SECTIONS} onClose={() => setShowHelp(false)} />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Tendencia</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Evolución de honorarios — últimos {rows.length} {rows.length === 1 ? "mes" : "meses"}
          </p>
        </div>
        <HelpButton onClick={() => setShowHelp(true)} />
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "HIS A Pago total",
            value: fmt(totalHisAPago),
            sub: `${rows.length} meses`,
            icon: DollarSign,
            color: "sky",
          },
          {
            label: "Liquidado total",
            value: hasAnyLiq ? fmt(totalLiqAPago) : "—",
            sub: hasAnyLiq ? `${liqRows.length} meses con liq.` : "Sin liquidaciones",
            icon: BarChart2,
            color: "emerald",
          },
          {
            label: "Diferencia promedio",
            value: avgDelta !== null ? `${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(1)}%` : "—",
            sub: avgDelta !== null
              ? Math.abs(avgDelta) <= 5 ? "Dentro del margen" : "Fuera del margen ±5%"
              : "Sin liquidaciones",
            icon: avgDelta !== null && avgDelta < -5 ? TrendingDown : TrendingUp,
            color: avgDelta === null ? "slate" : Math.abs(avgDelta) <= 5 ? "emerald" : "amber",
          },
          {
            label: "Meses sobre tope",
            value: `${mesesSobreTope} / ${rows.length}`,
            sub: mesesSobreTope > 0 ? "Meta alcanzada" : "Ninguno aún",
            icon: Target,
            color: mesesSobreTope > 0 ? "emerald" : "slate",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => {
          const textColor = color === "sky" ? "text-sky-400" : color === "emerald" ? "text-emerald-400" : color === "amber" ? "text-amber-400" : "text-slate-500";
          const bgColor   = color === "sky" ? "bg-sky-500/10 border-sky-500/20" : color === "emerald" ? "bg-emerald-500/10 border-emerald-500/20" : color === "amber" ? "bg-amber-500/10 border-amber-500/20" : "bg-slate-800 border-slate-700";
          return (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${bgColor}`}>
                  <Icon className={`w-3.5 h-3.5 ${textColor}`} />
                </div>
                <p className="text-xs text-slate-500 truncate">{label}</p>
              </div>
              <p className={`text-lg font-semibold tabular-nums leading-tight ${textColor}`}>{value}</p>
              <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-slate-300">A Pago mensual — HIS vs Liquidación</p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-sky-500/60" /> Est. HIS ({acuerdoPct}%)
            </div>
            {hasAnyLiq && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-400" /> Liquidado real
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-6 border-t-2 border-dashed border-slate-500" /> Tope
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtShort} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={tope} stroke={topeColor} strokeDasharray="4 4" strokeWidth={1.5} />
            <Bar dataKey="hisAPago" name="Est. HIS" radius={[3, 3, 0, 0]} maxBarSize={32} fill="#38bdf880">
              {rows.map((r, i) => (
                <Cell key={i} fill={r.topeAlcanzado ? "#34d39980" : "#38bdf880"} />
              ))}
            </Bar>
            {hasAnyLiq && (
              <Bar dataKey="liqAPago" name="Liquidado" radius={[3, 3, 0, 0]} maxBarSize={32}>
                {rows.map((r, i) => (
                  <Cell
                    key={i}
                    fill={
                      !r.hasLiq ? "transparent"
                      : r.pctDelta !== null && r.pctDelta < -10 ? "#f87171"
                      : r.pctDelta !== null && Math.abs(r.pctDelta) <= 5 ? "#34d399"
                      : "#fbbf24"
                    }
                  />
                ))}
              </Bar>
            )}
            <Line
              dataKey="hisAPago"
              stroke="transparent"
              dot={false}
              activeDot={false}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <p className="text-sm font-medium text-slate-300">Detalle por mes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Período</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Exámenes</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">HIS Valor</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-sky-600 uppercase tracking-wider">HIS A Pago est.</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-emerald-600 uppercase tracking-wider">Liq A Pago</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Diferencia</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((row) => {
                const ok  = row.pctDelta !== null && Math.abs(row.pctDelta) <= 5;
                const bad = row.pctDelta !== null && row.pctDelta < -10;
                const warn = row.pctDelta !== null && !ok && !bad;
                return (
                  <tr key={row.periodo} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200">{row.label}</p>
                        {row.topeAlcanzado && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">🎯</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-right tabular-nums">{row.hisExams || "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-right tabular-nums">{row.hisValor > 0 ? fmt(row.hisValor) : "—"}</td>
                    <td className="px-4 py-3 text-sky-400 text-right tabular-nums font-medium">
                      {row.hisAPago > 0 ? fmt(row.hisAPago) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {row.hasLiq
                        ? <span className="text-emerald-400">{fmt(row.liqAPago!)}</span>
                        : <span className="text-slate-600 text-xs">Sin liquidación</span>}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${ok ? "text-emerald-400" : bad ? "text-red-400" : warn ? "text-amber-400" : "text-slate-600"}`}>
                      {row.delta !== null
                        ? `${row.delta >= 0 ? "+" : ""}${fmt(row.delta)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!row.hasLiq ? (
                        <span className="text-slate-700 text-xs">—</span>
                      ) : ok ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : bad ? (
                        <AlertTriangle className="w-4 h-4 text-red-400 mx-auto" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 1 && (
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-800/30">
                  <td className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total ({rows.length} meses)
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-300 tabular-nums">
                    {rows.reduce((s, r) => s + r.hisExams, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-300 tabular-nums">
                    {fmt(rows.reduce((s, r) => s + r.hisValor, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-sky-400 tabular-nums">
                    {fmt(totalHisAPago)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-400 tabular-nums">
                    {hasAnyLiq ? fmt(totalLiqAPago) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${
                    !hasAnyLiq ? "text-slate-600"
                    : totalLiqAPago - totalHisAPago < 0 ? "text-red-400" : "text-emerald-400"
                  }`}>
                    {hasAnyLiq
                      ? `${totalLiqAPago - totalHisAPago >= 0 ? "+" : ""}${fmt(totalLiqAPago - totalHisAPago)}`
                      : "—"}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Trend insight */}
      {rows.length >= 2 && (() => {
        const last  = rows[rows.length - 1];
        const prev  = rows[rows.length - 2];
        const delta = last.hisAPago - prev.hisAPago;
        const pct   = prev.hisAPago > 0 ? (delta / prev.hisAPago) * 100 : 0;
        const positive = delta >= 0;
        return (
          <div className={`rounded-xl border p-4 flex items-start gap-3 ${positive ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${positive ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
              {positive
                ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                : <TrendingDown className="w-4 h-4 text-amber-400" />}
            </div>
            <div>
              <p className={`text-sm font-medium ${positive ? "text-emerald-300" : "text-amber-300"}`}>
                {positive ? "Tendencia al alza" : "Tendencia a la baja"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                El mes de {last.label} tuvo un estimado A Pago de {fmt(last.hisAPago)},
                {positive ? " +" : " "}{pct.toFixed(1)}% respecto a {prev.label} ({fmt(prev.hisAPago)}).
                {!last.hasLiq && " La liquidación aún no ha sido cargada."}
              </p>
            </div>
            <div className="ml-auto shrink-0">
              <span className={`text-sm font-bold tabular-nums ${positive ? "text-emerald-400" : "text-amber-400"}`}>
                {positive ? "+" : ""}{pct.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })()}

      {/* Missing liquidaciones hint */}
      {rows.filter((r) => !r.hasLiq).length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
          <Minus className="w-4 h-4 text-slate-500 shrink-0" />
          <p className="text-sm text-slate-500">
            <span className="text-slate-300 font-medium">{rows.filter((r) => !r.hasLiq).length} {rows.filter((r) => !r.hasLiq).length === 1 ? "mes" : "meses"} sin liquidación cargada.</span>
            {" "}Súbelas en <a href="/mensual" className="text-sky-400 hover:underline">Mensual → Liquidación</a> para ver la comparación completa.
          </p>
        </div>
      )}
    </div>
  );
}
