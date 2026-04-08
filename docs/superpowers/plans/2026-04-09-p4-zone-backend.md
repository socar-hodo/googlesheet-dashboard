# P4. Zone 시뮬레이터 백엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 존 시뮬레이터의 BQ 쿼리 7개, 지리 계산 모듈, 4개 모드 API를 Next.js API Routes + TypeScript로 이관한다.

**Architecture:** Python bq.py의 SQL을 sql/zone/*.sql로 추출, geo.py를 lib/zone-geo.ts로 포팅, 비즈니스 로직을 lib/zone.ts에 구현한다. API Routes는 기존 allocation 패턴을 따른다.

**Tech Stack:** Next.js 16 App Router, TypeScript, @google-cloud/bigquery, Upstash Redis

---

## File Structure

```
lib/zone-geo.ts                          ← 신규: haversine, checkCannibalization, estimateDemandTransfer
lib/zone.ts                              ← 신규: SQL 로더, 존 캐시, 응답 포맷팅, 7개 BQ 함수
sql/zone/zones.sql                       ← 신규: 존 목록 (위경도 포함)
sql/zone/zone-performance.sql            ← 신규: 존별 90일 평균 실적
sql/zone/cluster-benchmark.sql           ← 신규: 클러스터 벤치마크
sql/zone/zone-cluster.sql                ← 신규: 존의 클러스터 유형
sql/zone/region-zone-stats.sql           ← 신규: 지역 내 전체 존 실적 (최적화 모드)
app/api/zone/zones/route.ts              ← 신규: GET /api/zone/zones
app/api/zone/simulate/open/route.ts      ← 신규: POST /api/zone/simulate/open
app/api/zone/simulate/close/route.ts     ← 신규: POST /api/zone/simulate/close
app/api/zone/compare/route.ts            ← 신규: POST /api/zone/compare
app/api/zone/optimize/route.ts           ← 신규: POST /api/zone/optimize
app/api/zone/scenarios/route.ts          ← 신규: GET/POST /api/zone/scenarios
app/api/zone/report/route.ts             ← 신규: POST /api/zone/report (Slack webhook)
types/zone.ts                            ← 신규: Zone 관련 TypeScript 타입
```

---

## Task 1: `lib/zone-geo.ts` — 지리 계산 모듈 포팅

**Files:**
- Create: `lib/zone-geo.ts`

**Source:** `C:\Users\socar\socar\zone-simulator\geo.py` (150 lines)

- [ ] **Step 1: zone-geo.ts 생성 — haversine, checkCannibalization, estimateDemandTransfer**

`lib/zone-geo.ts`:

```typescript
/**
 * Zone 시뮬레이터 — 지리 계산 모듈
 * Ported from: zone-simulator/geo.py
 */

// 차량 1대당 월 비용 (KRW)
const COST_PER_CAR_MONTHLY = 9_500_000;

// 카니발리제이션 최대 거리 (m)
const CANNIBALIZATION_MAX_M = 500.0;

export interface ZoneCoord {
  id: number;
  name: string;
  lat: number;
  lng: number;
  [key: string]: unknown;
}

export interface CannibalizationResult {
  zone_id: number;
  zone_name: string;
  distance_m: number;
  level: "danger" | "warning";
}

export interface DemandTransferInput {
  id: number;
  lat: number;
  lng: number;
  utilization: number;
  revenue_per_car: number;
  car_count: number;
  [key: string]: unknown;
}

export interface NearbyZoneForTransfer {
  id: number;
  name: string;
  lat: number;
  lng: number;
  utilization: number;
  revenue_per_car: number;
  distance_m: number;
  [key: string]: unknown;
}

export interface TransferItem {
  zone_id: number;
  zone_name: string;
  absorption_pct: number;
}

export interface DemandTransferResult {
  transfers: TransferItem[];
  total_absorption_pct: number;
  churn_pct: number;
  cost_saved_monthly: number;
  churn_loss_monthly: number;
  net_effect_monthly: number;
}

/**
 * Haversine 공식으로 두 좌표 간 거리 계산 (미터 단위).
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 카니발리제이션 위험 체크.
 * - "danger": distance_m < threshold_m
 * - "warning": threshold_m <= distance_m < 500m
 * - 500m 이상은 제외
 * 결과는 distance_m 오름차순 정렬.
 */
export function checkCannibalization(
  lat: number,
  lng: number,
  zones: ZoneCoord[],
  thresholdM: number = 200,
): CannibalizationResult[] {
  const results: CannibalizationResult[] = [];
  for (const zone of zones) {
    const dist = haversine(lat, lng, zone.lat, zone.lng);
    if (dist >= CANNIBALIZATION_MAX_M) continue;
    const level = dist < thresholdM ? "danger" : "warning";
    results.push({
      zone_id: zone.id,
      zone_name: zone.name,
      distance_m: Math.round(dist * 10) / 10,
      level,
    });
  }
  results.sort((a, b) => a.distance_m - b.distance_m);
  return results;
}

/**
 * 존 폐쇄 시 수요 이전 추정.
 *
 * Inverse-distance weighting x capacity factor (1 - utilization) 로
 * 인근 존의 흡수율을 계산하고, 이탈/비용절감/순효과를 산출.
 */
