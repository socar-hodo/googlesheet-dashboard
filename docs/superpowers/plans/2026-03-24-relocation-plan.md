# 차량 재배치 의사결정 도구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** region2(시/군/구) 단위 복합 스코어를 BigQuery로 실시간 산출하여 어느 존에서 어느 존으로 차량을 이동해야 하는지 판단하는 재배치 의사결정 도구를 구현한다.

**Architecture:** 신차 배분(`lib/allocation.ts`)과 동일한 3-레이어 패턴 — `types/` → `lib/` (pure logic + BigQuery) → `app/api/` (POST route) → `components/` (Client Component UI). 스코어 계산과 추천은 서버에서 수행하고 JSON을 클라이언트로 반환한다.

**Tech Stack:** Next.js 15 App Router, TypeScript, Vitest (TDD), Recharts (BarChart), shadcn/ui, Tailwind v4, @google-cloud/bigquery, google-auth-library

---

## File Map

| 파일 | 역할 | 신규/수정 |
|------|------|----------|
| `types/relocation.ts` | RelocationParams, RelocationRow, RelocationRecommendation, RelocationResult | 신규 |
| `sql/relocation.sql` | BigQuery 집계 쿼리 (5 CTEs, 파라미터 치환) | 신규 |
| `lib/relocation.ts` | validateParams, loadSql, computeScore, computeRecommendations, runRelocation | 신규 |
| `lib/relocation.test.ts` | 순수 함수 단위 테스트 | 신규 |
| `app/api/relocation/run/route.ts` | POST 핸들러 | 신규 |
| `app/(dashboard)/relocation/layout.tsx` | 패스스루 레이아웃 | 신규 |
| `app/(dashboard)/relocation/page.tsx` | Server Component | 신규 |
| `components/relocation/relocation-table.tsx` | 존별 스코어 테이블 (색상 하이라이트) | 신규 |
| `components/relocation/relocation-chart.tsx` | 존별 스코어 막대 차트 (Recharts) | 신규 |
| `components/relocation/relocation-recommendations.tsx` | 재배치 추천 카드 목록 | 신규 |
| `components/relocation/relocation-form.tsx` | Client Component: 필터 폼 + fetch 조율 | 신규 |
| `components/layout/sidebar.tsx` | "차량 재배치" 메뉴 추가 | 수정 |
| `proxy.ts` | `/relocation` 보호 경로 추가 | 수정 |

---

## Task 1: 타입 정의 (`types/relocation.ts`)

**Files:**
- Create: `types/relocation.ts`

- [ ] **Step 1: 파일 작성**

```typescript
// types/relocation.ts

export const PAST_DAYS_OPTIONS = [7, 14, 30] as const;
export const FUTURE_DAYS_OPTIONS = [3, 7, 14] as const;

export interface RelocationParams {
  region1: string;       // "전체" 또는 특정 시/도
  pastDays: 7 | 14 | 30;
  futureDays: 3 | 7 | 14;
  weights: {
    utilization: number;     // α (0~1)
    revenue: number;         // β (0~1)
    prereservation: number;  // γ (0~1), 합계 = 1.0
  };
}

export interface RelocationRow {
  region1: string;
  region2: string;
  utilRate: number;        // 가동률 (0~1)
  revPerCar: number;       // 대당매출 (원)
  prereservRate: number;   // 사전예약률 (0~1)
  carCount: number;        // 차량 수 (past_operation 기준)
  score: number;           // 복합 스코어 (0~1)
  tier: "top" | "mid" | "bottom";  // 상위20% / 중간 / 하위20%
}

export interface RelocationRecommendation {
  fromZone: string;    // 송출 존 (region2)
  toZone: string;      // 수신 존 (region2)
  carCount: number;    // 권장 이동 대수 (fromZone.carCount × 0.2, 최소 1)
  sameRegion: boolean; // 동일 region1 여부
}

export interface RelocationResult {
  rows: RelocationRow[];
  recommendations: RelocationRecommendation[];
  fetchedAt: string;   // ISO 8601
}
```

- [ ] **Step 2: 커밋**

```bash
git add types/relocation.ts
git commit -m "feat: add relocation types"
```

---

## Task 2: SQL 쿼리 (`sql/relocation.sql`)

**Files:**
- Create: `sql/relocation.sql`

- [ ] **Step 1: SQL 파일 작성**

5개 CTE: past_operation → past_revenue → reserved_base → reserved_slots → future_reservation

