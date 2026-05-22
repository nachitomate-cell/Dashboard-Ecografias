"use client";

export interface Prestacion {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  duracionMin: number;
}

export interface PrecioPrestacion {
  prestacionId: string;
  precio: number;
  nivel: 1 | 2 | 3;
  vigenciaDesde: string;
}

export interface Registro {
  id: string;
  prestacionId: string;
  fecha: string;
  cantidad: number;
  precioUnitario: number;
  estado?: "finAtencion" | "porRecaudar"; // undefined = datos importados antes del fix
  orden?: string;    // N° de orden HIS para cruzar con liquidación
  paciente?: string; // solo en porRecaudar, para deduplicación multi-día
}

export interface LiquidacionRow {
  orden: string;
  fecha: string;       // YYYY-MM-DD
  examen: string;
  financiador: string;
  valor: number;
  aPago: number;
}

export interface Liquidacion {
  id: string;
  fileName: string;
  profesional: string;
  empresa: string;
  periodo: string;     // "YYYY-MM"
  acuerdoPct: number;  // ej. 37
  rows: LiquidacionRow[];
  importadaEn: string;
}

export interface EstadoDia {
  fecha: string;       // YYYY-MM-DD
  finAtencion: number;
  porRecaudar: number;
  ausente: number;
  eliminado: number;
  enCaja: number;
}

export interface TopeConfig {
  montoCLP: number;    // default 6_300_000
  acuerdoPct: number;  // % estimado para A Pago desde HIS, default 37
  nivelCalculo: 1 | 2 | 3; // nivel arancel para calcular A Pago, default 1 (Medicenter usa Nivel 1)
}