export function estimateDemandTransfer(
  targetZone: DemandTransferInput,
  nearbyZones: NearbyZoneForTransfer[],
): DemandTransferResult {
  const carCount = targetZone.car_count || 0;
  const utilization = targetZone.utilization || 0;
  const revenuePerCar = targetZone.revenue_per_car || 0;

  const costSavedMonthly = carCount * COST_PER_CAR_MONTHLY;
  const targetMonthlyRevenue = revenuePerCar * carCount;

  if (nearbyZones.length === 0) {
    return {
      transfers: [],
      total_absorption_pct: 0,
      churn_pct: 1,
      cost_saved_monthly: costSavedMonthly,
      churn_loss_monthly: targetMonthlyRevenue,
      net_effect_monthly: costSavedMonthly - targetMonthlyRevenue,
    };
  }

  // Inverse-distance weighting x capacity factor
  const weights: number[] = nearbyZones.map((z) => {
    const dist = Math.max(z.distance_m || 1, 1); // avoid division by zero
    const capacityFactor = Math.max(1 - (z.utilization || 0), 0);
    return (1 / dist) * capacityFactor;
  });

  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const rawAbsorptions = weights.map((w) =>
    totalWeight > 0 ? w / totalWeight : 0,
  );

  // Scale total absorption by target utilization (proxy for transferable demand)
  const maxAbsorption = Math.min(utilization, 1);

  let totalAbsorptionPct = 0;
  const transfers: TransferItem[] = [];

  for (let i = 0; i < nearbyZones.length; i++) {
    const absorptionPct = rawAbsorptions[i] * maxAbsorption;
    totalAbsorptionPct += absorptionPct;
    transfers.push({
      zone_id: nearbyZones[i].id,
      zone_name: nearbyZones[i].name,
      absorption_pct: Math.round(absorptionPct * 10000) / 10000,
    });
  }

  totalAbsorptionPct = Math.round(Math.min(totalAbsorptionPct, 1) * 10000) / 10000;
  const churnPct = Math.round(Math.max(1 - totalAbsorptionPct, 0) * 10000) / 10000;

  const churnLossMonthly = churnPct * targetMonthlyRevenue;
  const netEffectMonthly = costSavedMonthly - churnLossMonthly;

  return {
    transfers,
    total_absorption_pct: totalAbsorptionPct,
    churn_pct: churnPct,
    cost_saved_monthly: costSavedMonthly,
    churn_loss_monthly: Math.round(churnLossMonthly * 100) / 100,
    net_effect_monthly: Math.round(netEffectMonthly * 100) / 100,
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add lib/zone-geo.ts
git commit -m "feat(zone): port geo.py to lib/zone-geo.ts — haversine, cannibalization, demand transfer"
```

---

## Task 2: SQL 파일 — 5개 쿼리 추출

**Files:**
- Create: `sql/zone/zones.sql`
- Create: `sql/zone/zone-performance.sql`
- Create: `sql/zone/cluster-benchmark.sql`
- Create: `sql/zone/zone-cluster.sql`
- Create: `sql/zone/region-zone-stats.sql`

**Source:** `C:\Users\socar\socar\zone-simulator\bq.py` (298 lines)

> **Note:** Python의 parameterized queries (`@region1`, `UNNEST(@zone_ids)`)를 `{param}` 치환 + 직접 IN 절로 변환한다. `get_regions()`/`get_sub_regions()` 쿼리는 별도 SQL 파일 없이 `lib/zone.ts`에 인라인 SQL로 작성한다 (단순 SELECT DISTINCT라 파일 분리 불필요).

- [ ] **Step 1: `sql/zone/zones.sql` 생성 — 존 목록 (위경도 포함)**

`sql/zone/zones.sql`:

```sql
-- 존 목록 조회 (위경도 포함)
-- 파라미터:
--   {where_clause} : 동적 WHERE 조건 (lib/zone.ts에서 조립)
--
-- 반환: zone_id, zone_name, lat, lng, region1, region2, car_count
SELECT
  z.id AS zone_id,
  z.name AS zone_name,
  z.lat,
  z.lng,
  z.region1,
  z.region2,
  COUNT(DISTINCT p.car_id) AS car_count
FROM `socar-data.socar_biz_base.carzone_info_daily` z
LEFT JOIN `socar-data.socar_biz_profit.profit_socar_car_daily` p
  ON z.id = p.zone_id
  AND p.date = z.date
  AND p.car_sharing_type IN ('socar', 'zplus')
  AND p.car_state IN ('운영', '수리')
WHERE z.date = DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY)
  AND z.lat IS NOT NULL AND z.lng IS NOT NULL
  {where_clause}
GROUP BY z.id, z.name, z.lat, z.lng, z.region1, z.region2
ORDER BY z.region1, z.region2, z.name
```

- [ ] **Step 2: `sql/zone/zone-performance.sql` 생성 — 존별 90일 평균 실적**

`sql/zone/zone-performance.sql`:

```sql
-- 존별 최근 90일 평균 실적
-- 파라미터:
--   {zone_ids} : 존 ID 목록 (예: 1, 2, 3)
--
-- 반환: zone_id, revenue_per_car, utilization, total_nuse, car_count, avg_daily_cost_fixed
WITH date_range AS (
  SELECT
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 90 DAY) AS start_date,
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY) AS end_date
)
SELECT
  p.zone_id,
  SAFE_DIVIDE(SUM(p.revenue), SUM(p.opr_day)) AS revenue_per_car,
  SAFE_DIVIDE(SUM(o.op_min), SUM(o.dp_min)) AS utilization,
  SUM(p.nuse) AS total_nuse,
  COUNT(DISTINCT p.car_id) AS car_count,
  SAFE_DIVIDE(SUM(p.cost_fixed), COUNT(DISTINCT p.date)) AS avg_daily_cost_fixed
FROM `socar-data.socar_biz_profit.profit_socar_car_daily` p
LEFT JOIN `socar-data.socar_biz.operation_per_car_daily_v2` o
  ON p.date = o.date AND p.car_id = o.car_id
CROSS JOIN date_range d
WHERE p.date BETWEEN d.start_date AND d.end_date
  AND p.zone_id IN ({zone_ids})
  AND p.car_sharing_type IN ('socar', 'zplus')
  AND p.car_state IN ('운영', '수리')
GROUP BY p.zone_id
```

- [ ] **Step 3: `sql/zone/cluster-benchmark.sql` 생성 — 클러스터 벤치마크**

`sql/zone/cluster-benchmark.sql`:

```sql
-- 클러스터 유형의 전국 평균 실적
-- 파라미터:
--   {cluster_type} : 클러스터명 (문자열, 따옴표 포함해서 치환)
--
-- 반환: avg_revenue_per_car, avg_utilization, zone_count
WITH date_range AS (
  SELECT
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 90 DAY) AS start_date,
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY) AS end_date
)
SELECT
  AVG(perf.revenue_per_car) AS avg_revenue_per_car,
  AVG(perf.utilization) AS avg_utilization,
  COUNT(*) AS zone_count
