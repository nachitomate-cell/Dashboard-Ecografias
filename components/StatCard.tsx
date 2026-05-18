"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  accent?: "sky" | "emerald" | "violet" | "amber";
}

const ACCENT = {
  sky:     { icon: "bg-sky-500/10     border-sky-500/20     text-sky-400",     bar: "bg-sky-400",     glow: "hover:shadow-sky-500/10"     },
  emerald: { icon: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", bar: "bg-emerald-400", glow: "hover:shadow-emerald-500/10" },
  violet:  { icon: "bg-violet-500/10  border-violet-500/20  text-violet-400",  bar: "bg-violet-400",  glow: "hover:shadow-violet-500/10"  },
  amber:   { icon: "bg-amber-500/10   border-amber-500/20   text-amber-400",   bar: "bg-amber-400",   glow: "hover:shadow-amber-500/10"   },
};

function AnimatedValue({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);
  const [popping, setPopping] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value === prevRef.current) return;
    prevRef.current = value;
    setPopping(true);
    setDisplay(value);
    const t = setTimeout(() => setPopping(false), 320);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span
      key={display}
      className={clsx(
        "text-2xl font-semibold text-slate-100 tabular-nums block transition-all",
        popping && "animate-number-pop"
      )}
    >
      {display}
    </span>
  );
}

export default function StatCard({
  title, value, subtitle, icon: Icon, trend, accent = "sky",
}: StatCardProps) {
  const a = ACCENT[accent];

  return (
    <div className={clsx(
      "group relative rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col gap-4",
      "transition-all duration-200",
      "hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-xl",
      a.glow,
    )}>
      {/* Accent line top */}
      <div className={clsx("absolute top-0 left-5 right-5 h-px rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300", a.bar)} />

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider leading-none">{title}</p>
        <div className={clsx("flex items-center justify-center w-8 h-8 rounded-lg border transition-all group-hover:scale-110", a.icon)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div>
        <AnimatedValue value={value} />
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      {trend && (
        <div className="flex items-center gap-1">
          <span className={clsx(
            "text-xs font-medium px-1.5 py-0.5 rounded",
            trend.positive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          )}>
            {trend.positive ? "▲" : "▼"} {trend.value}
          </span>
          <span className="text-xs text-slate-600">vs período anterior</span>
        </div>
      )}
    </div>
  );
}
