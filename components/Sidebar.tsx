"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart2,
  GitCompare,
  Settings,
  Stethoscope,
  HardDrive,
} from "lucide-react";
import clsx from "clsx";
import { getStorageUsage } from "@/lib/store";

const nav = [
  { href: "/diario",     label: "Diario",      icon: Activity   },
  { href: "/mensual",    label: "Mensual",      icon: BarChart2  },
  { href: "/comparacion",label: "Comparación",  icon: GitCompare },
];

function fmtBytes(b: number): string {
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [storePct, setStorePct] = useState(0);
  const [storeUsed, setStoreUsed] = useState(0);

  useEffect(() => {
    function update() {
      const { totalBytes, limitBytes } = getStorageUsage();
      setStorePct(Math.min((totalBytes / limitBytes) * 100, 100));
      setStoreUsed(totalBytes);
    }
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, []);

  const barColor = storePct > 80 ? "#f87171" : storePct > 50 ? "#fbbf24" : "#34d399";

  return (
    <aside className="flex flex-col w-60 shrink-0 border-r border-slate-800/80 bg-slate-950 h-screen relative overflow-hidden">
      {/* Glow top-left */}
      <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-sky-500/5 blur-3xl" />

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800/80">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20">
          <Stethoscope className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-100 leading-tight">Tecnólogo</p>
          <p className="text-xs text-slate-500 leading-tight">Médico · Ecografía</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 mb-3 text-xs font-medium text-slate-600 uppercase tracking-widest">
          Reportes
        </p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-5 border-t border-slate-800 pt-4 space-y-1">
        {/* Uso de almacenamiento */}
        <Link href="/uso"
          className={clsx(
            "flex flex-col gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150 group",
            pathname === "/uso"
              ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          )}
        >
          <div className="flex items-center gap-3">
            <HardDrive className="w-4 h-4 shrink-0" />
            <span>Almacenamiento</span>
            {pathname === "/uso" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />}
          </div>
          {/* Mini barra */}
          <div className="ml-7 space-y-1">
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(storePct, 1)}%`, background: barColor }} />
            </div>
            <p className="text-xs text-slate-600">
              {fmtBytes(storeUsed)} · {storePct.toFixed(1)}%
            </p>
          </div>
        </Link>

        {/* Cmd+K hint */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true, bubbles: true }))}
          className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-slate-800/40 transition-all text-xs w-full"
        >
          <span>Paleta de comandos</span>
          <div className="flex items-center gap-0.5">
            <kbd className="bg-slate-800 border border-slate-700/80 px-1.5 py-0.5 rounded text-slate-600 font-mono">⌘</kbd>
            <kbd className="bg-slate-800 border border-slate-700/80 px-1.5 py-0.5 rounded text-slate-600 font-mono">K</kbd>
          </div>
        </button>

        {/* Configuración */}
        <Link href="/configuracion"
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
            pathname === "/configuracion"
              ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Configuración
          {pathname === "/configuracion" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />}
        </Link>
      </div>
    </aside>
  );
}