FROM (
  SELECT
    p.zone_id,
    SAFE_DIVIDE(SUM(p.revenue), SUM(p.opr_day)) AS revenue_per_car,
    SAFE_DIVIDE(SUM(o.op_min), SUM(o.dp_min)) AS utilization
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily` p
  LEFT JOIN `socar-data.socar_biz.operation_per_car_daily_v2` o
    ON p.date = o.date AND p.car_id = o.car_id
  JOIN `socar-data.dst_analytics.zone_commercial_clusters` c
    ON p.zone_id = c.zone_id
  CROSS JOIN date_range d
  WHERE p.date BETWEEN d.start_date AND d.end_date
    AND c.cluster_name = {cluster_type}
    AND p.car_sharing_type IN ('socar', 'zplus')
    AND p.car_state IN ('운영', '수리')
  GROUP BY p.zone_id
) perf
```

- [ ] **Step 4: `sql/zone/zone-cluster.sql` 생성 — 존의 클러스터 유형**

`sql/zone/zone-cluster.sql`:

```sql
-- 존의 상업 클러스터 유형 조회
-- 파라미터:
--   {zone_id} : 존 ID (정수)
--
-- 반환: cluster_name
SELECT cluster_name
FROM `socar-data.dst_analytics.zone_commercial_clusters`
WHERE zone_id = {zone_id}
LIMIT 1
```

- [ ] **Step 5: `sql/zone/region-zone-stats.sql` 생성 — 지역 내 전체 존 실적**

`sql/zone/region-zone-stats.sql`:

```sql
-- 지역 내 전체 존 실적 + 위경도 (최적화 모드용)
-- 파라미터:
--   {where_clause} : 동적 WHERE 조건 (lib/zone.ts에서 조립)
--
-- 반환: zone_id, zone_name, lat, lng, region1, region2, car_count,
--        revenue_per_car, utilization, total_nuse
WITH date_range AS (
  SELECT
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 90 DAY) AS start_date,
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY) AS end_date
)
SELECT
  z.id AS zone_id,
  z.name AS zone_name,
  z.lat, z.lng,
  z.region1, z.region2,
  COUNT(DISTINCT p.car_id) AS car_count,
  SAFE_DIVIDE(SUM(p.revenue), SUM(p.opr_day)) AS revenue_per_car,
  SAFE_DIVIDE(SUM(o.op_min), SUM(o.dp_min)) AS utilization,
  SUM(p.nuse) AS total_nuse
FROM `socar-data.socar_biz_base.carzone_info_daily` z
CROSS JOIN date_range d
LEFT JOIN `socar-data.socar_biz_profit.profit_socar_car_daily` p
  ON z.id = p.zone_id
  AND p.date BETWEEN d.start_date AND d.end_date
  AND p.car_sharing_type IN ('socar', 'zplus')
  AND p.car_state IN ('운영', '수리')
LEFT JOIN `socar-data.socar_biz.operation_per_car_daily_v2` o
  ON p.date = o.date AND p.car_id = o.car_id
WHERE z.date = DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY)
  AND z.lat IS NOT NULL AND z.lng IS NOT NULL
  {where_clause}
GROUP BY z.id, z.name, z.lat, z.lng, z.region1, z.region2
ORDER BY utilization DESC
```

- [ ] **Step 6: .gitkeep 삭제 (실제 SQL 파일로 대체)**

```bash
rm -f sql/zone/.gitkeep
```

- [ ] **Step 7: 커밋**

```bash
git add sql/zone/
git commit -m "feat(zone): add 5 SQL query files for zone simulator BQ operations"
```

---

## Task 3: `types/zone.ts` + `lib/zone.ts` — 타입, SQL 로더, 캐시, BQ 함수

**Files:**
- Create: `types/zone.ts`
- Create: `lib/zone.ts`

**Source:** `C:\Users\socar\socar\zone-simulator\bq.py` (298 lines)

- [ ] **Step 1: `types/zone.ts` 생성 — Zone 관련 타입 정의**

`types/zone.ts`:

```typescript
/** 존 기본 정보 (목록 조회 결과) */
export interface ZoneInfo {
  id: number;
  name: string;
  lat: number;
  lng: number;
  region1: string;
  region2: string;
  car_count: number;
}

/** 존 실적 (90일 평균) */
export interface ZonePerformance {
  zone_id: number;
  revenue_per_car: number;
  utilization: number;
  total_nuse: number;
  car_count: number;
  avg_daily_cost_fixed: number;
}

/** 클러스터 벤치마크 */
export interface ClusterBenchmark {
  avg_revenue_per_car: number;
  avg_utilization: number;
  zone_count: number;
}

/** 지역 존 통계 (최적화 모드) */
export interface RegionZoneStat {
  zone_id: number;
  zone_name: string;
  lat: number;
  lng: number;
  region1: string;
  region2: string;
  car_count: number;
  revenue_per_car: number;
  utilization: number;
  total_nuse: number;
}

/** 개설 시뮬레이션 요청 */
export interface OpenSimParams {
  lat: number;
  lng: number;
  radius_m?: number;   // default 1000
  alpha?: number;      // default 0.5
}

/** 폐쇄 시뮬레이션 요청 */
export interface CloseSimParams {
  zone_id: number;
}

/** 비교 요청 */
export interface CompareParams {
  zone_ids: number[];  // 2~5개
}

/** 최적화 요청 */
export interface OptimizeParams {
  region1: string;
  region2?: string;
}

/** 시나리오 저장 요청 */
export interface ScenarioSaveParams {
  mode: string;
  parameters: Record<string, unknown>;
  results: Record<string, unknown>;
}

/** 저장된 시나리오 */
export interface ZoneScenario {
  id: string;
  mode: string;
  parameters: Record<string, unknown>;
  results: Record<string, unknown>;
  created_at: string;
}

/** Slack 리포트 요청 */
export interface SlackReportParams {
  mode: string;
  data: Record<string, unknown>;
}
```

- [ ] **Step 2: `lib/zone.ts` 생성 — SQL 로더, 캐시, 7개 BQ 함수**

`lib/zone.ts`:

```typescript
/**
 * Zone 시뮬레이터 — BQ 쿼리 모듈
 * Ported from: zone-simulator/bq.py
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { runQuery } from "@/lib/bigquery";
import type {
  ZoneInfo,
  ZonePerformance,
  ClusterBenchmark,
  RegionZoneStat,
} from "@/types/zone";

// ── SQL 파일 경로 ──────────────────────────────────────────────
const SQL_DIR = resolve(process.cwd(), "sql/zone");

function loadSql(filename: string): string {
  return readFileSync(resolve(SQL_DIR, filename), "utf-8");
}

// ── SQL injection 방지 ─────────────────────────────────────────
const SQL_UNSAFE = /['";\\]/;

function assertSafe(value: string, label: string): void {
  if (SQL_UNSAFE.test(value)) {
    throw new Error(`${label}에 허용되지 않는 문자가 포함되어 있습니다.`);
  }
}

// ── 존 캐시 (1시간 TTL, 모듈 레벨 Map) ───────────────────────
let _zoneCache: ZoneInfo[] | null = null;
let _zoneCacheTs = 0;
const CACHE_TTL = 3600 * 1000; // 1시간 (ms)

function num(v: unknown): number {
  return Number(v) || 0;
}

// ── 지역 목록 ─────────────────────────────────────────────────

/** region1 목록 조회 (인라인 SQL — 단순 SELECT DISTINCT). */
export async function getRegions(): Promise<string[]> {
  const sql = `
    SELECT DISTINCT region1
    FROM \`socar-data.socar_biz_base.carzone_info_daily\`
    WHERE date = DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY)
      AND region1 IS NOT NULL
    ORDER BY region1
  `;
  const rows = await runQuery(sql);
  if (!rows) return [];
  return rows.map((r) => String(r.region1));
}

