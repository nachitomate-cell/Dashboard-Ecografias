"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag, DollarSign, Save, X, Check, FileDown, AlertTriangle, RefreshCw, Target, FlaskConical } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  getPrestaciones,
  savePrestaciones,
  getPrecios,
  savePrecios,
  resetToArancelDefaults,
  clearOperationalData,
  clearAllData,
  getTopeConfig,
  saveTopeConfig,
  arancelPrestaciones,
  arancelPrecios,
  type Prestacion,
  type PrecioPrestacion,
} from "@/lib/store";
import clsx from "clsx";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

const CATEGORIAS = [
  "Obstétrica", "Ginecológica", "Abdominal", "Urológica",
  "Cabeza y Cuello", "Mama", "Musculoesquelética", "Vascular", "Especial", "Otro",
];

const NIVEL_LABELS: Record<number, string> = { 1: "Nivel 1", 2: "Nivel 2", 3: "Nivel 3" };

export default function ConfiguracionPage() {
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [precios, setPrecios] = useState<PrecioPrestacion[]>([]);
  const [activeTab, setActiveTab] = useState<"prestaciones" | "precios" | "arancel" | "tope" | "demo">("prestaciones");
  const [nivelActivo, setNivelActivo] = useState<1 | 2 | 3>(2);

  // Form prestación
  const [editingPrest, setEditingPrest] = useState<Prestacion | null>(null);
  const [newPrest, setNewPrest] = useState({ nombre: "", codigo: "", categoria: "Abdominal", duracionMin: 20 });
  const [showFormPrest, setShowFormPrest] = useState(false);
  const [savedPrest, setSavedPrest] = useState(false);

  // Form precio
  const [editingPrecio, setEditingPrecio] = useState<string | null>(null);
  const [precioValues, setPrecioValues] = useState<Record<string, string>>({});
  const [savedPrecio, setSavedPrecio] = useState<string | null>(null);

  // Arancel
  const [showConfirmArancel, setShowConfirmArancel] = useState(false);
  const [arancelImportado, setArancelImportado] = useState(false);

  // Tope
  const [topeForm, setTopeForm] = useState({ montoCLP: "6300000", acuerdoPct: "37" });
  const [topeSaved, setTopeSaved] = useState(false);

  // Demo / Reset
  const [confirmReset, setConfirmReset] = useState<"none" | "operacional" | "todo">("none");

  useEffect(() => {
    const p = getPrestaciones();
    const pr = getPrecios();
    setPrestaciones(p);
    setPrecios(pr);
    const tc = getTopeConfig();
    setTopeForm({ montoCLP: String(tc.montoCLP), acuerdoPct: String(tc.acuerdoPct) });
    const init: Record<string, string> = {};
    p.forEach((prest) => {
      const precio = pr
        .filter((x) => x.prestacionId === prest.id && (x as PrecioPrestacion & { nivel?: number }).nivel === nivelActivo)
        .sort((a, b) => b.vigenciaDesde.localeCompare(a.vigenciaDesde))[0];
      init[prest.id] = precio ? String(precio.precio) : "";
    });
    setPrecioValues(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshPrecioValues(ps: Prestacion[], prs: PrecioPrestacion[], nivel: 1 | 2 | 3) {
    const init: Record<string, string> = {};
    ps.forEach((prest) => {
      const precio = prs
        .filter((x) => x.prestacionId === prest.id && (x as PrecioPrestacion & { nivel?: number }).nivel === nivel)
        .sort((a, b) => b.vigenciaDesde.localeCompare(a.vigenciaDesde))[0];
      init[prest.id] = precio ? String(precio.precio) : "";
    });
    setPrecioValues(init);
  }

  function handleNivelChange(n: 1 | 2 | 3) {
    setNivelActivo(n);
    refreshPrecioValues(prestaciones, precios, n);
  }

  // --- Prestaciones ---
  function handleSavePrest() {
    if (!newPrest.nombre.trim()) return;
    const updated = editingPrest
      ? prestaciones.map((p) => p.id === editingPrest.id ? { ...editingPrest, ...newPrest } : p)
      : [...prestaciones, { id: Date.now().toString(), ...newPrest }];
    savePrestaciones(updated);
    setPrestaciones(updated);
    setShowFormPrest(false);
    setEditingPrest(null);
    setNewPrest({ nombre: "", codigo: "", categoria: "Abdominal", duracionMin: 20 });
    setSavedPrest(true);
    setTimeout(() => setSavedPrest(false), 2000);
    toast.success(editingPrest ? "Prestación actualizada" : "Prestación agregada");
  }

  function handleDeletePrest(id: string) {
    const updated = prestaciones.filter((p) => p.id !== id);
    savePrestaciones(updated);
    setPrestaciones(updated);
  }

  function startEditPrest(p: Prestacion) {
    setEditingPrest(p);
    setNewPrest({ nombre: p.nombre, codigo: (p as Prestacion & { codigo?: string }).codigo ?? "", categoria: p.categoria, duracionMin: p.duracionMin });
    setShowFormPrest(true);
  }

  // --- Precios ---
  function handleSavePrecio(prestacionId: string) {
    const valor = parseInt(precioValues[prestacionId]?.replace(/\D/g, "") || "0", 10);
    if (isNaN(valor)) return;
    const today = new Date().toISOString().split("T")[0];
    const others = precios.filter((p) => !(p.prestacionId === prestacionId && (p as PrecioPrestacion & { nivel?: number }).nivel === nivelActivo));
    const newEntry = { prestacionId, precio: valor, nivel: nivelActivo, vigenciaDesde: today } as PrecioPrestacion;
    const updated = [...others, newEntry];
    savePrecios(updated);
    setPrecios(updated);
    setEditingPrecio(null);
    setSavedPrecio(prestacionId);
    setTimeout(() => setSavedPrecio(null), 2000);
  }

  function getPrecioActualLocal(prestacionId: string): number {
    const p = precios
      .filter((x) => x.prestacionId === prestacionId && (x as PrecioPrestacion & { nivel?: number }).nivel === nivelActivo)
      .sort((a, b) => b.vigenciaDesde.localeCompare(a.vigenciaDesde))[0];
    return p?.precio ?? 0;
  }

  // --- Tope ---
  function handleSaveTope() {
    const montoCLP = parseInt(topeForm.montoCLP.replace(/\D/g, ""), 10) || 6_300_000;
    const acuerdoPct = Math.min(100, Math.max(1, parseInt(topeForm.acuerdoPct, 10) || 37));
    saveTopeConfig({ montoCLP, acuerdoPct });
    setTopeSaved(true);
    setTimeout(() => setTopeSaved(false), 2000);
    toast.success("Meta mensual guardada");
  }

  // --- Demo / Reset ---
  function handleClearOperacional() {
    clearOperationalData();
    setConfirmReset("none");
    toast.success("Datos de atención borrados — configuración conservada");
    setTimeout(() => window.location.reload(), 800);
  }
  function handleClearAll() {
    clearAllData();
    setConfirmReset("none");
    toast.success("Todos los datos borrados");
    setTimeout(() => window.location.reload(), 800);
  }

  // --- Importar Arancel ---
  function handleImportarArancel() {
    resetToArancelDefaults();
    const p = getPrestaciones();
    const pr = getPrecios();
    setPrestaciones(p);
    setPrecios(pr);
    refreshPrecioValues(p, pr, nivelActivo);
    setShowConfirmArancel(false);
    setArancelImportado(true);
    setTimeout(() => setArancelImportado(false), 3000);
    toast.success(`Arancel MLE 2026 importado — ${arancelPrestaciones.length} prestaciones`);
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Configuración</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gestiona prestaciones y precios de tu consulta</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg w-fit border border-slate-800">
        {([["prestaciones", Tag, "Prestaciones"], ["precios", DollarSign, "Precios"], ["arancel", FileDown, "Arancel MLE 2026"], ["tope", Target, "Meta Mensual"], ["demo", FlaskConical, "Demo / Reset"]] as const).map(([tab, Icon, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150",
              activeTab === tab
                ? "bg-slate-900 text-slate-100 shadow-sm border border-slate-700"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ===== MÓDULO PRESTACIONES ===== */}
      {activeTab === "prestaciones" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-slate-200">Prestaciones</h2>
              <p className="text-xs text-slate-600 mt-0.5">{prestaciones.length} prestaciones registradas</p>
            </div>
            <button
              onClick={() => { setShowFormPrest(true); setEditingPrest(null); setNewPrest({ nombre: "", codigo: "", categoria: "Abdominal", duracionMin: 20 }); }}
              className="flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva prestación
            </button>
          </div>

          {showFormPrest && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-sky-400">{editingPrest ? "Editar prestación" : "Nueva prestación"}</p>
                <button onClick={() => { setShowFormPrest(false); setEditingPrest(null); }} className="text-slate-500 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs text-slate-500">Nombre</label>
                  <input type="text" placeholder="Ej: Ecografía Abdominal" value={newPrest.nombre}
                    onChange={(e) => setNewPrest({ ...newPrest, nombre: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-sky-500 placeholder-slate-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Código</label>
                  <input type="text" placeholder="Ej: 04 04 003" value={newPrest.codigo}
                    onChange={(e) => setNewPrest({ ...newPrest, codigo: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-sky-500 placeholder-slate-600 font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Duración (min)</label>
                  <input type="number" min={5} max={120} value={newPrest.duracionMin}
                    onChange={(e) => setNewPrest({ ...newPrest, duracionMin: parseInt(e.target.value) || 20 })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-sky-500" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs text-slate-500">Categoría</label>
                  <select value={newPrest.categoria} onChange={(e) => setNewPrest({ ...newPrest, categoria: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-sky-500 cursor-pointer">
                    {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowFormPrest(false); setEditingPrest(null); }} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
                <button onClick={handleSavePrest} disabled={!newPrest.nombre.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                  <Save className="w-4 h-4" /> Guardar
                </button>
              </div>
            </div>
          )}

          {savedPrest && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg w-fit">
              <Check className="w-4 h-4" /> Guardado correctamente
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Código</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Categoría</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Min</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {prestaciones.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 text-slate-600 font-mono text-xs">{(p as Prestacion & { codigo?: string }).codigo ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-300 font-medium">{p.nombre}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400">{p.categoria}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-center tabular-nums">{p.duracionMin}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => startEditPrest(p)} className="p-1.5 text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeletePrest(p.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MÓDULO PRECIOS ===== */}
      {activeTab === "precios" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-slate-200">Precios por Prestación</h2>
              <p className="text-xs text-slate-600 mt-0.5">El cambio queda vigente desde hoy.</p>
            </div>
            {/* Selector de nivel */}
            <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-800">
              {([1, 2, 3] as const).map((n) => (
                <button key={n} onClick={() => handleNivelChange(n)}
                  className={clsx("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    nivelActivo === n ? "bg-slate-900 text-slate-100 border border-slate-700" : "text-slate-500 hover:text-slate-300")}>
                  {NIVEL_LABELS[n]}
                </button>
              ))}
            </div>
          </div>

          {savedPrecio && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg w-fit">
              <Check className="w-4 h-4" /> Precio actualizado
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Prestación</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Categoría</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Precio · {NIVEL_LABELS[nivelActivo]}
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody>
                {prestaciones.map((p) => {
                  const precioActual = getPrecioActualLocal(p.id);
                  const isEditing = editingPrecio === p.id;
                  return (
                    <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-3 text-slate-300 font-medium">{p.nombre}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400">{p.categoria}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isEditing ? (
                          <input type="text" autoFocus value={precioValues[p.id] ?? ""}
                            onChange={(e) => setPrecioValues({ ...precioValues, [p.id]: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSavePrecio(p.id); if (e.key === "Escape") setEditingPrecio(null); }}
                            className="w-36 bg-slate-800 border border-sky-500 text-slate-200 text-sm rounded-lg px-3 py-1.5 outline-none text-right tabular-nums" />
                        ) : (
                          <span className="text-slate-200 font-medium tabular-nums cursor-pointer hover:text-sky-400 transition-colors"
                            onClick={() => { setEditingPrecio(p.id); setPrecioValues({ ...precioValues, [p.id]: String(precioActual) }); }} title="Clic para editar">
                            {precioActual > 0 ? fmt(precioActual) : <span className="text-slate-600 font-normal">Sin precio</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleSavePrecio(p.id)} className="flex items-center gap-1 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium rounded-lg transition-colors">
                                <Save className="w-3 h-3" /> Guardar
                              </button>
                              <button onClick={() => setEditingPrecio(null)} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"><X className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <button onClick={() => { setEditingPrecio(p.id); setPrecioValues({ ...precioValues, [p.id]: String(precioActual) }); }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 border border-slate-700 hover:border-sky-500/30 rounded-lg transition-all">
                              <Pencil className="w-3 h-3" /> Editar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Historial */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-sm font-medium text-slate-300">Historial de Precios</p>
              <p className="text-xs text-slate-600 mt-0.5">Últimos cambios registrados</p>
            </div>
            <div className="divide-y divide-slate-800/50">
              {precios
                .sort((a, b) => b.vigenciaDesde.localeCompare(a.vigenciaDesde))
                .slice(0, 10)
                .map((entry, i) => {
                  const prest = prestaciones.find((p) => p.id === entry.prestacionId);
                  if (!prest) return null;
                  return (
                    <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/20 transition-colors">
                      <div>
                        <p className="text-sm text-slate-300">{prest.nombre}</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {NIVEL_LABELS[(entry as PrecioPrestacion & { nivel?: number }).nivel ?? 2]} · Vigente desde {new Date(entry.vigenciaDesde).toLocaleDateString("es-CL")}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-slate-200 tabular-nums">{fmt(entry.precio)}</p>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ===== MÓDULO ARANCEL MLE 2026 ===== */}
      {activeTab === "arancel" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 flex gap-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-300">Importar Arancel MLE 2026</p>
              <p className="text-xs text-slate-400">
                Esto reemplazará todas las prestaciones y precios actuales con los{" "}
                <strong className="text-slate-300">21 ítems de Ultrasonografía</strong> del Arancel MLE 2026
                (sección III, códigos 04 04 002 al 04 04 218), con precios para los tres niveles.
                Los registros históricos no se modificarán.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Fuente: Libro Arancel MLE 2026, páginas 36–38.
              </p>
            </div>
          </div>

          {arancelImportado && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg w-fit">
              <Check className="w-4 h-4" /> Arancel importado correctamente — {arancelPrestaciones.length} prestaciones cargadas
            </div>
          )}

          {!showConfirmArancel ? (
            <button
              onClick={() => setShowConfirmArancel(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold rounded-lg transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Cargar Arancel MLE 2026
            </button>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <p className="text-sm text-slate-300 flex-1">¿Confirmas que deseas reemplazar las prestaciones y precios actuales?</p>
              <button onClick={handleImportarArancel}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap">
                <RefreshCw className="w-3.5 h-3.5" /> Sí, reemplazar
              </button>
              <button onClick={() => setShowConfirmArancel(false)} className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors">Cancelar</button>
            </div>
          )}

          {/* Preview tabla */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">Vista previa — Arancel MLE 2026</p>
                <p className="text-xs text-slate-600 mt-0.5">Ultrasonografía · {arancelPrestaciones.length} prestaciones</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-4 py-2.5 text-slate-600 uppercase tracking-wider font-medium">Código</th>
                    <th className="text-left px-4 py-2.5 text-slate-600 uppercase tracking-wider font-medium">Prestación</th>
                    <th className="text-left px-4 py-2.5 text-slate-600 uppercase tracking-wider font-medium">Categoría</th>
                    <th className="text-right px-4 py-2.5 text-slate-600 uppercase tracking-wider font-medium">Nivel 1</th>
                    <th className="text-right px-4 py-2.5 text-slate-600 uppercase tracking-wider font-medium">Nivel 2</th>
                    <th className="text-right px-4 py-2.5 text-slate-600 uppercase tracking-wider font-medium">Nivel 3</th>
                  </tr>
                </thead>
                <tbody>
                  {arancelPrestaciones.map((p, i) => {
                    const n1 = arancelPrecios.find((x) => x.prestacionId === p.id && x.nivel === 1)?.precio ?? 0;
                    const n2 = arancelPrecios.find((x) => x.prestacionId === p.id && x.nivel === 2)?.precio ?? 0;
                    const n3 = arancelPrecios.find((x) => x.prestacionId === p.id && x.nivel === 3)?.precio ?? 0;
                    return (
                      <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-600">{p.codigo}</td>
                        <td className="px-4 py-2.5 text-slate-300 max-w-xs truncate" title={p.nombre}>{p.nombre}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500"
                            style={{ borderColor: COLORS[i % COLORS.length] + "40", color: COLORS[i % COLORS.length] }}>
                            {p.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-right tabular-nums">{fmt(n1)}</td>
                        <td className="px-4 py-2.5 text-sky-400 text-right tabular-nums font-medium">{fmt(n2)}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-right tabular-nums">{fmt(n3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "tope" && (
        <div className="space-y-5 max-w-md">
          <p className="text-sm text-slate-400">
            Define tu meta mensual de honorarios y el porcentaje de acuerdo usado para estimar A Pago desde los datos HIS.
          </p>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Tope mensual (CLP)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input
                  type="text"
                  value={topeForm.montoCLP}
                  onChange={(e) => setTopeForm((f) => ({ ...f, montoCLP: e.target.value }))}
                  placeholder="6300000"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg pl-7 pr-4 py-2.5 outline-none focus:border-sky-500"
                />
              </div>
              <p className="text-xs text-slate-600 mt-1">Valor por defecto: $6.300.000 (cap MediCenter)</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">% Acuerdo estimado (A Pago)</label>
              <div className="relative">
                <input
                  type="number"
                  min={1} max={100}
                  value={topeForm.acuerdoPct}
                  onChange={(e) => setTopeForm((f) => ({ ...f, acuerdoPct: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-4 py-2.5 outline-none focus:border-sky-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">Se usa para estimar A Pago cuando no hay liquidación cargada. El valor real se lee de la liquidación.</p>
            </div>

            <button
              onClick={handleSaveTope}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                topeSaved
                  ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                  : "bg-sky-500 hover:bg-sky-400 text-white"
              )}
            >
              {topeSaved ? <><Check className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> Guardar</>}
            </button>
          </div>
        </div>
      )}

      {activeTab === "demo" && (
        <div className="space-y-4 max-w-lg">
          <div>
            <p className="text-sm text-slate-400">Opciones para reiniciar el dashboard. Útil antes de una demostración o para empezar desde cero.</p>
          </div>

          {/* Opción 1: solo datos operacionales */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <RefreshCw className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Borrar datos de atención</p>
                <p className="text-xs text-slate-500 mt-0.5">Elimina todos los registros HIS subidos, las liquidaciones y los estados de citación. Conserva las prestaciones, precios y meta mensual configuradas.</p>
              </div>
            </div>
            {confirmReset === "operacional" ? (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-amber-400 flex-1">¿Confirmas? Esta acción no se puede deshacer.</span>
                <button onClick={() => setConfirmReset("none")} className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-600 transition-colors">Cancelar</button>
                <button onClick={handleClearOperacional} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-colors font-medium">Sí, borrar</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset("operacional")}
                className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Borrar registros y liquidaciones
              </button>
            )}
          </div>

          {/* Opción 2: todo */}
          <div className="rounded-xl border border-red-900/40 bg-slate-900 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Borrar todo</p>
                <p className="text-xs text-slate-500 mt-0.5">Elimina absolutamente todos los datos: registros, liquidaciones, estados, prestaciones, precios y configuración. El dashboard queda como recién instalado.</p>
              </div>
            </div>
            {confirmReset === "todo" ? (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-red-400 flex-1">¿Seguro? Se perderá <strong>todo</strong>, incluyendo configuración.</span>
                <button onClick={() => setConfirmReset("none")} className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-600 transition-colors">Cancelar</button>
                <button onClick={handleClearAll} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors font-medium">Sí, borrar todo</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset("todo")}
                className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Borrar absolutamente todo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const COLORS = ["#38bdf8", "#818cf8", "#34d399", "#fb923c", "#f472b6", "#a78bfa", "#facc15", "#4ade80", "#f87171", "#c084fc"];
