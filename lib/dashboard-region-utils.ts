// 지역 필터 관련 순수 함수들 — server-only import 없음 (테스트 용이)
import type { RegionOption } from "@/types/dashboard";

/**
 * SQL injection 방지: region 이름은 한글·영문·숫자·공백·괄호·하이픈만 허용.
 * 작은따옴표·세미콜론·백슬래시 등은 거부, 연속 하이픈(--)도 제거 (SQL 주석 시퀀스).
 */
export function sanitizeRegionName(name: string): string {
  return name
    .replace(/[^가-힣A-Za-z0-9\s()-]/g, "")
    .replace(/--+/g, "")
    .slice(0, 50);
}

/** region1/region2 선택을 SQL WHERE 절 조각으로 변환 */
export function buildRegionFilter(region1?: string, region2?: string): string {
  const r1 = region1 ? sanitizeRegionName(region1) : "";
  const r2 = region2 ? sanitizeRegionName(region2) : "";
  const parts: string[] = [];
  if (r1) parts.push(`AND region1 = '${r1}'`);
  if (r1 && r2) parts.push(`AND region2 = '${r2}'`);
  return parts.join(" ");
}

/** region-list.sql row → RegionOption 집계 (region1별 region2 목록) */
export function buildRegionOptions(
  rows: Record<string, unknown>[],
): RegionOption[] {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const region1 = String(r.region1 ?? "").trim();
    const region2 = String(r.region2 ?? "").trim();
    if (!region1) continue;
    const list = map.get(region1) ?? [];
    if (region2 && !list.includes(region2)) list.push(region2);
    map.set(region1, list);
  }
  return Array.from(map.entries()).map(([region1, region2List]) => ({
    region1,
    region2List,
  }));
}
