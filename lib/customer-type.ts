import "server-only";

import { readFileSync } from "fs";
import { resolve } from "path";
import type { CustomerTypeRow } from "@/types/dashboard";

// ── SQL file cache ──────────────────────────────────────────────────
const _sqlCache = new Map<string, string>();

export function loadCustomerTypeSql(filename: string): string {
  if (_sqlCache.has(filename)) return _sqlCache.get(filename)!;
  const content = readFileSync(
    resolve(process.cwd(), "sql/customer-type", filename),
    "utf-8",
  );
  _sqlCache.set(filename, content);
  return content;
}

// ── Safe number conversion ──────────────────────────────────────────
function safeInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// ── BQ Date → "YYYY-MM-DD" 안전 변환 ────────────────────────────────
// BQ SDK는 DATE를 { value: "2026-04-17" } 객체로 반환할 수 있음
function safeDate(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).value);
  }
  return String(v).slice(0, 10);
}

// ── BQ row → CustomerTypeRow 변환 ───────────────────────────────────

export function buildDailyResponse(
  rows: Record<string, unknown>[],
): CustomerTypeRow[] {
  return rows.map((r) => ({
    date: safeDate(r.d),
    roundTripCount: safeInt(r.round_trip_count),
    callCount: safeInt(r.call_count),
    oneWayCount: safeInt(r.one_way_count),
  }));
}

export function buildWeeklyResponse(
  rows: Record<string, unknown>[],
): CustomerTypeRow[] {
  return rows.map((r) => ({
    week: String(r.week_label ?? ""),
    roundTripCount: safeInt(r.round_trip_count),
    callCount: safeInt(r.call_count),
    oneWayCount: safeInt(r.one_way_count),
  }));
}
