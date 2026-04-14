# Funnel Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zone-click-to-reservation CVR funnel dashboard as the 7th sidebar menu in the HODO dashboard.

**Architecture:** SQL files + API routes + client-side Recharts, matching existing ROAS/Zone patterns. Three API endpoints (regions, weekly, detail) serve data; one client component manages state with drilldown from region1 → region2.

**Tech Stack:** Next.js 16 App Router, TypeScript, Recharts, BigQuery, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-14-funnel-dashboard-design.md`

**Project root:** `C:\Users\socar\googlesheet-dashboard` (NOT the socar/ monorepo)

---

### Task 1: Types + lib utility

**Files:**
- Create: `types/funnel.ts`
- Create: `lib/funnel.ts`

- [ ] **Step 1: Create TypeScript types**

```typescript
// types/funnel.ts

export interface FunnelSummary {
  total_click_members: number;
  total_converted_members: number;
  cvr: number;
  clicks_per_user: number;
  wow_click_members: number;
  wow_converted_members: number;
  wow_cvr: number;
}

export interface FunnelTrendRow {
  year_week: string;
  click_member_cnt: number;
  converted_member_cnt: number;
  cvr: number;
}

export interface FunnelRankingRow {
  region: string;
  click_member_cnt: number;
  converted_member_cnt: number;
  zone_click_cnt: number;
  cvr: number;
  wow_cvr: number;
}

export interface FunnelData {
  summary: FunnelSummary;
  trend: FunnelTrendRow[];
  ranking: FunnelRankingRow[];
}
```

- [ ] **Step 2: Create lib/funnel.ts**

Follow the exact pattern from `lib/roas.ts` lines 153–197 (SQL cache + replaceSqlParams). The funnel module re-implements the same cache/replace pattern scoped to `sql/funnel/`.

```typescript
// lib/funnel.ts
import "server-only";

import { readFileSync } from "fs";
import { resolve } from "path";

// ── SQL 파일 캐시 (모듈 레벨) ──────────────────────────────────

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

/** sql/funnel/ 디렉토리에서 SQL 파일을 읽어 반환 (모듈 레벨 캐시 사용) */
export function loadFunnelSql(filename: string): string {
  return _readFunnelSqlFile(filename);
}

