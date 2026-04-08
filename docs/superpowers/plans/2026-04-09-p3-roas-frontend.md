# P3. ROAS 프론트엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ROAS 시뮬레이터의 시뮬레이션 페이지와 캠페인 분석 페이지를 React + shadcn/ui + Recharts로 재작성한다.

**Architecture:** 기존 Vanilla JS의 DOM 조작을 React 상태 관리로 전환. shadcn Card/Table/Select/Tabs 활용. Chart.js 차트를 Recharts로 교체. 시뮬레이션 계산은 클라이언트에서 수행.

**Tech Stack:** React 19, TypeScript, shadcn/ui, Recharts, Next.js 16 App Router

---

## File Structure

```
types/roas.ts                                        <- 신규: 프론트엔드 전용 타입 (Coupon, SimResult, Campaign 등)
components/roas/roas-region-selector.tsx              <- 신규: 캐스케이드 지역→존 선택기
components/roas/roas-simulator.tsx                    <- 신규: 시뮬레이션 메인 폼 (Step 1~4)
components/roas/roas-result-charts.tsx                <- 신규: Recharts 차트 (ROAS 바, 민감도 히트맵, 워터폴, 시나리오 오버레이)
components/roas/campaign-list.tsx                     <- 신규: 캠페인 검색 + 목록 테이블
components/roas/campaign-detail.tsx                   <- 신규: 캠페인 상세 패널 (KPI 카드, 크로스탭, 일별 트렌드)
components/roas/campaign-impact.tsx                   <- 신규: 3-view 영향도 분석 + 판정 배너 + DID 차트
app/(dashboard)/roas/page.tsx                         <- 수정: 시뮬레이터 컴포넌트 연결
app/(dashboard)/roas/analysis/page.tsx                <- 수정: 캠페인 분석 컴포넌트 연결
```

---

## Task 1: `types/roas.ts` + `components/roas/roas-region-selector.tsx` -- 타입 정의 및 캐스케이드 지역 선택기

**Files:**
- Create: `types/roas.ts`
- Create: `components/roas/roas-region-selector.tsx`

지역1 → 지역2(복수) → 존 검색의 3단계 캐스케이드 선택기와 프론트엔드 전용 타입을 정의한다.

- [ ] **Step 1: `types/roas.ts` 생성 -- 프론트엔드 전용 타입**

프론트엔드에서 사용하는 모든 ROAS 관련 타입을 정의한다. `lib/roas.ts`는 `"server-only"`이므로 클라이언트 컴포넌트에서 직접 import 불가하다. 클라이언트에서 필요한 타입만 이 파일에 재정의한다.

```ts
// types/roas.ts

// ── 존/지역 ──────────────────────────────────────────────────

export interface Zone {
  id: number;
  name: string;
  address: string;
}

// ── 성능 매트릭스 (Performance) ──────────────────────────────

export interface MatrixRow {
  age_group: string;
  age_label: string;
  duration_group: string;
  duration_label: string;
  day_type: string;
  nuse: number;
  revenue: number;
}

export interface PerformanceData {
  matrix: MatrixRow[];
  age_groups: string[];
  age_labels: Record<string, string>;
  duration_groups: string[];
  duration_labels: Record<string, string>;
  summary: {
    total_nuse: number;
    total_revenue: number;
    avg_rev_per_use: number;
  };
}

// ── 쿠폰 입력 ───────────────────────────────────────────────

export interface CouponInput {
  id: string;           // 고유 키 (React key 용)
  name: string;
  qty: number;
  conv_rate: number;    // 전환율 (%)
  discount: number;     // 할인금액 (원)
  rev_per_use: number;  // 건당 매출 (원)
  organic_rate: number; // 자연전환율 (%)
}

// ── 시뮬레이션 결과 (클라이언트 계산) ──────────────────────────

export interface CouponResult {
  name: string;
  conversions: number;
  revenue: number;
  cost: number;
  roas: number | null;
  incrementalConv: number;
  incrementalRev: number;
}

export interface SimulationResult {
  totalConversions: number;
  totalRevenue: number;
  totalCouponCost: number;
  totalCost: number;       // couponCost + adCost + etcCost
  roas: number | null;
  incrementalConv: number;
  incrementalRoas: number | null;
  breakEvenRate: number | null;
  perCoupon: CouponResult[];
}

// ── 시나리오 ──────────────────────────────────────────────────

export interface ScenarioInput {
  zone_ids: number[];
  region1: string;
  region2: string[];
  start_date: string;
  end_date: string;
  coupons: Omit<CouponInput, "id">[];
  ad_cost: number;
  etc_cost: number;
}

export interface Scenario {
  id: string;
  name: string;
  inputs: ScenarioInput;
  results: {
    conversions: number;
    revenue: number;
    total_cost: number;
    roas: number;
    incremental_roas: number;
  };
  created_at: string;
}

// ── 캠페인 목록 ──────────────────────────────────────────────

export interface CampaignListItem {
  policy_id: number;
  name: string;
  division: string;
  start_date: string;
  end_date: string;
  issued: number;
  used: number;
  usage_rate: number;
  revenue: number;
  discount: number;
  roas: number;
  is_ongoing: boolean;
}

// ── 캠페인 상세 ──────────────────────────────────────────────

export interface CampaignSummary {
  issued: number;
  used: number;
  usage_rate: number;
  revenue: number;
  discount: number;
  net_revenue: number;
  roas: number;
}

export interface CrosstabRow {
  age_group: string;
  age_label: string;
  duration_group: string;
  duration_label: string;
  nuse: number;
  revenue: number;
}

export interface DailyTrendItem {
  date: string;
  used_count: number;
  revenue: number;
  discount: number;
}

export interface CampaignDetailData {
  summary: CampaignSummary;
  crosstab: {
    matrix: CrosstabRow[];
    age_groups: string[];
    age_labels: Record<string, string>;
    duration_groups: string[];
    duration_labels: Record<string, string>;
  };
  daily_trend: DailyTrendItem[];
  target_zones: number[];
  target_regions: { region1: string; region2: string[] };
}

// ── 영향도 분석 ──────────────────────────────────────────────

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

export interface DailySeriesItem {
  date: string;
  target_nuse: number;
  target_revenue: number;
  control_nuse: number;
  control_revenue: number;
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

export interface Verdict {
  score: number;
  label: string;
  summary: string;
  insights: string[];
  note?: string;
}

export interface CampaignImpactData {
  analysis_a: AnalysisA;
  analysis_b: AnalysisB;
  analysis_c: AnalysisC;
  verdict: Verdict;
  is_ongoing: boolean;
}

// ── 예측 vs 실적 비교 ───────────────────────────────────────

export interface ForecastItem {
  label: string;
  predicted: number;
  actual: number;
  diff?: number;
  diff_pct?: number;
  unit?: string;
}

export interface ForecastComparisonData {
  scenario_name: string;
  items: ForecastItem[];
}
```

