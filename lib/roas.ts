import "server-only";

import { readFileSync } from "fs";
import { resolve } from "path";
import { Redis } from "@upstash/redis";
import { runQuery } from "@/lib/bigquery";

// ── 상수 ──────────────────────────────────────────────────────

/** age_group -> 한글 라벨 매핑 */
export const AGE_LABELS: Record<string, string> = {
  "01_21-22": "21~22세",
  "02_23-26": "23~26세",
  "03_27-30": "27~30세",
  "04_31-40": "31~40세",
  "05_41+": "41세 이상",
};

/** duration_group -> 한글 라벨 매핑 */
export const DURATION_LABELS: Record<string, string> = {
  "01_under_4h": "4시간 미만",
  "02_4h_24h": "4~24시간",
  "03_24h_36h": "24~36시간",
  "04_36h_48h": "36~48시간",
  "05_48h_plus": "48시간 이상",
};

/** BQ 오류 메시지 (API 응답용) */
export const BQ_ERROR_MSG = "데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";

// ── 타입 ──────────────────────────────────────────────────────

export interface CrosstabRow {
  age_group: string;
  age_label: string;
  duration_group: string;
  duration_label: string;
  nuse: number;
  revenue: number;
  day_type?: string;
}

export interface CrosstabResult {
  matrix: CrosstabRow[];
  age_groups: string[];
  age_labels: Record<string, string>;
  duration_groups: string[];
  duration_labels: Record<string, string>;
}

export interface PerformanceResult extends CrosstabResult {
  summary: {
    total_nuse: number;
    total_revenue: number;
    avg_rev_per_use: number;
  };
}

export interface CampaignSummary {
  issued: number;
  used: number;
  usage_rate: number;
  revenue: number;
  discount: number;
  net_revenue: number;
  roas: number;
}

export interface DailyTrendItem {
  date: string;
  used_count: number;
  revenue: number;
  discount: number;
}

export interface CampaignDetailResult {
  summary: CampaignSummary;
  crosstab: CrosstabResult;
  daily_trend: DailyTrendItem[];
  target_zones: number[];
  target_regions: { region1: string; region2: string[] };
}

export interface AnalysisA {
  title: string;
  coupon_users: { count: number; avg_revenue: number; avg_utime: number };
  non_coupon_users: { count: number; avg_revenue: number; avg_utime: number };
  diff_pct: { revenue: number; utime: number };
}

export interface AnalysisB {
  title: string;
  before: { period: string; nuse: number; revenue: number };
  after: { period: string; nuse: number; revenue: number; note?: string };
  change_pct: { nuse: number; revenue: number };
}

export interface AnalysisC {
  title: string;
  target_change?: { nuse_pct: number; revenue_pct: number };
  control_change?: { nuse_pct: number; revenue_pct: number };
  did_effect?: { nuse_pct: number; revenue_pct: number };
  note?: string;
  daily_series: DailySeriesItem[];
  camp_start: string;
}

export interface DailySeriesItem {
  date: string;
  target_nuse: number;
  target_revenue: number;
  control_nuse: number;
  control_revenue: number;
}

export interface Verdict {
  score: number;
  label: string;
  summary: string;
  insights: string[];
  note?: string;
}

export interface CampaignImpactResult {
  analysis_a: AnalysisA;
  analysis_b: AnalysisB;
  analysis_c: AnalysisC;
  verdict: Verdict;
  is_ongoing: boolean;
}

export interface RoasScenario {
  id: string;
  name: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  created_at: string;
}

// ── 유틸 ──────────────────────────────────────────────────────