/** region2 목록 조회. */
export async function getSubRegions(region1: string): Promise<string[]> {
  assertSafe(region1, "region1");
  const sql = `
    SELECT DISTINCT region2
    FROM \`socar-data.socar_biz_base.carzone_info_daily\`
    WHERE date = DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY)
      AND region1 = '${region1}'
      AND region2 IS NOT NULL
    ORDER BY region2
  `;
  const rows = await runQuery(sql);
  if (!rows) return [];
  return rows.map((r) => String(r.region2));
}

// ── 존 목록 (위경도 포함) ────────────────────────────────────

/** 존 목록 조회. 필터 없으면 캐시 사용 (1시간 TTL). */
export async function getZones(
  region1?: string,
  region2?: string,
): Promise<ZoneInfo[]> {
  // 필터 없는 전체 조회는 캐시 사용
  if (!region1 && !region2) {
    if (_zoneCache && Date.now() - _zoneCacheTs < CACHE_TTL) {
      return _zoneCache;
    }
  }

  let whereClause = "";
  if (region1) {
    assertSafe(region1, "region1");
    whereClause += `AND z.region1 = '${region1}'`;
  }
  if (region2) {
    assertSafe(region2, "region2");
    whereClause += ` AND z.region2 = '${region2}'`;
  }

  const raw = loadSql("zones.sql");
  const sql = raw.replace("{where_clause}", whereClause);

  const rows = await runQuery(sql);
  if (!rows) return [];

  const result: ZoneInfo[] = rows.map((r) => ({
    id: num(r.zone_id),
    name: String(r.zone_name ?? ""),
    lat: num(r.lat),
    lng: num(r.lng),
    region1: String(r.region1 ?? ""),
    region2: String(r.region2 ?? ""),
    car_count: num(r.car_count),
  }));

  // 전체 조회 결과 캐시
  if (!region1 && !region2) {
    _zoneCache = result;
    _zoneCacheTs = Date.now();
  }

  return result;
}

// ── 존 실적 (최근 90일) ─────────────────────────────────────

/** 존별 최근 90일 평균 실적 조회. */
export async function getZonePerformance(
  zoneIds: number[],
): Promise<ZonePerformance[]> {
  if (zoneIds.length === 0) return [];

  const raw = loadSql("zone-performance.sql");
  const sql = raw.replace("{zone_ids}", zoneIds.join(", "));

  const rows = await runQuery(sql);
  if (!rows) return [];

  return rows.map((r) => ({
    zone_id: num(r.zone_id),
    revenue_per_car: num(r.revenue_per_car),
    utilization: num(r.utilization),
    total_nuse: num(r.total_nuse),
    car_count: num(r.car_count),
    avg_daily_cost_fixed: num(r.avg_daily_cost_fixed),
  }));
}

// ── 클러스터 벤치마크 ───────────────────────────────────────

/** 해당 클러스터 유형의 전국 평균 실적. */
export async function getClusterBenchmark(
  clusterType: string,
): Promise<ClusterBenchmark> {
  assertSafe(clusterType, "cluster_type");
  const raw = loadSql("cluster-benchmark.sql");
  const sql = raw.replace("{cluster_type}", `'${clusterType}'`);

  const rows = await runQuery(sql);
  if (!rows || rows.length === 0) {
    return { avg_revenue_per_car: 0, avg_utilization: 0, zone_count: 0 };
  }

  const r = rows[0];
  return {
    avg_revenue_per_car: num(r.avg_revenue_per_car),
    avg_utilization: num(r.avg_utilization),
    zone_count: num(r.zone_count),
  };
}

/** 존의 상업 클러스터 유형 조회. */
export async function getZoneClusterType(
  zoneId: number,
): Promise<string | null> {
  const raw = loadSql("zone-cluster.sql");
  const sql = raw.replace("{zone_id}", String(zoneId));

  const rows = await runQuery(sql);
  if (!rows || rows.length === 0) return null;
  return String(rows[0].cluster_name);
}

// ── 지역 최적화 ─────────────────────────────────────────────

/** 지역 내 전체 존의 실적 + 위경도. 최적화 모드용. */
export async function getRegionZoneStats(
  region1: string,
  region2?: string,
): Promise<RegionZoneStat[]> {
  assertSafe(region1, "region1");
  let whereClause = `AND z.region1 = '${region1}'`;
  if (region2) {
    assertSafe(region2, "region2");
    whereClause += ` AND z.region2 = '${region2}'`;
  }

  const raw = loadSql("region-zone-stats.sql");
  const sql = raw.replace("{where_clause}", whereClause);

  const rows = await runQuery(sql);
  if (!rows) return [];

  return rows.map((r) => ({
    zone_id: num(r.zone_id),
    zone_name: String(r.zone_name ?? ""),
    lat: num(r.lat),
    lng: num(r.lng),
    region1: String(r.region1 ?? ""),
    region2: String(r.region2 ?? ""),
    car_count: num(r.car_count),
    revenue_per_car: num(r.revenue_per_car),
    utilization: num(r.utilization),
    total_nuse: num(r.total_nuse),
  }));
}
```

- [ ] **Step 3: 커밋**

```bash
git add types/zone.ts lib/zone.ts
git commit -m "feat(zone): add types/zone.ts and lib/zone.ts — 7 BQ query functions with SQL loader and zone cache"
```

---

## Task 4: API Routes — zones (GET), simulate/open (POST), simulate/close (POST)

**Files:**
- Create: `app/api/zone/zones/route.ts`
- Create: `app/api/zone/simulate/open/route.ts`
- Create: `app/api/zone/simulate/close/route.ts`

**Source:** `C:\Users\socar\socar\zone-simulator\app.py` lines 131-309

- [ ] **Step 1: `app/api/zone/zones/route.ts` 생성 — 존/지역 목록**

`app/api/zone/zones/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRegions, getSubRegions, getZones } from "@/lib/zone";