- [ ] **Step 2: `components/roas/roas-region-selector.tsx` 생성**

캐스케이드 지역 선택기 컴포넌트를 생성한다. 기존 simulator.js의 loadRegions → loadRegion2 → loadZones 흐름을 React 상태로 전환한다. region2는 체크박스 복수선택, zone도 체크박스 복수선택이다.

```tsx
// components/roas/roas-region-selector.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Zone } from "@/types/roas";

interface RegionSelectorProps {
  /** 선택된 존 ID 배열 (제어 컴포넌트) */
  selectedZoneIds: number[];
  /** 존 선택 변경 콜백 */
  onZoneChange: (zoneIds: number[]) => void;
  /** 선택된 region1 값 (부모에 알림용) */
  onRegionChange?: (region1: string, region2: string[]) => void;
}

export function RoasRegionSelector({
  selectedZoneIds,
  onZoneChange,
  onRegionChange,
}: RegionSelectorProps) {
  // -- 상태 --
  const [regions, setRegions] = useState<string[]>([]);
  const [region1, setRegion1] = useState("");
  const [subRegions, setSubRegions] = useState<string[]>([]);
  const [selectedRegion2, setSelectedRegion2] = useState<string[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneSearch, setZoneSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // -- region1 목록 로드 (마운트 시 1회) --
  useEffect(() => {
    fetch("/api/roas/regions")
      .then((r) => r.json())
      .then((data: string[]) => setRegions(data))
      .catch(() => {});
  }, []);

  // -- region1 변경 → region2 로드 --
  useEffect(() => {
    if (!region1) {
      setSubRegions([]);
      setSelectedRegion2([]);
      setZones([]);
      return;
    }
    fetch(`/api/roas/regions/${encodeURIComponent(region1)}`)
      .then((r) => r.json())
      .then((data: string[]) => {
        setSubRegions(data);
        setSelectedRegion2(data); // 기본: 전체 선택
      })
      .catch(() => {});
  }, [region1]);

  // -- region 변경 알림 --
  useEffect(() => {
    onRegionChange?.(region1, selectedRegion2);
  }, [region1, selectedRegion2, onRegionChange]);

  // -- 존 검색 --
  const handleSearchZones = useCallback(async () => {
    if (!region1 || selectedRegion2.length === 0) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        region1,
        region2: selectedRegion2.join(","),
      });
      const resp = await fetch(`/api/roas/zones?${params}`);
      const data: Zone[] = await resp.json();
      setZones(data);
      // 기본: 전체 존 선택
      onZoneChange(data.map((z) => z.id));
    } catch {
      // error handling via toast in parent
    } finally {
      setLoading(false);
    }
  }, [region1, selectedRegion2, onZoneChange]);

  // -- region2 체크박스 토글 --
  const toggleRegion2 = (r2: string) => {
    setSelectedRegion2((prev) =>
      prev.includes(r2) ? prev.filter((x) => x !== r2) : [...prev, r2]
    );
  };

  const toggleAllRegion2 = () => {
    setSelectedRegion2((prev) =>
      prev.length === subRegions.length ? [] : [...subRegions]
    );
  };

  // -- 존 체크박스 토글 --
  const toggleZone = (id: number) => {
    onZoneChange(
      selectedZoneIds.includes(id)
        ? selectedZoneIds.filter((x) => x !== id)
        : [...selectedZoneIds, id]
    );
  };

  const toggleAllZones = () => {
    const filteredZones = getFilteredZones();
    const allSelected = filteredZones.every((z) =>
      selectedZoneIds.includes(z.id)
    );
    if (allSelected) {
      const filteredIds = new Set(filteredZones.map((z) => z.id));
      onZoneChange(selectedZoneIds.filter((id) => !filteredIds.has(id)));
    } else {
      const existing = new Set(selectedZoneIds);
      const merged = [...selectedZoneIds];
      for (const z of filteredZones) {
        if (!existing.has(z.id)) merged.push(z.id);
      }
      onZoneChange(merged);
    }
  };

  const getFilteredZones = () => {
    if (!zoneSearch.trim()) return zones;
    const q = zoneSearch.toLowerCase();
    return zones.filter(
      (z) =>
        z.name.toLowerCase().includes(q) ||
        z.address.toLowerCase().includes(q) ||
        String(z.id).includes(q)
    );
  };

  const filteredZones = getFilteredZones();

  return (
    <Card className="border-border/60 bg-card/95 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.16)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">지역 / 존 선택</CardTitle>
        <p className="text-sm text-muted-foreground">
          시/도 → 시/군/구 → 존을 순서대로 선택합니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* region1 select */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">시/도</label>
          <select
            value={region1}
            onChange={(e) => setRegion1(e.target.value)}
            className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm"
          >
            <option value="">-- 선택 --</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* region2 checkboxes */}
        {subRegions.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                시/군/구 ({selectedRegion2.length}/{subRegions.length})
              </label>
              <button
                type="button"
                onClick={toggleAllRegion2}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedRegion2.length === subRegions.length ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            <div className="max-h-36 overflow-y-auto rounded-xl border border-border/70 bg-background p-2 space-y-0.5">
              {subRegions.map((r2) => (
                <label key={r2} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRegion2.includes(r2)}
                    onChange={() => toggleRegion2(r2)}
                    className="rounded"
                  />
                  <span className="text-xs">{r2}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 존 검색 버튼 */}
        {subRegions.length > 0 && (
          <Button
            onClick={handleSearchZones}
            disabled={loading || selectedRegion2.length === 0}
            className="w-full"
            size="sm"
          >
            {loading ? "검색 중..." : "존 검색"}
          </Button>
        )}

        {/* 존 목록 */}
        {zones.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                존 ({selectedZoneIds.length}/{zones.length}개 선택)
              </label>
              <button
                type="button"
                onClick={toggleAllZones}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                전체 선택/해제
              </button>
            </div>
            <Input
              placeholder="존 이름/주소/ID 검색..."
              value={zoneSearch}
              onChange={(e) => setZoneSearch(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border/70 bg-background p-2 space-y-0.5">
              {filteredZones.map((z) => (
                <label key={z.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedZoneIds.includes(z.id)}
                    onChange={() => toggleZone(z.id)}
                    className="rounded"
                  />
                  <span className="text-xs">
                    <span className="font-medium">{z.name}</span>
                    <span className="text-muted-foreground ml-1">({z.id})</span>
                  </span>
                </label>
              ))}
              {filteredZones.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {zoneSearch ? "검색 결과 없음" : "존이 없습니다"}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add types/roas.ts components/roas/roas-region-selector.tsx
git commit -m "feat(roas): add frontend types and cascading region/zone selector

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `components/roas/roas-simulator.tsx` -- 시뮬레이터 메인 폼

**Files:**
- Create: `components/roas/roas-simulator.tsx`

기존 simulator.js의 Step 1~4 흐름을 단일 React 컴포넌트로 전환한다. 핵심 포인트:
- 지역/존 선택은 RoasRegionSelector에 위임
- 날짜 범위 (퀵 버튼: 1/3/6/12개월)
- 성능 매트릭스 조회 및 연령대x이용시간 크로스탭 렌더 (체크박스 행/열 선택, 가중평균 건당매출 계산)
- 쿠폰 파라미터 입력 (최대 5개, 동적 추가/삭제)
- **클라이언트 사이드 ROAS 계산** (simulator.js의 calculateROAS 로직 포팅)
- 시나리오 저장

- [ ] **Step 1: 컴포넌트 기본 구조 -- 상태 정의 및 레이아웃**

```tsx
// components/roas/roas-simulator.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RoasRegionSelector } from "./roas-region-selector";
import { RoasResultCharts } from "./roas-result-charts";
import type {
  CouponInput,
  PerformanceData,
  MatrixRow,
  SimulationResult,
  CouponResult,
  Scenario,
} from "@/types/roas";

