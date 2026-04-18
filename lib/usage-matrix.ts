import "server-only";

import { readFileSync } from "fs";
import { resolve } from "path";
import type {
  UsageMatrixRow,
  UsageMatrixPeriodBundle,
  UsageMatrixPeriodKey,
  UsageMatrixPeriodMap,
  UsageDurationBucketKey,
} from "@/types/dashboard";
import { getDateRange } from "./period-utils";

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

/**
 * 주어진 날짜 범위에 해당하는 rows를 (ageGroup, durationGroup, dayType)으로 집계.
 * 반환된 행의 `date` 필드는 range.start로 세팅한다(클라이언트 호환용 sentinel).
 * 결과 행 수 ≤ 5 × 6 × 2 = 60.
 */
export function aggregateMatrixForRange(
  rows: UsageMatrixRow[],
  range: { start: string; end: string },
): UsageMatrixRow[] {
  type Key = `${string}|${UsageDurationBucketKey}|weekday` | `${string}|${UsageDurationBucketKey}|weekend`;
  const buckets = new Map<Key, UsageMatrixRow>();
  for (const r of rows) {
    if (r.date < range.start || r.date > range.end) continue;
    const k = `${r.ageGroup}|${r.durationGroup}|${r.dayType}` as Key;
    const prev = buckets.get(k);
    if (prev) {
      prev.nuse += r.nuse;
      prev.revenue += r.revenue;
    } else {
      buckets.set(k, {
        date: range.start,
        ageGroup: r.ageGroup,
        durationGroup: r.durationGroup,
        dayType: r.dayType,
        nuse: r.nuse,
        revenue: r.revenue,
      });
    }
  }
  return Array.from(buckets.values());
}

/** YYYY-MM-DD → Date (로컬 자정) */
function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 주어진 현재 range에 대한 "직전 동일 길이" range를 계산한다.
 * dashboard-content의 usageMatrixPeriods 로직과 동일.
 */
export function computePreviousRange(current: {
  start: string;
  end: string;
}): { start: string; end: string } {
  const startDate = parseDateLocal(current.start);
  const endDate = parseDateLocal(current.end);
  const lengthDays =
    Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (lengthDays - 1));
  return { start: toISODate(prevStart), end: toISODate(prevEnd) };
}

/**
 * 표준 4개 기간(this-week, last-week, this-month, last-month)별로
 * current/previous bundle을 만들어 맵으로 반환한다.
 * custom은 /api/dashboard/usage-matrix 엔드포인트에서 별도 처리한다.
 */
export function buildUsageMatrixPeriodMap(
  rows: UsageMatrixRow[],
  today: Date = new Date(),
): UsageMatrixPeriodMap {
  const keys: UsageMatrixPeriodKey[] = [
    "this-week",
    "last-week",
    "this-month",
    "last-month",
  ];
  const map = {} as UsageMatrixPeriodMap;
  for (const key of keys) {
    const currentRange = getDateRange(key, today);
    const previousRange = computePreviousRange(currentRange);
    const bundle: UsageMatrixPeriodBundle = {
      current: aggregateMatrixForRange(rows, currentRange),
      previous: aggregateMatrixForRange(rows, previousRange),
      currentRange,
      previousRange,
    };
    map[key] = bundle;
  }
  return map;
}
