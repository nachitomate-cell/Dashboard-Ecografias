"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { DollarSign, FileText, Clock, TrendingUp, Upload, UserCheck, UserX, UserMinus, CreditCard, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2, AlertTriangle } from "lucide-react";
import StatCard from "@/components/StatCard";
import UploadPanel from "@/components/UploadPanel";
import HelpModal, { HelpButton, type HelpSection } from "@/components/HelpModal";
import { getRegistros, saveRegistros, getPrestaciones, getEstadosDia, type Registro, type Prestacion } from "@/lib/store";

const COLORS = ["#38bdf8", "#818cf8", "#34d399", "#fb923c", "#f472b6", "#a78bfa"];
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAY_NAMES = ["L","M","X","J","V","S","D"];

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function pad(n: number) { return String(n).padStart(2, "0"); }

export default function DiarioPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [activeTab, setActiveTab] = useState<"resumen" | "carga">("resumen");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [calMes, setCalMes] = useState(new Date().getMonth());
  const [calAnio, setCalAnio] = useState(new Date().getFullYear());
  const [estadosMes, setEstadosMes] = useState({ finAtencion: 0, porRecaudar: 0, ausente: 0, eliminado: 0, enCaja: 0 });
  const [showHelp, setShowHelp] = useState(false);
  const [showRegistrosTable, setShowRegistrosTable] = useState(false);

  const HELP_SECTIONS: HelpSection[] = [
    {
      icon: "📁",
      heading: "Cómo importar archivos HIS",
      highlight: "sky",
      body: [
        'Ve a la pestaña "Cargar Excel" en esta misma página.',
        "El archivo debe tener la fecha en el nombre con formato DD-MM-YYYY (ej: 15-05-2026.xlsx).",
        "Puedes arrastrar varios archivos a la vez para importar múltiples días de una sola vez.",
        "Si importas el mismo día dos veces, los registros anteriores son reemplazados automáticamente.",
      ],
    },
    {
      icon: "📅",
      heading: "Usar el calendario",
      highlight: "violet",
      body: [
        "Los días con un punto azul tienen datos importados. Haz clic en cualquiera para ver sus estadísticas.",
        "Navega entre meses con las flechas. Las estadísticas de \"Estado de Citaciones\" cambian con el mes visible.",
        'El botón "Volver a hoy" regresa al día actual.',
      ],
    },
    {
      icon: "📊",
      heading: "Interpretar los indicadores",
      highlight: "emerald",
      body: [
        "Ingresos: valor estimado según el Arancel MLE 2026 (no el cobro real al paciente).",
        "La flecha de tendencia (↑ ↓) compara con el día anterior.",
        "Tiempo Activo: duración estimada basada en los tipos de exámenes realizados.",
      ],
    },
    {
      icon: "🔄",
      heading: "Estados de citación",
      highlight: "amber",
      body: [
        "Fin de Atención: examen realizado y N° de orden asignado. Estos son los que se facturan.",
        "Por Recaudar: examen realizado, pero el paciente aún no ha pagado en caja. Sin N° de orden.",
        "Ausente: el paciente no se presentó.",
        "En Caja: paciente en proceso de pago (estado transitorio del HIS).",
        "Importante: 'Por Recaudar' puede tardar 1 mes o más en aparecer en la liquidación.",
      ],
    },
  ];

  function reloadData(mes = calMes, anio = calAnio) {
    const regs = getRegistros();
    setRegistros(regs);
    setPrestaciones(getPrestaciones());
    // Filtrar estados del mes visible en el calendario (no del mes actual del sistema)
    const dias = getEstadosDia().filter((d) => {
      const f = new Date(d.fecha + "T12:00:00");
      return f.getFullYear() === anio && f.getMonth() === mes;
    });
    setEstadosMes({
      finAtencion: dias.reduce((s, d) => s + d.finAtencion, 0),
      porRecaudar: dias.reduce((s, d) => s + (d.porRecaudar ?? 0), 0),
      ausente:     dias.reduce((s, d) => s + d.ausente, 0),
      eliminado:   dias.reduce((s, d) => s + d.eliminado, 0),
      enCaja:      dias.reduce((s, d) => s + d.enCaja, 0),
    });
  }

  function handleDeleteRegistro(id: string) {
    const updated = registros.filter((r) => r.id !== id);
    saveRegistros(updated);
    setRegistros(updated);
  }

  useEffect(() => { reloadData(); }, [activeTab]);
  // Actualizar estadísticas cuando el usuario navega a otro mes en el calendario
  useEffect(() => { reloadData(calMes, calAnio); }, [calMes, calAnio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mapa fecha → {count, total} para el calendario
  const dateMap = registros.reduce((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = { count: 0, total: 0 };
    acc[r.fecha].count++;
    acc[r.fecha].total += r.precioUnitario * r.cantidad;
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  // Días hábiles recientes sin datos (últimos 5 días laborales excluyendo hoy)
  const missingDays: string[] = (() => {
    const missing: string[] = [];
    const cursor = new Date(todayStr + "T12:00:00");
    cursor.setDate(cursor.getDate() - 1);
    let checked = 0;
    while (checked < 5) {
      const dow = cursor.getDay(); // 0=Dom, 6=Sáb
      if (dow !== 0 && dow !== 6) {
        const key = cursor.toISOString().split("T")[0];
        if (!dateMap[key]) missing.push(key);
        checked++;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return missing.slice(0, 3); // máximo 3 avisos
  })();

  // Día anterior al seleccionado
  const prevDate = new Date(selectedDate + "T12:00:00");
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split("T")[0];

  const selRegs  = registros.filter((r) => r.fecha === selectedDate);
  const prevRegs = registros.filter((r) => r.fecha === prevDateStr);

  const totalSel  = selRegs.reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
  const totalPrev = prevRegs.reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
  const cantSel   = selRegs.length;
  const cantPrev  = prevRegs.length;

  const pctIngresos     = totalPrev > 0 ? (((totalSel - totalPrev) / totalPrev) * 100).toFixed(1) : null;
  const pctPrestaciones = cantPrev  > 0 ? (((cantSel  - cantPrev)  / cantPrev)  * 100).toFixed(1) : null;

  const isToday = selectedDate === todayStr;
  const selLabel = isToday
    ? "Hoy"
    : new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" });

  // Últimos 7 días centrados en selección
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const base = new Date(selectedDate + "T12:00:00");
    base.setDate(base.getDate() - (6 - i));
    const d = base.toISOString().split("T")[0];
    const regs = registros.filter((r) => r.fecha === d);
    const total = regs.reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
    const label = base.toLocaleDateString("es-CL", { weekday: "short", day: "numeric" });
    return { label, total, cantidad: regs.length, isSelected: d === selectedDate };
  });

  const pieData = prestaciones.map((p) => {
    const subtotal = selRegs.filter((r) => r.prestacionId === p.id).reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
    return { name: p.nombre, value: subtotal };
  }).filter((d) => d.value > 0);

  const barData = prestaciones.map((p) => {
    const regsP = selRegs.filter((r) => r.prestacionId === p.id);
    const total = regsP.reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
    return { name: p.nombre.replace("Ecografía ", ""), total, cant: regsP.length };
  }).filter((d) => d.cant > 0).sort((a, b) => b.total - a.total);

  const promDuracion = prestaciones.reduce((s, p) => {
    return s + p.duracionMin * selRegs.filter((r) => r.prestacionId === p.id).length;
  }, 0);

  // Navegación de calendario
  function prevMes() {
    if (calMes === 0) { setCalMes(11); setCalAnio(y => y - 1); }
    else setCalMes(m => m - 1);
  }
  function nextMes() {
    if (calMes === 11) { setCalMes(0); setCalAnio(y => y + 1); }
    else setCalMes(m => m + 1);
  }

  // Celdas del calendario
  const daysInMonth  = new Date(calAnio, calMes + 1, 0).getDate();
  const firstWeekDay = new Date(calAnio, calMes, 1).getDay(); // 0=Dom
  const startOffset  = (firstWeekDay + 6) % 7; // Lun=0 … Dom=6
  const calCells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

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
      {/* Header */}
      {showHelp && (
        <HelpModal
          title="Ayuda — Resumen Diario"
          subtitle="Cómo usar esta sección"
          sections={HELP_SECTIONS}
          onClose={() => setShowHelp(false)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Resumen Diario</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton onClick={() => setShowHelp(true)} />
        <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-800">
          <button onClick={() => setActiveTab("resumen")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "resumen" ? "bg-slate-900 text-slate-100 border border-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>
            <TrendingUp className="w-4 h-4" /> Resumen
          </button>
          <button onClick={() => setActiveTab("carga")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "carga" ? "bg-slate-900 text-slate-100 border border-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>
            <Upload className="w-4 h-4" /> Cargar Excel
          </button>
        </div>
        </div>
      </div>

      {activeTab === "carga" && <UploadPanel onUploaded={() => reloadData()} />}

      {activeTab === "resumen" && <>

      {/* Advertencia días sin datos */}
      {missingDays.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-300 font-medium">Días laborales sin datos importados</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              {missingDays.map((d) => new Date(d + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })).join(", ")}
              {" "}— ¿Olvidaste importar el HIS?
            </p>
          </div>
          <button
            onClick={() => setActiveTab("carga")}
            className="text-xs text-amber-400 hover:text-amber-300 font-medium shrink-0 transition-colors"
          >
            Importar →
          </button>
        </div>
      )}

      {/* Calendario + KPIs en una fila */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Calendario */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          {/* Cabecera mes */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMes} className="p-1 text-slate-500 hover:text-slate-200 transition-colors rounded-md hover:bg-slate-800">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-medium text-slate-200">{MONTH_NAMES[calMes]} {calAnio}</p>
            <button onClick={nextMes} className="p-1 text-slate-500 hover:text-slate-200 transition-colors rounded-md hover:bg-slate-800">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-slate-600 py-1">{d}</div>
            ))}
          </div>

          {/* Celdas */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {calCells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const dateStr = `${calAnio}-${pad(calMes + 1)}-${pad(day)}`;
              const info    = dateMap[dateStr];
              const isSel   = dateStr === selectedDate;
              const isTod   = dateStr === todayStr;
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  title={info ? `${info.count} exámenes · ${fmt(info.total)}` : "Sin datos"}
                  className={[
                    "relative flex flex-col items-center justify-center rounded-lg py-1 transition-all text-xs font-medium",
                    isSel
                      ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                      : isTod
                      ? "ring-1 ring-sky-500/60 text-slate-200 hover:bg-slate-800"
                      : info
                      ? "text-slate-200 hover:bg-slate-800"
                      : "text-slate-600 hover:bg-slate-800/50",
                  ].join(" ")}
                >
                  <span>{day}</span>
                  {info && (
                    <span className={[
                      "w-1 h-1 rounded-full mt-0.5",
                      isSel ? "bg-white/70" : "bg-sky-400",
                    ].join(" ")} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Con datos ({Object.keys(dateMap).filter(d => d.startsWith(`${calAnio}-${pad(calMes+1)}`)).length} días)
            </div>
            {selectedDate !== todayStr && (
              <button onClick={() => { setSelectedDate(todayStr); setCalMes(new Date().getMonth()); setCalAnio(new Date().getFullYear()); }}
                className="text-sky-500 hover:text-sky-400 transition-colors">
                Volver a hoy
              </button>
            )}
          </div>
        </div>

        {/* KPIs 2×2 */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <StatCard
            title={`Ingresos — ${selLabel}`}
            value={fmt(totalSel)}
            icon={DollarSign}
            accent="sky"
            trend={pctIngresos ? { value: `${pctIngresos}%`, positive: parseFloat(pctIngresos) >= 0 } : undefined}
          />
          <StatCard
            title="Prestaciones"
            value={String(cantSel)}
            subtitle="estudios realizados"
            icon={FileText}
            accent="violet"
            trend={pctPrestaciones ? { value: `${pctPrestaciones}%`, positive: parseFloat(pctPrestaciones) >= 0 } : undefined}
          />
          <StatCard
            title="Tiempo Activo"
            value={`${promDuracion} min`}
            subtitle="duración estimada"
            icon={Clock}
            accent="amber"
          />
          <StatCard
            title="Ticket Promedio"
            value={cantSel > 0 ? fmt(totalSel / cantSel) : "$0"}
            subtitle="por prestación"
            icon={TrendingUp}
            accent="emerald"
          />
        </div>
      </div>

      {/* Estado de citaciones del mes */}
      {(estadosMes.finAtencion + estadosMes.porRecaudar + estadosMes.ausente + estadosMes.eliminado + estadosMes.enCaja) > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-slate-300">Estado de Citaciones — {MONTH_NAMES[calMes]} {calAnio !== new Date().getFullYear() ? calAnio : ""}</p>
            <p className="text-xs text-slate-600 tabular-nums">
              Total: {estadosMes.finAtencion + estadosMes.porRecaudar + estadosMes.ausente + estadosMes.eliminado + estadosMes.enCaja}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Fin de Atención", value: estadosMes.finAtencion, icon: UserCheck,  color: "emerald" },
              { label: "Por Recaudar",    value: estadosMes.porRecaudar, icon: CreditCard, color: "violet"  },
              { label: "En Caja",         value: estadosMes.enCaja,      icon: CreditCard, color: "sky"     },
              { label: "Ausente",         value: estadosMes.ausente,     icon: UserX,      color: "amber"   },
              { label: "Eliminado",       value: estadosMes.eliminado,   icon: UserMinus,  color: "red"     },
            ].map(({ label, value, icon: Icon, color }) => {
              const total = estadosMes.finAtencion + estadosMes.porRecaudar + estadosMes.ausente + estadosMes.eliminado + estadosMes.enCaja;
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/30 px-4 py-3">
                  <div className={`p-2 rounded-lg border shrink-0 ${
                    color === "emerald" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                    color === "violet"  ? "bg-violet-500/10  border-violet-500/20  text-violet-400"  :
                    color === "amber"   ? "bg-amber-500/10  border-amber-500/20  text-amber-400"   :
                    color === "red"     ? "bg-red-500/10    border-red-500/20    text-red-400"     :
                                          "bg-sky-500/10    border-sky-500/20    text-sky-400"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-600 truncate">{label}</p>
                    <p className="text-lg font-semibold text-slate-100 tabular-nums leading-tight">{value}</p>
                    <p className="text-xs text-slate-600 tabular-nums">{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
          {(() => {
            const total = estadosMes.finAtencion + estadosMes.porRecaudar + estadosMes.ausente + estadosMes.eliminado + estadosMes.enCaja;
            if (total === 0) return null;
            return (
              <div className="mt-4 h-2 rounded-full overflow-hidden flex gap-px">
                {[
                  { v: estadosMes.finAtencion, c: "#34d399" },
                  { v: estadosMes.porRecaudar, c: "#a78bfa" },
                  { v: estadosMes.enCaja,      c: "#38bdf8" },
                  { v: estadosMes.ausente,     c: "#fbbf24" },
                  { v: estadosMes.eliminado,   c: "#f87171" },
                ].map((s, i) => s.v > 0 && (
                  <div key={i} style={{ width: `${(s.v / total) * 100}%`, background: s.c }} className="h-full first:rounded-l-full last:rounded-r-full" />
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-300 mb-4">Ingresos — 7 días anteriores</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={last7} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" stroke="#38bdf8" strokeWidth={2} fill="url(#gradSky)" dot={false} activeDot={{ r: 4, fill: "#38bdf8" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-300 mb-4">
            Distribución — {selLabel}
          </p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [fmt(v), ""]}
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-600 text-sm">Sin datos</div>
          )}
          <div className="mt-2 space-y-1">
            {pieData.slice(0, 4).map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate">{d.name.replace("Ecografía ", "")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm font-medium text-slate-300 mb-4">Ingresos por Tipo de Estudio — {selLabel}</p>
        {barData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(barData.length * 36, 120)}>
            <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtShort} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [fmt(v), "Ingresos"]}
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Bar dataKey="total" fill="#38bdf8" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-slate-600 text-sm">Sin registros para {selLabel.toLowerCase()}</div>
        )}
      </div>

      {/* Tabla de registros colapsable */}
      {selRegs.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <button
            onClick={() => setShowRegistrosTable((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-300">Registros del día — {selLabel}</span>
              <span className="px-2 py-0.5 text-xs bg-slate-800 border border-slate-700 rounded-full text-slate-400 tabular-nums">
                {selRegs.length}
              </span>
            </div>
            {showRegistrosTable ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>

          {showRegistrosTable && (
            <div className="border-t border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Prestación</th>
                      <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Estado</th>
                      <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Precio</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {selRegs.map((reg) => {
                      const prest = prestaciones.find((p) => p.id === reg.prestacionId);
                      return (
                        <tr key={reg.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors group">
                          <td className="px-4 py-2.5 text-slate-300">{prest?.nombre ?? reg.prestacionId}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              reg.estado === "finAtencion"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-violet-500/10 text-violet-400"
                            }`}>
                              {reg.estado === "finAtencion" ? "Fin Atención" : "Por Recaudar"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">{fmt(reg.precioUnitario)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleDeleteRegistro(reg.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-400 rounded transition-all"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-slate-800 flex justify-between text-xs text-slate-500">
                <span>Total del día</span>
                <span className="text-slate-300 font-medium tabular-nums">{fmt(totalSel)}</span>
              </div>
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  );
}