const MAX_COUPONS = 5;
const QUICK_DATE_OPTIONS = [
  { label: "1개월", months: 1 },
  { label: "3개월", months: 3 },
  { label: "6개월", months: 6 },
  { label: "12개월", months: 12 },
];

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDateRange(months: number): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - 1);
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  return { start: formatDate(start), end: formatDate(end) };
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

let couponIdCounter = 0;
function newCouponId(): string {
  return `cpn-${++couponIdCounter}`;
}

function createDefaultCoupon(revPerUse = 0): CouponInput {
  return {
    id: newCouponId(),
    name: "쿠폰 1",
    qty: 0,
    conv_rate: 0,
    discount: 0,
    rev_per_use: revPerUse,
    organic_rate: 0,
  };
}
```

레이아웃은 `xl:grid-cols-[22rem_minmax(0,1fr)]` 2열 그리드이다. 왼쪽: 지역 선택기 + 파라미터 패널, 오른쪽: 매트릭스 + 결과 + 차트.

- [ ] **Step 2: 성능 매트릭스 조회 및 크로스탭 렌더**

성능 매트릭스 조회 함수:

```tsx
async function fetchPerformance(
  zoneIds: number[],
  startDate: string,
  endDate: string
): Promise<PerformanceData> {
  const resp = await fetch("/api/roas/performance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zone_ids: zoneIds, start_date: startDate, end_date: endDate }),
  });
  if (!resp.ok) throw new Error("조회 실패");
  return resp.json();
}
```

크로스탭 테이블은 상태로 관리:
- `selectedAges: Record<string, boolean>` -- 연령대별 체크 상태
- `selectedDurations: Record<string, boolean>` -- 이용시간별 체크 상태  
- `dayType: "all" | "weekday" | "weekend"` -- 요일 필터

셀 렌더: 체크된 행+열의 교차 셀에 `bg-blue-50` 하이라이트. 각 셀에 `nuse건 / revenue원` 두 줄 표시.

가중평균 건당매출 계산 (simulator.js의 `recalcWeightedAvg` 포팅):

```tsx
const weightedAvgRevPerUse = useMemo(() => {
  if (!perfData) return 0;
  let totalNuse = 0;
  let totalRevenue = 0;
  for (const row of perfData.matrix) {
    if (dayType !== "all" && row.day_type !== dayType) continue;
    if (selectedAges[row.age_group] && selectedDurations[row.duration_group]) {
      totalNuse += row.nuse;
      totalRevenue += row.revenue;
    }
  }
  return totalNuse > 0 ? Math.round(totalRevenue / totalNuse) : 0;
}, [perfData, selectedAges, selectedDurations, dayType]);
```

매트릭스가 로드되면 `weightedAvgRevPerUse`를 쿠폰의 `rev_per_use` 기본값으로 설정한다.

- [ ] **Step 3: 쿠폰 입력 영역**

쿠폰 상태:
- `coupons: CouponInput[]` -- 초기값 `[createDefaultCoupon()]`
- `adCost: number` -- 광고비
- `etcCost: number` -- 기타 비용

쿠폰 행 추가/삭제:

```tsx
function addCoupon() {
  if (coupons.length >= MAX_COUPONS) return;
  setCoupons((prev) => [
    ...prev,
    {
      ...createDefaultCoupon(weightedAvgRevPerUse),
      name: `쿠폰 ${prev.length + 1}`,
    },
  ]);
}