/**
 * GET /api/zone/zones
 *
 * Query params:
 *   ?list=regions           → region1 목록
 *   ?list=subregions&region1=경상남도  → region2 목록
 *   (없으면)                 → 전체 존 목록 (region1, region2 필터 가능)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const list = searchParams.get("list");
  const region1 = searchParams.get("region1") || undefined;
  const region2 = searchParams.get("region2") || undefined;

  try {
    if (list === "regions") {
      const regions = await getRegions();
      return NextResponse.json(regions);
    }

    if (list === "subregions") {
      if (!region1) {
        return NextResponse.json(
          { error: "region1 파라미터가 필요합니다." },
          { status: 400 },
        );
      }
      const subRegions = await getSubRegions(region1);
      return NextResponse.json(subRegions);
    }

    // 존 목록 (필터 가능)
    const zones = await getZones(region1, region2);
    return NextResponse.json(zones);
  } catch (err) {
    console.error("[zone/zones]", err);
    return NextResponse.json(
      { error: "데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: `app/api/zone/simulate/open/route.ts` 생성 — 개설 시뮬레이션**

`app/api/zone/simulate/open/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  getZones,
  getZonePerformance,
  getZoneClusterType,
  getClusterBenchmark,
} from "@/lib/zone";
import { haversine, checkCannibalization } from "@/lib/zone-geo";
import type { OpenSimParams } from "@/types/zone";

const BQ_ERROR_MSG = "데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";

/**
 * POST /api/zone/simulate/open
 *
 * Body: { lat, lng, radius_m?, alpha? }
 *
 * 개설 시뮬레이션:
 * 1. 반경 내 존 조회
 * 2. 유사 존 실적 조회
 * 3. 유사 존 평균 계산 (실적 있는 존 기준)
 * 4. 클러스터 벤치마크 (가장 가까운 존의 클러스터 기준)
 * 5. 하이브리드 추정 (alpha 가중치)
 * 6. 카니발리제이션 체크
 */
