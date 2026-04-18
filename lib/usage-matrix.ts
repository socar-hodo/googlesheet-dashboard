import "server-only";

import { readFileSync } from "fs";
import { resolve } from "path";
import type { UsageMatrixRow, UsageDurationBucketKey } from "@/types/dashboard";

const _sqlCache = new Map<string, string>();

export function loadUsageMatrixSql(filename: string): string {
  if (_sqlCache.has(filename)) return _sqlCache.get(filename)!;
  const content = readFileSync(
    resolve(process.cwd(), "sql/usage-matrix", filename),
    "utf-8",
  );
  _sqlCache.set(filename, content);
  return content;
}

function safeInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function safeDate(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).value);
  }
  return String(v).slice(0, 10);
}

const VALID_BUCKETS = new Set<string>([
  "under4h",
  "from4to8h",
  "from8to12h",
  "from12to24h",
  "from24to48h",
  "over48h",
]);

export function buildMatrixResponse(rows: Record<string, unknown>[]): UsageMatrixRow[] {
  return rows
    .map((r) => {
      const durationGroup = String(r.duration_group ?? "");
      const dayType = String(r.day_type ?? "");
      if (!VALID_BUCKETS.has(durationGroup)) return null;
      if (dayType !== "weekday" && dayType !== "weekend") return null;
      return {
        date: safeDate(r.d),
        ageGroup: String(r.age_group ?? ""),
        durationGroup: durationGroup as UsageDurationBucketKey,
        dayType: dayType,
        nuse: safeInt(r.nuse),
        revenue: safeInt(r.revenue),
      } satisfies UsageMatrixRow;
    })
    .filter((r): r is UsageMatrixRow => r !== null && r.ageGroup !== "" && r.date !== "");
}