function removeCoupon(id: string) {
  if (coupons.length <= 1) return;
  setCoupons((prev) => prev.filter((c) => c.id !== id));
}

function updateCoupon(id: string, field: keyof CouponInput, value: string | number) {
  setCoupons((prev) =>
    prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
  );
}
```

쿠폰 입력 UI: shadcn Table 내에 각 행이 name/qty/conv_rate/discount/rev_per_use/organic_rate Input 필드 + 실시간 계산 결과(매출/비용/ROAS) 표시 + 삭제 버튼. `{coupons.length} / {MAX_COUPONS}` 카운터 표시.

- [ ] **Step 4: 클라이언트 사이드 ROAS 계산 로직**

**핵심 포팅 대상:** simulator.js line 998~1293의 `calculateROAS()` 함수를 순수 함수로 재작성한다. 이 계산은 서버가 아닌 클라이언트에서 수행된다.

```tsx
/**
 * 시뮬레이션 결과를 계산한다. (클라이언트 사이드)
 * simulator.js의 calculateROAS() 로직을 1:1 포팅.
 */
function calculateSimulation(
  coupons: CouponInput[],
  adCost: number,
  etcCost: number
): SimulationResult | null {
  const hasData = coupons.some(
    (c) => c.qty > 0 && c.conv_rate > 0 && c.rev_per_use > 0
  );
  if (!hasData) return null;

  let totalConversions = 0;
  let totalRevenue = 0;
  let totalCouponCost = 0;
  let totalOrganicConv = 0;
  let totalIncrementalConv = 0;
  let totalIncrementalRev = 0;
  let totalQty = 0;
  let weightedMarginNum = 0; // SUM(conv_i * (rev_i - discount_i))
  let weightedMarginDen = 0; // SUM(conv_i)

  const perCoupon: CouponResult[] = [];

  for (const c of coupons) {
    const conv = c.qty * (c.conv_rate / 100);
    const rev = conv * c.rev_per_use;
    const cost = conv * c.discount;
    const organicConv = c.qty * (c.organic_rate / 100);
    const incrConv = conv - organicConv;
    const incrRev = incrConv * c.rev_per_use;
    const indivRoas = cost > 0 ? (rev / cost) * 100 : null;

    perCoupon.push({
      name: c.name,
      conversions: conv,
      revenue: rev,
      cost,
      roas: indivRoas,
      incrementalConv: incrConv,
      incrementalRev: incrRev,
    });

    totalConversions += conv;
    totalRevenue += rev;
    totalCouponCost += cost;
    totalOrganicConv += organicConv;
    totalIncrementalConv += incrConv;
    totalIncrementalRev += incrRev;
    totalQty += c.qty;

    if (conv > 0) {
      weightedMarginNum += conv * (c.rev_per_use - c.discount);
      weightedMarginDen += conv;
    }
  }

  const totalCost = totalCouponCost + adCost + etcCost;
  const roas = totalCost > 0 ? (totalRevenue / totalCost) * 100 : null;
  const incrementalRoas =
    totalCost > 0 ? (totalIncrementalRev / totalCost) * 100 : null;

  // 손익분기 전환율 (가중평균 마진 기반)
  let breakEvenRate: number | null = null;
  const fixedCosts = adCost + etcCost;
  if (totalQty > 0 && weightedMarginDen > 0) {
    const weightedMargin = weightedMarginNum / weightedMarginDen;
    if (weightedMargin > 0) {
      breakEvenRate = (fixedCosts * 100) / (totalQty * weightedMargin);
    }
  }

  return {
    totalConversions,
    totalRevenue,
    totalCouponCost,
    totalCost,
    roas,
    incrementalConv: totalIncrementalConv,
    incrementalRoas: incrementalRoas,
    breakEvenRate,
    perCoupon,
  };
}
```

`useMemo`로 `coupons`, `adCost`, `etcCost` 의존성을 걸어 실시간 계산:

```tsx
const simResult = useMemo(
  () => calculateSimulation(coupons, adCost, etcCost),
  [coupons, adCost, etcCost]
);
```

- [ ] **Step 5: 결과 카드 + 요약 텍스트 + 시나리오 저장**

결과 카드 4개: 전환수, 매출, 비용, ROAS (shadcn Card grid). 추가 카드: 증분 전환수, 증분 ROAS.

손익분기 배지: `breakEvenRate`에 따라 색상 분기 (green/yellow/red).

Executive Summary 생성 (simulator.js의 `generateExecSummary` 포팅):

```tsx
function generateExecSummary(result: SimulationResult, couponCount: number): string | null {
  if (!result || result.totalCost <= 0) return null;
  const { totalCost, totalRevenue, roas, incrementalRoas, breakEvenRate } = result;

  const costText = totalCost >= 1_0000_0000
    ? `${(totalCost / 1_0000_0000).toFixed(1)}억원`
    : totalCost >= 10000
      ? `${Math.round(totalCost / 10000).toLocaleString("ko-KR")}만원`
      : `${totalCost.toLocaleString("ko-KR")}원`;

  const revenueText = totalRevenue >= 1_0000_0000
    ? `약 ${(totalRevenue / 1_0000_0000).toFixed(1)}억원`
    : totalRevenue >= 10000
      ? `약 ${Math.round(totalRevenue / 10000).toLocaleString("ko-KR")}만원`
      : `${totalRevenue.toLocaleString("ko-KR")}원`;

  let summary = couponCount > 1 ? `${couponCount}개 쿠폰 합산 기준, ` : "";
  summary += `본 캠페인은 ${costText} 투자로 ${revenueText} 매출이 기대되며 (ROAS ${roas?.toFixed(0)}%)`;

  if (incrementalRoas !== null && incrementalRoas > 0) {
    summary += `, 자연전환을 제외한 증분 기준으로도 ROAS ${incrementalRoas.toFixed(0)}%가 예상됩니다.`;
  } else {
    summary += ".";
  }

  if (breakEvenRate !== null && breakEvenRate <= 100) {
    summary += ` 손익분기 전환율 ${breakEvenRate.toFixed(1)}%.`;
  }

  return summary;
}
```

시나리오 저장: `POST /api/roas/scenarios`에 `{ name, inputs, results }` 전송. 저장 성공 시 `toast.success`.

- [ ] **Step 6: 전체 JSX 조합 및 커밋**

`RoasSimulator` 컴포넌트 전체 JSX를 완성한다:
- 좌측 패널: `RoasRegionSelector`, 날짜 선택 + 퀵 버튼, 조회 버튼
- 우측 패널: 크로스탭 매트릭스 테이블, 쿠폰 입력 테이블, 결과 카드 4개, Executive Summary, 시나리오 저장 버튼
- 하단: `RoasResultCharts` (차트 영역)

```bash
git add components/roas/roas-simulator.tsx
git commit -m "feat(roas): implement simulator form with client-side ROAS calculation

