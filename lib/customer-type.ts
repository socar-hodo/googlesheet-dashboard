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

// ── BQ row → CustomerTypeRow 변환 ───────────────────────────────────

export function buildDailyResponse(
  rows: Record<string, unknown>[],
): CustomerTypeRow[] {
  return rows.map((r) => ({
    date: String(r.d ?? "").slice(0, 10), // BigQuery DATE → "YYYY-MM-DD"
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