```sql
-- 파라미터: {region1_filter} | {past_days} | {future_days}
-- region1_filter = "전체" 이면 WHERE 절 없음 (치환 방식으로 처리)

WITH past_operation AS (
  SELECT
    region1,
    region2,
    SAFE_DIVIDE(SUM(op_min), SUM(dp_min)) AS util_rate,
    COUNT(DISTINCT car_id)                 AS car_count
  FROM `socar-data.socar_biz.operation_per_car_daily_v2`
  WHERE date BETWEEN DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL {past_days} DAY)
                 AND DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
    AND sharing_type IN ('socar', 'zplus')
    {region1_where}
  GROUP BY region1, region2
),
past_revenue AS (
  SELECT
    region1,
    region2,
    SAFE_DIVIDE(SUM(revenue), COUNT(DISTINCT car_id)) AS rev_per_car
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily`
  WHERE date BETWEEN DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL {past_days} DAY)
                 AND DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
    AND car_sharing_type IN ('socar', 'zplus')  -- past_operation과 동일 코호트 유지
    {region1_where}
  GROUP BY region1, region2
),
reserved_base AS (
  -- carzone_info_daily의 zone 식별 컬럼은 `id` (zone_id 아님 — MEMORY.md 기준)
  -- region1 필터는 JOIN 후 z.region1 기준으로 적용 ({region1_where_z})
  SELECT
    r.car_id,
    r.start_at,
    r.end_at,
    z.region1,
    z.region2
  FROM `socar-data.tianjin_replica.reservation_info` r
  JOIN `socar-data.socar_biz_base.carzone_info_daily` z
    ON r.zone_id = z.id
   AND DATE(r.start_at, "Asia/Seoul") = z.date
  WHERE r.state IN (0, 1, 2, 3)
    AND r.member_imaginary IN (0, 9)
    AND DATE(r.start_at, "Asia/Seoul") BETWEEN CURRENT_DATE("Asia/Seoul")
                                           AND DATE_ADD(CURRENT_DATE("Asia/Seoul"), INTERVAL {future_days} DAY)
    {region1_where_z}
),
reserved_slots AS (
  SELECT
    rb.region1,
    rb.region2,
    slot,
    TIMESTAMP_DIFF(
      LEAST(TIMESTAMP_ADD(slot, INTERVAL 1 HOUR), rb.end_at),
      GREATEST(slot, rb.start_at),
      MINUTE
    ) AS occupied_minutes
  FROM reserved_base rb
  CROSS JOIN UNNEST(GENERATE_TIMESTAMP_ARRAY(
    TIMESTAMP_TRUNC(rb.start_at, HOUR),
    TIMESTAMP_TRUNC(rb.end_at,   HOUR),
    INTERVAL 1 HOUR
  )) AS slot
  WHERE slot < rb.end_at
    AND slot >= rb.start_at
),
future_reservation AS (
  SELECT
    rs.region1,
    rs.region2,
    SAFE_DIVIDE(
      SUM(rs.occupied_minutes),
      SUM(h.dp_min)
    ) AS prereserv_rate
  FROM reserved_slots rs
  JOIN `socar-data.socar_biz.operation_per_car_hourly_v2` h
    ON rs.region1  = h.region1
   AND rs.region2  = h.region2
   AND TIMESTAMP_TRUNC(slot, HOUR) = h.datetime
  GROUP BY rs.region1, rs.region2
)
SELECT
  o.region1,
  o.region2,
  o.util_rate,
  r.rev_per_car,
  COALESCE(f.prereserv_rate, 0) AS prereserv_rate,
  o.car_count
FROM past_operation o
JOIN past_revenue r
  ON o.region1 = r.region1 AND o.region2 = r.region2
LEFT JOIN future_reservation f
  ON o.region1 = f.region1 AND o.region2 = f.region2
ORDER BY o.region1, o.region2
```

> 주의: `{region1_where}` 플레이스홀더는 loadSql에서 `AND region1 = '...'` 또는 빈 문자열로 치환된다.

- [ ] **Step 2: 커밋**

```bash
git add sql/relocation.sql
git commit -m "feat: add relocation BigQuery SQL"
```

---

## Task 3: 순수 함수 TDD (`lib/relocation.ts` — validateParams, loadSql, computeScore, computeRecommendations)

**Files:**
- Create: `lib/relocation.test.ts`
- Create: `lib/relocation.ts`

### Step 1~4: validateParams TDD

- [ ] **Step 1: validateParams 실패 테스트 작성**

```typescript
// lib/relocation.test.ts
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import {
  validateParams,
  loadSql,
  computeScore,
  computeRecommendations,
} from "./relocation";
import type { RelocationParams, RelocationRow } from "@/types/relocation";

