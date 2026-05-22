"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, FileText, TrendingUp, Award, BarChart2, FileSpreadsheet, Target, Calendar } from "lucide-react";
import StatCard from "@/components/StatCard";
import LiquidacionPanel from "@/components/LiquidacionPanel";
import HelpModal, { HelpButton, type HelpSection } from "@/components/HelpModal";
import { getRegistros, getPrestaciones, getLiquidaciones, getTopeConfig, type Registro, type Prestacion } from "@/lib/store";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const COLORS = ["#38bdf8", "#818cf8", "#34d399", "#fb923c", "#f472b6", "#a78bfa"];

export default function MensualPage() {
  const [activeTab, setActiveTab] = useState<"resumen" | "liquidacion">("resumen");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth());
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());
  const [topeAPago, setTopeAPago] = useState(0);
  const [topeConfig, setTopeConfig] = useState({ montoCLP: 6_300_000, acuerdoPct: 37 });
  const [showHelp, setShowHelp] = useState(false);

  const HELP_SECTIONS: HelpSection[] = [
    {
      icon: "📋",
      heading: "Resumen HIS del mes",
      highlight: "sky",
      body: [
        "Muestra el total de exámenes importados y el ingreso estimado según el Arancel MLE 2026.",
        "Usa el selector de mes para ver períodos anteriores.",
        "El porcentaje de cambio (↑ ↓) compara con el mes anterior.",
        "La columna \"A Pago est.\" es el ingreso estimado multiplicado por tu % de acuerdo configurado.",
      ],
    },
    {
      icon: "🎯",
      heading: "Meta mensual",
      highlight: "emerald",
      body: [
        "Muestra el progreso hacia tu tope mensual de honorarios.",
        'Si ya cargaste la liquidación, el valor es el "A Pago" real. Si no, se estima aplicando el % de acuerdo al total HIS.',
        'La barra se pone amarilla al 75% y verde al llegar al 100%.',
        'Configura el tope en "Configuración → Meta Mensual".',
      ],
    },
    {
      icon: "📄",
      heading: "Cargar la liquidación",
      highlight: "violet",
      body: [
        'Ve a la pestaña "Liquidación" en esta misma página.',
        "Arrastra el Excel que recibes de MediCenter con el detalle de tu pago mensual.",
        "El sistema calcula automáticamente el porcentaje de acuerdo y el total liquidado.",
        "Puedes cargar una liquidación por período. Si cargas otra del mismo período, reemplaza la anterior.",
      ],
    },
    {
      icon: "💡",
      heading: "Diferencia entre HIS y liquidación",
      highlight: "amber",
      body: [
        "El valor HIS es lo que realizaste según el arancel. No es lo que cobras — es la base de cálculo.",
        "La liquidación muestra lo que MediCenter realmente te pagó.",
        'Para ver si el pago fue correcto, ve a "Verificación".',
        'Los exámenes "Por Recaudar" que aún no cobraron aparecerán en la liquidación del mes siguiente.',
      ],
    },
  ];

  useEffect(() => {
    setRegistros(getRegistros());
    setPrestaciones(getPrestaciones());
    const cfg = getTopeConfig();
    setTopeConfig(cfg);
  }, []);

  useEffect(() => {
    const periodo = `${anioSeleccionado}-${String(mesSeleccionado + 1).padStart(2, "0")}`;
    const liq = getLiquidaciones().find((l) => l.periodo === periodo);
    if (liq) {
      setTopeAPago(liq.rows.reduce((s, r) => s + r.aPago, 0));
    } else {
      setTopeAPago(0);
    }
  }, [mesSeleccionado, anioSeleccionado]);

  // Usar T12:00:00 para evitar desfase de zona horaria (UTC-4 en Chile)
  const regsDelMes = registros.filter((r) => {
    const d = new Date(r.fecha + "T12:00:00");
    return d.getMonth() === mesSeleccionado && d.getFullYear() === anioSeleccionado;
  });

  const mesAnterior = mesSeleccionado === 0 ? 11 : mesSeleccionado - 1;
  const anioMesAnterior = mesSeleccionado === 0 ? anioSeleccionado - 1 : anioSeleccionado;
  const regsAnterior = registros.filter((r) => {
    const d = new Date(r.fecha + "T12:00:00");
    return d.getMonth() === mesAnterior && d.getFullYear() === anioMesAnterior;
  });

  const totalMes = regsDelMes.reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
  const totalAnterior = regsAnterior.reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
  const cantMes = regsDelMes.length;
  const cantAnterior = regsAnterior.length;

  const pctIngresos = totalAnterior > 0 ? (((totalMes - totalAnterior) / totalAnterior) * 100).toFixed(1) : null;
  const pctPrestaciones = cantAnterior > 0 ? (((cantMes - cantAnterior) / cantAnterior) * 100).toFixed(1) : null;

  // Ingresos por semana del mes — T12:00:00 evita desfase UTC-4 en Chile
  const semanas: Record<number, number> = {};
  regsDelMes.forEach((r) => {
    const day = new Date(r.fecha + "T12:00:00").getDate();
    const sem = Math.ceil(day / 7);
    semanas[sem] = (semanas[sem] || 0) + r.precioUnitario * r.cantidad;
  });
  const semanaData = [1, 2, 3, 4, 5].map((s) => ({
    label: `Sem ${s}`,
    total: semanas[s] || 0,
  }));

  // Ingresos diarios del mes
  const diasEnMes = new Date(anioSeleccionado, mesSeleccionado + 1, 0).getDate();
  const diarioData = Array.from({ length: diasEnMes }, (_, i) => {
    const day = i + 1;
    const fecha = `${anioSeleccionado}-${String(mesSeleccionado + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const total = regsDelMes.filter((r) => r.fecha === fecha).reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
    return { day: String(day), total };
  });

  // Datos por tipo de prestación
  const radarData = prestaciones.map((p) => {
    const total = regsDelMes.filter((r) => r.prestacionId === p.id).reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
    const cant = regsDelMes.filter((r) => r.prestacionId === p.id).length;
    const nombre = p.nombre.replace(/Ecografía\s*/i, "");
    const short = nombre.length > 22 ? nombre.slice(0, 20) + "…" : nombre;
    return {
      prestacion: nombre,
      label: short,
      ingresos: total,
      cantidad: cant,
    };
  });

  // Top prestaciones por ingreso
  const topPrestaciones = [...radarData].sort((a, b) => b.ingresos - a.ingresos).slice(0, 5);
  const topPrestacion = topPrestaciones[0];

  // Días disponibles para seleccionar (meses con datos)
  const mesesDisponibles = Array.from(
    new Set(registros.map((r) => {
      const d = new Date(r.fecha + "T12:00:00");
      return `${d.getFullYear()}-${d.getMonth()}`;
    }))
  ).map((key) => {
    const [anio, mes] = key.split("-").map(Number);
    return { anio, mes, label: `${MONTH_NAMES[mes]} ${anio}` };
  }).sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{value: number}>; label?: string }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
          <p className="text-slate-400 mb-1">{label}</p>
          <p className="text-sky-400 font-semibold">{fmt(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Help modal */}
      {showHelp && (
        <HelpModal
          title="Ayuda — Resumen Mensual"
          subtitle="Cómo usar esta sección"
          sections={HELP_SECTIONS}
          onClose={() => setShowHelp(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Resumen Mensual</h1>
          <p className="text-sm text-slate-500 mt-0.5">{MONTH_NAMES[mesSeleccionado]} {anioSeleccionado}</p>
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <HelpButton onClick={() => setShowHelp(true)} />
        <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-800">
          <button onClick={() => setActiveTab("resumen")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "resumen" ? "bg-slate-900 text-slate-100 border border-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>
            <BarChart2 className="w-4 h-4" /> Resumen HIS
          </button>
          <button onClick={() => setActiveTab("liquidacion")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "liquidacion" ? "bg-slate-900 text-slate-100 border border-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>
            <FileSpreadsheet className="w-4 h-4" /> Liquidación
          </button>
        </div>
        </div>
      </div>

      {/* Panel liquidación */}
      {activeTab === "liquidacion" && <LiquidacionPanel />}

      {activeTab === "resumen" && <>
        <select
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-sky-500 cursor-pointer"
          value={`${anioSeleccionado}-${mesSeleccionado}`}
          onChange={(e) => {
            const [a, m] = e.target.value.split("-").map(Number);
            setAnioSeleccionado(a);
            setMesSeleccionado(m);
          }}
        >
          {mesesDisponibles.length === 0 && (
            <option value={`${anioSeleccionado}-${mesSeleccionado}`}>
              {MONTH_NAMES[mesSeleccionado]} {anioSeleccionado}
            </option>
          )}
          {mesesDisponibles.map((m) => (
            <option key={`${m.anio}-${m.mes}`} value={`${m.anio}-${m.mes}`}>
              {m.label}
            </option>
          ))}
        </select>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos del Mes"
          value={fmt(totalMes)}
          icon={DollarSign}
          accent="sky"
          trend={pctIngresos ? { value: `${pctIngresos}%`, positive: parseFloat(pctIngresos) >= 0 } : undefined}
        />
        <StatCard
          title="Prestaciones"
          value={String(cantMes)}
          subtitle="estudios realizados"
          icon={FileText}
          accent="violet"
          trend={pctPrestaciones ? { value: `${pctPrestaciones}%`, positive: parseFloat(pctPrestaciones) >= 0 } : undefined}
        />
        <StatCard
          title="Ticket Promedio"
          value={cantMes > 0 ? fmt(totalMes / cantMes) : "$0"}
          subtitle="por prestación"
          icon={TrendingUp}
          accent="emerald"
        />
        <StatCard
          title="Top Prestación"
          value={topPrestacion?.prestacion ?? "—"}
          subtitle={topPrestacion ? fmt(topPrestacion.ingresos) : ""}
          icon={Award}
          accent="amber"
        />
      </div>

      {/* Meta Mensual (Tope) */}
      {(() => {
        const tope = topeConfig.montoCLP;
        const aPagoEstimado = topeAPago > 0 ? topeAPago : Math.round(totalMes * topeConfig.acuerdoPct / 100);
        const faltante = Math.max(0, tope - aPagoEstimado);
        const pctTope = Math.min(100, tope > 0 ? (aPagoEstimado / tope) * 100 : 0);
        const promedio = cantMes > 0 ? aPagoEstimado / cantMes : 0;
        const examenesParaTope = promedio > 0 ? Math.ceil(tope / promedio) : 0;
        const examenesRestantes = Math.max(0, examenesParaTope - cantMes);
        const metaSemanal = Math.ceil(examenesRestantes / 4);
        const tieneReal = topeAPago > 0;
        return (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-sky-400" />
                <p className="text-sm font-medium text-slate-300">Meta Mensual</p>
                {!tieneReal && <span className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">estimado {topeConfig.acuerdoPct}%</span>}
              </div>
              <p className="text-xs text-slate-600 tabular-nums">Tope: {fmt(tope)}</p>
            </div>

            {/* Barra de progreso */}
            <div className="mb-4">
              <div className="flex justify-between items-baseline mb-1.5">
                <p className={`text-2xl font-semibold tabular-nums ${pctTope >= 100 ? "gradient-emerald" : "gradient-sky"}`}>
                  {fmt(aPagoEstimado)}
                </p>
                <div className="flex items-center gap-2">
                  {pctTope >= 100 && (
                    <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full animate-fade-in">
                      🎯 Meta alcanzada
                    </span>
                  )}
                  <p className="text-sm tabular-nums text-slate-500">{pctTope.toFixed(1)}%</p>
                </div>
              </div>
              <div className={`w-full h-2.5 bg-slate-800 rounded-full overflow-hidden ${pctTope >= 100 ? "animate-pulse-glow-emerald" : ""}`}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(pctTope, 1)}%`, background: pctTope >= 100 ? "linear-gradient(90deg,#34d399,#38bdf8)" : pctTope >= 75 ? "#fbbf24" : "#38bdf8" }} />
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Faltante", value: faltante > 0 ? fmt(faltante) : "✓ Meta cumplida", icon: DollarSign, highlight: faltante === 0 },
                { label: "Promedio / Examen", value: promedio > 0 ? fmt(promedio) : "—", icon: TrendingUp, highlight: false },
                { label: "Exámenes para tope", value: examenesParaTope > 0 ? String(examenesParaTope) : "—", icon: FileText, highlight: false },
                { label: "Meta semanal", value: examenesRestantes > 0 ? `${metaSemanal} exámenes` : "✓ Alcanzado", icon: Calendar, highlight: examenesRestantes === 0 },
              ].map(({ label, value, icon: Icon, highlight }) => (
                <div key={label} className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-3 flex items-center gap-2">
                  <Icon className={`w-4 h-4 shrink-0 ${highlight ? "text-emerald-400" : "text-slate-500"}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-600 truncate">{label}</p>
                    <p className={`text-sm font-semibold tabular-nums truncate ${highlight ? "text-emerald-400" : "text-slate-200"}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Ingresos diarios */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm font-medium text-slate-300 mb-4">Ingresos Diarios — {MONTH_NAMES[mesSeleccionado]}</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={diarioData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} interval={3} />
            <YAxis tickFormatter={fmtShort} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="total" stroke="#818cf8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#818cf8" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Semanas + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-300 mb-4">Ingresos por Semana</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={semanaData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-300 mb-4">Distribución por Tipo de Estudio</p>
          {(() => {
            const active = radarData.filter((d) => d.cantidad > 0).sort((a, b) => b.ingresos - a.ingresos).slice(0, 8);
            const chartH = Math.max(active.length * 32, 120);
            return active.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-10">Sin datos este mes</p>
            ) : (
              <ResponsiveContainer width="100%" height={chartH}>
                <BarChart data={active} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtShort} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="ingresos" fill="#38bdf8" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </div>

      {/* Tabla top prestaciones */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <p className="text-sm font-medium text-slate-300">Detalle por Prestación</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Prestación</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Cantidad</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Ingresos</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-sky-600 uppercase tracking-wider">A Pago est.</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">% Total</th>
            </tr>
          </thead>
          <tbody>
            {radarData.sort((a, b) => b.ingresos - a.ingresos).map((row, i) => (
              <tr key={row.prestacion} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3 text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  {row.prestacion}
                </td>
                <td className="px-5 py-3 text-slate-400 text-right tabular-nums">{row.cantidad}</td>
                <td className="px-5 py-3 text-slate-300 text-right tabular-nums font-medium">{fmt(row.ingresos)}</td>
                <td className="px-5 py-3 text-sky-400 text-right tabular-nums font-medium">{fmt(Math.round(row.ingresos * topeConfig.acuerdoPct / 100))}</td>
                <td className="px-5 py-3 text-slate-500 text-right tabular-nums">
                  {totalMes > 0 ? ((row.ingresos / totalMes) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>}
    </div>
  );
}