/** NaN/null-safe 정수 변환 */
export function safeInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** NaN/null-safe 소수점 2자리 변환 */
export function safeFloat(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** sql/roas/ 디렉토리에서 SQL 파일을 읽어 반환 */
export function loadRoasSql(filename: string): string {
  const sqlPath = resolve(process.cwd(), "sql/roas", filename);
  return readFileSync(sqlPath, "utf-8");
}

/**
 * SQL 내 {param} 플레이스홀더를 치환한다.
 * 문자열 값은 호출 측에서 쿼테이션 포함하여 전달해야 한다.
 */
export function replaceSqlParams(
  sql: string,
  params: Record<string, string>
): string {
  let result = sql;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

/** 숫자 배열을 SQL IN절용 문자열로 변환: (1, 2, 3) */
export function toIntInClause(ids: number[]): string {
  return ids.join(", ");
}

/** 문자열 배열을 SQL IN절용 문자열로 변환: ('a', 'b') */
export function toStrInClause(strs: string[]): string {
  return strs.map((s) => `'${s.replace(/'/g, "\\'")}'`).join(", ");
}

/** 날짜 문자열 검증 (YYYY-MM-DD) */
export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

// ── SQL 섹션 파서 ─────────────────────────────────────────────

/**
 * -- @section <name> 마커로 구분된 SQL 파일을 섹션별 Map으로 분리한다.
 * @returns Map<sectionName, sqlString>
 */
export function parseSqlSections(rawSql: string): Map<string, string> {
  const sections = new Map<string, string>();
  let currentSection = "";
  const lines: string[] = [];

  for (const line of rawSql.split("\n")) {
    const match = line.match(/^--\s*@section\s+(\S+)/);
    if (match) {
      // 이전 섹션 저장
      if (currentSection) {
        sections.set(currentSection, lines.join("\n").trim());
      }
      currentSection = match[1];
      lines.length = 0;
    } else {
      lines.push(line);
    }
  }
  // 마지막 섹션 저장
  if (currentSection) {
    sections.set(currentSection, lines.join("\n").trim());
  }

  return sections;
}

// ── 크로스탭 빌더 ─────────────────────────────────────────────

/** BQ 결과 행 배열 -> 크로스탭 구조 변환 */
export function buildCrosstab(
  rows: Record<string, unknown>[]
): CrosstabResult {
  if (!rows || rows.length === 0) {
    return {
      matrix: [],
      age_groups: [],
      age_labels: {},
      duration_groups: [],
      duration_labels: { ...DURATION_LABELS },
    };
  }

  const matrix: CrosstabRow[] = rows.map((row) => ({
    age_group: String(row.age_group ?? ""),
    age_label:
      AGE_LABELS[String(row.age_group ?? "")] ?? String(row.age_group ?? ""),
    duration_group: String(row.duration_group ?? ""),
    duration_label:
      DURATION_LABELS[String(row.duration_group ?? "")] ??
      String(row.duration_group ?? ""),
    nuse: safeInt(row.nuse),
    revenue: safeFloat(row.revenue),
  }));

  const ageGroupsSet = new Set(matrix.map((r) => r.age_group));
  const durationGroupsSet = new Set(matrix.map((r) => r.duration_group));
  const ageGroups = [...ageGroupsSet].sort();
  const durationGroups = [...durationGroupsSet].sort();

  const ageLabels: Record<string, string> = {};
  for (const ag of ageGroups) {
    ageLabels[ag] = AGE_LABELS[ag] ?? ag;
  }
  const durationLabels: Record<string, string> = {};
  for (const dg of durationGroups) {
    durationLabels[dg] = DURATION_LABELS[dg] ?? dg;
  }

  return { matrix, age_groups: ageGroups, age_labels: ageLabels, duration_groups: durationGroups, duration_labels: durationLabels };
}

// ── Analysis A: 쿠폰 사용자 vs 미사용자 ──────────────────────

export function buildAnalysisA(rows: Record<string, unknown>[]): AnalysisA {
  const result: AnalysisA = {
    title: "쿠폰 사용자 vs 미사용자",
    coupon_users: { count: 0, avg_revenue: 0, avg_utime: 0 },
    non_coupon_users: { count: 0, avg_revenue: 0, avg_utime: 0 },
    diff_pct: { revenue: 0, utime: 0 },
  };

  for (const row of rows) {
    const gt = String(row.group_type ?? "");
    if (gt === "coupon") {
      result.coupon_users = {
        count: safeInt(row.cnt),
        avg_revenue: safeFloat(row.avg_revenue),
        avg_utime: safeFloat(row.avg_utime),
      };
    } else if (gt === "non_coupon") {
      result.non_coupon_users = {
        count: safeInt(row.cnt),
        avg_revenue: safeFloat(row.avg_revenue),
        avg_utime: safeFloat(row.avg_utime),
      };
    }
  }

  const cu = result.coupon_users;
  const nc = result.non_coupon_users;
  result.diff_pct = {
    revenue:
      nc.avg_revenue > 0
        ? Math.round(((cu.avg_revenue - nc.avg_revenue) / nc.avg_revenue) * 1000) / 10
        : 0,
    utime:
      nc.avg_utime > 0
        ? Math.round(((cu.avg_utime - nc.avg_utime) / nc.avg_utime) * 1000) / 10
        : 0,
  };

  return result;
}

// ── Analysis B: 전후 비교 ─────────────────────────────────────

export function buildAnalysisB(
  rows: Record<string, unknown>[],
  beforeStart: string,
  beforeEnd: string,
  afterStart: string,
  afterEnd: string,
  isOngoing: boolean
): AnalysisB {
  let bNuse = 0, bRev = 0, aNuse = 0, aRev = 0;

  for (const row of rows) {
    const period = String(row.period ?? "");
    if (period === "before") {
      bNuse = safeInt(row.nuse);
      bRev = safeFloat(row.revenue);
    } else if (period === "after") {
      aNuse = safeInt(row.nuse);
      aRev = safeFloat(row.revenue);
    }
  }

  const result: AnalysisB = {
    title: "캠페인 전후 비교",
    before: { period: `${beforeStart}~${beforeEnd}`, nuse: bNuse, revenue: bRev },
    after: { period: `${afterStart}~${afterEnd}`, nuse: aNuse, revenue: aRev },
    change_pct: {
      nuse: bNuse > 0 ? Math.round(((aNuse - bNuse) / bNuse) * 1000) / 10 : 0,
      revenue: bRev > 0 ? Math.round(((aRev - bRev) / bRev) * 1000) / 10 : 0,
    },
  };

  if (isOngoing) {
    result.after.note = "(진행 중, 부분 집계)";
  }

  return result;
}

// ── Analysis C: DID 분석 ──────────────────────────────────────

export function buildAnalysisC(rows: Record<string, unknown>[]): AnalysisC {
  function getVal(
    groupType: string,
    period: string
  ): { nuse: number; revenue: number } {
    const row = rows.find(
      (r) =>
        String(r.group_type ?? "") === groupType &&
        String(r.period ?? "") === period
    );
    if (!row) return { nuse: 0, revenue: 0 };
    return { nuse: safeInt(row.nuse), revenue: safeFloat(row.revenue) };
  }

  const tBefore = getVal("target", "before");
  const tAfter = getVal("target", "after");
  const cBefore = getVal("control", "before");
  const cAfter = getVal("control", "after");

  const tNusePct =
    tBefore.nuse > 0
      ? Math.round(((tAfter.nuse - tBefore.nuse) / tBefore.nuse) * 1000) / 10
      : 0;
  const tRevPct =
    tBefore.revenue > 0
      ? Math.round(
          ((tAfter.revenue - tBefore.revenue) / tBefore.revenue) * 1000
        ) / 10
      : 0;
  const cNusePct =
    cBefore.nuse > 0
      ? Math.round(((cAfter.nuse - cBefore.nuse) / cBefore.nuse) * 1000) / 10
      : 0;
  const cRevPct =
    cBefore.revenue > 0
      ? Math.round(
          ((cAfter.revenue - cBefore.revenue) / cBefore.revenue) * 1000
        ) / 10
      : 0;

  return {
    title: "타겟존 vs 비타겟존 (DID)",
    target_change: { nuse_pct: tNusePct, revenue_pct: tRevPct },
    control_change: { nuse_pct: cNusePct, revenue_pct: cRevPct },
    did_effect: {
      nuse_pct: Math.round((tNusePct - cNusePct) * 10) / 10,
      revenue_pct: Math.round((tRevPct - cRevPct) * 10) / 10,
    },
    daily_series: [],
    camp_start: "",
  };
}

// ── Daily DID 시계열 ──────────────────────────────────────────

export function buildDailySeries(
  rows: Record<string, unknown>[]
): DailySeriesItem[] {
  if (!rows || rows.length === 0) return [];

  const map: Record<string, DailySeriesItem> = {};

  for (const row of rows) {
    const d = String(row.date ?? "");
    if (!map[d]) {
      map[d] = {
        date: d,
        target_nuse: 0,
        target_revenue: 0,
        control_nuse: 0,
        control_revenue: 0,
      };
    }
    const gt = String(row.group_type ?? "");
    if (gt === "target") {
      map[d].target_nuse = safeInt(row.nuse);
      map[d].target_revenue = safeFloat(row.revenue);
    } else {
      map[d].control_nuse = safeInt(row.nuse);
      map[d].control_revenue = safeFloat(row.revenue);
    }
  }

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

// ── 종합 판정 ─────────────────────────────────────────────────

export function computeVerdict(
  roas: number,
  usageRate: number,
  analysisB: AnalysisB,
  analysisC: AnalysisC,
  didPossible: boolean
): Verdict {
  // ROAS score (30%)
  let roasScore: number;
  if (roas >= 300) roasScore = 100;
  else if (roas >= 200) roasScore = 80;
  else if (roas >= 100) roasScore = 50;
  else roasScore = 20;

  // Usage rate score (20%)
  let usageScore: number;
  if (usageRate >= 20) usageScore = 100;
  else if (usageRate >= 10) usageScore = 70;
  else if (usageRate >= 5) usageScore = 40;
  else usageScore = 10;

  // Before-after revenue change score (20%)
  const baRevPct = analysisB.change_pct?.revenue ?? 0;
  let baScore: number;
  if (baRevPct >= 30) baScore = 100;
  else if (baRevPct >= 10) baScore = 70;
  else if (baRevPct >= 0) baScore = 40;
  else baScore = 10;

  // DID score (30%)
  let didScore: number | null = null;
  let total: number;

  if (didPossible) {
    const didNusePct = analysisC.did_effect?.nuse_pct ?? 0;
    if (didNusePct >= 20) didScore = 100;
    else if (didNusePct >= 10) didScore = 70;
    else if (didNusePct >= 0) didScore = 40;
    else didScore = 10;
    total = roasScore * 0.3 + didScore * 0.3 + usageScore * 0.2 + baScore * 0.2;
  } else {
    // 재가중: ROAS 42.9%, 사용률 28.6%, 전후증감 28.6%
    total = roasScore * 0.429 + usageScore * 0.286 + baScore * 0.286;
  }

  total = Math.round(total * 10) / 10;

  let label: string;
  if (total >= 80) label = "효과적인 캠페인";
  else if (total >= 50) label = "보통 수준의 캠페인";
  else label = "비효율 캠페인 — 개선 필요";

  // 인사이트 생성
  const insights: string[] = [];
  insights.push(
    `ROAS ${Math.round(roas)}%로 ${roas >= 300 ? "높은" : roas >= 100 ? "보통 수준의" : "낮은"} 투자 대비 수익`
  );
  insights.push(
    `사용률 ${usageRate.toFixed(1)}%는 ${usageRate >= 10 ? "양호" : "개선 필요"}`
  );

  const baNusePct = analysisB.change_pct?.nuse ?? 0;
  if (baNusePct > 0) {
    insights.push(`캠페인 기간 이용건수 ${baNusePct.toFixed(1)}% 증가`);
  } else {
    insights.push(`캠페인 기간 이용건수 ${baNusePct.toFixed(1)}% 변화`);
  }

  if (didPossible) {
    const didEffect = analysisC.did_effect?.nuse_pct ?? 0;
    insights.push(`DID 분석: 순수 캠페인 효과 ${didEffect.toFixed(1)}%p`);
  }

  let summaryText = `ROAS ${Math.round(roas)}%, 사용률 ${usageRate.toFixed(1)}%의 캠페인.`;
  if (didPossible) {
    const didEffect = analysisC.did_effect?.nuse_pct ?? 0;
    summaryText += ` 타겟존에서 비타겟존 대비 ${didEffect.toFixed(1)}%p 높은 이용건수 증가 확인.`;
  }

  const verdict: Verdict = {
    score: total,
    label,
    summary: summaryText,
    insights,
  };

  if (!didPossible) {
    verdict.note = "DID 비교 불가 — 타겟존 미지정 또는 비교군 없음";
  }

  return verdict;
}

// ── 시나리오 저장소 (Upstash Redis) ────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

const SCENARIO_PREFIX = "roas:scenario:";
const SCENARIO_INDEX_KEY = "roas:scenario_ids";
const SCENARIO_TTL = 180 * 24 * 60 * 60; // 180 days

/** 시나리오 저장 */
export async function saveScenario(data: {
  name: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
}): Promise<{ id: string; created_at: string }> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis not configured");

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const scenario: RoasScenario = {
    id,
    name: data.name,
    inputs: data.inputs,
    results: data.results,
    created_at: createdAt,
  };

  await redis.set(`${SCENARIO_PREFIX}${id}`, scenario, { ex: SCENARIO_TTL });
  // 인덱스에 ID 추가 (LPUSH)
  await redis.lpush(SCENARIO_INDEX_KEY, id);

  return { id, created_at: createdAt };
}

/** 시나리오 목록 조회 */
export async function listScenarios(): Promise<RoasScenario[]> {
  const redis = getRedis();
  if (!redis) return [];

  const ids = await redis.lrange(SCENARIO_INDEX_KEY, 0, 99);
  if (!ids || ids.length === 0) return [];

  const scenarios: RoasScenario[] = [];
  for (const id of ids) {
    const s = await redis.get<RoasScenario>(`${SCENARIO_PREFIX}${id}`);
    if (s) scenarios.push(s);
  }

  return scenarios;
}

/** 시나리오 단건 조회 */
export async function getScenario(
  id: string
): Promise<RoasScenario | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<RoasScenario>(`${SCENARIO_PREFIX}${id}`);
}

// suppress unused import warning — runQuery is imported for future direct use
void runQuery;