/**
 * SQL 내 {param} 플레이스홀더를 치환한다.
 * 문자열 값은 호출 측에서 쿼테이션 포함하여 전달해야 한다.
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

/** NaN/null-safe 정수 변환 */
export function safeInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** NaN/null-safe 소수점 4자리 변환 (CVR 등 비율값) */
export function safeFloat(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add types/funnel.ts lib/funnel.ts
git commit -m "feat(funnel): add TypeScript types and SQL utility lib"
```

---

### Task 2: SQL files

**Files:**
- Create: `sql/funnel/regions.sql`
- Create: `sql/funnel/weekly-by-region1.sql`
- Create: `sql/funnel/weekly-by-region2.sql`

- [ ] **Step 1: Create regions.sql**

```sql
-- sql/funnel/regions.sql
-- 전국 region1(시/도) 목록
SELECT DISTINCT region1
FROM `socar-data.tianjin_replica.carzone_info`
WHERE imaginary = 0
  AND region1 IS NOT NULL
ORDER BY region1
```

- [ ] **Step 2: Create weekly-by-region1.sql**

This is the user's validated query adapted for region1-level aggregation with WoW via LAG(). The `{weeks}` placeholder controls the lookback period. We fetch weeks+1 rows so the oldest row provides the LAG baseline, then the API trims it.

```sql
-- sql/funnel/weekly-by-region1.sql
-- 전국 시/도별 주간 존클릭→예약 전환율
-- params: {weeks} (정수, 조회 주차 수)

WITH zone_master AS (
  SELECT
    id AS zone_id,
    region1
  FROM `socar-data.tianjin_replica.carzone_info`
  WHERE imaginary = 0
),

click_base AS (
  SELECT
    DATE_TRUNC(DATE(g.event_timestamp, 'Asia/Seoul'), ISOWEEK) AS iso_week_start,
    EXTRACT(ISOYEAR FROM DATE(g.event_timestamp, 'Asia/Seoul')) AS iso_year,
    EXTRACT(ISOWEEK FROM DATE(g.event_timestamp, 'Asia/Seoul')) AS iso_week_num,
    TIMESTAMP(g.event_timestamp) AS click_ts,
    g.member_id,
    z.region1,
    g.zone_id
  FROM `socar-data.socar_server_2.get_car_classes` g
  INNER JOIN zone_master z ON g.zone_id = z.zone_id
  WHERE DATE(g.event_timestamp, 'Asia/Seoul')
        >= DATE_SUB(
             DATE_TRUNC(CURRENT_DATE('Asia/Seoul'), ISOWEEK),
             INTERVAL ({weeks} + 1) WEEK
           )
    AND g.member_id IS NOT NULL
),

reservation_base AS (
  SELECT
    DATE_TRUNC(DATE(r.created_at, 'Asia/Seoul'), ISOWEEK) AS iso_week_start,
    TIMESTAMP(r.created_at) AS res_ts,
    r.member_id,
    z.region1,
    r.zone_id
  FROM `socar-data.tianjin_replica.reservation_info` r
  INNER JOIN zone_master z ON r.zone_id = z.zone_id
  WHERE DATE(r.created_at, 'Asia/Seoul')
        >= DATE_SUB(
             DATE_TRUNC(CURRENT_DATE('Asia/Seoul'), ISOWEEK),
             INTERVAL ({weeks} + 1) WEEK
           )
    AND r.member_id IS NOT NULL
    AND r.channel NOT IN (
      'admin', 'system', 'alliance/naver_place', 'alliance/web_partners',
      'test_drive/owned', 'mobile/web', 'mobile/ios/web/korailtalk',
      'mobile/android/web/korailtalk', 'alliance/ota', 'test_drive'
    )
),

click_member_week AS (
  SELECT
    iso_week_start,
    region1,
    member_id,
    MIN(click_ts) AS first_click_ts,
    COUNT(*) AS zone_click_cnt
  FROM click_base
  GROUP BY 1, 2, 3
),

converted_member_week AS (
  SELECT DISTINCT
    c.iso_week_start,
    c.region1,
    c.member_id
  FROM click_member_week c
  INNER JOIN reservation_base r
    ON c.member_id = r.member_id
   AND c.iso_week_start = r.iso_week_start
   AND c.region1 = r.region1
   AND r.res_ts >= c.first_click_ts
),

weekly_summary AS (
  SELECT
    c.iso_week_start,
    c.region1,
    SUM(c.zone_click_cnt) AS zone_click_cnt,
    COUNT(DISTINCT c.member_id) AS click_member_cnt,
    COUNT(DISTINCT v.member_id) AS converted_member_cnt
  FROM click_member_week c
  LEFT JOIN converted_member_week v
    ON c.iso_week_start = v.iso_week_start
   AND c.region1 = v.region1
   AND c.member_id = v.member_id
  GROUP BY 1, 2
)

SELECT
  CONCAT(
    CAST(EXTRACT(ISOYEAR FROM iso_week_start) AS STRING),
    '-W',
    FORMAT('%02d', EXTRACT(ISOWEEK FROM iso_week_start))
  ) AS year_week,
  iso_week_start,
  region1,
  zone_click_cnt,
  click_member_cnt,
  converted_member_cnt,
  SAFE_DIVIDE(converted_member_cnt, click_member_cnt) AS cvr,
  LAG(SAFE_DIVIDE(converted_member_cnt, click_member_cnt))
    OVER (PARTITION BY region1 ORDER BY iso_week_start) AS prev_cvr
FROM weekly_summary
ORDER BY iso_week_start, region1
```

- [ ] **Step 3: Create weekly-by-region2.sql**

Same structure but with `{region1}` filter and region2-level grouping.

```sql
-- sql/funnel/weekly-by-region2.sql
-- 특정 시/도 내 구/군별 주간 존클릭→예약 전환율
-- params: {weeks} (정수), {region1} (문자열, 쿼테이션 포함)

WITH zone_master AS (
  SELECT
    id AS zone_id,
    region1,
    region2
  FROM `socar-data.tianjin_replica.carzone_info`
  WHERE imaginary = 0
    AND region1 = {region1}
),

click_base AS (
  SELECT
    DATE_TRUNC(DATE(g.event_timestamp, 'Asia/Seoul'), ISOWEEK) AS iso_week_start,
    TIMESTAMP(g.event_timestamp) AS click_ts,
    g.member_id,
    z.region2,
    g.zone_id
  FROM `socar-data.socar_server_2.get_car_classes` g
  INNER JOIN zone_master z ON g.zone_id = z.zone_id
  WHERE DATE(g.event_timestamp, 'Asia/Seoul')
        >= DATE_SUB(
             DATE_TRUNC(CURRENT_DATE('Asia/Seoul'), ISOWEEK),
             INTERVAL ({weeks} + 1) WEEK
           )
    AND g.member_id IS NOT NULL
),

reservation_base AS (
  SELECT
    DATE_TRUNC(DATE(r.created_at, 'Asia/Seoul'), ISOWEEK) AS iso_week_start,
    TIMESTAMP(r.created_at) AS res_ts,
    r.member_id,
    z.region2,
    r.zone_id
  FROM `socar-data.tianjin_replica.reservation_info` r
  INNER JOIN zone_master z ON r.zone_id = z.zone_id
  WHERE DATE(r.created_at, 'Asia/Seoul')
        >= DATE_SUB(
             DATE_TRUNC(CURRENT_DATE('Asia/Seoul'), ISOWEEK),
             INTERVAL ({weeks} + 1) WEEK
           )
    AND r.member_id IS NOT NULL
    AND r.channel NOT IN (
      'admin', 'system', 'alliance/naver_place', 'alliance/web_partners',
      'test_drive/owned', 'mobile/web', 'mobile/ios/web/korailtalk',
      'mobile/android/web/korailtalk', 'alliance/ota', 'test_drive'
    )
),

click_member_week AS (
  SELECT
    iso_week_start,
    region2,
    member_id,
    MIN(click_ts) AS first_click_ts,
    COUNT(*) AS zone_click_cnt
  FROM click_base
  GROUP BY 1, 2, 3
),

converted_member_week AS (
  SELECT DISTINCT
    c.iso_week_start,
    c.region2,
    c.member_id
  FROM click_member_week c
  INNER JOIN reservation_base r
    ON c.member_id = r.member_id
   AND c.iso_week_start = r.iso_week_start
   AND c.region2 = r.region2
   AND r.res_ts >= c.first_click_ts
),

weekly_summary AS (
  SELECT
    c.iso_week_start,
    c.region2,
    SUM(c.zone_click_cnt) AS zone_click_cnt,
    COUNT(DISTINCT c.member_id) AS click_member_cnt,
    COUNT(DISTINCT v.member_id) AS converted_member_cnt
  FROM click_member_week c
  LEFT JOIN converted_member_week v
    ON c.iso_week_start = v.iso_week_start
   AND c.region2 = v.region2
   AND c.member_id = v.member_id
  GROUP BY 1, 2
)

SELECT
  CONCAT(
    CAST(EXTRACT(ISOYEAR FROM iso_week_start) AS STRING),
    '-W',
    FORMAT('%02d', EXTRACT(ISOWEEK FROM iso_week_start))
  ) AS year_week,
  iso_week_start,
  region2 AS region,
  zone_click_cnt,
  click_member_cnt,
  converted_member_cnt,
  SAFE_DIVIDE(converted_member_cnt, click_member_cnt) AS cvr,
  LAG(SAFE_DIVIDE(converted_member_cnt, click_member_cnt))
    OVER (PARTITION BY region2 ORDER BY iso_week_start) AS prev_cvr
FROM weekly_summary
ORDER BY iso_week_start, region2
```

- [ ] **Step 4: Commit**

```bash
git add sql/funnel/
git commit -m "feat(funnel): add BigQuery SQL files for CVR funnel"
```

---

### Task 3: API routes

**Files:**
- Create: `app/api/funnel/regions/route.ts`
- Create: `app/api/funnel/weekly/route.ts`
- Create: `app/api/funnel/detail/route.ts`

- [ ] **Step 1: Create regions API**

```typescript
// app/api/funnel/regions/route.ts
import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadFunnelSql } from "@/lib/funnel";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async () => {
  const sql = loadFunnelSql("regions.sql");
  const rows = await runQuery(sql);

  if (!rows) {
    return NextResponse.json(
      { error: "BigQuery not configured" },
      { status: 500 },
    );
  }

  const regions = rows.map((r) => String(r.region1 ?? "")).filter(Boolean);
  return NextResponse.json(regions);
});
```

- [ ] **Step 2: Create weekly API**

This endpoint handles the heavy lifting: runs the region1 SQL, then computes summary, trend, and ranking from the raw rows. The SQL returns one row per (year_week, region1). The API must:
1. Aggregate across all regions per week for the `trend` array
2. Aggregate across all weeks per region for the `ranking` array (using the latest week for WoW)
3. Build `summary` from the latest week's totals

```typescript
// app/api/funnel/weekly/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadFunnelSql, replaceSqlParams, safeInt, safeFloat } from "@/lib/funnel";
import { withAuth } from "@/lib/api-utils";