Ports calculateROAS(), recalcWeightedAvg(), and exec summary from
vanilla JS simulator.js to React with useMemo-based reactivity.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `components/roas/roas-result-charts.tsx` -- Recharts 차트

**Files:**
- Create: `components/roas/roas-result-charts.tsx`

기존 Chart.js 기반 차트 4종을 Recharts로 교체한다. simulator.js의 VIZ-03, VIZ-05 (sensitivity), VIZ-07 (waterfall), VIZ-08 (scenario overlay)에 해당한다.

- [ ] **Step 1: ROAS 바 차트 (쿠폰별 비교)**

simulator.js line 1087~1161의 per-coupon ROAS bar chart를 Recharts `BarChart`로 구현.
쿠폰별 ROAS(%), 매출(원), 비용(원)을 이중 Y축으로 표시한다.

```tsx
// components/roas/roas-result-charts.tsx
"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell,
  LineChart, Line, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CouponResult, SimulationResult, CouponInput } from "@/types/roas";

interface ResultChartsProps {
  simResult: SimulationResult | null;
  coupons: CouponInput[];
  adCost: number;
  etcCost: number;
  scenarios?: Array<{
    name: string;
    roas: number | null;
    incrementalRoas: number | null;
    totalRevenue: number;
    totalCost: number;
  }>;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

// ROAS 바 차트: 쿠폰별 ROAS + 매출/비용 비교
function RoasBarChart({ perCoupon }: { perCoupon: CouponResult[] }) {
  if (perCoupon.length === 0) return null;

  const data = perCoupon.map((c) => ({
    name: c.name,
    roas: c.roas !== null ? Math.round(c.roas * 10) / 10 : 0,
    revenue: Math.round(c.revenue),
    cost: Math.round(c.cost),
  }));

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">쿠폰별 ROAS 비교</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: "ROAS (%)", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: "금액 (원)", angle: 90, position: "insideRight", style: { fontSize: 11 } }} />
            <Tooltip formatter={(value: number, name: string) =>
              name === "roas" ? `${value.toFixed(1)}%` : `${formatNumber(value)}원`
            } />
            <Legend />
            <Bar yAxisId="left" dataKey="roas" name="ROAS (%)" fill="#00B4D8" />
            <Bar yAxisId="right" dataKey="revenue" name="매출" fill="#0077A8" />
            <Bar yAxisId="right" dataKey="cost" name="쿠폰비용" fill="#90E0EF" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 민감도 히트맵**

simulator.js line 1296~1428의 sensitivity heatmap을 Recharts `ScatterChart`로 구현. 전환율 스케일(Y) x 할인 스케일(X)에서 ROAS 값을 색상 코딩한 셀로 표시.

```tsx
const RATE_SCALES = [0.5, 0.7, 0.85, 1.0, 1.15, 1.3, 1.5];
const DISCOUNT_SCALES = [0.5, 0.75, 1.0, 1.25, 1.5];

function computeScaledRoas(
  coupons: CouponInput[],
  rateScale: number,
  discountScale: number,
  adCost: number,
  etcCost: number
): number | null {
  let totalRevenue = 0;
  let totalCouponCost = 0;
  for (const c of coupons) {
    const scaledRate = Math.min(c.conv_rate * rateScale, 100);
    const scaledDiscount = c.discount * discountScale;
    const conv = c.qty * (scaledRate / 100);
    totalRevenue += conv * c.rev_per_use;
    totalCouponCost += conv * scaledDiscount;
  }
  const total = totalCouponCost + adCost + etcCost;
  return total > 0 ? (totalRevenue / total) * 100 : null;
}

