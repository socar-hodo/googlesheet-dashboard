import "server-only";

import { readFileSync } from "fs";
import { resolve } from "path";

const _funnelSqlCache = new Map<string, string>();

function _readFunnelSqlFile(filename: string): string {
  if (_funnelSqlCache.has(filename)) return _funnelSqlCache.get(filename)!;
  const content = readFileSync(
    resolve(process.cwd(), "sql/funnel", filename),
    "utf-8",
  );
  _funnelSqlCache.set(filename, content);
  return content;
}

export function loadFunnelSql(filename: string): string {
  return _readFunnelSqlFile(filename);
}

/**
 * SQL 내 {param} 플레이스홀더를 치환한다.
 * ⚠️ 호출 측에서 반드시 값을 사전 검증해야 한다 (숫자는 clamp, 문자열은 BQ 파라미터 사용 권장).
 */
export function replaceSqlParams(
  sql: string,
  params: Record<string, string>,
): string {
  let result = sql;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

export function safeInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function safeFloat(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
}

// ── 응답 빌드 공통 로직 ──────────────────────────────────────────

import type { FunnelData } from "@/types/funnel";

interface RawFunnelRow {
  year_week: string;
  zone_click_cnt: number;
  click_member_cnt: number;
  converted_member_cnt: number;
  cvr: number | null;
  prev_cvr: number | null;
  [key: string]: unknown;
}

function emptyResponse(): FunnelData {
  return {
    summary: {
      total_click_members: 0,
      total_converted_members: 0,
      cvr: 0,
      clicks_per_user: 0,
      wow_click_members: 0,
      wow_converted_members: 0,
      wow_cvr: 0,
    },
    trend: [],
    ranking: [],
  };
}

/**
 * BQ raw rows를 FunnelResponse로 변환한다.
 * weekly/detail API에서 공통 사용.
 * @param rows BQ 결과 행
 * @param regionField 지역 컬럼명 (region1 또는 region)
 */
export function buildFunnelResponse(
  rows: Record<string, unknown>[],
  regionField: string,
): FunnelData {
  if (rows.length === 0) return emptyResponse();

  const typed = rows as RawFunnelRow[];
  const allWeeks = [...new Set(typed.map((r) => r.year_week))].sort();
  const displayWeeks = new Set(allWeeks.slice(1));
  const latestWeek = allWeeks[allWeeks.length - 1];
  const prevWeek = allWeeks.length >= 2 ? allWeeks[allWeeks.length - 2] : null;

  // Trend: aggregate all regions per week
  const trendMap = new Map<string, { click: number; converted: number; zone_click: number }>();
  for (const r of typed) {
    if (!displayWeeks.has(r.year_week)) continue;
    const acc = trendMap.get(r.year_week) ?? { click: 0, converted: 0, zone_click: 0 };
    acc.click += safeInt(r.click_member_cnt);
    acc.converted += safeInt(r.converted_member_cnt);
    acc.zone_click += safeInt(r.zone_click_cnt);
    trendMap.set(r.year_week, acc);
  }
  const trend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({
      year_week: week,
      click_member_cnt: v.click,
      converted_member_cnt: v.converted,
      cvr: v.click > 0 ? Math.round((v.converted / v.click) * 10000) / 10000 : 0,
    }));

  // Ranking: latest week per region
  const latestRows = typed.filter((r) => r.year_week === latestWeek);
  const ranking = latestRows
    .map((r) => ({
      region: String(r[regionField] ?? ""),
      click_member_cnt: safeInt(r.click_member_cnt),
      converted_member_cnt: safeInt(r.converted_member_cnt),
      zone_click_cnt: safeInt(r.zone_click_cnt),
      cvr: safeFloat(r.cvr),
      wow_cvr:
        r.cvr != null && r.prev_cvr != null
          ? Math.round((Number(r.cvr) - Number(r.prev_cvr)) * 10000) / 10000
          : 0,
    }))
    .sort((a, b) => b.cvr - a.cvr);

  // Summary: totals for latest week
  const latestTrend = trendMap.get(latestWeek);
  const prevTrend = prevWeek ? trendMap.get(prevWeek) : null;

  const totalClick = latestTrend?.click ?? 0;
  const totalConverted = latestTrend?.converted ?? 0;
  const totalZoneClick = latestTrend?.zone_click ?? 0;
  const cvr = totalClick > 0 ? totalConverted / totalClick : 0;

  const prevClick = prevTrend?.click ?? 0;
  const prevConverted = prevTrend?.converted ?? 0;
  const prevCvr = prevClick > 0 ? prevConverted / prevClick : 0;

  const summary = {
    total_click_members: totalClick,
    total_converted_members: totalConverted,
    cvr: Math.round(cvr * 10000) / 10000,
    clicks_per_user: totalClick > 0 ? Math.round((totalZoneClick / totalClick) * 10) / 10 : 0,
    wow_click_members: prevClick > 0 ? Math.round(((totalClick - prevClick) / prevClick) * 1000) / 1000 : 0,
    wow_converted_members: prevConverted > 0 ? Math.round(((totalConverted - prevConverted) / prevConverted) * 1000) / 1000 : 0,
    wow_cvr: Math.round((cvr - prevCvr) * 10000) / 10000,
  };

  return { summary, trend, ranking };
}
