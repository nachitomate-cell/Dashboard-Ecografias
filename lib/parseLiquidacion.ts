"use client";

import * as XLSX from "xlsx";
import type { Liquidacion, LiquidacionRow } from "./store";

// ── Helpers ──────────────────────────────────────────────────────

function toNum(v: unknown): number {
  if (typeof v === "number") return Math.round(v);
  const n = parseInt(String(v ?? "0").replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

/** Convierte un valor de celda a fecha YYYY-MM-DD */
function toDate(v: unknown): string {
  if (!v) return "";
  // Número serial de Excel
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  // String "DD/MM/YYYY" o "YYYY-MM-DD"
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  const cl = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (cl) return `${cl[3]}-${cl[2].padStart(2, "0")}-${cl[1].padStart(2, "0")}`;
  return s;
}

function capFirst(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase())
    .trim();
}

// ── Detectar fila de encabezado ──────────────────────────────────

const HEADER_SIGNALS = ["orden", "fecha", "examen", "valor", "pago", "financiador", "profesional"];

function findHeaderRow(raw: unknown[][]): number {
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i].map((c) => String(c ?? "").toLowerCase());
    const hits = HEADER_SIGNALS.filter((s) => row.some((c) => c.includes(s)));
    if (hits.length >= 3) return i;
  }
  return 0;
}

// ── Detectar índices de columna ──────────────────────────────────

interface ColMap {
  orden: number;
  fecha: number;
  examen: number;
  financiador: number;
  valor: number;
  aPago: number;
  profesional: number;
}

function mapColumns(headers: unknown[]): ColMap {
  const h = headers.map((c) => String(c ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const find = (...terms: string[]) => h.findIndex((c) => terms.some((t) => c.includes(t)));
  return {
    orden:       find("orden"),
    fecha:       find("fecha"),
    examen:      find("examen"),
    financiador: find("financiador"),
    valor:       find("valor"),
    aPago:       find("apago", "a pago", "pago"),
    profesional: find("profesional"),
  };
}

// ── Parser principal ─────────────────────────────────────────────

export function parseLiquidacionExcel(
  buffer: ArrayBuffer,
  fileName: string
): Liquidacion {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  const headerIdx = findHeaderRow(raw);
  const cols = mapColumns(raw[headerIdx] ?? []);
  const rows: LiquidacionRow[] = [];

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    if (!r || !r[cols.fecha]) continue;
    const valor = toNum(r[cols.valor]);
    const aPago = toNum(r[cols.aPago]);
    if (valor === 0 && aPago === 0) continue;

    rows.push({
      orden:       String(r[cols.orden] ?? i),
      fecha:       toDate(r[cols.fecha]),
      examen:      String(r[cols.examen] ?? "").trim(),
      financiador: String(r[cols.financiador] ?? "").trim(),
      valor,
      aPago,
    });
  }

  // Calcular porcentaje de acuerdo
  const sumValor = rows.reduce((s, r) => s + r.valor, 0);
  const sumAPago = rows.reduce((s, r) => s + r.aPago, 0);
  const acuerdoPct = sumValor > 0 ? Math.round((sumAPago / sumValor) * 100) : 37;

  // Profesional desde los datos
  const profesionalRaw = cols.profesional >= 0
    ? String(raw[headerIdx + 1]?.[cols.profesional] ?? "").trim()
    : "";
  const profesional = profesionalRaw
    ? capFirst(profesionalRaw)
    : capFirst(fileName.split(/\s+/)[0] ?? "Profesional");

  // Empresa desde filename (última parte antes del .xlsx)
  const nameParts = fileName.replace(/\.xlsx?$/i, "").split(/\s+/);
  const empresa = nameParts.slice(-3).join(" ") || "Empresa";

  // Periodo: primer mes/año que aparezca en los datos
  const primeraFecha = rows.find((r) => r.fecha)?.fecha ?? "";
  const periodo = primeraFecha.slice(0, 7); // "YYYY-MM"

  return {
    id: `${periodo}_${fileName.replace(/[^a-z0-9]/gi, "_")}`,
    fileName,
    profesional,
    empresa,
    periodo,
    acuerdoPct,
    rows,
    importadaEn: new Date().toISOString(),
  };
}

// ── Cálculos sobre la liquidación ────────────────────────────────

export interface ResumenExamen {
  examen: string;
  cantidad: number;
  valorTotal: number;
  honorarioTotal: number;
  pct: number;
}

export interface ResumenFinanciador {
  financiador: string;
  cantidad: number;
  valorTotal: number;
  honorarioTotal: number;
}

export interface ResumenDia {
  fecha: string;
  label: string;
  cantidad: number;
  valor: number;
  honorario: number;
}

export function calcularResumenExamenes(liq: Liquidacion): ResumenExamen[] {
  const map = new Map<string, ResumenExamen>();
  for (const r of liq.rows) {
    const k = r.examen || "Sin nombre";
    const prev = map.get(k) ?? { examen: k, cantidad: 0, valorTotal: 0, honorarioTotal: 0, pct: 0 };
    prev.cantidad++;
    prev.valorTotal += r.valor;
    prev.honorarioTotal += r.aPago;
    map.set(k, prev);
  }
  return Array.from(map.values())
    .map((e) => ({ ...e, pct: e.valorTotal > 0 ? (e.honorarioTotal / e.valorTotal) * 100 : 0 }))
    .sort((a, b) => b.honorarioTotal - a.honorarioTotal);
}

export function calcularResumenFinanciadores(liq: Liquidacion): ResumenFinanciador[] {
  const map = new Map<string, ResumenFinanciador>();
  for (const r of liq.rows) {
    const k = r.financiador || "Sin financiador";
    const prev = map.get(k) ?? { financiador: k, cantidad: 0, valorTotal: 0, honorarioTotal: 0 };
    prev.cantidad++;
    prev.valorTotal += r.valor;
    prev.honorarioTotal += r.aPago;
    map.set(k, prev);
  }
  return Array.from(map.values()).sort((a, b) => b.valorTotal - a.valorTotal);
}

export function calcularResumenDiario(liq: Liquidacion): ResumenDia[] {
  const map = new Map<string, ResumenDia>();
  for (const r of liq.rows) {
    if (!r.fecha) continue;
    const prev = map.get(r.fecha) ?? {
      fecha: r.fecha,
      label: new Date(r.fecha + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" }),
      cantidad: 0, valor: 0, honorario: 0,
    };
    prev.cantidad++;
    prev.valor    += r.valor;
    prev.honorario += r.aPago;
    map.set(r.fecha, prev);
  }
  return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
