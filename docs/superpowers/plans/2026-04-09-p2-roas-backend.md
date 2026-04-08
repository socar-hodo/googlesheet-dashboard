# P2. ROAS 백엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ROAS 시뮬레이터의 BQ 쿼리 16개와 비즈니스 로직을 Next.js API Routes + TypeScript로 이관한다.

**Architecture:** Python bq.py의 인라인 SQL을 sql/roas/*.sql 파일로 추출하고, lib/roas.ts에 크로스탭/판정 로직을 포팅한다. API Routes는 기존 allocation 패턴을 따른다.

**Tech Stack:** Next.js 16 App Router, TypeScript, @google-cloud/bigquery, Upstash Redis

---

## File Structure

```
lib/roas.ts                                  <- 신규: 상수 + 헬퍼 함수
sql/roas/regions.sql                         <- 신규: region1 목록 쿼리
sql/roas/sub-regions.sql                     <- 신규: region2 목록 쿼리
sql/roas/zones.sql                           <- 신규: 존 목록 쿼리
sql/roas/performance.sql                     <- 신규: 연령대x이용시간 크로스탭
sql/roas/campaigns.sql                       <- 신규: 캠페인 목록
sql/roas/campaign-detail.sql                 <- 신규: 캠페인 상세 (4 섹션)
sql/roas/campaign-impact.sql                 <- 신규: 영향도 분석 (다중 섹션)
app/api/roas/regions/route.ts                <- 신규: GET /api/roas/regions
app/api/roas/regions/[region1]/route.ts      <- 신규: GET /api/roas/regions/:region1
app/api/roas/zones/route.ts                  <- 신규: GET /api/roas/zones
app/api/roas/performance/route.ts            <- 신규: POST /api/roas/performance
app/api/roas/campaigns/route.ts              <- 신규: GET /api/roas/campaigns
app/api/roas/campaign/detail/route.ts        <- 신규: POST /api/roas/campaign/detail
app/api/roas/campaign/impact/route.ts        <- 신규: POST /api/roas/campaign/impact
app/api/roas/scenarios/route.ts              <- 신규: GET+POST /api/roas/scenarios
app/api/roas/campaign/vs-forecast/route.ts   <- 신규: POST /api/roas/campaign/vs-forecast
```

---

## Task 1: `lib/roas.ts` -- 상수 + 헬퍼 함수

**Files:**
- Create: `lib/roas.ts`

이 파일에 AGE_LABELS, DURATION_LABELS 상수, buildCrosstab, computeVerdict, analysis builder 함수, daily series builder, scenario Redis 유틸을 모두 정의한다.

- [ ] **Step 1: 파일 생성 및 상수 정의**

`lib/roas.ts` 파일을 생성하고 상수와 타입을 정의한다:

```ts
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
```

- [ ] **Step 2: SQL 로딩 헬퍼 + safe number 유틸**

같은 파일에 SQL 로딩과 숫자 변환 유틸을 추가한다:

```ts
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
```

- [ ] **Step 3: buildCrosstab 함수**

Python `_build_crosstab()`을 TypeScript로 포팅한다:

```ts
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
```

- [ ] **Step 4: buildAnalysisA 함수**

Python `_build_analysis_a()`를 TypeScript로 포팅한다:

```ts
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
```

- [ ] **Step 5: buildAnalysisB 함수**

Python `_build_analysis_b()`를 TypeScript로 포팅한다:

```ts
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
```

- [ ] **Step 6: buildAnalysisC 함수**

Python `_build_analysis_c()`를 TypeScript로 포팅한다:

```ts
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
```

- [ ] **Step 7: buildDailySeries 함수**

Python `_build_daily_series()`를 TypeScript로 포팅한다:

```ts
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
```

- [ ] **Step 8: computeVerdict 함수**

Python `_compute_verdict()`를 TypeScript로 포팅한다:

```ts
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
```

- [ ] **Step 9: Scenario Redis 유틸**

GCS 대신 Upstash Redis를 사용하는 시나리오 CRUD 유틸을 추가한다:

```ts
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
```

- [ ] **Step 10: 커밋**

```bash
git add lib/roas.ts
git commit -m "feat(roas): add lib/roas.ts with constants, crosstab builder, verdict, analysis helpers, scenario Redis utils"
```

---

## Task 2: SQL 파일 -- regions, sub-regions, zones, performance

**Files:**
- Create: `sql/roas/regions.sql`
- Create: `sql/roas/sub-regions.sql`
- Create: `sql/roas/zones.sql`
- Create: `sql/roas/performance.sql`

- [ ] **Step 1: `sql/roas/regions.sql` 생성**

Python `get_regions()`의 SQL을 추출한다. 파라미터 없음:

```sql
-- regions.sql: region1 목록 조회 (화이트리스트 필터링)
SELECT DISTINCT region1
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND region1 IS NOT NULL
  AND region1 != ''
  AND region1 != '-'
  AND region1 NOT LIKE '%테스트%'
  AND region1 IN (
    '서울특별시','부산광역시','대구광역시','인천광역시','광주광역시',
    '대전광역시','울산광역시','세종특별자치시','경기도','강원도',
    '충청북도','충청남도','전라북도','전라남도','경상북도','경상남도',
    '제주특별자치도'
  )
ORDER BY region1
```

- [ ] **Step 2: `sql/roas/sub-regions.sql` 생성**

Python `get_sub_regions(region1)`의 SQL. 파라미터: `{region1}` (문자열, 호출 측에서 쿼테이션 포함):

```sql
-- sub-regions.sql: region2 목록 조회
-- 파라미터: {region1} (쿼테이션 포함 문자열, 예: '경상남도')
SELECT DISTINCT region2
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND region1 = {region1}
  AND region2 IS NOT NULL
  AND region2 != ''
ORDER BY region2
```

- [ ] **Step 3: `sql/roas/zones.sql` 생성**

Python `get_zones(region1, region2_list)`의 SQL. 원본은 `IN UNNEST(@region2_list)` 패턴을 사용하지만, 이 프로젝트에서는 `IN ({region2_list})` 문자열 치환을 사용한다. 파라미터: `{region1}`, `{region2_list}`:

```sql
-- zones.sql: 카셰어링 차량이 배치된 운영 존 목록
-- 파라미터: {region1} (쿼테이션 포함 문자열), {region2_list} (쿼테이션 포함 문자열 목록)
SELECT DISTINCT z.id, z.name, z.address
FROM `socar-data.socar_biz_base.carzone_info_daily` z
WHERE z.date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND z.region1 = {region1}
  AND z.region2 IN ({region2_list})
  AND z.state = 1
  AND EXISTS (
    SELECT 1 FROM `socar-data.socar_biz_base.car_info_daily` c
    WHERE c.date = z.date AND c.zone_id = z.id
      AND c.sharing_type IN ('socar', 'zplus')
  )
ORDER BY z.name
```

- [ ] **Step 4: `sql/roas/performance.sql` 생성**

Python `get_performance(zone_ids, start_date, end_date)`의 SQL. 파라미터: `{zone_ids}` (정수 목록), `{start_date}`, `{end_date}` (쿼테이션 포함 문자열):

```sql
-- performance.sql: 연령대 x 이용시간 크로스탭 실적
-- 파라미터: {zone_ids}, {start_date}, {end_date}
SELECT
  age_group,
  CASE
    WHEN utime < 4 THEN '01_under_4h'
    WHEN utime < 24 THEN '02_4h_24h'
    WHEN utime < 36 THEN '03_24h_36h'
    WHEN utime < 48 THEN '04_36h_48h'
    ELSE '05_48h_plus'
  END AS duration_group,
  CASE
    WHEN EXTRACT(DAYOFWEEK FROM date) IN (1, 7) THEN 'weekend'
    ELSE 'weekday'
  END AS day_type,
  COUNT(*) AS nuse,
  SUM(revenue) + SUM(ABS(__rev_coupon)) AS revenue,
  SAFE_DIVIDE(SUM(revenue) + SUM(ABS(__rev_coupon)), COUNT(*)) AS rev_per_use
FROM `socar-data.soda_store.reservation_v2`
WHERE date BETWEEN {start_date} AND {end_date}
  AND zone_id IN ({zone_ids})
  AND state IN (3, 5)
  AND member_imaginary IN (0, 9)
  AND sharing_type IN ('socar', 'zplus')
GROUP BY age_group, duration_group, day_type
ORDER BY age_group, duration_group, day_type
```

- [ ] **Step 5: 커밋**

```bash
git add sql/roas/regions.sql sql/roas/sub-regions.sql sql/roas/zones.sql sql/roas/performance.sql
git commit -m "feat(roas): add SQL files for regions, sub-regions, zones, performance queries"
```

---

## Task 3: SQL 파일 -- campaigns, campaign-detail

**Files:**
- Create: `sql/roas/campaigns.sql`
- Create: `sql/roas/campaign-detail.sql`

- [ ] **Step 1: `sql/roas/campaigns.sql` 생성**

Python `get_campaigns(start_date, end_date)`의 SQL. 파라미터: `{start_date}`, `{end_date}` (쿼테이션 포함 문자열):

```sql
-- campaigns.sql: 캠페인 목록 조회
-- 파라미터: {start_date}, {end_date}
WITH policy_stats AS (
  SELECT policy_id,
    COUNT(DISTINCT id) AS issued_count,
    COUNT(DISTINCT CASE WHEN reservation_id IS NOT NULL THEN id END) AS used_count,
    MIN(DATE(created_at, "Asia/Seoul")) AS first_issued,
    MAX(DATE(used_at, "Asia/Seoul")) AS last_used
  FROM `socar-data.tianjin_replica.coupon_info`
  GROUP BY policy_id
),
revenue_stats AS (
  SELECT coupon_policy_id AS policy_id,
    SUM(revenue) AS post_discount_revenue,
    SUM(ABS(__rev_coupon)) AS total_discount,
    SUM(revenue) + SUM(ABS(__rev_coupon)) AS total_revenue
  FROM `socar-data.soda_store.reservation_v2`
  WHERE state IN (3, 5) AND member_imaginary IN (0, 9)
    AND sharing_type IN ('socar', 'zplus')
    AND date >= DATE_SUB({start_date}, INTERVAL 6 MONTH)
  GROUP BY coupon_policy_id
)
SELECT cp.id AS policy_id, cp.name, cp.division,
  cp.discount_price, cp.discount_percent,
  cp.usable_start_on, cp.usable_end_on,
  ps.issued_count, ps.used_count,
  SAFE_DIVIDE(ps.used_count, ps.issued_count) * 100 AS usage_rate,
  rs.total_revenue, rs.total_discount,
  rs.post_discount_revenue AS net_revenue,
  SAFE_DIVIDE(rs.total_revenue, rs.total_discount) * 100 AS roas,
  ps.first_issued, ps.last_used
FROM `socar-data.tianjin_replica.coupon_policy` cp
LEFT JOIN policy_stats ps ON ps.policy_id = cp.id
LEFT JOIN revenue_stats rs ON rs.policy_id = cp.id
WHERE (
  DATE(cp.usable_start_on, "Asia/Seoul") BETWEEN {start_date} AND {end_date}
  OR (cp.usable_start_on IS NULL AND DATE(cp.created_at, "Asia/Seoul") BETWEEN {start_date} AND {end_date})
)
ORDER BY ps.used_count DESC
```

- [ ] **Step 2: `sql/roas/campaign-detail.sql` 생성**

Python `get_campaign_detail(policy_id)`의 4개 서브쿼리를 `-- @section` 마커로 분리한다. 파라미터: `{policy_id}` (정수):

```sql
-- campaign-detail.sql: 캠페인 상세 (4개 섹션)
-- 파라미터: {policy_id}

-- @section meta
-- 쿠폰 정책 기본정보 + 타겟존/지역
SELECT id, name, division, discount_price, discount_percent,
  include_zone, include_region1, include_region2,
  usable_start_on, usable_end_on
FROM `socar-data.tianjin_replica.coupon_policy`
WHERE id = {policy_id}

-- @section summary
-- 쿠폰 발급/사용 요약
SELECT
  COUNT(DISTINCT ci.id) AS issued,
  COUNT(DISTINCT CASE WHEN ci.reservation_id IS NOT NULL THEN ci.id END) AS used,
  COALESCE(SUM(r.revenue), 0) AS revenue,
  COALESCE(SUM(ABS(r.__rev_coupon)), 0) AS discount
FROM `socar-data.tianjin_replica.coupon_info` ci
LEFT JOIN `socar-data.soda_store.reservation_v2` r
  ON ci.reservation_id = r.reservation_id AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
WHERE ci.policy_id = {policy_id}

-- @section crosstab
-- 쿠폰 사용 예약의 연령대 x 이용시간 크로스탭
SELECT
  r.age_group,
  CASE
    WHEN r.utime < 4 THEN '01_under_4h'
    WHEN r.utime < 24 THEN '02_4h_24h'
    WHEN r.utime < 36 THEN '03_24h_36h'
    WHEN r.utime < 48 THEN '04_36h_48h'
    ELSE '05_48h_plus'
  END AS duration_group,
  COUNT(*) AS nuse,
  SUM(r.revenue) AS revenue,
  SAFE_DIVIDE(SUM(r.revenue), COUNT(*)) AS rev_per_use
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.coupon_policy_id = {policy_id}
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
GROUP BY r.age_group, duration_group
ORDER BY r.age_group, duration_group

-- @section daily_trend
-- 일별 추이
SELECT DATE(r.date) AS date,
  COUNT(*) AS used_count,
  SUM(r.revenue) AS revenue,
  SUM(ABS(r.__rev_coupon)) AS discount
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.coupon_policy_id = {policy_id}
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
GROUP BY date
ORDER BY date
```

- [ ] **Step 3: `lib/roas.ts`에 SQL 섹션 파서 추가**

`campaign-detail.sql` 등 `-- @section` 마커가 포함된 SQL 파일을 섹션별로 분리하는 유틸을 `lib/roas.ts`에 추가한다:

```ts
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
```

- [ ] **Step 4: 커밋**

```bash
git add sql/roas/campaigns.sql sql/roas/campaign-detail.sql lib/roas.ts
git commit -m "feat(roas): add campaigns & campaign-detail SQL files, SQL section parser"
```

---

## Task 4: SQL 파일 -- campaign-impact (복합 다중 섹션)

**Files:**
- Create: `sql/roas/campaign-impact.sql`

이 SQL 파일은 `get_campaign_impact()` 함수에서 사용하는 모든 쿼리를 포함한다. 총 9개 섹션으로 나눈다.

- [ ] **Step 1: `sql/roas/campaign-impact.sql` 생성**

Python `get_campaign_impact(policy_id)`의 모든 서브쿼리를 섹션으로 분리한다. 각 쿼리는 API Route에서 필요한 파라미터를 치환한 후 개별 실행한다.

파라미터는 섹션별로 다르며, API Route에서 동적으로 조립한다:

```sql
-- campaign-impact.sql: 영향도 분석 (9개 섹션)
-- 각 섹션은 API route에서 필요한 파라미터를 치환 후 개별 실행

-- @section meta
-- 캠페인 메타 정보 (기간, 타겟존, 지역)
-- 파라미터: {policy_id}
SELECT usable_start_on, usable_end_on, include_zone,
  include_region1, include_region2
FROM `socar-data.tianjin_replica.coupon_policy`
WHERE id = {policy_id}

-- @section analysis_a_with_zones
-- Analysis A: 쿠폰 사용 vs 미사용 (타겟존 필터)
-- 파라미터: {policy_id}, {target_zones}, {camp_start}, {camp_end}
SELECT
  CASE WHEN r.coupon_policy_id = {policy_id} THEN 'coupon' ELSE 'non_coupon' END AS group_type,
  COUNT(*) AS cnt,
  AVG(r.revenue) AS avg_revenue,
  AVG(r.utime) AS avg_utime
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.date BETWEEN {camp_start} AND {camp_end}
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
  AND r.zone_id IN ({target_zones})
GROUP BY group_type

-- @section analysis_a_with_region
-- Analysis A: 쿠폰 사용 vs 미사용 (지역 필터)
-- 파라미터: {policy_id}, {camp_start}, {camp_end}, {region1}
SELECT
  CASE WHEN r.coupon_policy_id = {policy_id} THEN 'coupon' ELSE 'non_coupon' END AS group_type,
  COUNT(*) AS cnt,
  AVG(r.revenue) AS avg_revenue,
  AVG(r.utime) AS avg_utime
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.date BETWEEN {camp_start} AND {camp_end}
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
  AND r.zone_id IN (SELECT id FROM `socar-data.socar_biz_base.carzone_info_daily` WHERE date = {camp_start} AND region1 = {region1})
GROUP BY group_type

-- @section analysis_a_no_filter
-- Analysis A: 쿠폰 사용 vs 미사용 (필터 없음)
-- 파라미터: {policy_id}, {camp_start}, {camp_end}
SELECT
  CASE WHEN r.coupon_policy_id = {policy_id} THEN 'coupon' ELSE 'non_coupon' END AS group_type,
  COUNT(*) AS cnt,
  AVG(r.revenue) AS avg_revenue,
  AVG(r.utime) AS avg_utime
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.date BETWEEN {camp_start} AND {camp_end}
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
GROUP BY group_type

-- @section zone_fetch_by_region
-- region1 기반 존 ID 목록 조회 (Analysis B 존 목록 fallback용)
-- 파라미터: {region1}
SELECT DISTINCT id
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND region1 = {region1}

-- @section analysis_b
-- Analysis B: 전후 비교
-- 파라미터: {before_start}, {before_end}, {camp_start}, {camp_end}, {b_zones}
SELECT
  CASE WHEN r.date BETWEEN {before_start} AND {before_end} THEN 'before' ELSE 'after' END AS period,
  COUNT(*) AS nuse,
  SUM(r.revenue) AS revenue
FROM `socar-data.soda_store.reservation_v2` r
WHERE (r.date BETWEEN {before_start} AND {before_end} OR r.date BETWEEN {camp_start} AND {camp_end})
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
  AND r.zone_id IN ({b_zones})
GROUP BY period

-- @section control_zones_with_region
-- 비타겟존 조회 (region1 + target_zones 제외)
-- 파라미터: {region1}, {target_zones}
SELECT DISTINCT id
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND region1 = {region1}
  AND id NOT IN ({target_zones})

-- @section control_zones_infer_region
-- target_zones에서 region1 추출
-- 파라미터: {target_zones}
SELECT DISTINCT region1
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND id IN ({target_zones})

-- @section control_zones_from_regions
-- 추출된 region 목록으로 비타겟존 조회
-- 파라미터: {regions}, {target_zones}
SELECT DISTINCT id
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND region1 IN ({regions})
  AND id NOT IN ({target_zones})

-- @section did
-- DID 분석: 타겟존 vs 비타겟존, 전후 비교
-- 파라미터: {target_zones}, {before_start}, {before_end}, {camp_start}, {camp_end}, {all_zones}
SELECT
  CASE WHEN r.zone_id IN ({target_zones}) THEN 'target' ELSE 'control' END AS group_type,
  CASE WHEN r.date BETWEEN {before_start} AND {before_end} THEN 'before' ELSE 'after' END AS period,
  COUNT(*) AS nuse,
  SUM(r.revenue) AS revenue
FROM `socar-data.soda_store.reservation_v2` r
WHERE (r.date BETWEEN {before_start} AND {before_end} OR r.date BETWEEN {camp_start} AND {camp_end})
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
  AND r.zone_id IN ({all_zones})
GROUP BY group_type, period

-- @section did_daily
-- DID 일별 시계열
-- 파라미터: {target_zones}, {before_start}, {before_end}, {camp_start}, {camp_end}, {all_zones}
SELECT
  r.date,
  CASE WHEN r.zone_id IN ({target_zones}) THEN 'target' ELSE 'control' END AS group_type,
  COUNT(*) AS nuse,
  SUM(r.revenue) AS revenue
FROM `socar-data.soda_store.reservation_v2` r
WHERE (r.date BETWEEN {before_start} AND {before_end}
    OR r.date BETWEEN {camp_start} AND {camp_end})
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
  AND r.zone_id IN ({all_zones})
GROUP BY r.date, group_type
ORDER BY r.date

-- @section verdict_summary
-- Verdict용 쿠폰 발급/사용 수 집계
-- 파라미터: {policy_id}
SELECT
  COUNT(DISTINCT id) AS issued,
  COUNT(DISTINCT CASE WHEN reservation_id IS NOT NULL THEN id END) AS used
FROM `socar-data.tianjin_replica.coupon_info`
WHERE policy_id = {policy_id}

-- @section verdict_revenue
-- Verdict용 매출/할인 집계
-- 파라미터: {policy_id}
SELECT SUM(revenue) AS post_discount_revenue, SUM(ABS(__rev_coupon)) AS total_discount
FROM `socar-data.soda_store.reservation_v2`
WHERE coupon_policy_id = {policy_id} AND state IN (3, 5) AND member_imaginary IN (0, 9)
  AND sharing_type IN ('socar', 'zplus')
```

- [ ] **Step 2: 커밋**

```bash
git add sql/roas/campaign-impact.sql
git commit -m "feat(roas): add campaign-impact SQL with 12 sections for impact analysis"
```

---

## Task 5: API Routes -- regions, zones, performance

**Files:**
- Create: `app/api/roas/regions/route.ts`
- Create: `app/api/roas/regions/[region1]/route.ts`
- Create: `app/api/roas/zones/route.ts`
- Create: `app/api/roas/performance/route.ts`

- [ ] **Step 1: `app/api/roas/regions/route.ts` 생성**

```ts
import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadRoasSql, BQ_ERROR_MSG } from "@/lib/roas";

export async function GET() {
  try {
    const sql = loadRoasSql("regions.sql");
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }
    return NextResponse.json(rows.map((r) => String(r.region1 ?? "")));
  } catch (err) {
    console.error("[roas/regions]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 2: `app/api/roas/regions/[region1]/route.ts` 생성**

```ts
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadRoasSql, replaceSqlParams, BQ_ERROR_MSG } from "@/lib/roas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ region1: string }> }
) {
  const { region1 } = await params;

  try {
    const raw = loadRoasSql("sub-regions.sql");
    const sql = replaceSqlParams(raw, {
      region1: `'${region1.replace(/'/g, "\\'")}'`,
    });
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }
    return NextResponse.json(rows.map((r) => String(r.region2 ?? "")));
  } catch (err) {
    console.error("[roas/regions/region1]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 3: `app/api/roas/zones/route.ts` 생성**

```ts
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadRoasSql, replaceSqlParams, toStrInClause, BQ_ERROR_MSG } from "@/lib/roas";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region1 = sp.get("region1");
  const region2 = sp.getAll("region2");

  if (!region1 || region2.length === 0) {
    return NextResponse.json(
      { error: "region1 and region2 are required" },
      { status: 400 }
    );
  }

  try {
    const raw = loadRoasSql("zones.sql");
    const sql = replaceSqlParams(raw, {
      region1: `'${region1.replace(/'/g, "\\'")}'`,
      region2_list: toStrInClause(region2),
    });
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }
    return NextResponse.json(
      rows.map((r) => ({
        id: Number(r.id ?? 0),
        name: String(r.name ?? ""),
        address: String(r.address ?? ""),
      }))
    );
  } catch (err) {
    console.error("[roas/zones]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 4: `app/api/roas/performance/route.ts` 생성**

```ts
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  replaceSqlParams,
  toIntInClause,
  buildCrosstab,
  safeFloat,
  safeInt,
  isValidDate,
  AGE_LABELS,
  DURATION_LABELS,
  BQ_ERROR_MSG,
} from "@/lib/roas";
import type { PerformanceResult } from "@/lib/roas";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const zoneIds: number[] = Array.isArray(body.zone_ids) ? body.zone_ids.map(Number) : [];
  const startDate: string = body.start_date ?? "";
  const endDate: string = body.end_date ?? "";

  if (zoneIds.length === 0) {
    return NextResponse.json({ error: "zone_ids must not be empty" }, { status: 400 });
  }
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const raw = loadRoasSql("performance.sql");
    const sql = replaceSqlParams(raw, {
      zone_ids: toIntInClause(zoneIds),
      start_date: `'${startDate}'`,
      end_date: `'${endDate}'`,
    });
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }

    if (rows.length === 0) {
      const empty: PerformanceResult = {
        matrix: [],
        age_groups: [],
        age_labels: {},
        duration_groups: [],
        duration_labels: { ...DURATION_LABELS },
        summary: { total_nuse: 0, total_revenue: 0, avg_rev_per_use: 0 },
      };
      return NextResponse.json(empty);
    }

    // performance는 day_type 포함하여 crosstab보다 확장된 형태
    const matrix = rows.map((row) => ({
      age_group: String(row.age_group ?? ""),
      age_label: AGE_LABELS[String(row.age_group ?? "")] ?? String(row.age_group ?? ""),
      duration_group: String(row.duration_group ?? ""),
      duration_label: DURATION_LABELS[String(row.duration_group ?? "")] ?? String(row.duration_group ?? ""),
      day_type: String(row.day_type ?? "all"),
      nuse: safeInt(row.nuse),
      revenue: safeFloat(row.revenue),
    }));

    const ageGroupsSet = new Set(matrix.map((r) => r.age_group));
    const durationGroupsSet = new Set(matrix.map((r) => r.duration_group));
    const ageGroups = [...ageGroupsSet].sort();
    const durationGroups = [...durationGroupsSet].sort();

    const ageLabels: Record<string, string> = {};
    for (const ag of ageGroups) ageLabels[ag] = AGE_LABELS[ag] ?? ag;
    const durationLabels: Record<string, string> = {};
    for (const dg of durationGroups) durationLabels[dg] = DURATION_LABELS[dg] ?? dg;

    const totalNuse = matrix.reduce((s, r) => s + r.nuse, 0);
    const totalRevenue = matrix.reduce((s, r) => s + r.revenue, 0);
    const avgRevPerUse = totalNuse > 0 ? Math.round((totalRevenue / totalNuse) * 100) / 100 : 0;

    const result: PerformanceResult = {
      matrix,
      age_groups: ageGroups,
      age_labels: ageLabels,
      duration_groups: durationGroups,
      duration_labels: durationLabels,
      summary: {
        total_nuse: totalNuse,
        total_revenue: totalRevenue,
        avg_rev_per_use: avgRevPerUse,
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[roas/performance]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 5: 커밋**

```bash
git add app/api/roas/regions/route.ts app/api/roas/regions/\[region1\]/route.ts app/api/roas/zones/route.ts app/api/roas/performance/route.ts
git commit -m "feat(roas): add API routes for regions, zones, performance"
```

---

## Task 6: API Routes -- campaigns, campaign/detail

**Files:**
- Create: `app/api/roas/campaigns/route.ts`
- Create: `app/api/roas/campaign/detail/route.ts`

- [ ] **Step 1: `app/api/roas/campaigns/route.ts` 생성**

```ts
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  replaceSqlParams,
  safeInt,
  safeFloat,
  isValidDate,
  BQ_ERROR_MSG,
} from "@/lib/roas";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("start_date") ?? "";
  const endDate = sp.get("end_date") ?? "";

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const raw = loadRoasSql("campaigns.sql");
    const sql = replaceSqlParams(raw, {
      start_date: `'${startDate}'`,
      end_date: `'${endDate}'`,
    });
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ campaigns: [] });
    }

    const campaigns = rows.map((row) => {
      // usable_start_on / usable_end_on: BigQuery TIMESTAMP -> 날짜 문자열
      const startOn = row.usable_start_on;
      const endOn = row.usable_end_on;

      return {
        policy_id: safeInt(row.policy_id),
        name: String(row.name ?? ""),
        division: String(row.division ?? ""),
        discount_price: safeInt(row.discount_price),
        discount_percent: safeFloat(row.discount_percent),
        usable_start_on: startOn ? String(startOn).slice(0, 10) : "",
        usable_end_on: endOn ? String(endOn).slice(0, 10) : "",
        issued_count: safeInt(row.issued_count),
        used_count: safeInt(row.used_count),
        usage_rate: safeFloat(row.usage_rate),
        total_revenue: safeFloat(row.total_revenue),
        total_discount: safeFloat(row.total_discount),
        net_revenue: safeFloat(row.net_revenue),
        roas: safeFloat(row.roas),
        first_issued: String(row.first_issued ?? ""),
        last_used: String(row.last_used ?? ""),
      };
    });

    return NextResponse.json({ campaigns });
  } catch (err) {
    console.error("[roas/campaigns]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 2: `app/api/roas/campaign/detail/route.ts` 생성**

```ts
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  parseSqlSections,
  replaceSqlParams,
  buildCrosstab,
  safeInt,
  safeFloat,
  BQ_ERROR_MSG,
} from "@/lib/roas";
import type { CampaignSummary, DailyTrendItem, CampaignDetailResult } from "@/lib/roas";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const policyId = Number(body.policy_id);

  if (!policyId || policyId <= 0) {
    return NextResponse.json({ error: "policy_id is required" }, { status: 400 });
  }

  try {
    const rawSql = loadRoasSql("campaign-detail.sql");
    const sections = parseSqlSections(rawSql);
    const policyIdStr = String(policyId);

    // 1) Meta
    const metaSql = replaceSqlParams(sections.get("meta")!, { policy_id: policyIdStr });
    const metaRows = await runQuery(metaSql);
    if (!metaRows || metaRows.length === 0) {
      return NextResponse.json({ error: "policy not found" }, { status: 404 });
    }

    const meta = metaRows[0];
    const includeZoneStr = String(meta.include_zone ?? "");
    const targetZones = includeZoneStr
      .split(",")
      .map((z) => z.trim())
      .filter((z) => /^\d+$/.test(z))
      .map(Number);
    const targetRegions = {
      region1: String(meta.include_region1 ?? ""),
      region2: String(meta.include_region2 ?? "")
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
    };

    // 2) Summary
    const summarySql = replaceSqlParams(sections.get("summary")!, { policy_id: policyIdStr });
    const summaryRows = await runQuery(summarySql);
    const s = summaryRows?.[0] ?? {};
    const issued = safeInt(s.issued);
    const used = safeInt(s.used);
    const postDiscountRevenue = safeFloat(s.revenue); // revenue = 쿠폰 할인 후
    const discount = safeFloat(s.discount);
    const totalRevenue = Math.round((postDiscountRevenue + discount) * 100) / 100;

    const summary: CampaignSummary = {
      issued,
      used,
      usage_rate: issued > 0 ? Math.round((used / issued) * 10000) / 100 : 0,
      revenue: totalRevenue,
      discount,
      net_revenue: postDiscountRevenue,
      roas: discount > 0 ? Math.round((totalRevenue / discount) * 10000) / 100 : 0,
    };

    // 3) Crosstab
    const crosstabSql = replaceSqlParams(sections.get("crosstab")!, { policy_id: policyIdStr });
    const crosstabRows = await runQuery(crosstabSql);
    const crosstab = buildCrosstab(crosstabRows ?? []);

    // 4) Daily trend
    const dailySql = replaceSqlParams(sections.get("daily_trend")!, { policy_id: policyIdStr });
    const dailyRows = await runQuery(dailySql);
    const dailyTrend: DailyTrendItem[] = (dailyRows ?? []).map((row) => ({
      date: String(row.date ?? ""),
      used_count: safeInt(row.used_count),
      revenue: safeFloat(row.revenue),
      discount: safeFloat(row.discount),
    }));

    const result: CampaignDetailResult = {
      summary,
      crosstab,
      daily_trend: dailyTrend,
      target_zones: targetZones,
      target_regions: targetRegions,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[roas/campaign/detail]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add app/api/roas/campaigns/route.ts app/api/roas/campaign/detail/route.ts
git commit -m "feat(roas): add API routes for campaigns list and campaign detail"
```

---

## Task 7: API Route -- campaign/impact (복합 오케스트레이션)

**Files:**
- Create: `app/api/roas/campaign/impact/route.ts`

이 라우트는 가장 복잡하다. Python `get_campaign_impact()` (~230줄)의 전체 로직을 포팅한다. 메타 조회 -> 조건별 Analysis A/B/C 쿼리 조립 -> DID -> Verdict 순서로 실행한다.

- [ ] **Step 1: `app/api/roas/campaign/impact/route.ts` 생성**

```ts
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  parseSqlSections,
  replaceSqlParams,
  toIntInClause,
  toStrInClause,
  buildAnalysisA,
  buildAnalysisB,
  buildAnalysisC,
  buildDailySeries,
  computeVerdict,
  safeInt,
  safeFloat,
  BQ_ERROR_MSG,
} from "@/lib/roas";
import type { AnalysisC, CampaignImpactResult } from "@/lib/roas";

/** 날짜 문자열 연산 헬퍼 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  return addDays(today(), -1);
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function dateDiffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const policyId = Number(body.policy_id);

  if (!policyId || policyId <= 0) {
    return NextResponse.json({ error: "policy_id is required" }, { status: 400 });
  }

  try {
    const rawSql = loadRoasSql("campaign-impact.sql");
    const sections = parseSqlSections(rawSql);
    const policyIdStr = String(policyId);

    // ── 메타 조회 ──
    const metaSql = replaceSqlParams(sections.get("meta")!, { policy_id: policyIdStr });
    const metaRows = await runQuery(metaSql);
    if (!metaRows || metaRows.length === 0) {
      return NextResponse.json({ error: "policy not found" }, { status: 404 });
    }

    const m = metaRows[0];
    const campStartRaw = m.usable_start_on;
    const campEndRaw = m.usable_end_on;
    const campStart = campStartRaw ? String(campStartRaw).slice(0, 10) : today();
    const campEndDate = campEndRaw
      ? minDate(String(campEndRaw).slice(0, 10), yesterday())
      : yesterday();
    const campEnd = campEndDate;
    const isOngoing = campEndRaw ? String(campEndRaw).slice(0, 10) >= today() : false;

    const includeZoneStr = String(m.include_zone ?? "");
    const targetZones = includeZoneStr
      .split(",")
      .map((z) => z.trim())
      .filter((z) => /^\d+$/.test(z))
      .map(Number);
    const region1 = String(m.include_region1 ?? "");

    // ── Analysis A ──
    let analysisASql: string;
    if (targetZones.length > 0) {
      analysisASql = replaceSqlParams(sections.get("analysis_a_with_zones")!, {
        policy_id: policyIdStr,
        target_zones: toIntInClause(targetZones),
        camp_start: `'${campStart}'`,
        camp_end: `'${campEnd}'`,
      });
    } else if (region1) {
      analysisASql = replaceSqlParams(sections.get("analysis_a_with_region")!, {
        policy_id: policyIdStr,
        camp_start: `'${campStart}'`,
        camp_end: `'${campEnd}'`,
        region1: `'${region1}'`,
      });
    } else {
      analysisASql = replaceSqlParams(sections.get("analysis_a_no_filter")!, {
        policy_id: policyIdStr,
        camp_start: `'${campStart}'`,
        camp_end: `'${campEnd}'`,
      });
    }
    const aRows = await runQuery(analysisASql);
    const analysisA = buildAnalysisA(aRows ?? []);

    // ── Analysis B: 전후 비교 ──
    const durationDays = dateDiffDays(campStart, campEnd);
    const beforeEnd = addDays(campStart, -1);
    const beforeStart = addDays(beforeEnd, -durationDays);

    // B 분석용 존 목록
    let bZones = targetZones.length > 0 ? [...targetZones] : [];
    if (bZones.length === 0 && region1) {
      const zoneFetchSql = replaceSqlParams(sections.get("zone_fetch_by_region")!, {
        region1: `'${region1}'`,
      });
      const zoneRows = await runQuery(zoneFetchSql);
      bZones = (zoneRows ?? []).map((r) => Number(r.id ?? 0));
    }

    let analysisB;
    if (bZones.length > 0) {
      const bSql = replaceSqlParams(sections.get("analysis_b")!, {
        before_start: `'${beforeStart}'`,
        before_end: `'${beforeEnd}'`,
        camp_start: `'${campStart}'`,
        camp_end: `'${campEnd}'`,
        b_zones: toIntInClause(bZones),
      });
      const bRows = await runQuery(bSql);
      analysisB = buildAnalysisB(bRows ?? [], beforeStart, beforeEnd, campStart, campEnd, isOngoing);
    } else {
      analysisB = buildAnalysisB([], beforeStart, beforeEnd, campStart, campEnd, isOngoing);
    }

    // ── Analysis C: DID ──
    let analysisC: AnalysisC = {
      title: "타겟존 vs 비타겟존 (DID)",
      note: "계산 불가 — 비교 대상 존 없음",
      daily_series: [],
      camp_start: "",
    };
    let didPossible = false;
    let controlZones: number[] = [];

    if (targetZones.length > 0 && region1) {
      // 비타겟존 = 동일 region1 내 target 제외
      const controlSql = replaceSqlParams(sections.get("control_zones_with_region")!, {
        region1: `'${region1}'`,
        target_zones: toIntInClause(targetZones),
      });
      const controlRows = await runQuery(controlSql);
      controlZones = (controlRows ?? []).map((r) => Number(r.id ?? 0));
      didPossible = controlZones.length > 0;
    } else if (targetZones.length > 0 && !region1) {
      // target_zones에서 region1 추출 후 비타겟존 선정
      const regionSql = replaceSqlParams(sections.get("control_zones_infer_region")!, {
        target_zones: toIntInClause(targetZones),
      });
      const regionRows = await runQuery(regionSql);
      if (regionRows && regionRows.length > 0) {
        const regions = regionRows.map((r) => String(r.region1 ?? ""));
        const controlSql2 = replaceSqlParams(sections.get("control_zones_from_regions")!, {
          regions: toStrInClause(regions),
          target_zones: toIntInClause(targetZones),
        });
        const controlRows2 = await runQuery(controlSql2);
        controlZones = (controlRows2 ?? []).map((r) => Number(r.id ?? 0));
        didPossible = controlZones.length > 0;
      }
    }

    if (didPossible) {
      const allZones = [...targetZones, ...controlZones];
      const commonParams = {
        target_zones: toIntInClause(targetZones),
        before_start: `'${beforeStart}'`,
        before_end: `'${beforeEnd}'`,
        camp_start: `'${campStart}'`,
        camp_end: `'${campEnd}'`,
        all_zones: toIntInClause(allZones),
      };

      const didSql = replaceSqlParams(sections.get("did")!, commonParams);
      const didRows = await runQuery(didSql);
      analysisC = buildAnalysisC(didRows ?? []);

      // Daily time series
      const dailyDidSql = replaceSqlParams(sections.get("did_daily")!, commonParams);
      const dailyRows = await runQuery(dailyDidSql);
      analysisC.daily_series = buildDailySeries(dailyRows ?? []);
      analysisC.camp_start = campStart;
    }

    // ── Verdict ──
    const verdictSummarySql = replaceSqlParams(sections.get("verdict_summary")!, { policy_id: policyIdStr });
    const verdictRevSql = replaceSqlParams(sections.get("verdict_revenue")!, { policy_id: policyIdStr });

    const [sRows, rRows] = await Promise.all([
      runQuery(verdictSummarySql),
      runQuery(verdictRevSql),
    ]);

    const issued = safeInt(sRows?.[0]?.issued);
    const used = safeInt(sRows?.[0]?.used);
    const usageRate = issued > 0 ? (used / issued) * 100 : 0;

    const postDiscountRev = safeFloat(rRows?.[0]?.post_discount_revenue);
    const totalDiscount = safeFloat(rRows?.[0]?.total_discount);
    const totalRevenue = postDiscountRev + totalDiscount;
    const roas = totalDiscount > 0 ? (totalRevenue / totalDiscount) * 100 : 0;

    const verdict = computeVerdict(roas, usageRate, analysisB, analysisC, didPossible);

    const result: CampaignImpactResult = {
      analysis_a: analysisA,
      analysis_b: analysisB,
      analysis_c: analysisC,
      verdict,
      is_ongoing: isOngoing,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[roas/campaign/impact]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/api/roas/campaign/impact/route.ts
git commit -m "feat(roas): add campaign/impact API route with full DID analysis + verdict"
```

---

## Task 8: API Routes -- scenarios (Redis CRUD) + vs-forecast

**Files:**
- Create: `app/api/roas/scenarios/route.ts`
- Create: `app/api/roas/campaign/vs-forecast/route.ts`

- [ ] **Step 1: `app/api/roas/scenarios/route.ts` 생성**

GET (목록) + POST (저장) 핸들러:

```ts
import { NextRequest, NextResponse } from "next/server";
import { saveScenario, listScenarios } from "@/lib/roas";

export async function GET() {
  try {
    const scenarios = await listScenarios();
    return NextResponse.json(
      scenarios.map((s) => ({
        id: s.id,
        name: s.name ?? "",
        created_at: s.created_at ?? "",
        zone_ids: (s.inputs as Record<string, unknown>)?.zone_ids ?? [],
        start_date: (s.inputs as Record<string, unknown>)?.start_date ?? "",
        end_date: (s.inputs as Record<string, unknown>)?.end_date ?? "",
      }))
    );
  } catch (err) {
    console.error("[roas/scenarios] list error", err);
    return NextResponse.json(
      { error: "시나리오 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = body.name;
  const inputs = body.inputs;
  const results = body.results;

  if (!name || !inputs || !results) {
    return NextResponse.json(
      { error: "name, inputs, results are required" },
      { status: 400 }
    );
  }

  try {
    const result = await saveScenario({ name, inputs, results });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[roas/scenarios] save error", err);
    return NextResponse.json(
      { error: "시나리오 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: `app/api/roas/campaign/vs-forecast/route.ts` 생성**

Python `api_vs_forecast`를 포팅한다. 시나리오 조회(Redis) + 캠페인 상세(BQ) + 비교 로직:

```ts
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  parseSqlSections,
  replaceSqlParams,
  getScenario,
  safeInt,
  safeFloat,
  BQ_ERROR_MSG,
} from "@/lib/roas";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const policyId = Number(body.policy_id);
  const scenarioId = String(body.scenario_id ?? "");

  if (!policyId || !scenarioId) {
    return NextResponse.json(
      { error: "policy_id and scenario_id are required" },
      { status: 400 }
    );
  }

  try {
    // 시나리오 조회
    const scenario = await getScenario(scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { error: "시나리오를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 캠페인 상세 조회 (campaign-detail.sql의 summary 섹션 재사용)
    const rawSql = loadRoasSql("campaign-detail.sql");
    const sections = parseSqlSections(rawSql);
    const policyIdStr = String(policyId);

    // meta 확인
    const metaSql = replaceSqlParams(sections.get("meta")!, { policy_id: policyIdStr });
    const metaRows = await runQuery(metaSql);
    if (!metaRows || metaRows.length === 0) {
      return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
    }

    // summary
    const summarySql = replaceSqlParams(sections.get("summary")!, { policy_id: policyIdStr });
    const summaryRows = await runQuery(summarySql);
    const s = summaryRows?.[0] ?? {};

    const actualIssued = safeInt(s.issued);
    const actualUsed = safeInt(s.used);
    const postDiscountRevenue = safeFloat(s.revenue);
    const actualDiscount = safeFloat(s.discount);
    const actualRevenue = Math.round((postDiscountRevenue + actualDiscount) * 100) / 100;
    const actualRoas = actualDiscount > 0
      ? Math.round((actualRevenue / actualDiscount) * 10000) / 100
      : 0;
    const actualConvRate = actualIssued > 0
      ? Math.round((actualUsed / actualIssued) * 10000) / 100
      : 0;

    // 예측 데이터
    const pred = (scenario.results ?? {}) as Record<string, unknown>;
    const predConversions = Number(pred.conversions ?? 0);
    const predRevenue = Number(pred.revenue ?? 0);
    const predRoas = Number(pred.roas ?? 0);

    const inputs = (scenario.inputs ?? {}) as Record<string, unknown>;
    let predConvRate: number;
    if (Array.isArray(inputs.coupons) && inputs.coupons.length > 0) {
      const totalQty = (inputs.coupons as Array<Record<string, unknown>>).reduce(
        (sum, c) => sum + Number(c.qty ?? 0),
        0
      );
      predConvRate = totalQty > 0
        ? Math.round((predConversions / totalQty) * 10000) / 100
        : 0;
    } else {
      predConvRate = Number(inputs.conv_rate ?? 0);
    }

    const comparison = {
      scenario_name: scenario.name ?? "",
      items: [
        {
          label: "전환건수",
          predicted: predConversions,
          actual: actualUsed,
          diff_pct: predConversions
            ? Math.round(((actualUsed - predConversions) / predConversions) * 1000) / 10
            : 0,
        },
        {
          label: "매출",
          predicted: predRevenue,
          actual: actualRevenue,
          diff_pct: predRevenue
            ? Math.round(((actualRevenue - predRevenue) / predRevenue) * 1000) / 10
            : 0,
        },
        {
          label: "ROAS",
          predicted: predRoas,
          actual: actualRoas,
          diff: Math.round((actualRoas - predRoas) * 10) / 10,
          unit: "%p",
        },
        {
          label: "전환율",
          predicted: predConvRate,
          actual: actualConvRate,
          diff: Math.round((actualConvRate - predConvRate) * 10) / 10,
          unit: "%p",
        },
      ],
    };

    return NextResponse.json(comparison);
  } catch (err) {
    console.error("[roas/campaign/vs-forecast]", err);
    return NextResponse.json(
      { error: "예측 vs 실적 비교에 실패했습니다." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add app/api/roas/scenarios/route.ts app/api/roas/campaign/vs-forecast/route.ts
git commit -m "feat(roas): add scenarios CRUD (Upstash Redis) and vs-forecast API routes"
```

---

## Endpoint Mapping (Python -> Next.js)

| Python (FastAPI) | Next.js (App Router) | Method |
|---|---|---|
| `GET /api/regions` | `GET /api/roas/regions` | GET |
| `GET /api/regions/{region1}` | `GET /api/roas/regions/[region1]` | GET |
| `GET /api/zones` | `GET /api/roas/zones` | GET |
| `POST /api/performance` | `POST /api/roas/performance` | POST |
| `GET /api/campaigns` | `GET /api/roas/campaigns` | GET |
| `POST /api/campaign/detail` | `POST /api/roas/campaign/detail` | POST |
| `POST /api/campaign/impact` | `POST /api/roas/campaign/impact` | POST |
| `POST /api/scenarios` | `POST /api/roas/scenarios` | POST |
| `GET /api/scenarios` | `GET /api/roas/scenarios` | GET |
| `POST /api/campaign/vs-forecast` | `POST /api/roas/campaign/vs-forecast` | POST |

> 모든 엔드포인트에 `/roas` 프리픽스를 추가하여 기존 allocation API와 네임스페이스를 분리한다.

---

## Notes

- **인증**: Python 버전의 `require_auth_or_401`은 NextAuth.js 미들웨어로 대체한다 (이미 프로젝트에 `(auth)` route group 존재). API route 인증은 별도 작업(P3 이후)에서 처리.
- **SQL injection 방지**: `toStrInClause()`에서 단따옴표 이스케이프 처리. `toIntInClause()`는 `Number()`로 강제 변환하여 안전.
- **타임스탬프 처리**: BigQuery TIMESTAMP를 `.slice(0, 10)`으로 날짜만 추출. Python의 `pd.Timestamp().date()`와 동등.
- **에러 응답**: Python 원본의 한글 에러 메시지를 그대로 유지한다.
