import "server-only";

import { readFileSync } from "fs";
import { resolve } from "path";
import type {
  DailyRecord,
  WeeklyRecord,
  RevenueBreakdownRow,
  CostBreakdownRow,
  ForecastRow,
  RegionRankingRow,
} from "@/types/dashboard";

// ── SQL file cache ──────────────────────────────────────────────────
const _sqlCache = new Map<string, string>();

export function loadDashboardSql(filename: string): string {
  if (_sqlCache.has(filename)) return _sqlCache.get(filename)!;
  const content = readFileSync(
    resolve(process.cwd(), "sql/dashboard", filename),
    "utf-8",
  );
  _sqlCache.set(filename, content);
  return content;
}

// ── Safe conversions ─────────────────────────────────────────────────
function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

// ── Row transformers ─────────────────────────────────────────────────
// 주의: weeklyTarget은 BQ 소스가 없어 0으로 반환한다.
// 추후 목표 데이터용 BQ 테이블(또는 전용 API) 도입 시 교체 필요.

export function buildDailyRecords(
  rows: Record<string, unknown>[],
): DailyRecord[] {
  return rows.map((r) => ({
    date: safeDate(r.d),
    revenue: safeNumber(r.revenue),
    profit: safeNumber(r.profit),
    usageHours: safeNumber(r.usage_hours),
    usageCount: safeInt(r.usage_count),
    utilizationRate: safeNumber(r.utilization_rate),
    revenuePerCar: safeNumber(r.revenue_per_car),
    usageCountPerCar: safeNumber(r.usage_count_per_car),
    usageHoursPerCar: safeNumber(r.usage_hours_per_car),
  }));
}

export function buildWeeklyRecords(
  rows: Record<string, unknown>[],
): WeeklyRecord[] {
  return rows.map((r) => ({
    week: String(r.week_label ?? ""),
    isoWeek: safeInt(r.iso_week),
    revenue: safeNumber(r.revenue),
    profit: safeNumber(r.profit),
    usageHours: safeNumber(r.usage_hours),
    usageCount: safeInt(r.usage_count),
    utilizationRate: safeNumber(r.utilization_rate),
    revenuePerCar: safeNumber(r.revenue_per_car),
    usageCountPerCar: safeNumber(r.usage_count_per_car),
    usageHoursPerCar: safeNumber(r.usage_hours_per_car),
  }));
}

export function buildRevenueBreakdownDaily(
  rows: Record<string, unknown>[],
): RevenueBreakdownRow[] {
  return rows.map((r) => ({
    date: safeDate(r.d),
    rentalRevenue: safeNumber(r.rental_revenue),
    pfRevenue: safeNumber(r.pf_revenue),
    drivingRevenue: safeNumber(r.driving_revenue),
    callRevenue: safeNumber(r.call_revenue),
    otherRevenue: safeNumber(r.other_revenue),
  }));
}

export function buildRevenueBreakdownWeekly(
  rows: Record<string, unknown>[],
): RevenueBreakdownRow[] {
  // 주차별도 date 필드를 사용 (RevenueBreakdownRow는 date만 가짐 — week_label을 date 필드에 저장)
  return rows.map((r) => ({
    date: String(r.week_label ?? ""),
    rentalRevenue: safeNumber(r.rental_revenue),
    pfRevenue: safeNumber(r.pf_revenue),
    drivingRevenue: safeNumber(r.driving_revenue),
    callRevenue: safeNumber(r.call_revenue),
    otherRevenue: safeNumber(r.other_revenue),
  }));
}

export function buildCostBreakdownDaily(
  rows: Record<string, unknown>[],
): CostBreakdownRow[] {
  return rows.map((r) => ({
    date: safeDate(r.d),
    transportCost: safeNumber(r.transport_cost),
    fuelCost: safeNumber(r.fuel_cost),
    parkingCost: safeNumber(r.parking_cost),
    inspectionCost: safeNumber(r.inspection_cost),
    depreciationCost: safeNumber(r.depreciation_cost),
    commissionCost: safeNumber(r.commission_cost),
    // 드릴다운(충전/부름/존편도 운반비)은 profit 테이블에 분리 컬럼이 없어 0으로 스텁
    chargeTransportCost: 0,
    callTransportCost: 0,
    zoneOneWayTransportCost: 0,
  }));
}

export function buildRegionRanking(
  rows: Record<string, unknown>[],
): RegionRankingRow[] {
  return rows.map((r) => ({
    region: String(r.region ?? ""),
    revenue: safeNumber(r.revenue),
    profit: safeNumber(r.profit),
    gpm: safeNumber(r.gpm),
    usageCount: safeInt(r.usage_count),
    usageHours: safeNumber(r.usage_hours),
    utilizationRate: safeNumber(r.utilization_rate),
  }));
}

// ── Region filter 유틸 ─────────────────────────────────────────────
// SQL injection 방지: region 이름은 한글·영문·숫자·공백·특별시/광역시 등만 허용
// 작은따옴표·세미콜론 등은 거부 → 안전한 문자열 치환 가능
export function sanitizeRegionName(name: string): string {
  return name.replace(/[^가-힣A-Za-z0-9\s()-]/g, "").slice(0, 50);
}

// 사전 매출: actual 우선, 미래는 expected 폴백
export function buildForecastRows(
  rows: Record<string, unknown>[],
): ForecastRow[] {
  return rows.map((r) => ({
    date: safeDate(r.d),
    forecastRevenue: safeNumber(r.forecast_revenue),
  }));
}

export function buildCostBreakdownWeekly(
  rows: Record<string, unknown>[],
): CostBreakdownRow[] {
  return rows.map((r) => ({
    date: String(r.week_label ?? ""),
    transportCost: safeNumber(r.transport_cost),
    fuelCost: safeNumber(r.fuel_cost),
    parkingCost: safeNumber(r.parking_cost),
    inspectionCost: safeNumber(r.inspection_cost),
    depreciationCost: safeNumber(r.depreciation_cost),
    commissionCost: safeNumber(r.commission_cost),
    chargeTransportCost: 0,
    callTransportCost: 0,
    zoneOneWayTransportCost: 0,
  }));
}
