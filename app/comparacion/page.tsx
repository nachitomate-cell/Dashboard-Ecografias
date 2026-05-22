"use client";

import { useEffect, useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  CheckCircle, AlertTriangle, XCircle, FileSpreadsheet,
  ArrowRight, TrendingUp, TrendingDown, Minus,
  FileText, DollarSign, Scale, ShieldCheck, ShieldAlert,
  Sparkles, RefreshCw, Clock, Eye, EyeOff,
} from "lucide-react";
import HelpModal, { HelpButton, type HelpSection } from "@/components/HelpModal";
import {
  getRegistros, getPrestaciones, getLiquidaciones,
  getTopeConfig, getPrecios,
  type Registro, type Prestacion,
} from "@/lib/store";
import { matchExamen } from "@/lib/parseExcel";

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
  const [y, m] = p.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export default function ComparacionPage() {
  const [registros,    setRegistros]    = useState<Registro[]>([]);
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [liquidaciones, setLiquidaciones] = useState([] as ReturnType<typeof getLiquidaciones>);
  const [acuerdoPct,   setAcuerdoPct]   = useState(37);
  const [precios,      setPrecios]      = useState<Record<string, number>>({});
  const [selectedPeriodo, setSelectedPeriodo] = useState("");
  // "todos" | "inteligente" | "soloFin"
  const [modoHIS, setModoHIS] = useState<"todos" | "inteligente" | "soloFin">("todos");
  const [showHelp, setShowHelp] = useState(false);

  const HELP_SECTIONS: HelpSection[] = [
    {
      icon: "⚖️",
      heading: "Cómo leer el veredicto",
      highlight: "emerald",
      body: [
        "Verde ✓: La liquidación es consistente con los registros HIS (diferencia ≤ 5%).",
        "Rojo ✗: Posible subpago — se liquidó menos de lo estimado. Revisar con la clínica.",
        "Naranja ⚠: Diferencia fuera del margen esperado. Puede ser por arancel distinto o ajustes.",
        "Gris: Falta la liquidación del período, o no hay datos HIS importados.",
      ],
    },
    {
      icon: "⏳",
      heading: "¿Qué son los exámenes 'Por Recaudar'?",
      highlight: "violet",
      body: [
        "Son exámenes realizados donde el paciente aún no ha pagado en caja al momento del cierre HIS.",
        "No tienen N° de orden asignado, por eso no pueden cruzarse directamente con la liquidación.",
        "Pueden aparecer en la liquidación del mes siguiente una vez que el paciente pague.",
        'Usa el modo "Solo Fin de Atención" para excluirlos de la comparación si generan una diferencia falsa.',
      ],
    },
    {
      icon: "🔍",
      heading: "Modos de comparación HIS",
      highlight: "sky",
      body: [
        "Todos los HIS: incluye Fin de Atención + Por Recaudar. Puede inflar el estimado si aún no cobraron.",
        "Solo Fin de Atención: excluye Por Recaudar. Comparación más conservadora.",
        "Cobrados en el período: modo inteligente (disponible tras reimportar los archivos HIS). Cruza por N° de orden para saber exactamente cuáles Por Recaudar ya están en esta liquidación.",
      ],
    },
    {
      icon: "🤖",
      heading: "El asistente de análisis",
      highlight: "amber",
      body: [
        'Pulsa "Generar análisis" para obtener conclusiones automáticas sobre el período.',
        "Detecta diferencias por prestación, porcentajes de acuerdo distintos y exámenes sin clasificar.",
        "No es una IA externa — lee los datos que ya están cargados en el navegador.",
      ],
    },
    {
      icon: "💡",
      heading: "Flujo recomendado",
      body: [
        "1. Importa todos los HIS del mes en 'Diario'.",
        "2. Carga la liquidación en 'Mensual → Liquidación'.",
        "3. Vuelve aquí, selecciona el período y pulsa 'Generar análisis'.",
        "4. Si hay subpago, revisa la tabla de detalle por prestación para identificar las diferencias.",
      ],
    },
  ];

  useEffect(() => {
    const regs   = getRegistros();
    const prests = getPrestaciones();
    const liqs   = getLiquidaciones();
    const cfg    = getTopeConfig();

    // build precios map usando nivel configurado
    const { nivelCalculo } = cfg;
    const pm: Record<string, number> = {};
    getPrecios().forEach((p) => { if (p.nivel === nivelCalculo) pm[p.prestacionId] = p.precio; });
    getPrecios().forEach((p) => { if (!pm[p.prestacionId]) pm[p.prestacionId] = p.precio; });

    setRegistros(regs);
    setPrestaciones(prests);
    setLiquidaciones(liqs);
    setAcuerdoPct(cfg.acuerdoPct);
    setPrecios(pm);

    // auto-select latest period with any data
    const hisPeriods = [...new Set(regs.map((r) => r.fecha.slice(0, 7)))];
    const liqPeriods = liqs.map((l) => l.periodo);
    const all = [...new Set([...hisPeriods, ...liqPeriods])].sort();
    if (all.length > 0) setSelectedPeriodo(all[all.length - 1]);
  }, []);

  // ── Datos HIS del período ─────────────────────────────────────
  const hisRegsAll     = registros.filter((r) => r.fecha.startsWith(selectedPeriodo));
  const hisPorRecaudar = hisRegsAll.filter((r) => r.estado === "porRecaudar");

  // Órdenes presentes en la liquidación del período (para modo inteligente)
  const liqOrdenes = new Set(
    (liquidaciones.find((l) => l.periodo === selectedPeriodo)?.rows ?? [])
      .map((r) => r.orden)
      .filter(Boolean)
  );
  const porRecaudarEnLiq  = hisPorRecaudar.filter((r) => r.orden && liqOrdenes.has(r.orden));
  const porRecaudarFuera  = hisPorRecaudar.filter((r) => !r.orden || !liqOrdenes.has(r.orden));
  const tieneOrden        = hisPorRecaudar.some((r) => r.orden); // si la data ya tiene ordenes

  const hisRegs = modoHIS === "soloFin"
    ? hisRegsAll.filter((r) => r.estado !== "porRecaudar")
    : modoHIS === "inteligente"
      ? hisRegsAll.filter((r) => r.estado !== "porRecaudar" || (r.orden && liqOrdenes.has(r.orden)))
      : hisRegsAll;
  const hisTotalExams = hisRegs.length;
  const hisValorBase = hisRegs.reduce((s, r) => s + r.precioUnitario * r.cantidad, 0);
  const hisAPagoEst  = Math.round(hisValorBase * acuerdoPct / 100);

  // ── Liquidación del período ───────────────────────────────────
  const liq         = liquidaciones.find((l) => l.periodo === selectedPeriodo);
  const liqExams    = liq?.rows.length ?? 0;
  const liqAPago    = liq?.rows.reduce((s, r) => s + r.aPago, 0) ?? 0;
  const liqAcuerdoPct = liq?.acuerdoPct ?? null;

  // ── Deltas ────────────────────────────────────────────────────
  const deltaExams   = liqExams - hisTotalExams;
  const deltaAPago   = liqAPago - hisAPagoEst;
  const pctDelta     = hisAPagoEst > 0 ? (deltaAPago / hisAPagoEst) * 100 : 0;

  const hasHIS  = hisTotalExams > 0;
  const hasLiq  = !!liq;
  const hasBoth = hasHIS && hasLiq;

  // ── Veredicto ─────────────────────────────────────────────────
  type Veredicto = "ok" | "subpago" | "diferencia" | "sin_liq" | "sin_datos";
  const veredicto: Veredicto = !hasHIS && !hasLiq ? "sin_datos"
    : !hasLiq       ? "sin_liq"
    : !hasHIS       ? "sin_liq"
    : Math.abs(pctDelta) <= 5 ? "ok"
    : pctDelta < -5 ? "subpago"
    : "diferencia";

  const VEREDICTO_UI = {
    ok:         { icon: ShieldCheck,  color: "emerald", border: "border-emerald-500/20", bg: "bg-emerald-500/5",  text: "text-emerald-400",  label: "Honorarios consistentes",         sub: "La liquidación es coherente con los registros HIS" },
    subpago:    { icon: ShieldAlert,  color: "red",     border: "border-red-500/20",     bg: "bg-red-500/5",     text: "text-red-400",      label: "Posible subpago detectado",       sub: "Se liquidó menos de lo estimado según acuerdo" },
    diferencia: { icon: AlertTriangle,color: "amber",   border: "border-amber-500/20",   bg: "bg-amber-500/5",   text: "text-amber-400",    label: "Diferencia fuera del margen",     sub: "La diferencia supera el 5% — revisa los detalles" },
    sin_liq:    { icon: FileSpreadsheet, color: "slate", border: "border-slate-700",     bg: "bg-slate-800/30",  text: "text-slate-400",    label: "Sin liquidación para este mes",   sub: "Sube el archivo en Mensual → Liquidación para comparar" },
    sin_datos:  { icon: FileText,     color: "slate",   border: "border-slate-700",      bg: "bg-slate-800/30",  text: "text-slate-500",    label: "Sin datos",                       sub: "Sube archivos HIS en Diario y la liquidación en Mensual" },
  };
  const V = VEREDICTO_UI[veredicto];
  const VIcon = V.icon;

  // ── Comparación por prestación ────────────────────────────────
  const liqByPrest = new Map<string, { count: number; aPago: number }>();
  if (liq) {
    liq.rows.forEach((row) => {
      const { prestacionId } = matchExamen(row.examen, prestaciones, precios);
      const key  = prestacionId ?? "__sin_match__";
      const prev = liqByPrest.get(key) ?? { count: 0, aPago: 0 };
      liqByPrest.set(key, { count: prev.count + 1, aPago: prev.aPago + row.aPago });
    });
  }

  const compData = prestaciones
    .map((p) => {
      const hisR    = hisRegs.filter((r) => r.prestacionId === p.id);
      const hisA    = Math.round(hisR.reduce((s, r) => s + r.precioUnitario * r.cantidad, 0) * acuerdoPct / 100);
      const liqData = liqByPrest.get(p.id) ?? { count: 0, aPago: 0 };
      const delta   = liqData.aPago - hisA;
      const nombre  = p.nombre.replace(/Ecografía\s*/i, "");
      const label   = nombre.length > 22 ? nombre.slice(0, 20) + "…" : nombre;
      return {
        id: p.id, nombre, label,
        hisCount: hisR.length, hisAPago: hisA,
        liqCount: liqData.count, liqAPago: liqData.aPago,
        delta,
        pctDelta: hisA > 0 ? (delta / hisA) * 100 : liqData.aPago > 0 ? 100 : 0,
      };
    })
    .filter((d) => d.hisCount > 0 || d.liqCount > 0)
    .sort((a, b) => b.hisAPago - a.hisAPago);

  // Sin match en liquidación
  const sinMatch = liqByPrest.get("__sin_match__");

  // ── Asistente ─────────────────────────────────────────────────
  type AnalysisLine = { text: string; highlight?: "red" | "amber" | "emerald" | "sky" | "violet" };
  const [analysisLines, setAnalysisLines] = useState<AnalysisLine[]>([]);
  const [analysisState, setAnalysisState] = useState<"idle" | "thinking" | "done">("idle");
  const [visibleCount,  setVisibleCount]  = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function generateAnalysis() {
    setAnalysisState("thinking");
    setAnalysisLines([]);
    setVisibleCount(0);

    setTimeout(() => {
      const lines: AnalysisLine[] = [];
      const periodo = periodoLabel(selectedPeriodo);

      if (!hasHIS && !hasLiq) {
        lines.push({ text: `No hay datos cargados para ${periodo}. Sube archivos HIS en /Diario y la liquidación en /Mensual para poder analizar.` });
      } else if (!hasLiq && hasHIS) {
        lines.push({ text: `Hay ${hisTotalExams} exámenes registrados en HIS para ${periodo}, pero aún no se ha subido la liquidación.`, highlight: "amber" });
        lines.push({ text: `El honorario estimado (${acuerdoPct}% de acuerdo) es ${fmt(hisAPagoEst)}. Sin liquidación no es posible verificar si el pago fue correcto.` });
        lines.push({ text: `Recomendación: sube el archivo de liquidación en Mensual → Liquidación para comparar.` });
      } else {
        // Global
        if (veredicto === "ok") {
          lines.push({ text: `La liquidación de ${periodo} es consistente con los registros HIS. La diferencia de ${pctDelta >= 0 ? "+" : ""}${pctDelta.toFixed(1)}% está dentro del margen aceptable del ±5%.`, highlight: "emerald" });
        } else if (veredicto === "subpago") {
          const porRecaudarNote = hisPorRecaudar.length > 0
            ? tieneOrden && modoHIS === "inteligente"
              ? ` Se excluyeron ${porRecaudarFuera.length} exámenes "Por Recaudar" pendientes de cobro (mes siguiente).`
              : ` Hay ${hisPorRecaudar.length} exámenes "Por Recaudar" en el HIS. Activa el modo "Cobrados en el período" para una comparación más precisa.`
            : "";
          lines.push({ text: `Se detectó un posible subpago en ${periodo}: se liquidaron ${fmt(liqAPago)} pero el estimado HIS era ${fmt(hisAPagoEst)}. La diferencia es de ${fmt(deltaAPago)} (${pctDelta.toFixed(1)}%), fuera del margen del ±5%.${porRecaudarNote}`, highlight: hisPorRecaudar.length > 0 ? "amber" : "red" });
        } else {
          lines.push({ text: `En ${periodo} la liquidación supera el estimado HIS en ${fmt(deltaAPago)} (+${pctDelta.toFixed(1)}%). Esto puede indicar diferencias en el arancel aplicado o exámenes no registrados en HIS.`, highlight: "amber" });
        }

        // Examen count
        if (deltaExams !== 0) {
          const quien = deltaExams > 0 ? "la liquidación tiene más exámenes" : "HIS registra más exámenes que la liquidación";
          let conteoExtra = "";
          if (deltaExams < 0 && hisPorRecaudar.length > 0 && modoHIS === "todos") {
            conteoExtra = ` Nota: ${hisPorRecaudar.length} HIS están en "Por Recaudar". ${tieneOrden ? `De esos, ${porRecaudarEnLiq.length} ya están en esta liquidación y ${porRecaudarFuera.length} aparecerán el mes siguiente. Usa el modo "Cobrados en el período" para la comparación exacta.` : 'Reimporta los archivos HIS para activar el cruce inteligente por N° de orden.'}`;
          } else if (modoHIS === "inteligente" && tieneOrden) {
            conteoExtra = ` (Modo inteligente: incluye ${porRecaudarEnLiq.length} "Por Recaudar" confirmados en esta liquidación, excluye ${porRecaudarFuera.length} pendientes.)`;
          }
          lines.push({ text: `Conteo de exámenes: HIS registra ${hisTotalExams} y la liquidación incluye ${liqExams}. ${quien} (${deltaExams >= 0 ? "+" : ""}${deltaExams}).${conteoExtra} ${Math.abs(deltaExams) > 5 ? "Esta diferencia es significativa y debería revisarse." : "La diferencia es menor y puede deberse a correcciones o ajustes normales."}`, highlight: Math.abs(deltaExams) > 5 ? "amber" : undefined });
        } else {
          lines.push({ text: `El conteo de exámenes coincide perfectamente: ${hisTotalExams} en HIS y ${liqExams} en liquidación.`, highlight: "emerald" });
        }

        // Acuerdo %
        if (liqAcuerdoPct !== null && liqAcuerdoPct !== acuerdoPct) {
          lines.push({ text: `El porcentaje de acuerdo aplicado en la liquidación (${liqAcuerdoPct}%) difiere del configurado (${acuerdoPct}%). Esto explica parte de la diferencia. Verifica cuál es el porcentaje correcto en tu contrato.`, highlight: "amber" });
        }

        // Problematic categories
        const subpagados = compData.filter((d) => d.hisCount > 0 && d.pctDelta < -10);
        const sobrepagados = compData.filter((d) => d.hisCount > 0 && d.pctDelta > 10);
        const noLiquidados = compData.filter((d) => d.hisCount > 0 && d.liqCount === 0 && hasLiq);

        if (subpagados.length > 0) {
          const nombres = subpagados.slice(0, 3).map((d) => d.nombre.replace(/Ecografía\s*/i, "")).join(", ");
          lines.push({ text: `Prestaciones con subpago (>10% bajo lo estimado): ${nombres}${subpagados.length > 3 ? ` y ${subpagados.length - 3} más` : ""}. Revisar si el arancel aplicado es correcto.`, highlight: "red" });
        }

        if (sobrepagados.length > 0) {
          const nombres = sobrepagados.slice(0, 3).map((d) => d.nombre.replace(/Ecografía\s*/i, "")).join(", ");
          lines.push({ text: `Prestaciones liquidadas sobre lo estimado (>10%): ${nombres}${sobrepagados.length > 3 ? ` y ${sobrepagados.length - 3} más` : ""}. Puede tratarse de un arancel diferente o de correcciones a favor.`, highlight: "sky" });
        }

        if (noLiquidados.length > 0) {
          const nombres = noLiquidados.slice(0, 3).map((d) => d.nombre.replace(/Ecografía\s*/i, "")).join(", ");
          lines.push({ text: `Prestaciones en HIS sin ningún registro en la liquidación: ${nombres}${noLiquidados.length > 3 ? ` y ${noLiquidados.length - 3} más` : ""}. Estos exámenes podrían no haberse incluido en el pago.`, highlight: "amber" });
        }

        // Sin match
        if (sinMatch) {
          lines.push({ text: `${sinMatch.count} examen(es) de la liquidación no pudieron clasificarse en ninguna prestación conocida (total: ${fmt(sinMatch.aPago)}). Revisa si los nombres corresponden a exámenes no configurados.`, highlight: "amber" });
        }

        // Best and worst
        const ranked = compData.filter((d) => d.hisCount > 0 && d.liqCount > 0 && d.hisAPago > 0);
        if (ranked.length > 0) {
          const mejor = ranked.reduce((a, b) => Math.abs(a.pctDelta) < Math.abs(b.pctDelta) ? a : b);
          if (Math.abs(mejor.pctDelta) <= 3) {
            lines.push({ text: `La prestación con mayor precisión en la liquidación es "${mejor.nombre.replace(/Ecografía\s*/i, "")}" con solo ${Math.abs(mejor.pctDelta).toFixed(1)}% de diferencia.` });
          }
        }

        // Summary recommendation
        if (veredicto === "ok") {
          lines.push({ text: `Conclusión: el pago de ${periodo} parece correcto. No se requiere acción inmediata, pero se recomienda mantener el registro mensual para detectar tendencias a lo largo del tiempo.`, highlight: "emerald" });
        } else if (veredicto === "subpago") {
          lines.push({ text: `Conclusión: se recomienda contactar al pagador para revisar las diferencias detectadas, en especial las prestaciones con subpago. Prepara un informe con el detalle por prestación.`, highlight: "red" });
        } else {
          lines.push({ text: `Conclusión: existe una diferencia fuera del margen esperado. Revisa el porcentaje de acuerdo y las prestaciones con mayor diferencia antes de cerrar el período.`, highlight: "amber" });
        }
      }

      setAnalysisLines(lines);
      setAnalysisState("done");
      setVisibleCount(0);

      let i = 0;
      function tick() {
        i++;
        setVisibleCount(i);
        if (i < lines.length) {
          timerRef.current = setTimeout(tick, 180);
        }
      }
      timerRef.current = setTimeout(tick, 80);
    }, 900);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Períodos disponibles
  const hisPeriods = [...new Set(registros.map((r) => r.fecha.slice(0, 7)))];
  const allPeriods = [...new Set([...hisPeriods, ...liquidaciones.map((l) => l.periodo)])].sort().reverse();

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{name:string; value:number; color:string}>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl space-y-1">
        <p className="text-slate-400 font-medium mb-1">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-400">{p.name}:</span>
            <span className="font-semibold text-slate-200">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Help modal */}
      {showHelp && (
        <HelpModal
          title="Ayuda — Verificación de Honorarios"
          subtitle="Cómo interpretar la comparación HIS vs Liquidación"
          sections={HELP_SECTIONS}
          onClose={() => setShowHelp(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Verificación de Honorarios</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Contrasta los registros HIS con la liquidación para detectar diferencias en el pago
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2">
          <HelpButton onClick={() => setShowHelp(true)} />
          <span className="text-xs text-slate-600">Período:</span>
          <select
            className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-sky-500 cursor-pointer"
            value={selectedPeriodo}
            onChange={(e) => setSelectedPeriodo(e.target.value)}
          >
            {allPeriods.length === 0 && <option value="">Sin datos</option>}
            {allPeriods.map((p) => (
              <option key={p} value={p}>{periodoLabel(p)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Veredicto */}
      <div className={`rounded-xl border ${V.border} ${V.bg} p-5 flex items-start gap-4`}>
        <div className={`p-2.5 rounded-xl border ${V.border} ${V.bg} shrink-0`}>
          <VIcon className={`w-5 h-5 ${V.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-base font-semibold ${V.text}`}>{V.label}</p>
          <p className="text-sm text-slate-500 mt-0.5">{V.sub}</p>
          {hasBoth && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="text-xs text-slate-500">Diferencia:</span>
              <span className={`text-sm font-semibold tabular-nums ${Math.abs(pctDelta) <= 5 ? "text-emerald-400" : pctDelta < 0 ? "text-red-400" : "text-amber-400"}`}>
                {deltaAPago >= 0 ? "+" : ""}{fmt(deltaAPago)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium tabular-nums ${Math.abs(pctDelta) <= 5 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : pctDelta < 0 ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
                {pctDelta >= 0 ? "+" : ""}{pctDelta.toFixed(1)}%
              </span>
              {liqAcuerdoPct !== null && (
                <span className="text-xs text-slate-600">
                  Acuerdo aplicado: <span className="text-slate-400">{liqAcuerdoPct}%</span>
                  {liqAcuerdoPct !== acuerdoPct && <span className="text-amber-500 ml-1">(config: {acuerdoPct}%)</span>}
                </span>
              )}
            </div>
          )}
          {veredicto === "sin_liq" && hasHIS && (
            <div className="flex items-center gap-2 mt-3">
              <a href="/mensual" className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors">
                Ir a Mensual → Liquidación <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
        {hasBoth && (
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-600 mb-0.5">% coincidencia</p>
            <p className={`text-3xl font-bold tabular-nums ${Math.abs(pctDelta) <= 5 ? "text-emerald-400" : pctDelta < 0 ? "text-red-400" : "text-amber-400"}`}>
              {Math.min(100, Math.round(100 - Math.abs(pctDelta)))}%
            </p>
          </div>
        )}
      </div>

      {/* Banner Por Recaudar */}
      {hisPorRecaudar.length > 0 && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
          <div className="flex flex-wrap items-start gap-3">
            <Clock className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-violet-300">
                {hisPorRecaudar.length} exámenes en estado <span className="font-semibold">Por Recaudar</span> en HIS
              </p>
              {tieneOrden ? (
                <p className="text-xs text-violet-400/70 mt-0.5">
                  Cruzando N° de orden: <span className="text-emerald-400 font-medium">{porRecaudarEnLiq.length} cobrados en este período</span>
                  {" "}· <span className="text-amber-400 font-medium">{porRecaudarFuera.length} pendientes (aparecerán en el mes siguiente)</span>
                </p>
              ) : (
                <p className="text-xs text-violet-400/70 mt-0.5">
                  Reimporta los archivos HIS para activar el cruce por N° de orden y saber cuáles se cobraron en este mes.
                </p>
              )}
            </div>
          </div>

          {/* Selector de modo */}
          <div className="flex flex-wrap gap-2">
            {(["todos", "inteligente", "soloFin"] as const).map((modo) => {
              const labels = {
                todos: { label: "Todos los HIS", sub: `${hisRegsAll.length} exáms`, icon: Eye },
                inteligente: { label: tieneOrden ? "Cobrados en el período" : "Inteligente (reimporta primero)", sub: tieneOrden ? `${hisRegsAll.filter((r) => r.estado !== "porRecaudar" || (r.orden && liqOrdenes.has(r.orden))).length} exáms` : "requiere reimportar", icon: CheckCircle },
                soloFin: { label: "Solo Fin de Atención", sub: `${hisRegsAll.filter((r) => r.estado !== "porRecaudar").length} exáms`, icon: EyeOff },
              };
              const { label, sub, icon: MIcon } = labels[modo];
              const active = modoHIS === modo;
              const disabled = modo === "inteligente" && !tieneOrden;
              return (
                <button
                  key={modo}
                  onClick={() => !disabled && setModoHIS(modo)}
                  disabled={disabled}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    disabled ? "opacity-40 cursor-not-allowed border-slate-700 text-slate-600 bg-slate-800/30" :
                    active
                      ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                      : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-violet-500/30 hover:text-violet-400"
                  }`}
                >
                  <MIcon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                  <span className={`${active ? "text-violet-400" : "text-slate-600"}`}>· {sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Métricas comparativas */}
      {(hasHIS || hasLiq) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Exámenes */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">Exámenes realizados</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">HIS</p>
                <p className="text-2xl font-semibold text-slate-100 tabular-nums">{hisTotalExams}</p>
                <p className="text-xs text-slate-600 mt-0.5">registros</p>
              </div>
              <div className="text-center flex flex-col items-center justify-center">
                <div className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${deltaExams === 0 ? "text-emerald-400" : deltaExams > 0 ? "text-sky-400" : "text-amber-400"}`}>
                  {deltaExams > 0 ? <TrendingUp className="w-4 h-4" /> : deltaExams < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  {deltaExams >= 0 ? "+" : ""}{deltaExams}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">diferencia</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Liquidados</p>
                <p className={`text-2xl font-semibold tabular-nums ${hasLiq ? "text-slate-100" : "text-slate-600"}`}>{liqExams || "—"}</p>
                <p className="text-xs text-slate-600 mt-0.5">en liquidación</p>
              </div>
            </div>
            {sinMatch && (
              <p className="mt-3 text-xs text-amber-500 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
                ⚠ {sinMatch.count} examen(es) en liquidación sin categoría reconocida — {fmt(sinMatch.aPago)}
              </p>
            )}
          </div>

          {/* A Pago */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">A Pago / Honorario</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Estimado HIS</p>
                <p className="text-lg font-semibold text-slate-300 tabular-nums">{hasHIS ? fmtShort(hisAPagoEst) : "—"}</p>
                <p className="text-xs text-slate-600 mt-0.5">{acuerdoPct}% acuerdo</p>
              </div>
              <div className="text-center flex flex-col items-center justify-center">
                <div className={`text-sm font-semibold tabular-nums ${Math.abs(pctDelta) <= 5 ? "text-emerald-400" : deltaAPago < 0 ? "text-red-400" : "text-sky-400"}`}>
                  {hasBoth ? `${deltaAPago >= 0 ? "+" : ""}${fmtShort(deltaAPago)}` : "—"}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">diferencia</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Real Liquidación</p>
                <p className={`text-lg font-semibold tabular-nums ${hasLiq ? "text-sky-400" : "text-slate-600"}`}>{hasLiq ? fmtShort(liqAPago) : "—"}</p>
                <p className="text-xs text-slate-600 mt-0.5">{hasLiq ? `${liqAcuerdoPct ?? acuerdoPct}% aplicado` : "sin datos"}</p>
              </div>
            </div>
            {hasBoth && (
              <div className="mt-3">
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, hisAPagoEst > 0 ? (liqAPago / hisAPagoEst) * 100 : 0)}%`,
                      background: Math.abs(pctDelta) <= 5 ? "#34d399" : pctDelta < -5 ? "#f87171" : "#fbbf24",
                    }}
                  />
                </div>
                <p className="text-xs text-slate-600 mt-1 text-right">{hisAPagoEst > 0 ? ((liqAPago / hisAPagoEst) * 100).toFixed(1) : 0}% del estimado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gráfico por prestación */}
      {compData.length > 0 && hasLiq && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-300 mb-1">A Pago por Prestación</p>
          <p className="text-xs text-slate-600 mb-4">Estimado HIS vs liquidado real</p>
          <ResponsiveContainer width="100%" height={Math.max(compData.length * 44 + 30, 140)}>
            <BarChart data={compData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtShort} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={155} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="hisAPago" name="Estimado HIS" fill="#334155" radius={[0, 3, 3, 0]} maxBarSize={12} />
              <Bar dataKey="liqAPago" name="Liquidado" radius={[0, 3, 3, 0]} maxBarSize={12}>
                {compData.map((d) => (
                  <Cell key={d.id} fill={Math.abs(d.pctDelta) <= 10 ? "#34d399" : d.pctDelta < -10 ? "#f87171" : "#fbbf24"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-600">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-700" /> Estimado HIS ({acuerdoPct}%)</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Liquidado (±10%)</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Diferencia significativa</div>
          </div>
        </div>
      )}

      {/* Tabla detalle */}
      {compData.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">Detalle por Prestación</p>
            {hasBoth && <p className="text-xs text-slate-600">{periodoLabel(selectedPeriodo)}</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Prestación</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">HIS #</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">HIS A Pago est.</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-sky-600 uppercase tracking-wider">Liq #</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-sky-600 uppercase tracking-wider">Liq A Pago</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Diferencia</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {compData.map((row) => {
                  const ok  = Math.abs(row.pctDelta) <= 10;
                  const bad = row.pctDelta < -10;
                  return (
                    <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-3 text-slate-300 max-w-[200px] truncate" title={row.nombre}>{row.nombre}</td>
                      <td className="px-4 py-3 text-slate-400 text-right tabular-nums">{row.hisCount}</td>
                      <td className="px-4 py-3 text-slate-400 text-right tabular-nums">{row.hisAPago > 0 ? fmt(row.hisAPago) : "—"}</td>
                      <td className="px-4 py-3 text-sky-400/70 text-right tabular-nums">{row.liqCount || (hasLiq ? "0" : "—")}</td>
                      <td className="px-4 py-3 text-sky-400 text-right tabular-nums font-medium">{row.liqAPago > 0 ? fmt(row.liqAPago) : (hasLiq ? "$0" : "—")}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${hasLiq ? (ok ? "text-emerald-400" : bad ? "text-red-400" : "text-amber-400") : "text-slate-600"}`}>
                        {hasLiq ? `${row.delta >= 0 ? "+" : ""}${fmt(row.delta)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!hasLiq ? (
                          <span className="text-slate-700">—</span>
                        ) : ok ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : bad ? (
                          <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {hasBoth && (
                <tfoot>
                  <tr className="border-t border-slate-700 bg-slate-800/30">
                    <td className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-300 tabular-nums">{hisTotalExams}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-300 tabular-nums">{fmt(hisAPagoEst)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-sky-400 tabular-nums">{liqExams}</td>
                    <td className="px-4 py-3 text-right font-semibold text-sky-400 tabular-nums">{fmt(liqAPago)}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${Math.abs(pctDelta) <= 5 ? "text-emerald-400" : deltaAPago < 0 ? "text-red-400" : "text-amber-400"}`}>
                      {deltaAPago >= 0 ? "+" : ""}{fmt(deltaAPago)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {Math.abs(pctDelta) <= 5
                        ? <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                        : <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Asistente */}
      {allPeriods.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-sky-500/20 border border-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Asistente de análisis</p>
                <p className="text-xs text-slate-600">Lectura automática de los datos del período</p>
              </div>
            </div>
            <button
              onClick={generateAnalysis}
              disabled={analysisState === "thinking"}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all
                bg-violet-500/10 border-violet-500/20 text-violet-400
                hover:bg-violet-500/20 hover:border-violet-500/40
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analysisState === "thinking" ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {analysisState === "idle" ? "Generar análisis" : analysisState === "thinking" ? "Analizando…" : "Regenerar"}
            </button>
          </div>

          <div className="p-5">
            {analysisState === "idle" && (
              <p className="text-sm text-slate-600 text-center py-4">
                Pulsa <span className="text-violet-400 font-medium">Generar análisis</span> para que el asistente revise los datos del período seleccionado.
              </p>
            )}

            {analysisState === "thinking" && (
              <div className="flex items-center gap-3 py-4">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <p className="text-sm text-slate-500">Leyendo datos y generando conclusiones…</p>
              </div>
            )}

            {analysisState === "done" && (
              <div className="space-y-3">
                {analysisLines.slice(0, visibleCount).map((line, i) => {
                  const borderColor = line.highlight === "red" ? "border-red-500/30" : line.highlight === "amber" ? "border-amber-500/30" : line.highlight === "emerald" ? "border-emerald-500/30" : line.highlight === "sky" ? "border-sky-500/30" : line.highlight === "violet" ? "border-violet-500/30" : "border-slate-700/50";
                  const dotColor   = line.highlight === "red" ? "bg-red-400" : line.highlight === "amber" ? "bg-amber-400" : line.highlight === "emerald" ? "bg-emerald-400" : line.highlight === "sky" ? "bg-sky-400" : line.highlight === "violet" ? "bg-violet-400" : "bg-slate-600";
                  const textColor  = line.highlight === "red" ? "text-red-300" : line.highlight === "amber" ? "text-amber-300" : line.highlight === "emerald" ? "text-emerald-300" : line.highlight === "sky" ? "text-sky-300" : "text-slate-300";
                  return (
                    <div
                      key={i}
                      className={`flex gap-3 items-start rounded-lg border px-4 py-3 animate-fade-in ${borderColor} bg-slate-800/30`}
                    >
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                      <p className={`text-sm leading-relaxed ${textColor}`}>{line.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {allPeriods.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl border border-slate-700 bg-slate-800 flex items-center justify-center">
            <Scale className="w-6 h-6 text-slate-500" />
          </div>
          <div>
            <p className="text-slate-300 font-medium">Sin datos para comparar</p>
            <p className="text-sm text-slate-600 mt-1">Sube archivos HIS en Diario y la liquidación en Mensual</p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <a href="/diario" className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 px-3 py-2 rounded-lg transition-colors">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Ir a Diario <ArrowRight className="w-3 h-3" />
            </a>
            <a href="/mensual" className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 px-3 py-2 rounded-lg transition-colors">
              <DollarSign className="w-3.5 h-3.5" /> Ir a Mensual <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