export async function POST(req: NextRequest) {
  try {
    const body: OpenSimParams = await req.json();
    const { lat, lng, radius_m = 1000, alpha = 0.5 } = body;

    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "lat, lng는 필수입니다." },
        { status: 400 },
      );
    }

    // 1. 반경 내 존 조회
    const allZones = await getZones();
    const nearby: Array<Record<string, unknown>> = [];

    for (const z of allZones) {
      const dist = haversine(lat, lng, z.lat, z.lng);
      if (dist <= radius_m) {
        nearby.push({ ...z, distance_m: Math.round(dist) });
      }
    }

    // 2. 유사 존 실적 조회
    if (nearby.length > 0) {
      const zoneIds = nearby.map((z) => Number(z.id));
      const perfs = await getZonePerformance(zoneIds);
      const perfMap = new Map(perfs.map((p) => [p.zone_id, p]));
      for (const z of nearby) {
        const p = perfMap.get(Number(z.id));
        z.revenue_per_car = p?.revenue_per_car ?? 0;
        z.utilization = p?.utilization ?? 0;
      }
    }

    // 2b. 실적 있는 존만 유사 존으로 사용, 가까운 순 정렬
    nearby.sort((a, b) => Number(a.distance_m) - Number(b.distance_m));
    const activeNearby = nearby.filter((z) => Number(z.revenue_per_car) > 0);

    // 3. 유사 존 평균 (실적 있는 존 기준)
    let avgRev = 0;
    let avgUtil = 0;
    if (activeNearby.length > 0) {
      avgRev =
        activeNearby.reduce((s, z) => s + Number(z.revenue_per_car), 0) /
        activeNearby.length;
      avgUtil =
        activeNearby.reduce((s, z) => s + Number(z.utilization), 0) /
        activeNearby.length;
    }

    // 4. 클러스터 벤치마크 (가장 가까운 존의 클러스터 기준)
    let clusterType: string | null = null;
    let clusterBench = { avg_revenue_per_car: 0, avg_utilization: 0, zone_count: 0 };
    if (nearby.length > 0) {
      const nearest = nearby.reduce((a, b) =>
        Number(a.distance_m) < Number(b.distance_m) ? a : b,
      );
      try {
        clusterType = await getZoneClusterType(Number(nearest.id));
        if (clusterType) {
          clusterBench = await getClusterBenchmark(clusterType);
        }
      } catch {
        // 클러스터 조회 실패 — 유사 존 평균만 사용
        console.warn("클러스터 조회 실패 — 유사 존 평균만 사용");
      }
    }

    // 5. 하이브리드 추정 (클러스터 데이터 없으면 유사 존 평균만 사용)
    let estRev: number;
    let estUtil: number;
    if (clusterBench.zone_count === 0) {
      estRev = avgRev;
      estUtil = avgUtil;
    } else {
      estRev = alpha * avgRev + (1 - alpha) * clusterBench.avg_revenue_per_car;
      estUtil = alpha * avgUtil + (1 - alpha) * clusterBench.avg_utilization;
    }

    // 6. 카니발리제이션 체크
    const cannibal = checkCannibalization(lat, lng, allZones);

    return NextResponse.json({
      estimated_revenue_per_car: Math.round(estRev),
      estimated_utilization: Math.round(estUtil * 1000) / 1000,
      cluster_type: clusterType,
      cluster_benchmark: clusterBench,
      nearby_avg_revenue: Math.round(avgRev),
      nearby_avg_utilization: Math.round(avgUtil * 1000) / 1000,
      nearby_zones: nearby.slice(0, 10),
      cannibalization: cannibal,
      alpha,
    });
  } catch (err) {
    console.error("[zone/simulate/open]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 3: `app/api/zone/simulate/close/route.ts` 생성 — 폐쇄 시뮬레이션**

`app/api/zone/simulate/close/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getZones, getZonePerformance } from "@/lib/zone";
import { haversine, estimateDemandTransfer } from "@/lib/zone-geo";
import type { CloseSimParams } from "@/types/zone";

const BQ_ERROR_MSG = "데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";

/**
 * POST /api/zone/simulate/close
 *
 * Body: { zone_id }
 *
 * 폐쇄 시뮬레이션:
 * 1. 대상 존 실적 조회
 * 2. 대상 존 위경도 확인
 * 3. 반경 1km 내 인근 존 조회
 * 4. 인근 존 실적 (가까운 순 상위 10개)
 * 5. 수요 이전 추정
 */
export async function POST(req: NextRequest) {
  try {
    const body: CloseSimParams = await req.json();
    const { zone_id } = body;

    if (!zone_id) {
      return NextResponse.json(
        { error: "zone_id는 필수입니다." },
        { status: 400 },
      );
    }

    // 1. 대상 존 실적
    const targetPerfs = await getZonePerformance([zone_id]);
    if (targetPerfs.length === 0) {
      return NextResponse.json(
        { error: "존 데이터를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    const target = { ...targetPerfs[0] } as Record<string, unknown>;

    // 2. 대상 존 위경도
    const allZones = await getZones();
    const targetZone = allZones.find((z) => z.id === zone_id);
    if (!targetZone) {
      return NextResponse.json(
        { error: "존을 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    target.lat = targetZone.lat;
    target.lng = targetZone.lng;
    target.name = targetZone.name;

    // 3. 반경 1km 내 인근 존
    const nearby: Array<Record<string, unknown>> = [];
    for (const z of allZones) {
      if (z.id === zone_id) continue;
      const dist = haversine(targetZone.lat, targetZone.lng, z.lat, z.lng);
      if (dist <= 1000) {
        nearby.push({ ...z, distance_m: Math.round(dist) });
      }
    }

    // 4. 인근 존 실적 (가까운 순 정렬, 상위 10개)
    nearby.sort((a, b) => Number(a.distance_m) - Number(b.distance_m));
    const topNearby = nearby.slice(0, 10);

    if (topNearby.length > 0) {
      const nearbyIds = topNearby.map((z) => Number(z.id));
      const nearbyPerfs = await getZonePerformance(nearbyIds);
      const perfMap = new Map(nearbyPerfs.map((p) => [p.zone_id, p]));
      for (const z of topNearby) {
        const p = perfMap.get(Number(z.id));
        z.utilization = p?.utilization ?? 0;
        z.revenue_per_car = p?.revenue_per_car ?? 0;
      }
    }

    // 5. 수요 이전 추정
    const transfer = estimateDemandTransfer(
      {
        id: zone_id,
        lat: targetZone.lat,
        lng: targetZone.lng,
        utilization: Number(target.utilization) || 0,
        revenue_per_car: Number(target.revenue_per_car) || 0,
        car_count: Number(target.car_count) || 0,
      },
      topNearby.map((z) => ({
        id: Number(z.id),
        name: String(z.name),
        lat: Number(z.lat),
        lng: Number(z.lng),
        utilization: Number(z.utilization) || 0,
        revenue_per_car: Number(z.revenue_per_car) || 0,
        distance_m: Number(z.distance_m),
      })),
    );

    return NextResponse.json({
      target_zone: {
        zone_id,
        name: targetZone.name,
        region1: targetZone.region1,
        region2: targetZone.region2,
        revenue_per_car: Number(target.revenue_per_car) || 0,
        utilization: Number(target.utilization) || 0,
        car_count: Number(target.car_count) || 0,
      },
      demand_transfer: transfer,
    });
  } catch (err) {
    console.error("[zone/simulate/close]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 4: 커밋**

```bash
git add app/api/zone/zones/ app/api/zone/simulate/
git commit -m "feat(zone): add API routes — zones list, open/close simulation"
```

---

## Task 5: API Routes — compare (POST), optimize (POST)

**Files:**
- Create: `app/api/zone/compare/route.ts`
- Create: `app/api/zone/optimize/route.ts`

**Source:** `C:\Users\socar\socar\zone-simulator\app.py` lines 312-430

- [ ] **Step 1: `app/api/zone/compare/route.ts` 생성 — 존 비교**

`app/api/zone/compare/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  getZones,
  getZonePerformance,
  getZoneClusterType,
  getClusterBenchmark,
} from "@/lib/zone";
import type { CompareParams } from "@/types/zone";

const BQ_ERROR_MSG = "데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";

/**
 * POST /api/zone/compare
 *
 * Body: { zone_ids: number[] }  (2~5개)
 *
 * 존 비교: 각 존의 실적 + 클러스터 벤치마크를 조회하여 side-by-side 비교.
 */
export async function POST(req: NextRequest) {
  try {
    const body: CompareParams = await req.json();
    const { zone_ids } = body;

    if (!zone_ids || zone_ids.length < 2) {
      return NextResponse.json(
        { error: "비교할 존을 2개 이상 선택해주세요." },
        { status: 400 },
      );
    }
    if (zone_ids.length > 5) {
      return NextResponse.json(
        { error: "최대 5개까지 비교할 수 있습니다." },
        { status: 400 },
      );
    }

    const perfs = await getZonePerformance(zone_ids);
    const allZones = await getZones();
    const zoneMap = new Map(allZones.map((z) => [z.id, z]));

    const results = [];
    for (const p of perfs) {
      const z = zoneMap.get(p.zone_id);
      let clusterType: string | null = null;
      let bench: Record<string, unknown> | null = null;
      try {
        clusterType = await getZoneClusterType(p.zone_id);
        if (clusterType) {
          bench = await getClusterBenchmark(clusterType);
        }
      } catch {
        console.warn(`클러스터 조회 실패: zone_id=${p.zone_id}`);
      }
      results.push({
        ...p,
        name: z?.name ?? "",
        region1: z?.region1 ?? "",
        region2: z?.region2 ?? "",
        lat: z?.lat ?? 0,
        lng: z?.lng ?? 0,
        cluster_type: clusterType,
        cluster_benchmark: bench,
      });
    }

    return NextResponse.json({ zones: results });
  } catch (err) {
    console.error("[zone/compare]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 2: `app/api/zone/optimize/route.ts` 생성 — 지역 최적화**

`app/api/zone/optimize/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRegionZoneStats } from "@/lib/zone";
import { haversine } from "@/lib/zone-geo";
import type { OptimizeParams, RegionZoneStat } from "@/types/zone";

const BQ_ERROR_MSG = "데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";

/**
 * POST /api/zone/optimize
 *
 * Body: { region1, region2? }
 *
 * 지역 최적화:
 * 1. 지역 존 전체 통계 조회
 * 2. 현황 요약 (운영 존 기준)
 * 3. 폐쇄 후보: 가동률 20% 미만 + 반경 300m 내 대체 존
 * 4. 차량 재배치: 가동률 하위 → 상위
 * 5. 예상 효과
 */
export async function POST(req: NextRequest) {
  try {
    const body: OptimizeParams = await req.json();
    const { region1, region2 } = body;

    if (!region1) {
      return NextResponse.json(
        { error: "region1은 필수입니다." },
        { status: 400 },
      );
    }

    const zoneStats = await getRegionZoneStats(region1, region2);
    if (zoneStats.length === 0) {
      return NextResponse.json({
        summary: {},
        suggestions: { close: [], open: [], rebalance: [] },
      });
    }

    // 운영 중인 존만 (차량 1대 이상)
    let activeZones = zoneStats.filter((z) => z.car_count > 0);
    if (activeZones.length === 0) activeZones = zoneStats;

    // 현황 요약
    const totalZones = activeZones.length;
    const totalCars = activeZones.reduce((s, z) => s + z.car_count, 0);
    const avgUtil = totalZones > 0
      ? activeZones.reduce((s, z) => s + z.utilization, 0) / totalZones
      : 0;
    const avgCarsPerZone = totalZones > 0 ? totalCars / totalZones : 0;

    // 폐쇄 후보: 가동률 20% 미만 + 반경 300m 내 대체 존
    const closeCandidates: RegionZoneStat[] = [];
    for (const z of activeZones) {
      if (z.utilization < 0.2) {
        const hasAlternative = activeZones.some(
          (oz) =>
            oz.zone_id !== z.zone_id &&
            oz.car_count > 0 &&
            haversine(z.lat, z.lng, oz.lat, oz.lng) < 300,
        );
        if (hasAlternative) {
          closeCandidates.push(z);
        }
      }
    }

    // 차량 재배치: 가동률 하위 → 상위 (상대적 기준)
    const sortedByUtil = [...activeZones].sort(
      (a, b) => a.utilization - b.utilization,
    );
    const lowUtil = sortedByUtil.filter(
      (z) => z.utilization < avgUtil * 0.5 && z.car_count > 2,
    );
    const highUtil = [...sortedByUtil]
      .reverse()
      .filter((z) => z.utilization > avgUtil * 1.5);

    const rebalance: Array<{
      from_zone: { zone_id: number; name: string; utilization: number };
      to_zone: { zone_id: number; name: string; utilization: number };
      cars: number;
    }> = [];
    for (const src of lowUtil.slice(0, 3)) {
      for (const dst of highUtil.slice(0, 3)) {
        if (src.zone_id !== dst.zone_id) {
          rebalance.push({
            from_zone: {
              zone_id: src.zone_id,
              name: src.zone_name,
              utilization: src.utilization,
            },
            to_zone: {
              zone_id: dst.zone_id,
              name: dst.zone_name,
              utilization: dst.utilization,
            },
            cars: 1,
          });
        }
      }
    }

    // 예상 효과
    const closeCarTotal = closeCandidates.reduce(
      (s, z) => s + z.car_count,
      0,
    );
    const closeSavings = closeCarTotal * 9_500_000;
    const rebalanceGain = rebalance.length * 500_000;

    // 폐쇄 존 제거 후 나머지 존의 평균 가동률 재계산
    const closeIds = new Set(closeCandidates.map((z) => z.zone_id));
    const remaining = activeZones.filter((z) => !closeIds.has(z.zone_id));
    const newAvgUtil = remaining.length > 0
      ? remaining.reduce((s, z) => s + z.utilization, 0) / remaining.length
      : avgUtil;

    return NextResponse.json({
      summary: {
        total_zones: totalZones,
        total_cars: totalCars,
        avg_utilization: Math.round(avgUtil * 1000) / 1000,
        avg_cars_per_zone: Math.round(avgCarsPerZone * 10) / 10,
      },
      suggestions: {
        close: closeCandidates.slice(0, 5),
        open: [], // 개설 추천은 v2에서 예약 데이터 분석 후 추가
        rebalance: rebalance.slice(0, 5),
      },
      projected: {
        new_avg_utilization: Math.round(Math.min(newAvgUtil, 1) * 1000) / 1000,
        monthly_savings: closeSavings + rebalanceGain,
      },
      zones: zoneStats,
    });
  } catch (err) {
    console.error("[zone/optimize]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add app/api/zone/compare/ app/api/zone/optimize/
git commit -m "feat(zone): add API routes — compare and optimize"
```

---

## Task 6: API Routes — scenarios (GET/POST via Upstash Redis), report (POST via Slack webhook)

**Files:**
- Create: `app/api/zone/scenarios/route.ts`
- Create: `app/api/zone/report/route.ts`

**Source:** `C:\Users\socar\socar\zone-simulator\app.py` lines 433-552

- [ ] **Step 1: `app/api/zone/scenarios/route.ts` 생성 — 시나리오 저장/목록 (Upstash Redis)**

`app/api/zone/scenarios/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import type { ScenarioSaveParams, ZoneScenario } from "@/types/zone";

// ── Redis client (lazy singleton) ─────────────────────────────
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn("[zone/scenarios] UPSTASH_REDIS not configured");
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// ── Key helpers ───────────────────────────────────────────────
const PREFIX = "zone:scenario";

function scenarioKey(id: string): string {
  return `${PREFIX}:${id}`;
}

function indexKey(): string {
  return `${PREFIX}:index`;
}

// ── TTL: 90 days ──────────────────────────────────────────────
const TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * POST /api/zone/scenarios — 시나리오 저장
 * Body: { mode, parameters, results }
 */
export async function POST(req: NextRequest) {
  try {
    const body: ScenarioSaveParams = await req.json();
    const { mode, parameters, results } = body;

    if (!mode) {
      return NextResponse.json(
        { error: "mode는 필수입니다." },
        { status: 400 },
      );
    }

    const redis = getRedis();
    if (!redis) {
      return NextResponse.json(
        { error: "시나리오 저장소가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    const scenario: ZoneScenario = { id, mode, parameters, results, created_at: createdAt };

    // 시나리오 저장 (90일 TTL)
    await redis.set(scenarioKey(id), scenario, { ex: TTL_SECONDS });

    // 인덱스에 추가 (최근 100개까지)
    await redis.lpush(indexKey(), id);
    await redis.ltrim(indexKey(), 0, 99);

    return NextResponse.json({ id, created_at: createdAt });
  } catch (err) {
    console.error("[zone/scenarios] save error:", err);
    return NextResponse.json(
      { error: "시나리오 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}

/**
 * GET /api/zone/scenarios — 시나리오 목록
 */
export async function GET() {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json([]);
    }

    // 인덱스에서 ID 목록 조회
    const ids: string[] = await redis.lrange(indexKey(), 0, 49);
    if (ids.length === 0) return NextResponse.json([]);

    // 각 시나리오 조회
    const scenarios: Array<{
      id: string;
      mode: string;
      created_at: string;
      parameters: Record<string, unknown>;
    }> = [];

    for (const id of ids) {
      const s = await redis.get<ZoneScenario>(scenarioKey(id));
      if (s) {
        scenarios.push({
          id: s.id,
          mode: s.mode,
          created_at: s.created_at,
          parameters: s.parameters,
        });
      }
    }

    return NextResponse.json(scenarios);
  } catch (err) {
    console.error("[zone/scenarios] list error:", err);
    return NextResponse.json(
      { error: "시나리오 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: `app/api/zone/report/route.ts` 생성 — Slack 리포트**

`app/api/zone/report/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import type { SlackReportParams } from "@/types/zone";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";

const MODE_LABELS: Record<string, string> = {
  open: "개설 검토",
  close: "폐쇄 검토",
  compare: "존 비교",
  optimize: "최적화",
};

/**
 * POST /api/zone/report
 *
 * Body: { mode, data }
 *
 * Slack Block Kit 메시지를 웹훅으로 발송.
 */
export async function POST(req: NextRequest) {
  try {
    const body: SlackReportParams = await req.json();
    const { mode, data } = body;

    if (!SLACK_WEBHOOK_URL) {
      return NextResponse.json(
        { error: "Slack 웹훅이 설정되지 않았습니다." },
        { status: 400 },
      );
    }

    const blocks = buildSlackBlocks(mode, data);
    const resp = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `Slack 발송 실패: ${text}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[zone/report]", err);
    return NextResponse.json(
      { error: "Slack 발송에 실패했습니다." },
      { status: 500 },
    );
  }
}

/** 모드별 Slack Block Kit 메시지 생성. */
function buildSlackBlocks(
  mode: string,
  data: Record<string, unknown>,
): unknown[] {
  const header = {
    type: "header",
    text: {
      type: "plain_text",
      text: `📍 존 시뮬레이터 — ${MODE_LABELS[mode] ?? mode}`,
    },
  };
  const divider = { type: "divider" };

  let fields: string[];

  if (mode === "open") {
    fields = [
      `*예상 대당 매출:* ₩${(Number(data.estimated_revenue_per_car) || 0).toLocaleString()}/일`,
      `*예상 가동률:* ${Math.round((Number(data.estimated_utilization) || 0) * 1000) / 10}%`,
      `*클러스터 유형:* ${data.cluster_type ?? "미분류"}`,
      `*반경 내 존:* ${Array.isArray(data.nearby_zones) ? data.nearby_zones.length : 0}개`,
    ];
    const cannibal = Array.isArray(data.cannibalization) ? data.cannibalization : [];
    const danger = cannibal.filter(
      (c: Record<string, unknown>) => c.level === "danger",
    );
    if (danger.length > 0) {
      fields.push(
        `*⚠️ 카니발리제이션:* ${danger.map((c: Record<string, unknown>) => `${c.zone_name}(${c.distance_m}m)`).join(", ")}`,
      );
    }
  } else if (mode === "close") {
    const t = (data.target_zone ?? {}) as Record<string, unknown>;
    const d = (data.demand_transfer ?? {}) as Record<string, unknown>;
    fields = [
      `*대상 존:* ${t.name ?? ""}`,
      `*가동률:* ${Math.round((Number(t.utilization) || 0) * 1000) / 10}%`,
      `*흡수율:* ${d.total_absorption_pct ?? 0}%`,
      `*이탈율:* ${d.churn_pct ?? 0}%`,
      `*순 효과:* ₩${(Number(d.net_effect_monthly) || 0).toLocaleString()}/월`,
    ];
  } else if (mode === "compare") {
    const zones = Array.isArray(data.zones) ? data.zones : [];
    fields = zones.map(
      (z: Record<string, unknown>) =>
        `*${z.name ?? ""}:* 매출 ₩${(Number(z.revenue_per_car) || 0).toLocaleString()} / 가동률 ${Math.round((Number(z.utilization) || 0) * 1000) / 10}%`,
    );
  } else if (mode === "optimize") {
    const s = (data.summary ?? {}) as Record<string, unknown>;
    const p = (data.projected ?? {}) as Record<string, unknown>;
    fields = [
      `*운영 존:* ${s.total_zones ?? 0}개`,
      `*평균 가동률:* ${Math.round((Number(s.avg_utilization) || 0) * 1000) / 10}%`,
      `*개선 후 예상:* ${Math.round((Number(p.new_avg_utilization) || 0) * 1000) / 10}%`,
      `*월 절감:* ₩${(Number(p.monthly_savings) || 0).toLocaleString()}`,
    ];
  } else {
    fields = [JSON.stringify(data)];
  }

  const bodyBlock = {
    type: "section",
    fields: fields.slice(0, 10).map((f) => ({ type: "mrkdwn", text: f })),
  };

  return [header, divider, bodyBlock];
}
```

- [ ] **Step 3: 커밋**

```bash
git add app/api/zone/scenarios/ app/api/zone/report/
git commit -m "feat(zone): add API routes — scenarios (Upstash Redis) and Slack report"
```

---

## Summary: API Endpoint Mapping

| Python (zone-simulator) | Next.js (호도 대시보드) | Method |
|---|---|---|
| `GET /api/regions` | `GET /api/zone/zones?list=regions` | GET |
| `GET /api/regions/{region1}` | `GET /api/zone/zones?list=subregions&region1=X` | GET |
| `GET /api/zones` | `GET /api/zone/zones` | GET |
| `POST /api/simulate/open` | `POST /api/zone/simulate/open` | POST |
| `POST /api/simulate/close` | `POST /api/zone/simulate/close` | POST |
| `POST /api/compare` | `POST /api/zone/compare` | POST |
| `POST /api/optimize` | `POST /api/zone/optimize` | POST |
| `POST /api/scenarios` | `POST /api/zone/scenarios` | POST |
| `GET /api/scenarios` | `GET /api/zone/scenarios` | GET |
| `POST /api/slack/report` | `POST /api/zone/report` | POST |

## Key Migration Decisions

1. **SQL injection prevention**: `assertSafe()` 함수로 문자열 파라미터 검증 (기존 relocation.ts 패턴)
2. **Zone cache**: 모듈 레벨 `_zoneCache` + `_zoneCacheTs` (Python과 동일한 1시간 TTL). Vercel Functions 인스턴스 재사용 시 캐시 유효.
3. **Scenarios**: GCS 대신 Upstash Redis 사용 (기존 `workspace-state-store.ts` 패턴). 90일 TTL, 최근 100개 인덱스.
4. **regions/subregions/zones 통합**: 3개의 Python 엔드포인트를 1개의 `/api/zone/zones` GET route로 통합 (`?list=` 쿼리 파라미터).
5. **`_safe_int()`/`_safe_float()` 대체**: `Number(v) || 0` 패턴 사용 (`num()` 헬퍼).