function roasCellColor(roas: number | null): string {
  if (roas === null) return "#f5f5f5";
  if (roas >= 300) return "#4CAF50";
  if (roas >= 100) return "#C8E6C9";
  if (roas >= 50) return "#FFF9C4";
  return "#FFCDD2";
}
```

히트맵은 `ScatterChart` + `Cell`로 구현:
- X축: 할인 스케일 (50%~150%)
- Y축: 전환율 스케일 (50%~150%)
- 각 점 크기는 고정, 색상은 `roasCellColor`로 결정
- 현재 값(1.0, 1.0) 셀에 border 강조
- 툴팁: 전환율/할인/ROAS 표시

- [ ] **Step 3: 워터폴 차트**

simulator.js line 1430~1507의 waterfall chart를 Recharts stacked `BarChart`로 구현. 기저매출 → 증분매출 → 쿠폰비용 → 순매출 4단계.

```tsx
function WaterfallChart({ result }: { result: SimulationResult }) {
  if (result.totalRevenue <= 0) return null;

  const baseRevenue = result.totalRevenue - (result.incrementalConv > 0
    ? result.perCoupon.reduce((s, c) => s + c.incrementalRev, 0)
    : 0);
  const incremental = result.totalRevenue - baseRevenue;
  const netRevenue = result.totalRevenue - result.totalCost;

  const data = [
    { name: "기저매출", value: baseRevenue, fill: "#1976D2" },
    { name: "증분매출", value: incremental, fill: "#43A047" },
    { name: "쿠폰비용", value: -result.totalCost, fill: "#e53935" },
    { name: "순매출", value: netRevenue, fill: "#00B4D8" },
  ];

  // Recharts waterfall은 floating bar (base/top) 패턴으로 구현
  // ...BarChart + stacked invisible base + visible value
}
```

워터폴 차트는 Recharts에서 네이티브 지원하지 않으므로, `[base, top]` 형식의 stacked bar 패턴을 사용:
- invisible base bar (투명) + visible value bar
- 각 바에 ROAS 라벨 annotation (순매출 바 상단)

- [ ] **Step 4: 시나리오 오버레이 차트**

시나리오 비교 차트: 선택된 시나리오들의 ROAS/매출/비용을 grouped bar로 비교.

- [ ] **Step 5: 메인 export 및 커밋**

```tsx
export function RoasResultCharts({ simResult, coupons, adCost, etcCost, scenarios }: ResultChartsProps) {
  if (!simResult) return null;

  return (
    <div className="space-y-4">
      {simResult.perCoupon.length >= 1 && (
        <RoasBarChart perCoupon={simResult.perCoupon} />
      )}
      <SensitivityHeatmap coupons={coupons} adCost={adCost} etcCost={etcCost} />
      <WaterfallChart result={simResult} />
      {scenarios && scenarios.length >= 2 && (
        <ScenarioOverlayChart scenarios={scenarios} />
      )}
    </div>
  );
}
```

```bash
git add components/roas/roas-result-charts.tsx
git commit -m "feat(roas): add Recharts charts — ROAS bar, sensitivity heatmap, waterfall, scenario overlay

Replaces Chart.js charts from simulator.js with Recharts equivalents.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `components/roas/campaign-list.tsx` + `campaign-detail.tsx` -- 캠페인 검색/목록/상세

**Files:**
- Create: `components/roas/campaign-list.tsx`
- Create: `components/roas/campaign-detail.tsx`

기존 analysis.js의 Step 1 (캠페인 검색/목록) + Step 2 (캠페인 상세) 흐름을 React로 전환한다.

- [ ] **Step 1: `campaign-list.tsx` 생성 -- 캠페인 검색 + 목록 테이블**

analysis.js의 date init, searchCampaigns, renderCampaignRows, division filter 로직을 포팅한다.

```tsx
// components/roas/campaign-list.tsx
"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { CampaignListItem } from "@/types/roas";

interface CampaignListProps {
  onSelectCampaign: (policyId: number) => void;
  selectedPolicyId: number | null;
}

const QUICK_DATE_OPTIONS = [
  { label: "1개월", months: 1 },
  { label: "3개월", months: 3 },
  { label: "6개월", months: 6 },
  { label: "12개월", months: 12 },
];

const DIVISIONS = ["지역사업", "마케팅", "사업"];
```

상태:
- `startDate`, `endDate` (퀵 버튼으로 기본 3개월)
- `campaigns: CampaignListItem[]` (API 응답)
- `searchQuery: string` (정책번호/이름 필터)
- `checkedDivisions: string[]` (구분 필터 체크박스)
- `loading: boolean`

검색: `GET /api/roas/campaigns?start_date=X&end_date=Y` → `campaigns` 상태 업데이트.

필터링 (`useMemo`):
```tsx
const filteredCampaigns = useMemo(() => {
  return campaigns.filter((c) => {
    if (!checkedDivisions.includes(c.division)) return false;
    if (searchQuery) {
      const pid = String(c.policy_id);
      if (/^\d+$/.test(searchQuery)) {
        if (pid !== searchQuery && !pid.startsWith(searchQuery)) return false;
      } else {
        if (!c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
    }
    return true;
  });
}, [campaigns, checkedDivisions, searchQuery]);
```

테이블 컬럼: 정책번호, 정책명, 구분, 시작일, 종료일, 발급, 사용, 사용률, 매출, 할인, ROAS, 상태(진행중 배지).

행 클릭 → `onSelectCampaign(c.policy_id)` 호출.

- [ ] **Step 2: `campaign-detail.tsx` 생성 -- 캠페인 상세 패널**

analysis.js의 selectCampaign → loadDetail → renderSummary + renderCrosstab + renderDailyTrend 로직을 포팅한다.

```tsx
// components/roas/campaign-detail.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { CampaignDetailData, CampaignSummary } from "@/types/roas";

interface CampaignDetailProps {
  policyId: number;
  onImpactReady?: () => void;
}
```

상태: `detail: CampaignDetailData | null`, `loading: boolean`.

`useEffect`로 `policyId` 변경 시 `POST /api/roas/campaign/detail` 호출.

**Summary KPI 카드**: 7개 지표를 2행 grid로 표시:
- 발급수, 사용수, 사용률(%)
- 매출, 할인액, 순매출, ROAS

