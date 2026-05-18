"use client";

import * as XLSX from "xlsx";
import type { Prestacion } from "./store";

export interface ExamRow {
  hrReserva: string;
  hrLlegada: string;
  orden: string;
  paciente: string;
  examen: string;
  estado: string;
  usuario: string;
}

export interface StatusCounts {
  finAtencion: number;
  ausente: number;
  eliminado: number;
  enCaja: number;
  otros: number;
}

export interface ParsedDay {
  fecha: string;        // YYYY-MM-DD
  fileName: string;
  rows: ExamRow[];
  atendidos: ExamRow[]; // solo "Fin de Atención", deduplicados
  statusCounts: StatusCounts;
}

export interface MatchedExam {
  row: ExamRow;
  prestacionId: string | null;
  prestacionNombre: string | null;
  precio: number;
}

export interface DayReport {
  fecha: string;
  fileName: string;
  total: number;
  matched: number;
  unmatched: number;
  ingresoEstimado: number;
  examenes: MatchedExam[];
  sinMatchNombres: string[];
  statusCounts: StatusCounts;
}

// -----------------------------------------------------------
// 1. Parser de fecha desde el nombre de archivo DD-MM-YYYY
// -----------------------------------------------------------
export function fechaDesdeNombre(fileName: string): string | null {
  const base = fileName.replace(/\.xlsx?$/i, "");
  const match = base.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

// -----------------------------------------------------------
// 2. Leer un ArrayBuffer → ParsedDay
// -----------------------------------------------------------
export function parseExcelFile(buffer: ArrayBuffer, fileName: string): ParsedDay {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false,
  }) as (string | number | null)[][];

  const fecha = fechaDesdeNombre(fileName) ?? new Date().toISOString().split("T")[0];

  // Fila 0: título "HIS - Lista trabajo v2"
  // Fila 1: encabezados (Hr.Reserva, Hr.Llegada, # Orden, Paciente, Examen, Estado, …)
  // Fila 2+: datos
  const rows: ExamRow[] = [];
  for (let i = 2; i < raw.length; i++) {
    const r = raw[i];
    if (!r || !r[3]) continue; // sin paciente → vacía
    rows.push({
      hrReserva: String(r[0] ?? ""),
      hrLlegada: String(r[1] ?? ""),
      orden:     String(r[2] ?? "0"),
      paciente:  String(r[3] ?? ""),
      examen:    String(r[4] ?? ""),
      estado:    String(r[5] ?? ""),
      usuario:   String(r[8] ?? ""),
    });
  }

  // Solo atendidos (Fin de Atención), deduplicar por # Orden + Examen
  const seen = new Set<string>();
  const atendidos = rows.filter((r) => {
    if (!r.estado.toLowerCase().includes("fin de atenc")) return false;
    const key = r.orden !== "0" ? `${r.orden}|${r.examen}` : `${r.paciente}|${r.examen}|${r.hrReserva}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const finAtencion = rows.filter((r) => r.estado.toLowerCase().includes("fin de atenc")).length;
  const ausente     = rows.filter((r) => r.estado.toLowerCase().includes("ausente")).length;
  const eliminado   = rows.filter((r) => r.estado.toLowerCase().includes("eliminado")).length;
  const enCaja      = rows.filter((r) => r.estado.toLowerCase().includes("en caja")).length;
  const statusCounts: StatusCounts = {
    finAtencion, ausente, eliminado, enCaja,
    otros: Math.max(0, rows.length - finAtencion - ausente - eliminado - enCaja),
  };

  return { fecha, fileName, rows, atendidos, statusCounts };
}

// -----------------------------------------------------------
// 3. Normalizar cadena para matching
// -----------------------------------------------------------
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------------------------------------
// 4. Mapa de palabras clave → prestacionId (arancel MLE 2026)
// -----------------------------------------------------------
const KEYWORD_MAP: Array<{ keywords: string[]; id: string }> = [
  // Doppler vascular (más específico primero)
  { keywords: ["vascular periferica", "doppler periferica", "doppler arterial venosa"], id: "040418" },
  { keywords: ["doppler cuello", "vasos cuello", "vasos del cuello", "doppler carotideo", "carotidea", "carotideo"], id: "040419" },
  { keywords: ["transcranea", "transcraneana"], id: "040420" },
  { keywords: ["vasos testiculares", "doppler visceral", "visceral abdominal", "doppler abdominal"], id: "040421" },
  { keywords: ["placentar", "vasos placentarios"], id: "040422" },

  // Partes blandas / musculoesquelético (antes que "abdominal" genérico)
  { keywords: ["partes blandas", "musculoesqueletica", "cervical ecotomografia", "hombro", "rodilla", "dedo", "codo", "muneca", "tobillo", "pie ecoto", "muñeca"], id: "040416" },

  // Mama
  { keywords: ["mamaria", "mama bilateral"], id: "040412" },

  // Tiroides
  { keywords: ["tiroidea", "tiroides"], id: "040415" },

  // Renal / bazo
  { keywords: ["doppler renal", "renal bilateral", "ecotomografia renal", "renal o de bazo", "renal"], id: "040410" },

  // Pélvica masculina
  { keywords: ["pelvica masculina", "vejiga y prostata", "prostata", "vejiga masculina"], id: "040409" },

  // Testicular (sin doppler)
  { keywords: ["testicular"], id: "040414" },

  // Ocular
  { keywords: ["ocular"], id: "040413" },

  // Encefálica
  { keywords: ["encefalica", "encefalo", "encefal"], id: "040411" },

  // Obstétrica
  { keywords: ["obstetrica", "obstetrico", "obstetr"], id: "040402" },

  // Ginecológica / pelviana
  { keywords: ["ginecologica", "pelviana femenina", "estudio fetal", "femenina"], id: "040406" },
  { keywords: ["transvaginal", "transrectal"], id: "040405" },
  { keywords: ["seguimiento ovulacion transvaginal"], id: "040407" },
  { keywords: ["seguimiento ovulacion"], id: "040408" },

  // Abdominal genérico
  { keywords: ["abdominal", "abdomen"], id: "040403" },

  // Elastografía
  { keywords: ["elastograf"], id: "040423" },

  // Apoyo a cirugía
  { keywords: ["apoyo cirugia", "apoyo a cirugia", "procedimiento"], id: "040404" },
];

export function matchExamen(
  examen: string,
  prestaciones: Prestacion[],
  precios: Record<string, number>
): { prestacionId: string | null; prestacionNombre: string | null; precio: number } {
  const n = norm(examen);

  for (const { keywords, id } of KEYWORD_MAP) {
    if (keywords.some((kw) => n.includes(norm(kw)))) {
      const prest = prestaciones.find((p) => p.id === id);
      return {
        prestacionId: id,
        prestacionNombre: prest?.nombre ?? id,
        precio: precios[id] ?? 0,
      };
    }
  }

  // Fallback: buscar en nombres de prestaciones
  for (const p of prestaciones) {
    const words = norm(p.nombre).split(" ").filter((w) => w.length > 4);
    if (words.some((w) => n.includes(w))) {
      return { prestacionId: p.id, prestacionNombre: p.nombre, precio: precios[p.id] ?? 0 };
    }
  }

  return { prestacionId: null, prestacionNombre: null, precio: 0 };
}

// -----------------------------------------------------------
// 5. Construir reporte por día
// -----------------------------------------------------------
export function buildDayReport(
  parsed: ParsedDay,
  prestaciones: Prestacion[],
  precios: Record<string, number>
): DayReport {
  const examenes: MatchedExam[] = parsed.atendidos.map((row) => ({
    row,
    ...matchExamen(row.examen, prestaciones, precios),
  }));

  const matched = examenes.filter((e) => e.prestacionId !== null).length;
  const ingresoEstimado = examenes.reduce((s, e) => s + e.precio, 0);
  const sinMatchNombres = [
    ...new Set(examenes.filter((e) => !e.prestacionId).map((e) => e.row.examen)),
  ];

  return {
    fecha: parsed.fecha,
    fileName: parsed.fileName,
    total: examenes.length,
    matched,
    unmatched: examenes.length - matched,
    ingresoEstimado,
    examenes,
    sinMatchNombres,
    statusCounts: parsed.statusCounts,
  };
}
