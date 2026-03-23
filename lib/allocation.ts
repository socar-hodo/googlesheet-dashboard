import { readFileSync } from "fs";
import { resolve } from "path";
import type { AllocationParams, AllocationRow, AllocationResult } from "@/types/allocation";
import { SEGMENTS } from "@/types/allocation";
import { runQuery } from "@/lib/bigquery";

// sql/allocation.sql 기본 경로 (프로젝트 루트 기준)
const DEFAULT_SQL_PATH = resolve(process.cwd(), "sql/allocation.sql");

/** 입력 파라미터 검증. 오류 메시지 배열 반환 (비어있으면 통과). */
export function validateParams(params: AllocationParams): string[] {
  const errors: string[] = [];
  const { carModel, carSegment, totalCars, baseDate } = params;

  if (carModel.includes("'")) {
    errors.push("차종 모델명에 단따옴표(')가 포함될 수 없습니다.");
  }
  if (totalCars < 1) {
    errors.push("총 배분 물량은 1 이상이어야 합니다.");
  }
  if (!(SEGMENTS as readonly string[]).includes(carSegment)) {
    errors.push(`세그먼트 값이 올바르지 않습니다: ${carSegment}`);
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(baseDate)) {
    errors.push("기준 날짜 형식이 올바르지 않습니다 (YYYY-MM-DD).");
  } else {
    const bd = new Date(baseDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(bd.getTime())) {
      errors.push("기준 날짜 형식이 올바르지 않습니다 (YYYY-MM-DD).");
    } else if (bd >= today) {
      errors.push("기준 날짜는 오늘 이전이어야 합니다.");
    }
  }

  return errors;
}

/**
 * allocation.sql 파일을 읽어 파라미터 치환 후 반환.
 * @param sqlPath - 테스트 시 임시 파일 경로 주입 가능 (기본: sql/allocation.sql)
 */
export function loadSql(
  params: AllocationParams,
  alpha = 0.5,
  sqlPath: string = DEFAULT_SQL_PATH
): string {
  const raw = readFileSync(sqlPath, "utf-8");
  const formatted = raw
    .replace(/\{car_model\}/g, params.carModel)
    .replace(/\{car_segment\}/g, params.carSegment)
    .replace(/\{total_cars\}/g, String(params.totalCars))
    .replace(/\{base_date\}/g, params.baseDate)
    .replace(/\{alpha\}/g, String(alpha));

  // 선두 주석 블록(-- ...) 제거
  const lines = formatted.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (stripped && !stripped.startsWith("--")) {
      return lines.slice(i).join("\n");
    }
  }
  return formatted;
}

/**
 * 스피어만 순위 상관계수 계산.
 * ρ = 1 - (6 * Σd²) / (n * (n² - 1))
 */
export function computeSpearman(rankS1: number[], rankS5: number[]): number | null {
  const n = rankS1.length;
  if (n === 0 || n !== rankS5.length) return null;

  const sumD2 = rankS1.reduce((acc, r1, i) => acc + (r1 - rankS5[i]) ** 2, 0);
  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
  return Math.round(rho * 10000) / 10000;
}

/** SQL 실행 후 AllocationResult 반환. */
export async function runAllocation(params: AllocationParams): Promise<AllocationResult> {
  const sql = loadSql(params);
  const rawRows = await runQuery(sql);
  if (!rawRows) throw new Error("BigQuery가 설정되지 않았습니다 (GOOGLE_APPLICATION_CREDENTIALS_B64).");

  // BigQuery 반환값을 AllocationRow로 캐스팅
  // rev_yoy / util_yoy는 NULL일 수 있으므로 null 처리
  const rows: AllocationRow[] = rawRows.map((r) => ({
    region1:       String(r.region1 ?? ""),
    region2:       String(r.region2 ?? ""),
    ref_type:      (r.ref_type as "model" | "segment" | "fallback") ?? "fallback",
    final_score:   Number(r.final_score ?? 0),
    rev_yoy:       r.rev_yoy != null ? Number(r.rev_yoy) : null,
    util_yoy:      r.util_yoy != null ? Number(r.util_yoy) : null,
    allocated_cars: Number(r.allocated_cars ?? 0),
    score_s1:      Number(r.score_s1 ?? 0),
    score_s2:      Number(r.score_s2 ?? 0),
    score_s3:      Number(r.score_s3 ?? 0),
    score_s4:      Number(r.score_s4 ?? 0),
    score_s5:      Number(r.score_s5 ?? 0),
    rank_s1:       Number(r.rank_s1 ?? 0),
    rank_s5:       Number(r.rank_s5 ?? 0),
  }));

  const spearman = computeSpearman(rows.map((r) => r.rank_s1), rows.map((r) => r.rank_s5));

  return {
    rows,
    spearman,
    totalAllocated: rows.reduce((s, r) => s + r.allocated_cars, 0),
    region1Count:   new Set(rows.map((r) => r.region1)).size,
    region2Count:   rows.length,
  };
}