interface RawRow {
  year_week: string;
  iso_week_start: { value: string };
  region1: string;
  zone_click_cnt: number;
  click_member_cnt: number;
  converted_member_cnt: number;
  cvr: number | null;
  prev_cvr: number | null;
}

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const weeks = Math.max(1, Math.min(52, Number(sp.get("weeks")) || 12));

  const raw = loadFunnelSql("weekly-by-region1.sql");
  const sql = replaceSqlParams(raw, { weeks: String(weeks) });
  const rows = (await runQuery(sql)) as RawRow[] | null;

  if (!rows) {
    return NextResponse.json(
      { error: "BigQuery not configured" },
      { status: 500 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({
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
    });
  }

  // Get unique weeks sorted, drop the oldest (LAG baseline only)
  const allWeeks = [...new Set(rows.map((r) => r.year_week))].sort();
  const displayWeeks = new Set(allWeeks.slice(1)); // drop oldest week
  const latestWeek = allWeeks[allWeeks.length - 1];
  const prevWeek = allWeeks.length >= 2 ? allWeeks[allWeeks.length - 2] : null;

  // --- Trend: aggregate all regions per week ---
  const trendMap = new Map<
    string,
    { click: number; converted: number; zone_click: number }
  >();
  for (const r of rows) {
    if (!displayWeeks.has(r.year_week)) continue;
    const acc = trendMap.get(r.year_week) ?? {
      click: 0,
      converted: 0,
      zone_click: 0,
    };
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

  // --- Ranking: latest week per region ---
  const latestRows = rows.filter((r) => r.year_week === latestWeek);
  const ranking = latestRows
    .map((r) => ({
      region: String(r.region1),
      click_member_cnt: safeInt(r.click_member_cnt),
      converted_member_cnt: safeInt(r.converted_member_cnt),
      zone_click_cnt: safeInt(r.zone_click_cnt),
      cvr: safeFloat(r.cvr),
      wow_cvr: r.cvr != null && r.prev_cvr != null
        ? Math.round((Number(r.cvr) - Number(r.prev_cvr)) * 10000) / 10000
        : 0,
    }))
    .sort((a, b) => b.cvr - a.cvr);

  // --- Summary: totals for latest week ---
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
    clicks_per_user:
      totalClick > 0
        ? Math.round((totalZoneClick / totalClick) * 10) / 10
        : 0,
    wow_click_members:
      prevClick > 0
        ? Math.round(((totalClick - prevClick) / prevClick) * 1000) / 1000
        : 0,
    wow_converted_members:
      prevConverted > 0
        ? Math.round(
            ((totalConverted - prevConverted) / prevConverted) * 1000,
          ) / 1000
        : 0,
    wow_cvr: Math.round((cvr - prevCvr) * 10000) / 10000,
  };

  return NextResponse.json({ summary, trend, ranking });
});
```

- [ ] **Step 3: Create detail API**

Same logic as weekly but uses `weekly-by-region2.sql` with region1 filter.

```typescript
// app/api/funnel/detail/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadFunnelSql, replaceSqlParams, safeInt, safeFloat } from "@/lib/funnel";
import { withAuth } from "@/lib/api-utils";

