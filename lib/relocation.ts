// lib/relocation.ts
import { readFileSync } from "fs";
import { resolve } from "path";
import type {
  RelocationParams,
  RelocationRow,
  RelocationRecommendation,
  RelocationResult,
} from "@/types/relocation";
import { PAST_DAYS_OPTIONS, FUTURE_DAYS_OPTIONS } from "@/types/relocation";
import { runQuery } from "@/lib/bigquery";

const DEFAULT_SQL_PATH = resolve(process.cwd(), "sql/relocation.sql");

const SQL_UNSAFE_CHARS = /['";\\]/;

export function validateParams(params: RelocationParams): string[] {
  const errors: string[] = [];
  const { region1, pastDays, futureDays, weights } = params;

  if (!(PAST_DAYS_OPTIONS as readonly number[]).includes(pastDays)) {
    errors.push(`pastDays 허용값: ${PAST_DAYS_OPTIONS.join(", ")}`);
  }
  if (!(FUTURE_DAYS_OPTIONS as readonly number[]).includes(futureDays)) {
    errors.push(`futureDays 허용값: ${FUTURE_DAYS_OPTIONS.join(", ")}`);
  }

  const weightSum = weights.utilization + weights.revenue + weights.prereservation;
  if (Math.abs(weightSum - 1.0) > 0.001) {
    errors.push(`가중치 합계는 1.0이어야 합니다 (현재: ${weightSum.toFixed(3)})`);
  }

  if (region1 !== "전체" && SQL_UNSAFE_CHARS.test(region1)) {
    errors.push("region1에 허용되지 않는 문자가 포함되어 있습니다.");
  }

  return errors;
}

export function loadSql(
  params: RelocationParams,
  sqlPath: string = DEFAULT_SQL_PATH
): string {
  const raw = readFileSync(sqlPath, "utf-8");
  const region1Where =
    params.region1 === "전체" ? "" : `AND region1 = '${params.region1}'`;
  const region1WhereZ =
    params.region1 === "전체" ? "" : `AND z.region1 = '${params.region1}'`;

  return raw
    .replace(/\{past_days\}/g, String(params.pastDays))
    .replace(/\{future_days\}/g, String(params.futureDays))
    .replace(/\{region1_where\}/g, region1Where)
    .replace(/\{region1_where_z\}/g, region1WhereZ);
}

export function computeScore(
  rows: Omit<RelocationRow, "score" | "tier">[],
  weights: RelocationParams["weights"]
): RelocationRow[] {
  const { utilization, revenue, prereservation } = weights;

  const utils = rows.map((r) => r.utilRate);
  const revs = rows.map((r) => r.revPerCar);
  const pres = rows.map((r) => r.prereservRate);

  const minMax = (arr: number[]) => ({
    min: Math.min(...arr),
    max: Math.max(...arr),
  });

  const mmUtil = minMax(utils);
  const mmRev = minMax(revs);
  const mmPre = minMax(pres);

  const norm = (v: number, min: number, max: number) =>
    min === max ? 0.5 : (v - min) / (max - min);

  const scored = rows.map((r, i) => ({
    ...r,
    _idx: i,
    score:
      utilization * norm(r.utilRate, mmUtil.min, mmUtil.max) +
      revenue * norm(r.revPerCar, mmRev.min, mmRev.max) +
      prereservation * norm(r.prereservRate, mmPre.min, mmPre.max),
    tier: "mid" as RelocationRow["tier"],
  }));

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const n = sorted.length;
  const topN = Math.ceil(n * 0.2);
  const botN = Math.ceil(n * 0.2);

  const topIdxSet = new Set(sorted.slice(0, topN).map((r) => r._idx));
  const botIdxSet = new Set(sorted.slice(n - botN).map((r) => r._idx));

  return scored.map(({ _idx, ...r }) => {
    if (topIdxSet.has(_idx)) return { ...r, tier: "top" as const };
    if (botIdxSet.has(_idx)) return { ...r, tier: "bottom" as const };
    return r;
  });
}

export function computeRecommendations(
  rows: RelocationRow[]
): RelocationRecommendation[] {
  const bottomRows = rows.filter((r) => r.tier === "bottom");
  const topRows = rows.filter((r) => r.tier === "top");

  if (topRows.length === 0) return [];

  return bottomRows.map((from) => {
    const sameRegionTop = topRows.find((t) => t.region1 === from.region1);
    const target = sameRegionTop ?? topRows[0];

    return {
      fromZone: from.region2,
      fromRegion1: from.region1,
      toZone: target.region2,
      toRegion1: target.region1,
      carCount: Math.max(1, Math.round(from.carCount * 0.2)),
      sameRegion: target.region1 === from.region1,
    };
  });
}

export async function runRelocation(params: RelocationParams): Promise<RelocationResult> {
  const sql = loadSql(params);
  const rawRows = await runQuery(sql);
  if (!rawRows) {
    throw new Error("BigQuery가 설정되지 않았습니다 (GOOGLE_APPLICATION_CREDENTIALS_B64).");
  }

  const baseRows = rawRows.map((r) => ({
    region1:       String(r.region1 ?? ""),
    region2:       String(r.region2 ?? ""),
    utilRate:      Number(r.util_rate      ?? 0),
    revPerCar:     Number(r.rev_per_car    ?? 0),
    prereservRate: Number(r.prereserv_rate ?? 0),
    carCount:      Number(r.car_count      ?? 0),
    score:         0,
    tier:          "mid" as RelocationRow["tier"],
  }));

  const scored          = computeScore(baseRows, params.weights);
  const recommendations = computeRecommendations(scored);

  return {
    rows: scored,
    recommendations,
    fetchedAt: new Date().toISOString(),
  };
}
