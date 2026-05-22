"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Upload, BarChart2, FileSpreadsheet, Scale, Download, ArrowRight } from "lucide-react";

const STORAGE_KEY = "ecografia_welcome_v2";

export default function WelcomeModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch { /* SSR */ }
  }, []);

  const dismiss = useCallback((permanent: boolean) => {
    if (permanent) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(false); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [visible, dismiss]);

  if (!visible) return null;

  const steps = [
    {
      icon: <Upload className="w-5 h-5" />,
      color: "sky",
      num: "1",
      title: "Importar archivos HIS diarios",
      desc: 'Ve a "Diario" → "Cargar Excel" y arrastra el archivo HIS de cada día de trabajo. El nombre debe tener la fecha (ej: 15-05-2026.xlsx). El sistema detecta automáticamente los exámenes y sus estados.',
    },
    {
      icon: <BarChart2 className="w-5 h-5" />,
      color: "violet",
      num: "2",
      title: "Ver estadísticas diarias y mensuales",
      desc: "En \"Diario\" verás ingresos, cantidad de prestaciones y estados de citación del día seleccionado. En \"Mensual\" tendrás el resumen completo del mes y el avance hacia tu meta de honorarios.",
    },
    {
      icon: <FileSpreadsheet className="w-5 h-5" />,
      color: "emerald",
      num: "3",
      title: "Cargar la liquidación de MediCenter",
      desc: 'Cuando recibas el pago, ve a "Mensual" → "Liquidación" y sube el Excel. El sistema calculará automáticamente el porcentaje de acuerdo y el honorario real.',
    },
    {
      icon: <Scale className="w-5 h-5" />,
      color: "amber",
      num: "4",
      title: "Verificar honorarios",
      desc: 'En "Verificación" compara lo que registraste en HIS con lo que te pagaron. El asistente detecta automáticamente si hay diferencias significativas o posibles subpagos.',
    },
    {
      icon: <Download className="w-5 h-5" />,
      color: "red",
      num: "💡",
      title: "Haz backups periódicos",
      desc: "Los datos se guardan solo en este navegador (no en la nube). Usa el botón \"Exportar\" (abajo derecha) para guardar un backup .json en tu computador. Hazlo al menos una vez al mes.",
    },
  ];

  const colorMap: Record<string, string> = {
    sky:     "bg-sky-500/10 border-sky-500/20 text-sky-400",
    violet:  "bg-violet-500/10 border-violet-500/20 text-violet-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber:   "bg-amber-500/10 border-amber-500/20 text-amber-400",
    red:     "bg-orange-500/10 border-orange-500/20 text-orange-400",
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/80 pointer-events-auto animate-fade-in">

          {/* Header */}
          <div className="sticky top-0 z-10 px-6 pt-6 pb-4 bg-slate-900 border-b border-slate-800 rounded-t-2xl">
            <button
              onClick={() => dismiss(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">👋</span>
              <h2 className="text-lg font-semibold text-slate-100">Bienvenido al Dashboard de Ecografía</h2>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Este dashboard te ayuda a <strong className="text-slate-300">controlar tus honorarios</strong> como tecnólogo médico,
              comparar los registros HIS con las liquidaciones de MediCenter y detectar diferencias en el pago.
            </p>
          </div>

          {/* Steps */}
          <div className="p-5 space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">¿Cómo funciona?</p>

            {steps.map((s, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className={`flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 text-sm font-bold ${colorMap[s.color]}`}>
                  {s.num}
                </div>
                <div className="flex-1 min-w-0 pb-3 border-b border-slate-800/60 last:border-0">
                  <p className="text-sm font-semibold text-slate-200 mb-0.5">{s.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}

            {/* Quick links */}
            <div className="pt-2">
              <p className="text-xs text-slate-600 mb-2.5">Empieza por aquí:</p>
              <div className="flex flex-wrap gap-2">
                <a href="/diario" onClick={() => dismiss(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Importar HIS <ArrowRight className="w-3 h-3" />
                </a>
                <a href="/configuracion" onClick={() => dismiss(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-colors">
                  Configurar meta mensual <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800 bg-slate-900/80">
            <button
              onClick={() => dismiss(true)}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              No mostrar de nuevo
            </button>
            <button
              onClick={() => dismiss(true)}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Empezar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