interface RawRow {
  year_week: string;
  iso_week_start: { value: string };
  region: string;
  zone_click_cnt: number;
  click_member_cnt: number;
  converted_member_cnt: number;
  cvr: number | null;
  prev_cvr: number | null;
}

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const region1 = sp.get("region1") ?? "";
  const weeks = Math.max(1, Math.min(52, Number(sp.get("weeks")) || 12));

  if (!region1) {
    return NextResponse.json(
      { error: "region1 parameter is required" },
      { status: 400 },
    );
  }

  const raw = loadFunnelSql("weekly-by-region2.sql");
  const sql = replaceSqlParams(raw, {
    weeks: String(weeks),
    region1: `'${region1.replace(/'/g, "''")}'`,
  });
  const rows = (await runQuery(sql)) as RawRow[] | null;

  if (!rows) {
    return NextResponse.json(
      { error: "BigQuery not configured" },
      { status: 500 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({
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
    });
  }

  const allWeeks = [...new Set(rows.map((r) => r.year_week))].sort();
  const displayWeeks = new Set(allWeeks.slice(1));
  const latestWeek = allWeeks[allWeeks.length - 1];
  const prevWeek = allWeeks.length >= 2 ? allWeeks[allWeeks.length - 2] : null;

  // Trend
  const trendMap = new Map<
    string,
    { click: number; converted: number; zone_click: number }
  >();
  for (const r of rows) {
    if (!displayWeeks.has(r.year_week)) continue;
    const acc = trendMap.get(r.year_week) ?? {
      click: 0,
      converted: 0,
      zone_click: 0,
    };
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

  // Ranking
  const latestRows = rows.filter((r) => r.year_week === latestWeek);
  const ranking = latestRows
    .map((r) => ({
      region: String(r.region),
      click_member_cnt: safeInt(r.click_member_cnt),
      converted_member_cnt: safeInt(r.converted_member_cnt),
      zone_click_cnt: safeInt(r.zone_click_cnt),
      cvr: safeFloat(r.cvr),
      wow_cvr: r.cvr != null && r.prev_cvr != null
        ? Math.round((Number(r.cvr) - Number(r.prev_cvr)) * 10000) / 10000
        : 0,
    }))
    .sort((a, b) => b.cvr - a.cvr);

  // Summary
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
    clicks_per_user:
      totalClick > 0
        ? Math.round((totalZoneClick / totalClick) * 10) / 10
        : 0,
    wow_click_members:
      prevClick > 0
        ? Math.round(((totalClick - prevClick) / prevClick) * 1000) / 1000
        : 0,
    wow_converted_members:
      prevConverted > 0
        ? Math.round(
            ((totalConverted - prevConverted) / prevConverted) * 1000,
          ) / 1000
        : 0,
    wow_cvr: Math.round((cvr - prevCvr) * 10000) / 10000,
  };

  return NextResponse.json({ summary, trend, ranking });
});
```

- [ ] **Step 4: Commit**

```bash
git add app/api/funnel/
git commit -m "feat(funnel): add API routes for regions, weekly CVR, and detail drilldown"
```

---

### Task 4: next.config.ts + sidebar

**Files:**
- Modify: `next.config.ts` — add outputFileTracingIncludes for funnel API routes
- Modify: `components/layout/sidebar.tsx` — add funnel nav item

- [ ] **Step 1: Update next.config.ts**

Add these entries to the `outputFileTracingIncludes` object (after the existing zone entries):

```typescript
"/api/funnel/regions": ["./sql/**/*.sql"],
"/api/funnel/weekly": ["./sql/**/*.sql"],
"/api/funnel/detail": ["./sql/**/*.sql"],
```

- [ ] **Step 2: Update sidebar.tsx**

Add `MousePointerClick` to the lucide-react import:

```typescript
import {
  ArrowLeftRight,
  Car,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  MapPin,
  Menu,
  MousePointerClick,
  SearchCheck,
  TrendingUp,
  X,
} from "lucide-react";
```

Add funnel entry to `navItems` array (before the workspace entry):

```typescript
const navItems = [
  { icon: LayoutDashboard, label: "대시보드", href: "/dashboard" },
  { icon: Car, label: "신차 배분", href: "/allocation" },
  { icon: ArrowLeftRight, label: "재배치 추천", href: "/relocation" },
  { icon: TrendingUp, label: "ROAS 시뮬레이터", href: "/roas" },
  { icon: MapPin, label: "존 시뮬레이터", href: "/zone" },
  { icon: MousePointerClick, label: "전환율 퍼널", href: "/funnel" },
  { icon: SearchCheck, label: "워크스페이스", href: "/work-history" },
];
```

- [ ] **Step 3: Commit**

```bash
git add next.config.ts components/layout/sidebar.tsx
git commit -m "feat(funnel): add sidebar menu and Vercel file tracing config"
```

---

### Task 5: Page scaffolding

**Files:**
- Create: `app/(dashboard)/funnel/page.tsx`
- Create: `app/(dashboard)/funnel/loading.tsx`
- Create: `app/(dashboard)/funnel/error.tsx`

- [ ] **Step 1: Create page.tsx**

```typescript
// app/(dashboard)/funnel/page.tsx
import { FunnelContent } from "@/components/funnel/funnel-content";