const KEYS = {
  prestaciones:  "ecografia_prestaciones",
  precios:       "ecografia_precios",
  registros:     "ecografia_registros",
  liquidaciones: "ecografia_liquidaciones",
  estadosDia:    "ecografia_estados_dia",
  topeConfig:    "ecografia_tope_config",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// --- Prestaciones ---
export function getPrestaciones(): Prestacion[] {
  return load<Prestacion[]>(KEYS.prestaciones, arancelPrestaciones);
}
export function savePrestaciones(data: Prestacion[]): void {
  save(KEYS.prestaciones, data);
}

// --- Precios ---
export function getPrecios(): PrecioPrestacion[] {
  return load<PrecioPrestacion[]>(KEYS.precios, arancelPrecios);
}
export function savePrecios(data: PrecioPrestacion[]): void {
  save(KEYS.precios, data);
}
export function getPrecioActual(prestacionId: string, nivel: 1 | 2 | 3 = 2): number {
  const precios = getPrecios()
    .filter((p) => p.prestacionId === prestacionId && p.nivel === nivel)
    .sort((a, b) => b.vigenciaDesde.localeCompare(a.vigenciaDesde));
  return precios[0]?.precio ?? 0;
}

// --- Registros ---
export function getRegistros(): Registro[] {
  return load<Registro[]>(KEYS.registros, []);
}
export function saveRegistros(data: Registro[]): void {
  save(KEYS.registros, data);
}

// --- Liquidaciones ---
export function getLiquidaciones(): Liquidacion[] {
  return load<Liquidacion[]>(KEYS.liquidaciones, []);
}
export function saveLiquidaciones(data: Liquidacion[]): void {
  save(KEYS.liquidaciones, data);
}
export function addLiquidacion(liq: Liquidacion): void {
  const all = getLiquidaciones().filter((l) => l.id !== liq.id);
  saveLiquidaciones([...all, liq]);
}
export function deleteLiquidacion(id: string): void {
  saveLiquidaciones(getLiquidaciones().filter((l) => l.id !== id));
}

// --- EstadosDia ---
export function getEstadosDia(): EstadoDia[] {
  return load<EstadoDia[]>(KEYS.estadosDia, []);
}
export function upsertEstadoDia(d: EstadoDia): void {
  const all = getEstadosDia().filter((e) => e.fecha !== d.fecha);
  save(KEYS.estadosDia, [...all, d]);
}

// --- TopeConfig ---
export function getTopeConfig(): TopeConfig {
  const cfg = load<Partial<TopeConfig>>(KEYS.topeConfig, {});
  const full: TopeConfig = {
    montoCLP:     cfg.montoCLP     ?? 6_300_000,
    acuerdoPct:   cfg.acuerdoPct   ?? 37,
    nivelCalculo: cfg.nivelCalculo ?? 1,
  };
  // Migración: si el objeto guardado no tenía nivelCalculo, lo persiste ahora
  if (cfg.nivelCalculo === undefined) save(KEYS.topeConfig, full);
  return full;
}
export function saveTopeConfig(c: TopeConfig): void {
  save(KEYS.topeConfig, c);
}

// --- Resetear a datos del Arancel MLE 2026 ---
export function resetToArancelDefaults(): void {
  save(KEYS.prestaciones, arancelPrestaciones);
  save(KEYS.precios, arancelPrecios);
}

// --- Borrar datos operacionales (registros, liquidaciones, estados) ---
export function clearOperationalData(): void {
  localStorage.removeItem(KEYS.registros);
  localStorage.removeItem(KEYS.liquidaciones);
  localStorage.removeItem(KEYS.estadosDia);
}

// --- Borrar TODO (incluyendo configuración) ---
export function clearAllData(): void {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

// ================================================================
// ARANCEL MLE 2026 — Sección III: Ultrasonografía (04 04 xxx)
// Fuente: Libro Arancel MLE 2026, páginas 36-38
// Precios en CLP. Cada prestación tiene Nivel 1, 2 y 3 (TOTAL).
// ================================================================

export const arancelPrestaciones: Prestacion[] = [
  // A. Equipos Simples
  { id: "040402", codigo: "04 04 002", nombre: "Ecografía Obstétrica", categoria: "Obstétrica", duracionMin: 20 },

  // B. Equipos de Mediana a Alta Resolución
  { id: "040403", codigo: "04 04 003", nombre: "Ecografía Abdominal", categoria: "Abdominal", duracionMin: 25 },
  { id: "040404", codigo: "04 04 004", nombre: "Ecografía Apoyo a Cirugía o Procedimiento", categoria: "Especial", duracionMin: 15 },
  { id: "040405", codigo: "04 04 005", nombre: "Ecografía Transvaginal o Transrectal", categoria: "Ginecológica", duracionMin: 20 },
  { id: "040406", codigo: "04 04 006", nombre: "Ecografía Ginecológica / Pelviana Femenina u Obstétrica c/ Estudio Fetal", categoria: "Obstétrica", duracionMin: 25 },
  { id: "040407", codigo: "04 04 007", nombre: "Ecografía Transvaginal Seguimiento Ovulación (6-8 sesiones)", categoria: "Ginecológica", duracionMin: 15 },
  { id: "040408", codigo: "04 04 008", nombre: "Ecografía Seguimiento de Ovulación (6-8 sesiones)", categoria: "Ginecológica", duracionMin: 15 },
  { id: "040409", codigo: "04 04 009", nombre: "Ecografía Pélvica Masculina (Vejiga y Próstata)", categoria: "Urológica", duracionMin: 20 },
  { id: "040410", codigo: "04 04 010", nombre: "Ecografía Renal Bilateral o de Bazo", categoria: "Urológica", duracionMin: 20 },

  // C. Equipos de Alta Resolución
  { id: "040411", codigo: "04 04 011", nombre: "Ecografía Encefálica (RN o Lactante)", categoria: "Cabeza y Cuello", duracionMin: 25 },
  { id: "040412", codigo: "04 04 012", nombre: "Ecografía Mamaria Bilateral (incluye Doppler)", categoria: "Mama", duracionMin: 25 },
  { id: "040413", codigo: "04 04 013", nombre: "Ecografía Ocular Unilateral o Bilateral", categoria: "Cabeza y Cuello", duracionMin: 20 },
  { id: "040414", codigo: "04 04 014", nombre: "Ecografía Testicular Unilateral o Bilateral (incluye Doppler)", categoria: "Urológica", duracionMin: 20 },
  { id: "040415", codigo: "04 04 015", nombre: "Ecografía Tiroidea (incluye Doppler)", categoria: "Cabeza y Cuello", duracionMin: 20 },
  { id: "040416", codigo: "04 04 016", nombre: "Ecografía Partes Blandas o Musculoesquelética (por zona)", categoria: "Musculoesquelética", duracionMin: 20 },

  // D. Equipos con Doppler
  { id: "040418", codigo: "04 04 118", nombre: "Ecografía Vascular Periférica Arterial y Venosa (Bilateral)", categoria: "Vascular", duracionMin: 40 },
  { id: "040419", codigo: "04 04 119", nombre: "Ecografía Doppler de Vasos del Cuello", categoria: "Vascular", duracionMin: 35 },
  { id: "040420", codigo: "04 04 120", nombre: "Ecografía Transcraneana", categoria: "Vascular", duracionMin: 35 },
  { id: "040421", codigo: "04 04 121", nombre: "Ecografía Abdominal o de Vasos Testiculares (Doppler)", categoria: "Vascular", duracionMin: 30 },
  { id: "040422", codigo: "04 04 122", nombre: "Ecografía Doppler de Vasos Placentarios", categoria: "Obstétrica", duracionMin: 30 },

  // E. Elastografía
  { id: "040423", codigo: "04 04 218", nombre: "Elastografía Hepática", categoria: "Especial", duracionMin: 30 },
];

// Precios por nivel (TOTAL, sin copago) — fuente Arancel MLE 2026
// nivel 1 = Nivel 1, nivel 2 = Nivel 2, nivel 3 = Nivel 3
const _precios: Array<{ id: string; n1: number; n2: number; n3: number }> = [
  { id: "040402", n1:  8730, n2: 11350, n3: 13970 },
  { id: "040403", n1: 27570, n2: 35840, n3: 44110 },
  { id: "040404", n1: 17040, n2: 22150, n3: 27260 },
  { id: "040405", n1: 15400, n2: 20020, n3: 24640 },
  { id: "040406", n1: 14670, n2: 19070, n3: 23470 },
  { id: "040407", n1: 21410, n2: 27830, n3: 34260 },
  { id: "040408", n1: 23980, n2: 31170, n3: 38370 },
  { id: "040409", n1: 15330, n2: 19930, n3: 24530 },
  { id: "040410", n1: 19110, n2: 24840, n3: 30580 },
  { id: "040411", n1: 20630, n2: 26820, n3: 33010 },
  { id: "040412", n1: 19210, n2: 24970, n3: 30740 },
  { id: "040413", n1: 22290, n2: 28980, n3: 35660 },
  { id: "040414", n1: 18960, n2: 24650, n3: 30340 },
  { id: "040415", n1: 19210, n2: 24970, n3: 30740 },
  { id: "040416", n1: 19210, n2: 24970, n3: 30740 },
  { id: "040418", n1: 63040, n2: 81950, n3: 100860 },
  { id: "040419", n1: 59530, n2: 77390, n3:  95250 },
  { id: "040420", n1: 63040, n2: 81950, n3: 100860 },
  { id: "040421", n1: 64960, n2: 84450, n3: 103940 },
  { id: "040422", n1: 63040, n2: 81950, n3: 100860 },
  { id: "040423", n1: 199030, n2: 199030, n3: 199030 }, // solo nivel 1 publicado
];

export const arancelPrecios: PrecioPrestacion[] = _precios.flatMap(({ id, n1, n2, n3 }) => [
  { prestacionId: id, precio: n1, nivel: 1 as const, vigenciaDesde: "2026-01-01" },
  { prestacionId: id, precio: n2, nivel: 2 as const, vigenciaDesde: "2026-01-01" },
  { prestacionId: id, precio: n3, nivel: 3 as const, vigenciaDesde: "2026-01-01" },
]);

// --- Utilidad: tamaño del localStorage ---
export interface StorageEntry {
  key: string;
  label: string;
  bytes: number;
}

export function getStorageUsage(): { entries: StorageEntry[]; totalBytes: number; limitBytes: number } {
  const limitBytes = 5 * 1024 * 1024; // 5 MB estimado (estándar navegadores)
  const labels: Record<string, string> = {
    [KEYS.prestaciones]: "Prestaciones",
    [KEYS.precios]: "Precios",
    [KEYS.registros]: "Registros",
  };
  const entries: StorageEntry[] = [];
  let totalBytes = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? "";
      const val = localStorage.getItem(key) ?? "";
      const bytes = (key.length + val.length) * 2; // UTF-16: 2 bytes por char
      entries.push({ key, label: labels[key] ?? key, bytes });
      totalBytes += bytes;
    }
  } catch { /* SSR guard */ }

  entries.sort((a, b) => b.bytes - a.bytes);
  return { entries, totalBytes, limitBytes };
}