const validParams: RelocationParams = {
  region1: "전체",
  pastDays: 14,
  futureDays: 7,
  weights: { utilization: 0.4, revenue: 0.4, prereservation: 0.2 },
};

describe("validateParams", () => {
  it("유효한 파라미터는 빈 배열 반환", () => {
    expect(validateParams(validParams)).toEqual([]);
  });

  it("허용되지 않는 pastDays는 오류", () => {
    expect(validateParams({ ...validParams, pastDays: 10 as 7 })).toHaveLength(1);
  });

  it("허용되지 않는 futureDays는 오류", () => {
    expect(validateParams({ ...validParams, futureDays: 5 as 3 })).toHaveLength(1);
  });

  it("weights 합계가 1.0이 아니면 오류", () => {
    expect(
      validateParams({
        ...validParams,
        weights: { utilization: 0.5, revenue: 0.5, prereservation: 0.2 },
      })
    ).toHaveLength(1);
  });

  it("region1에 단따옴표 포함 시 오류 (SQL injection)", () => {
    expect(validateParams({ ...validParams, region1: "서울'; DROP TABLE--" })).toHaveLength(1);
  });

  it("region1에 세미콜론 포함 시 오류", () => {
    expect(validateParams({ ...validParams, region1: "서울;명령어" })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run lib/relocation.test.ts
```
Expected: FAIL (validateParams not defined)

- [ ] **Step 3: validateParams 구현**

```typescript
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run lib/relocation.test.ts --reporter=verbose
```
Expected: validateParams describe 6/6 PASS

### Step 5~8: loadSql TDD

- [ ] **Step 5: loadSql 테스트 추가 (같은 파일)**

```typescript
describe("loadSql", () => {
  it("region1='전체'이면 {region1_where}, {region1_where_z} 모두 빈 문자열로 치환", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "relocation-test.sql");
    writeFileSync(tmpSql, "SELECT {past_days} AS p, {future_days} AS f {region1_where} {region1_where_z}");

    const result = loadSql(validParams, tmpSql);
    expect(result).toContain("14");
    expect(result).toContain("7");
    expect(result).not.toContain("{past_days}");
    expect(result).not.toContain("{region1_where}");
    expect(result).not.toContain("{region1_where_z}");
    expect(result).not.toContain("AND region1");
  });

  it("region1이 특정 값이면 {region1_where} → AND region1 = '...'", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "relocation-region.sql");
    writeFileSync(tmpSql, "WHERE 1=1 {region1_where}");

    const result = loadSql({ ...validParams, region1: "서울특별시" }, tmpSql);
    expect(result).toContain("AND region1 = '서울특별시'");
  });

  it("region1이 특정 값이면 {region1_where_z} → AND z.region1 = '...'", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "relocation-z.sql");
    writeFileSync(tmpSql, "WHERE 1=1 {region1_where_z}");

    const result = loadSql({ ...validParams, region1: "서울특별시" }, tmpSql);
    expect(result).toContain("AND z.region1 = '서울특별시'");
  });
});
```

- [ ] **Step 6: 테스트 실패 확인**

```bash
npx vitest run lib/relocation.test.ts
```
Expected: FAIL (loadSql not defined)

- [ ] **Step 7: loadSql 구현 (lib/relocation.ts에 추가)**

```typescript
export function loadSql(params: RelocationParams, sqlPath: string = DEFAULT_SQL_PATH): string {
  const raw = readFileSync(sqlPath, "utf-8");
  const region1Where  = params.region1 === "전체" ? "" : `AND region1 = '${params.region1}'`;
  const region1WhereZ = params.region1 === "전체" ? "" : `AND z.region1 = '${params.region1}'`;

  return raw
    .replace(/\{past_days\}/g,       String(params.pastDays))
    .replace(/\{future_days\}/g,     String(params.futureDays))
    .replace(/\{region1_where\}/g,   region1Where)
    .replace(/\{region1_where_z\}/g, region1WhereZ);
}
```

- [ ] **Step 8: 테스트 통과 확인**

```bash
npx vitest run lib/relocation.test.ts --reporter=verbose
```
Expected: loadSql describe 2/2 PASS

### Step 9~14: computeScore TDD

- [ ] **Step 9: computeScore 테스트 추가**

```typescript
describe("computeScore", () => {
  const makeRow = (util: number, rev: number, pre: number): Omit<RelocationRow, "score" | "tier"> => ({
    region1: "서울", region2: "강남구",
    utilRate: util, revPerCar: rev, prereservRate: pre, carCount: 10,
  });

  const weights = { utilization: 0.4, revenue: 0.4, prereservation: 0.2 };

  it("여러 존이면 Min-Max 정규화 후 가중 합산", () => {
    const raw = [makeRow(0.5, 100000, 0.3), makeRow(0.8, 200000, 0.6)];
    const result = computeScore(raw as RelocationRow[], weights);
    // 두 번째 존이 모든 지표에서 높으므로 score가 더 높아야 함
    expect(result[1].score).toBeGreaterThan(result[0].score);
  });

  it("단일 존(min==max)이면 score = 0.5", () => {
    const raw = [makeRow(0.6, 150000, 0.4)];
    const result = computeScore(raw as RelocationRow[], weights);
    expect(result[0].score).toBeCloseTo(0.5);
  });

  it("score 범위는 0~1", () => {
    const raw = [
      makeRow(0.1, 50000, 0.1),
      makeRow(0.5, 100000, 0.5),
      makeRow(0.9, 200000, 0.9),
    ];
    const result = computeScore(raw as RelocationRow[], weights);
    result.forEach((r) => {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    });
  });

  it("상위 20%는 tier=top, 하위 20%는 tier=bottom", () => {
    // 5개 존 → 상위 1개 top, 하위 1개 bottom
    const raw = Array.from({ length: 5 }, (_, i) =>
      makeRow(i * 0.2, i * 50000, i * 0.2)
    );
    const result = computeScore(raw as RelocationRow[], weights);
    const sorted = [...result].sort((a, b) => b.score - a.score);
    expect(sorted[0].tier).toBe("top");
    expect(sorted[sorted.length - 1].tier).toBe("bottom");
  });

  it("20% 경계: 4개 존 → Math.ceil(4*0.2)=1개씩 top/bottom", () => {
    const raw = Array.from({ length: 4 }, (_, i) =>
      makeRow(i * 0.25, i * 40000, i * 0.25)
    );
    const result = computeScore(raw as RelocationRow[], weights);
    expect(result.filter((r) => r.tier === "top").length).toBeGreaterThanOrEqual(1);
    expect(result.filter((r) => r.tier === "bottom").length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 10: 테스트 실패 확인**

```bash
npx vitest run lib/relocation.test.ts
```
Expected: FAIL (computeScore not defined)

- [ ] **Step 11: computeScore 구현 (lib/relocation.ts에 추가)**

```typescript
export function computeScore(
  rows: Omit<RelocationRow, "score" | "tier">[],
  weights: RelocationParams["weights"]
): RelocationRow[] {
  const { utilization, revenue, prereservation } = weights;

  const utils  = rows.map((r) => r.utilRate);
  const revs   = rows.map((r) => r.revPerCar);
  const pres   = rows.map((r) => r.prereservRate);

  const minMax = (arr: number[]) => ({
    min: Math.min(...arr),
    max: Math.max(...arr),
  });

  const mmUtil = minMax(utils);
  const mmRev  = minMax(revs);
  const mmPre  = minMax(pres);

  const norm = (v: number, min: number, max: number) =>
    min === max ? 0.5 : (v - min) / (max - min);

  const scored = rows.map((r) => ({
    ...r,
    score:
      utilization   * norm(r.utilRate,     mmUtil.min, mmUtil.max) +
      revenue       * norm(r.revPerCar,    mmRev.min,  mmRev.max)  +
      prereservation * norm(r.prereservRate, mmPre.min,  mmPre.max),
    tier: "mid" as RelocationRow["tier"],
  }));

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const n      = sorted.length;
  const topN   = Math.ceil(n * 0.2);
  const botN   = Math.ceil(n * 0.2);

  const topSet = new Set(sorted.slice(0, topN).map((r) => `${r.region1}|${r.region2}`));
  const botSet = new Set(sorted.slice(n - botN).map((r) => `${r.region1}|${r.region2}`));

  return scored.map((r) => {
    const key = `${r.region1}|${r.region2}`;
    if (topSet.has(key)) return { ...r, tier: "top" as const };
    if (botSet.has(key)) return { ...r, tier: "bottom" as const };
    return r;
  });
}
```

- [ ] **Step 12: 테스트 통과 확인**

```bash
npx vitest run lib/relocation.test.ts --reporter=verbose
```
Expected: computeScore describe 5/5 PASS

### Step 13~16: computeRecommendations TDD

- [ ] **Step 13: computeRecommendations 테스트 추가**

```typescript
describe("computeRecommendations", () => {
  const makeScored = (
    r1: string, r2: string, tier: RelocationRow["tier"], count: number
  ): RelocationRow => ({
    region1: r1, region2: r2,
    utilRate: 0, revPerCar: 0, prereservRate: 0,
    carCount: count, score: 0, tier,
  });

  it("bottom 존은 top 존으로 매칭", () => {
    const rows = [
      makeScored("서울", "강남구", "top",    20),
      makeScored("서울", "중구",   "bottom", 10),
    ];
    const recs = computeRecommendations(rows);
    expect(recs).toHaveLength(1);
    expect(recs[0].fromZone).toBe("중구");
    expect(recs[0].toZone).toBe("강남구");
  });

  it("이동 대수 = carCount × 0.2 반올림, 최소 1", () => {
    const rows = [
      makeScored("서울", "강남구", "top",    20),
      makeScored("서울", "중구",   "bottom", 3),
    ];
    const recs = computeRecommendations(rows);
    expect(recs[0].carCount).toBe(1); // Math.round(3 * 0.2) = 1
  });

  it("동일 region1 우선 매칭", () => {
    const rows = [
      makeScored("서울", "강남구", "top",    20),
      makeScored("부산", "해운대구", "top",  15),
      makeScored("서울", "중구",  "bottom",  10),
    ];
    const recs = computeRecommendations(rows);
    const fromJung = recs.find((r) => r.fromZone === "중구");
    expect(fromJung?.toZone).toBe("강남구");
    expect(fromJung?.sameRegion).toBe(true);
  });

  it("같은 region1 top 없으면 타 지역으로 매칭", () => {
    const rows = [
      makeScored("부산", "해운대구", "top",  15),
      makeScored("서울", "중구",    "bottom", 10),
    ];
    const recs = computeRecommendations(rows);
    expect(recs[0].sameRegion).toBe(false);
  });

  it("top이 없으면 빈 배열 반환", () => {
    const rows = [makeScored("서울", "중구", "bottom", 10)];
    expect(computeRecommendations(rows)).toEqual([]);
  });
});
```

- [ ] **Step 14: 테스트 실패 확인**

```bash
npx vitest run lib/relocation.test.ts
```
Expected: FAIL (computeRecommendations not defined)

- [ ] **Step 15: computeRecommendations 구현 (lib/relocation.ts에 추가)**

```typescript
export function computeRecommendations(rows: RelocationRow[]): RelocationRecommendation[] {
  const bottomRows = rows.filter((r) => r.tier === "bottom");
  const topRows    = rows.filter((r) => r.tier === "top");

  if (topRows.length === 0) return [];

  return bottomRows.map((from) => {
    const sameRegionTop = topRows.find((t) => t.region1 === from.region1);
    const target = sameRegionTop ?? topRows[0];

    return {
      fromZone:   from.region2,
      toZone:     target.region2,
      carCount:   Math.max(1, Math.round(from.carCount * 0.2)),
      sameRegion: target.region1 === from.region1,
    };
  });
}
```

- [ ] **Step 16: 전체 테스트 통과 확인**

```bash
npx vitest run lib/relocation.test.ts --reporter=verbose
```
Expected: 전체 describe 모두 PASS

- [ ] **Step 17: 커밋**

```bash
git add lib/relocation.ts lib/relocation.test.ts
git commit -m "feat: add relocation pure functions with tests"
```

---

## Task 4: runRelocation + API Route

**Files:**
- Modify: `lib/relocation.ts` (runRelocation 추가)
- Create: `app/api/relocation/run/route.ts`

- [ ] **Step 1: runRelocation 구현 (lib/relocation.ts에 추가)**

allocation.ts의 runAllocation 패턴 그대로 따름:

```typescript
export async function runRelocation(params: RelocationParams): Promise<RelocationResult> {
  const sql = loadSql(params);
  const rawRows = await runQuery(sql);
  if (!rawRows) {
    throw new Error("BigQuery가 설정되지 않았습니다 (GOOGLE_APPLICATION_CREDENTIALS_B64).");
  }

  const baseRows = rawRows.map((r) => ({
    region1:       String(r.region1 ?? ""),
    region2:       String(r.region2 ?? ""),
    utilRate:      Number(r.util_rate     ?? 0),
    revPerCar:     Number(r.rev_per_car   ?? 0),
    prereservRate: Number(r.prereserv_rate ?? 0),
    carCount:      Number(r.car_count     ?? 0),
    score:         0,
    tier:          "mid" as RelocationRow["tier"],
  }));

  const scored  = computeScore(baseRows, params.weights);
  const recommendations = computeRecommendations(scored);

  return {
    rows: scored,
    recommendations,
    fetchedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: API route 작성**

```typescript
// app/api/relocation/run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateParams, runRelocation } from "@/lib/relocation";
import type { RelocationParams } from "@/types/relocation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const params: RelocationParams = {
    region1:    body.region1    ?? "전체",
    pastDays:   Number(body.pastDays   ?? 14),
    futureDays: Number(body.futureDays ?? 7),
    weights: {
      utilization:    Number(body.weights?.utilization    ?? 0.4),
      revenue:        Number(body.weights?.revenue        ?? 0.4),
      prereservation: Number(body.weights?.prereservation ?? 0.2),
    },
  };

  const errors = validateParams(params);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const result = await runRelocation(params);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[relocation/run]", err);
    let message = "BQ 실행 중 오류가 발생했습니다. 서버 로그를 확인해주세요.";
    if (err instanceof Error) {
      if (err.message.includes("ENOENT")) {
        message = "SQL 파일을 찾을 수 없습니다 (sql/relocation.sql).";
      } else if (err.message.includes("GOOGLE_APPLICATION_CREDENTIALS")) {
        message = "BigQuery 인증이 설정되지 않았습니다 (GOOGLE_APPLICATION_CREDENTIALS_B64).";
      }
    }
    return NextResponse.json({ errors: [message] }, { status: 500 });
  }
}
```

- [ ] **Step 3: 테스트 재실행으로 기존 테스트 여전히 통과 확인**

```bash
npx vitest run lib/relocation.test.ts
```
Expected: PASS (runRelocation은 BQ 의존성으로 테스트 불필요)

- [ ] **Step 4: 커밋**

```bash
git add lib/relocation.ts app/api/relocation/run/route.ts
git commit -m "feat: add runRelocation and API route"
```

---

## Task 5: 스코어 테이블 컴포넌트 (`relocation-table.tsx`)

**Files:**
- Create: `components/relocation/relocation-table.tsx`

allocation의 results-tabs.tsx 구조 참고. 상위 20% 초록, 하위 20% 빨강 하이라이트.

- [ ] **Step 1: 컴포넌트 작성**

```typescript
// components/relocation/relocation-table.tsx
import type { RelocationRow } from "@/types/relocation";
import { cn } from "@/lib/utils";

interface Props {
  rows: RelocationRow[];
}

export function RelocationTable({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left">시/도</th>
            <th className="px-3 py-2 text-left">시/군/구</th>
            <th className="px-3 py-2 text-right">가동률</th>
            <th className="px-3 py-2 text-right">대당매출</th>
            <th className="px-3 py-2 text-right">사전예약률</th>
            <th className="px-3 py-2 text-right">종합스코어</th>
            <th className="px-3 py-2 text-right">차량수</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={`${row.region1}-${row.region2}`}
              className={cn(
                "border-b last:border-0 transition-colors",
                row.tier === "top"    && "bg-green-50 dark:bg-green-950/30",
                row.tier === "bottom" && "bg-red-50 dark:bg-red-950/30"
              )}
            >
              <td className="px-3 py-2 text-muted-foreground">{row.region1}</td>
              <td className="px-3 py-2 font-medium">{row.region2}</td>
              <td className="px-3 py-2 text-right">{(row.utilRate * 100).toFixed(1)}%</td>
              <td className="px-3 py-2 text-right">{Math.round(row.revPerCar / 10000).toLocaleString()}만원</td>
              <td className="px-3 py-2 text-right">{(row.prereservRate * 100).toFixed(1)}%</td>
              <td className="px-3 py-2 text-right font-semibold">{row.score.toFixed(3)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{row.carCount}대</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/relocation/relocation-table.tsx
git commit -m "feat: add relocation score table component"
```

---

## Task 6: 막대 차트 컴포넌트 (`relocation-chart.tsx`)

**Files:**
- Create: `components/relocation/relocation-chart.tsx`

Recharts BarChart. 신차 배분의 ScoreRationale에서 Recharts 사용 패턴 참고.

- [ ] **Step 1: 컴포넌트 작성**

```typescript
// components/relocation/relocation-chart.tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { RelocationRow } from "@/types/relocation";

interface Props {
  rows: RelocationRow[];
}

const TIER_COLOR: Record<RelocationRow["tier"], string> = {
  top:    "#22c55e",  // green-500
  mid:    "#94a3b8",  // slate-400
  bottom: "#ef4444",  // red-500
};

export function RelocationChart({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const data   = sorted.map((r) => ({
    name:  r.region2,
    score: parseFloat(r.score.toFixed(3)),
    tier:  r.tier,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          interval={0}
        />
        <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => v.toFixed(3)} />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={TIER_COLOR[d.tier]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/relocation/relocation-chart.tsx
git commit -m "feat: add relocation bar chart component"
```

---

## Task 7: 추천 카드 컴포넌트 (`relocation-recommendations.tsx`)

**Files:**
- Create: `components/relocation/relocation-recommendations.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```typescript
// components/relocation/relocation-recommendations.tsx
import type { RelocationRecommendation } from "@/types/relocation";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  recommendations: RelocationRecommendation[];
}

export function RelocationRecommendations({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        추천할 재배치 경로가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
        >
          <span className="font-semibold text-red-600 dark:text-red-400">{rec.fromZone}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-green-600 dark:text-green-400">{rec.toZone}</span>
          <span className="ml-auto font-medium">{rec.carCount}대 이동 권장</span>
          {rec.sameRegion && (
            <Badge variant="secondary" className="text-xs">동일 시/도</Badge>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/relocation/relocation-recommendations.tsx
git commit -m "feat: add relocation recommendation cards"
```

---

## Task 8: 폼 컴포넌트 (`relocation-form.tsx`)

**Files:**
- Create: `components/relocation/relocation-form.tsx`

AllocationForm 구조 참고. 좌측 필터 패널 + 우측 결과(테이블 + 차트 + 추천카드).

- [ ] **Step 1: 컴포넌트 작성**

```typescript
// components/relocation/relocation-form.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RelocationTable } from "./relocation-table";
import { RelocationChart } from "./relocation-chart";
import { RelocationRecommendations } from "./relocation-recommendations";
import { PAST_DAYS_OPTIONS, FUTURE_DAYS_OPTIONS } from "@/types/relocation";
import type { RelocationResult } from "@/types/relocation";

const REGION1_OPTIONS = ["전체", "서울특별시", "경기도", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도"];

export function RelocationForm() {
  const [form, setForm] = useState({
    region1:        "전체",
    pastDays:       14,
    futureDays:     7,
    weightUtil:     0.4,
    weightRev:      0.4,
    weightPre:      0.2,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<RelocationResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/relocation/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        region1:    form.region1,
        pastDays:   form.pastDays,
        futureDays: form.futureDays,
        weights: {
          utilization:    form.weightUtil,
          revenue:        form.weightRev,
          prereservation: form.weightPre,
        },
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.errors?.join(" / ") ?? "알 수 없는 오류가 발생했습니다.");
      return;
    }
    setResult(data);
  }

  // 가중치 합계가 1.0이 되도록 나머지 하나를 자동 조정
  function handleWeightChange(field: "weightUtil" | "weightRev" | "weightPre", value: number) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // 세 슬라이더 중 나머지 두 개의 합이 1 - value가 되도록 비례 조정
      const others = (["weightUtil", "weightRev", "weightPre"] as const).filter((k) => k !== field);
      const othersSum = next[others[0]] + next[others[1]];
      const target = 1 - value;
      if (othersSum > 0) {
        next[others[0]] = parseFloat(((next[others[0]] / othersSum) * target).toFixed(2));
        next[others[1]] = parseFloat((target - next[others[0]]).toFixed(2));
      }
      return next;
    });
  }

  return (
    <div className="flex gap-6">
      {/* 좌측: 필터 패널 */}
      <div className="w-72 shrink-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">조회 파라미터</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">지역 필터</label>
                <select
                  className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.region1}
                  onChange={(e) => setForm((f) => ({ ...f, region1: e.target.value }))}
                >
                  {REGION1_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">과거 실적 기간</label>
                <div className="flex gap-2">
                  {PAST_DAYS_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, pastDays: d }))}
                      className={`flex-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                        form.pastDays === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {d}일
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">사전예약 조회</label>
                <div className="flex gap-2">
                  {FUTURE_DAYS_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, futureDays: d }))}
                      className={`flex-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                        form.futureDays === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      향후 {d}일
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  가중치 (합계: {(form.weightUtil + form.weightRev + form.weightPre).toFixed(2)})
                </label>
                {[
                  { key: "weightUtil" as const, label: "α 가동률",   value: form.weightUtil },
                  { key: "weightRev"  as const, label: "β 매출",     value: form.weightRev  },
                  { key: "weightPre"  as const, label: "γ 사전예약", value: form.weightPre  },
                ].map(({ key, label, value }) => (
                  <div key={key} className="space-y-0.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{label}</span>
                      <span>{value.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={value}
                      onChange={(e) => handleWeightChange(key, parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "조회 중…" : "조회 실행"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 우측: 결과 */}
      <div className="flex-1 min-w-0 space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-md border bg-muted/50 p-8 text-center text-sm text-muted-foreground">
            BigQuery 조회 중입니다… (약 10~30초 소요)
          </div>
        )}

        {result && !loading && (
          <>
            <div>
              <h2 className="text-base font-semibold mb-2">존별 스코어</h2>
              <RelocationTable rows={result.rows} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="text-base font-semibold mb-2">스코어 비교</h2>
                <div className="rounded-xl border bg-card p-4">
                  <RelocationChart rows={result.rows} />
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-2">재배치 추천</h2>
                <RelocationRecommendations recommendations={result.recommendations} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              조회 시각: {new Date(result.fetchedAt).toLocaleString("ko-KR")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/relocation/relocation-form.tsx
git commit -m "feat: add relocation filter form with results layout"
```

---

## Task 9: 페이지 / 레이아웃 / 사이드바 / 미들웨어

**Files:**
- Create: `app/(dashboard)/relocation/layout.tsx`
- Create: `app/(dashboard)/relocation/page.tsx`
- Modify: `components/layout/sidebar.tsx`
- Modify: `proxy.ts`

- [ ] **Step 1: 레이아웃 작성**

```typescript
// app/(dashboard)/relocation/layout.tsx
export default function RelocationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: 페이지 작성**

```typescript
// app/(dashboard)/relocation/page.tsx
import { RelocationForm } from "@/components/relocation/relocation-form";

export const metadata = { title: "차량 재배치 | Workspace Hub" };

export default function RelocationPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">차량 재배치</h1>
        <p className="text-sm text-muted-foreground mt-1">
          존별 복합 스코어를 기반으로 차량 재배치 의사결정을 지원합니다.
        </p>
      </div>
      <RelocationForm />
    </div>
  );
}
```

- [ ] **Step 3: 사이드바에 "차량 재배치" 메뉴 추가**

`components/layout/sidebar.tsx`의 `navItems` 배열에 추가:

```typescript
import { ArrowLeftRight } from "lucide-react";  // 상단 import에 추가

const navItems = [
  { icon: LayoutDashboard, label: "대시보드",    href: "/dashboard"   },
  { icon: Car,             label: "신차 배분",   href: "/allocation"  },
  { icon: ArrowLeftRight,  label: "차량 재배치", href: "/relocation"  },
  { icon: SearchCheck,     label: "워크스페이스", href: "/work-history"},
];
```

- [ ] **Step 4: proxy.ts에 `/relocation` 보호 경로 추가**

```typescript
const isProtectedRoute =
  nextUrl.pathname.startsWith("/dashboard") ||
  nextUrl.pathname.startsWith("/allocation") ||
  nextUrl.pathname.startsWith("/relocation") ||
  nextUrl.pathname.startsWith("/work-history");
```

- [ ] **Step 5: TypeScript 빌드 확인**

```bash
npx tsc --noEmit
```
Expected: 오류 없음

- [ ] **Step 6: 개발 서버에서 동작 확인**

```bash
npm run dev
```

브라우저에서 확인:
- `/relocation` 접근 → 페이지 정상 렌더링
- 사이드바에 "차량 재배치" 메뉴 표시
- 필터 설정 → "조회 실행" 클릭 → 로딩 메시지 표시
- BigQuery 미설정 환경 → 에러 메시지 정상 표시

- [ ] **Step 7: 전체 테스트 재실행**

```bash
npx vitest run
```
Expected: 모든 테스트 PASS

- [ ] **Step 8: 커밋**

```bash
git add app/(dashboard)/relocation/ components/relocation/ components/layout/sidebar.tsx proxy.ts
git commit -m "feat: add relocation page, layout, sidebar menu, and middleware protection"
```

---

## 완료 기준

- [ ] `npx vitest run` → 전체 PASS
- [ ] `npx tsc --noEmit` → 오류 없음
- [ ] `/relocation` 페이지 정상 접근 (로그인 필요)
- [ ] 사이드바에 "차량 재배치" 메뉴 표시
- [ ] BigQuery 미설정 시 에러 메시지 표시
- [ ] BigQuery 설정 시 스코어 테이블 + 차트 + 추천 카드 정상 렌더링