**크로스탭 테이블**: `detail.crosstab.matrix`를 연령대(행) x 이용시간(열) HTML table로 렌더. 각 셀에 `nuse건 / revenue원` 표시. ROAS 색상 코딩은 하지 않음 (분석 페이지에서는 읽기 전용).

**일별 트렌드 차트**: Recharts `LineChart`로 `daily_trend` 데이터를 이중 Y축 (매출/이용건수) 표시.

```tsx
<ResponsiveContainer width="100%" height={280}>
  <LineChart data={detail.daily_trend}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
    <YAxis yAxisId="left" label={{ value: "매출 (원)", angle: -90, position: "insideLeft" }} />
    <YAxis yAxisId="right" orientation="right" label={{ value: "이용건수", angle: 90, position: "insideRight" }} />
    <Tooltip />
    <Legend />
    <Line yAxisId="left" type="monotone" dataKey="revenue" name="매출" stroke="#00B4D8" dot={false} />
    <Line yAxisId="right" type="monotone" dataKey="used_count" name="이용건수" stroke="#43A047" dot={false} />
  </LineChart>
</ResponsiveContainer>
```

- [ ] **Step 3: 커밋**

```bash
git add components/roas/campaign-list.tsx components/roas/campaign-detail.tsx
git commit -m "feat(roas): add campaign list and detail components

Ports campaign search, division filter, summary KPIs, crosstab table,
and daily trend chart from analysis.js to React + Recharts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `components/roas/campaign-impact.tsx` -- 영향도 분석 + 판정

**Files:**
- Create: `components/roas/campaign-impact.tsx`

analysis.js의 Step 3 (Impact Analysis) 전체를 React로 전환한다. 3-view 분석 (A: 쿠폰 사용자 vs 미사용자, B: 전/후 비교, C: DID) + 판정 배너 + DID 일별 차트 + 예측 vs 실적 비교.

- [ ] **Step 1: 3-view 분석 카드 (A/B/C)**

```tsx
// components/roas/campaign-impact.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type {
  CampaignImpactData, AnalysisA, AnalysisB, AnalysisC, Verdict,
  Scenario, ForecastComparisonData, ForecastItem,
} from "@/types/roas";

interface CampaignImpactProps {
  policyId: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_0000_0000) return `${sign}${(abs / 1_0000_0000).toFixed(1)}억원`;
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}만원`;
  return `${formatNumber(Math.round(n))}원`;
}

function DiffBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const color = value >= 0 ? "text-green-600" : "text-red-500";
  return (
    <span className={`font-semibold ${color}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}