export const dynamic = "force-dynamic";

export default function FunnelPage() {
  return (
    <div className="space-y-6">
      <FunnelContent />
    </div>
  );
}
```

- [ ] **Step 2: Create loading.tsx**

```typescript
// app/(dashboard)/funnel/loading.tsx
export default function FunnelLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-9 w-16 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl bg-card/80"
          />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-80 animate-pulse rounded-2xl bg-card/80" />

      {/* Bottom section skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl bg-card/80" />
        <div className="col-span-2 h-72 animate-pulse rounded-2xl bg-card/80" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create error.tsx**

```typescript
// app/(dashboard)/funnel/error.tsx
"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function FunnelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="space-y-4 pt-6">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">
            데이터를 불러올 수 없습니다
          </h2>
          <p className="text-sm text-muted-foreground">
            잠시 후 다시 시도해주세요.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60">
              오류 코드: {error.digest}
            </p>
          )}
          <Button onClick={reset}>다시 시도</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/funnel/
git commit -m "feat(funnel): add page scaffolding with loading and error states"
```

---

### Task 6: KPI cards component

**Files:**
- Create: `components/funnel/kpi-cards.tsx`

- [ ] **Step 1: Create kpi-cards.tsx**

```typescript
// components/funnel/kpi-cards.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { FunnelSummary } from "@/types/funnel";

function WowBadge({ value, isPercent }: { value: number; isPercent?: boolean }) {
  if (value === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        — {isPercent ? "0.0%p" : "0.0%"}
      </span>
    );
  }
  const positive = value > 0;
  const display = isPercent
    ? `${positive ? "+" : ""}${(value * 100).toFixed(1)}%p`
    : `${positive ? "+" : ""}${(value * 100).toFixed(1)}%`;
  return (
    <span className={positive ? "text-xs text-emerald-500" : "text-xs text-red-500"}>
      {positive ? "▲" : "▼"} {display}
    </span>
  );
}

const CARDS: {
  key: keyof FunnelSummary;
  label: string;
  wowKey: keyof FunnelSummary;
  format: (v: number) => string;
  isPercentWow?: boolean;
}[] = [
  {
    key: "total_click_members",
    label: "존클릭 유저",
    wowKey: "wow_click_members",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "total_converted_members",
    label: "전환 유저",
    wowKey: "wow_converted_members",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "cvr",
    label: "전환율 (CVR)",
    wowKey: "wow_cvr",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    isPercentWow: true,
  },
  {
    key: "clicks_per_user",
    label: "인당 클릭",
    wowKey: "clicks_per_user", // not used for WoW
    format: (v) => v.toFixed(1),
  },
];

interface KpiCardsProps {
  summary: FunnelSummary;
}

export function KpiCards({ summary }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {CARDS.map((card) => (
        <Card key={card.key} className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {card.key === "cvr" ? (
                <span className="text-blue-500">
                  {card.format(summary[card.key] as number)}
                </span>
              ) : (
                card.format(summary[card.key] as number)
              )}
            </p>
            {card.key !== "clicks_per_user" && (
              <div className="mt-1 flex items-center gap-1">
                <WowBadge
                  value={summary[card.wowKey] as number}
                  isPercent={card.isPercentWow}
                />
                <span className="text-[10px] text-muted-foreground/60">
                  vs 전주
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/funnel/kpi-cards.tsx
git commit -m "feat(funnel): add KPI cards component with WoW badges"
```

---

### Task 7: CVR trend chart

**Files:**
- Create: `components/funnel/cvr-trend-chart.tsx`

- [ ] **Step 1: Create cvr-trend-chart.tsx**

```typescript
// components/funnel/cvr-trend-chart.tsx
"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChartColors } from "@/components/dashboard/charts/chart-colors";
import type { FunnelTrendRow } from "@/types/funnel";

interface CvrTrendChartProps {
  data: FunnelTrendRow[];
}

// "2026-W15" → "W15"
function formatWeekLabel(yearWeek: string): string {
  return yearWeek.split("-")[1] ?? yearWeek;
}

export function CvrTrendChart({ data }: CvrTrendChartProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === "dark");

  const chartData = data.map((r) => ({
    label: formatWeekLabel(r.year_week),
    click_member_cnt: r.click_member_cnt,
    converted_member_cnt: r.converted_member_cnt,
    cvr: Math.round(r.cvr * 1000) / 10, // 0.189 → 18.9
  }));

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">주간 CVR 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300} minWidth={0}>
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.axis, fontSize: 11 }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={(v) => v.toLocaleString()}
              width={60}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              width={45}
              domain={[0, "auto"]}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "cvr") return [`${value.toFixed(1)}%`, "CVR"];
                if (name === "click_member_cnt")
                  return [value.toLocaleString(), "클릭유저"];
                return [value.toLocaleString(), "전환유저"];
              }}
              contentStyle={{
                backgroundColor: colors.tooltip.bg,
                border: `1px solid ${colors.tooltip.border}`,
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend
              formatter={(value: string) => {
                if (value === "click_member_cnt") return "클릭유저";
                if (value === "converted_member_cnt") return "전환유저";
                return "CVR (%)";
              }}
              wrapperStyle={{ fontSize: "11px" }}
            />
            <Bar
              yAxisId="left"
              dataKey="click_member_cnt"
              fill="#34d399"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
              name="click_member_cnt"
            />
            <Bar
              yAxisId="left"
              dataKey="converted_member_cnt"
              fill="#a78bfa"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
              name="converted_member_cnt"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cvr"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={{ fill: "#60a5fa", r: 3 }}
              name="cvr"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/funnel/cvr-trend-chart.tsx
git commit -m "feat(funnel): add CVR trend chart with dual Y-axis"
```

---

### Task 8: Region ranking + detail table + header

**Files:**
- Create: `components/funnel/region-ranking.tsx`
- Create: `components/funnel/detail-table.tsx`
- Create: `components/funnel/funnel-header.tsx`

- [ ] **Step 1: Create region-ranking.tsx**

```typescript
// components/funnel/region-ranking.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelRankingRow } from "@/types/funnel";

interface RegionRankingProps {
  data: FunnelRankingRow[];
  onRegionClick?: (region: string) => void;
}

export function RegionRanking({ data, onRegionClick }: RegionRankingProps) {
  const maxCvr = Math.max(...data.map((r) => r.cvr), 0.01);
  const top10 = data.slice(0, 10);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">CVR 랭킹</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {top10.map((row, i) => (
          <button
            key={row.region}
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted/50"
            onClick={() => onRegionClick?.(row.region)}
          >
            <span
              className={`w-5 text-center text-xs font-bold ${
                i === 0
                  ? "text-yellow-500"
                  : i === 1
                    ? "text-gray-400"
                    : i === 2
                      ? "text-amber-700"
                      : "text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className="flex-1 truncate">{row.region}</span>
            <div className="w-20">
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{
                    width: `${Math.round((row.cvr / maxCvr) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <span className="w-12 text-right text-xs font-semibold text-blue-500">
              {(row.cvr * 100).toFixed(1)}%
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create detail-table.tsx**

```typescript
// components/funnel/detail-table.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { utils, writeFile } from "xlsx";
import type { FunnelRankingRow } from "@/types/funnel";

type SortKey = "region" | "click_member_cnt" | "converted_member_cnt" | "cvr" | "wow_cvr";

interface DetailTableProps {
  data: FunnelRankingRow[];
  canDrillDown?: boolean;
  onRegionClick?: (region: string) => void;
}

export function DetailTable({
  data,
  canDrillDown = false,
  onRegionClick,
}: DetailTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("click_member_cnt");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string" && typeof bv === "string")
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortAsc ? (
      <ChevronUp className="inline h-3 w-3" />
    ) : (
      <ChevronDown className="inline h-3 w-3" />
    );
  }

  function handleExport() {
    if (data.length === 0) return;
    const rows = data.map((r) => ({
      지역: r.region,
      클릭유저: r.click_member_cnt,
      전환유저: r.converted_member_cnt,
      CVR: Math.round(r.cvr * 1000) / 10,
      "WoW(%p)": Math.round(r.wow_cvr * 1000) / 10,
      인당클릭:
        r.click_member_cnt > 0
          ? Math.round((r.zone_click_cnt / r.click_member_cnt) * 10) / 10
          : 0,
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "전환율");
    writeFile(wb, `funnel-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const COLS: { key: SortKey; label: string; align: string }[] = [
    { key: "region", label: "지역", align: "text-left" },
    { key: "click_member_cnt", label: "클릭유저", align: "text-right" },
    { key: "converted_member_cnt", label: "전환유저", align: "text-right" },
    { key: "cvr", label: "CVR", align: "text-right" },
    { key: "wow_cvr", label: "WoW", align: "text-right" },
  ];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">상세 데이터</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={handleExport}
        >
          <Download className="h-3 w-3" /> Excel
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={`cursor-pointer px-3 py-2 font-medium ${col.align}`}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label} <SortIcon col={col.key} />
                </th>
              ))}
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                인당클릭
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const clicksPerUser =
                row.click_member_cnt > 0
                  ? (row.zone_click_cnt / row.click_member_cnt).toFixed(1)
                  : "0.0";
              return (
                <tr
                  key={row.region}
                  className={`border-b transition-colors last:border-0 ${
                    canDrillDown
                      ? "cursor-pointer hover:bg-muted/50"
                      : ""
                  }`}
                  onClick={() =>
                    canDrillDown && onRegionClick?.(row.region)
                  }
                >
                  <td className="px-3 py-2.5 font-medium">
                    {row.region}
                    {canDrillDown && (
                      <span className="ml-1 text-muted-foreground">→</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                    {row.click_member_cnt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                    {row.converted_member_cnt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-blue-500">
                    {(row.cvr * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.wow_cvr === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : row.wow_cvr > 0 ? (
                      <span className="text-emerald-500">
                        ▲ {(row.wow_cvr * 100).toFixed(1)}%p
                      </span>
                    ) : (
                      <span className="text-red-500">
                        ▼ {(Math.abs(row.wow_cvr) * 100).toFixed(1)}%p
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                    {clicksPerUser}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create funnel-header.tsx**

```typescript
// components/funnel/funnel-header.tsx
"use client";

import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PRESETS = [
  { label: "4주", value: 4 },
  { label: "8주", value: 8 },
  { label: "12주", value: 12 },
] as const;

interface FunnelHeaderProps {
  weeks: number;
  onWeeksChange: (w: number) => void;
  drillRegion: string | null;
  onBack: () => void;
  loading?: boolean;
}

export function FunnelHeader({
  weeks,
  onWeeksChange,
  drillRegion,
  onBack,
  loading,
}: FunnelHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {drillRegion && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" /> 전국
          </Button>
        )}
        <h1 className="text-lg font-bold tracking-tight">전환율 퍼널</h1>
        <Badge variant="secondary" className="text-xs">
          {drillRegion ?? "전국"}
        </Badge>
        {loading && (
          <span className="text-xs text-muted-foreground animate-pulse">
            로딩중...
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            variant={weeks === p.value ? "default" : "outline"}
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => onWeeksChange(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/funnel/region-ranking.tsx components/funnel/detail-table.tsx components/funnel/funnel-header.tsx
git commit -m "feat(funnel): add ranking, detail table, and header components"
```

---

### Task 9: Main content orchestrator

**Files:**
- Create: `components/funnel/funnel-content.tsx`

This is the main `'use client'` component that wires everything together: fetches data, manages state, handles drilldown.

- [ ] **Step 1: Create funnel-content.tsx**

```typescript
// components/funnel/funnel-content.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { FunnelData } from "@/types/funnel";
import { FunnelHeader } from "./funnel-header";
import { KpiCards } from "./kpi-cards";
import { CvrTrendChart } from "./cvr-trend-chart";
import { RegionRanking } from "./region-ranking";
import { DetailTable } from "./detail-table";

async function fetchFunnelData(
  weeks: number,
  region1: string | null,
): Promise<FunnelData> {
  const url = region1
    ? `/api/funnel/detail?region1=${encodeURIComponent(region1)}&weeks=${weeks}`
    : `/api/funnel/weekly?weeks=${weeks}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function FunnelContent() {
  const [weeks, setWeeks] = useState(12);
  const [drillRegion, setDrillRegion] = useState<string | null>(null);
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFunnelData(weeks, drillRegion);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [weeks, drillRegion]);

  useEffect(() => {
    load();
  }, [load]);

  function handleRegionClick(region: string) {
    if (!drillRegion) {
      // region1 view → drill into region2
      setDrillRegion(region);
    }
  }

  function handleBack() {
    setDrillRegion(null);
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            className="mt-2 text-sm text-blue-500 underline"
            onClick={load}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FunnelHeader
        weeks={weeks}
        onWeeksChange={setWeeks}
        drillRegion={drillRegion}
        onBack={handleBack}
        loading={loading}
      />

      {data && (
        <>
          <KpiCards summary={data.summary} />

          <CvrTrendChart data={data.trend} />

          <div className="grid gap-4 md:grid-cols-3">
            <RegionRanking
              data={data.ranking}
              onRegionClick={handleRegionClick}
            />
            <div className="md:col-span-2">
              <DetailTable
                data={data.ranking}
                canDrillDown={!drillRegion}
                onRegionClick={handleRegionClick}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/funnel/funnel-content.tsx
git commit -m "feat(funnel): add main content orchestrator with state management and drilldown"
```

---

### Task 10: Verify build + smoke test

- [ ] **Step 1: Run TypeScript check**

```bash
cd C:/Users/socar/googlesheet-dashboard && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: successful build with no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server and verify:

```bash
npm run dev
```

1. Open http://localhost:3000/funnel
2. Verify sidebar shows "전환율 퍼널" menu item
3. Verify KPI cards render (may show 0 if BQ not configured locally)
4. Verify period preset buttons (4주/8주/12주) toggle
5. If BQ is configured, verify data loads and charts render

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(funnel): address build/type issues from smoke test"
```