```

**분석 A** (쿠폰 사용자 vs 미사용자): analysis.js line 671~738의 `renderAnalysisA` 포팅. shadcn Card 내에 3행 테이블 (구분/건수/평균매출/평균이용시간 + 차이 행).

**분석 B** (캠페인 전/후 비교): analysis.js line 740~805의 `renderAnalysisB` 포팅. 3행 테이블 (이전/이후/변화).

**분석 C** (타겟존 vs 비타겟존 DID): analysis.js line 807~876의 `renderAnalysisC` 포팅. 3행 테이블 (타겟존/비타겟존/DID효과). `note`가 있으면 테이블 대신 안내 메시지.

- [ ] **Step 2: DID 일별 차트**

analysis.js line 878~1007의 `renderDIDChart` 포팅. Recharts `LineChart`로 이중 Y축 4개 라인:
- 타겟 이용건수 (실선, #00B4D8)
- 대조군 이용건수 (점선, #90CAF9)
- 타겟 매출 (실선, #43A047)
- 대조군 매출 (점선, #A5D6A7)

캠페인 시작일에 `ReferenceLine` 수직선 표시:

```tsx
{impact.analysis_c.camp_start && (
  <ReferenceLine
    x={impact.analysis_c.camp_start}
    stroke="#FF7043"
    strokeDasharray="6 4"
    label={{ value: "캠페인 시작", position: "top", fill: "#FF7043", fontSize: 11 }}
  />
)}
```

- [ ] **Step 3: 판정 배너**

analysis.js line 1009~1063의 `renderVerdict` 포팅. 점수에 따른 색상 분기:
- score >= 80: green (bg-green-50 border-green-200)
- score >= 50: yellow (bg-yellow-50 border-yellow-200)
- score < 50: red (bg-red-50 border-red-200)

```tsx
function VerdictBanner({ verdict }: { verdict: Verdict }) {
  const colorClass =
    verdict.score >= 80 ? "bg-green-50 border-green-200" :
    verdict.score >= 50 ? "bg-yellow-50 border-yellow-200" :
    "bg-red-50 border-red-200";

  const scoreColor =
    verdict.score >= 80 ? "bg-green-500" :
    verdict.score >= 50 ? "bg-yellow-500" :
    "bg-red-500";

  return (
    <div className={`rounded-2xl border p-4 ${colorClass}`}>
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-white font-bold text-sm ${scoreColor}`}>
          {Math.round(verdict.score)}
        </span>
        <span className="text-base font-semibold">{verdict.label}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{verdict.summary}</p>
      {verdict.note && (
        <p className="mt-1 text-xs text-muted-foreground">{verdict.note}</p>
      )}
      {verdict.insights.length > 0 && (
        <ul className="mt-2 space-y-1">
          {verdict.insights.map((insight, i) => (
            <li key={i} className="text-xs text-muted-foreground">- {insight}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 예측 vs 실적 비교 섹션**

analysis.js line 1065~1225의 forecast comparison을 포팅한다. 시나리오 목록을 `GET /api/roas/scenarios`로 로드, 선택 시 `POST /api/roas/campaign/vs-forecast`로 비교 데이터 조회.

비교 테이블: 항목 / 예측 / 실적 / 차이 / 차이% 5열. 차이 열 양수=green, 음수=red.

- [ ] **Step 5: 메인 export 조합 및 커밋**

```tsx
export function CampaignImpact({ policyId }: CampaignImpactProps) {
  const [impact, setImpact] = useState<CampaignImpactData | null>(null);
  const [forecast, setForecast] = useState<ForecastComparisonData | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // POST /api/roas/campaign/impact
    setLoading(true);
    fetch("/api/roas/campaign/impact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy_id: policyId }),
    })
      .then((r) => r.json())
      .then((data) => setImpact(data))
      .catch(() => toast.error("영향도 분석 조회에 실패했습니다."))
      .finally(() => setLoading(false));

    // GET /api/roas/scenarios (for forecast comparison)
    fetch("/api/roas/scenarios")
      .then((r) => r.json())
      .then((data) => setScenarios(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [policyId]);

  if (loading) return <Skeleton />;
  if (!impact) return null;

  return (
    <div className="space-y-4">
      {/* 3-view 분석 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <AnalysisACard data={impact.analysis_a} />
        <AnalysisBCard data={impact.analysis_b} />
        <AnalysisCCard data={impact.analysis_c} />
      </div>

      {/* DID 일별 차트 */}
      {impact.analysis_c.daily_series?.length > 0 && (
        <DIDDailyChart analysisC={impact.analysis_c} />
      )}

      {/* 판정 배너 */}
      <VerdictBanner verdict={impact.verdict} />

      {/* 예측 vs 실적 비교 */}
      {scenarios.length > 0 && (
        <ForecastComparison
          policyId={policyId}
          scenarios={scenarios}
          forecast={forecast}
          onForecastChange={setForecast}
        />
      )}
    </div>
  );
}
```

```bash
git add components/roas/campaign-impact.tsx
git commit -m "feat(roas): add impact analysis — 3-view cards, DID chart, verdict, forecast comparison

Ports renderAnalysisA/B/C, renderDIDChart, renderVerdict, and
forecast comparison from analysis.js to React + Recharts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 페이지 연결 -- `roas/page.tsx` + `roas/analysis/page.tsx`

**Files:**
- Modify: `app/(dashboard)/roas/page.tsx`
- Modify: `app/(dashboard)/roas/analysis/page.tsx`

placeholder 섹션을 실제 컴포넌트로 교체한다.

- [ ] **Step 1: `roas/page.tsx` 수정 -- 시뮬레이터 페이지**

기존 placeholder를 `RoasSimulator` 컴포넌트로 교체한다. 서버 컴포넌트(metadata export)에서 클라이언트 컴포넌트를 children으로 렌더한다.

```tsx
// app/(dashboard)/roas/page.tsx
import { RoasSimulator } from "@/components/roas/roas-simulator";

export const metadata = { title: "ROAS 시뮬레이터" };

export default function RoasPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            ROAS Simulator
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            쿠폰 캠페인 ROAS 시뮬레이션
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            지역, 존, 쿠폰 조건을 설정하고 투자 대비 수익을 예측합니다.
          </p>
        </div>
      </section>

      <RoasSimulator />
    </div>
  );
}
```

- [ ] **Step 2: `roas/analysis/page.tsx` 수정 -- 캠페인 분석 페이지**

`CampaignList` + `CampaignDetail` + `CampaignImpact`를 조합하는 클라이언트 래퍼를 만든다. 상태: `selectedPolicyId`.

```tsx
// app/(dashboard)/roas/analysis/page.tsx
import { RoasAnalysis } from "@/components/roas/roas-analysis";

export const metadata = { title: "캠페인 분석" };

export default function RoasAnalysisPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Campaign Analysis
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            캠페인 사후 분석
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            실행된 쿠폰 캠페인의 효과를 데이터로 분석하고 판정합니다.
          </p>
        </div>
      </section>

      <RoasAnalysis />
    </div>
  );
}
```

이를 위해 `components/roas/roas-analysis.tsx` 래퍼 컴포넌트를 추가 생성한다:

```tsx
// components/roas/roas-analysis.tsx
"use client";

import { useState } from "react";
import { CampaignList } from "./campaign-list";
import { CampaignDetail } from "./campaign-detail";
import { CampaignImpact } from "./campaign-impact";

export function RoasAnalysis() {
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <CampaignList
        onSelectCampaign={setSelectedPolicyId}
        selectedPolicyId={selectedPolicyId}
      />

      {selectedPolicyId && (
        <>
          <CampaignDetail policyId={selectedPolicyId} />
          <CampaignImpact policyId={selectedPolicyId} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 빌드 검증 및 커밋**

```bash
# 빌드 확인 (타입 오류 없는지)
npx tsc --noEmit

git add app/(dashboard)/roas/page.tsx app/(dashboard)/roas/analysis/page.tsx components/roas/roas-analysis.tsx
git commit -m "feat(roas): wire up simulator and analysis pages with React components

Replaces placeholder sections with RoasSimulator and RoasAnalysis
component trees. Adds roas-analysis.tsx wrapper for campaign workflow.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Verification Checklist

완료 후 확인 항목:

- [ ] `npx tsc --noEmit` 타입 오류 0건
- [ ] `/roas` 페이지: 지역→존 선택 → 매트릭스 조회 → 쿠폰 입력 → 실시간 ROAS 계산 동작
- [ ] `/roas/analysis` 페이지: 캠페인 검색 → 목록 표시 → 상세 클릭 → KPI/크로스탭/트렌드 표시
- [ ] 영향도 분석: 3-view 카드 + DID 차트 + 판정 배너 정상 렌더
- [ ] 민감도 히트맵, 워터폴 차트, ROAS 바 차트 정상 렌더
- [ ] 시나리오 저장/불러오기, 예측 vs 실적 비교 동작
- [ ] 모든 금액 표시: `toLocaleString("ko-KR")` 한국어 포맷
- [ ] 에러 시 `toast.error` 사용자 피드백
- [ ] 기존 API 엔드포인트 변경 없음 (P2 백엔드 그대로 사용)
