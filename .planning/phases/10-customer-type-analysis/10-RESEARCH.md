# Phase 10: Customer Type Analysis - Research

**Researched:** 2026-03-01
**Domain:** Recharts 3 PieChart (donut) + stacked BarChart, React Client Component, period filter integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**차트 배치**
- 기존 4개 차트(`ChartsSection`) 아래에 추가
- 도넛(좌) + 스택 바 추이(우) 좌우 나란히 — 같은 행, CSS grid 또는 flex
- 각 차트에 개별 제목 (`Card > CardTitle` 패턴 유지)
  - 도넛: "고객 유형 분포"
  - 추이: "유형별 이용건수 추이"

**추이 차트 타입**
- 스택 바 (누적) — 3색 바가 누적되어 전체 총건수 + 각 유형 비율을 한 바로 파악
- X축 레이블: 기존 차트와 동일한 포맷 — 일별 `2/1`, 주차별 `1주`
- Y축: `건` 단위 표시 (예: `0건`, `10건`, `20건`)
- 툴팁: 왕복 N건, 부름 N건, 편도 N건, 합계 N건

**도넛 차트 정보**
- 중앙 텍스트: 총 이용건수 (예: `총 78건`)
- 조각 레이블 없음 — 범례(Legend)로만 유형명 표시
- 툴팁: 유형명 + 건수 + 비율 (예: `왕복: 45건 (58%)`)
- innerRadius: 60~70% (중앙 공간 충분히 확보)

**색상 체계**
- globals.css에 `--chart-3`, `--chart-4`, `--chart-5` CSS 변수 확장 (다크모드 포함) — **이미 존재함 (globals.css 라이트/다크 모두 정의됨, 아래 참고)**
- chart-colors.ts에 `chart3`, `chart4`, `chart5` 필드 추가
- 매핑 (도넛·스택 바 동일한 순서): 왕복=chart1(파랑), 부름=chart2(녹색), 편도=chart3(주황)

### Claude's Discretion
- 도넛 `innerRadius` 정확한 px 값
- 좌우 배치 grid 컬럼 비율 (도넛:추이 = 1:2 또는 1:1.5 등)
- 스택 바 `radius` prop 값
- 반응형 브레이크포인트 처리 (모바일에서 위아래로 전환 여부)

### Deferred Ideas (OUT OF SCOPE)

없음 — 논의가 Phase 10 스코프 내에서 진행됨.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTYPE-01 | 사용자가 왕복/부름/편도 이용건수 비율을 도넛 차트로 확인할 수 있다 | Recharts PieChart with innerRadius (donut). Cell per segment with chart colors. Legend only (no slice labels). Center SVG text for total count. Tooltip with 건수 + %. |
| CTYPE-02 | 사용자가 왕복/부름/편도 이용건수의 일별/주차별 추이를 스택 차트로 확인할 수 있다 | Recharts BarChart with 3 Bar components sharing `stackId="a"`. tab prop switches daily/weekly data. Same label format as existing charts. |
| CTYPE-03 | 기간 필터(이번 주/지난 주/이번 달/지난 달) 변경 시 고객 유형 차트도 즉시 반영된다 | `filteredData` in DashboardContent currently does NOT filter customerTypeDaily/Weekly. Must extend the `useMemo` to filter customerType arrays using the same period logic. New CustomerTypeSection receives filtered data via `data.customerTypeDaily/Weekly`. |
</phase_requirements>

---

## Summary

Phase 10 is a pure UI phase: the data layer (Phase 9) is already complete. The task is to render two Recharts charts using `CustomerTypeRow[]` arrays from `filteredData` — a donut chart (PieChart with innerRadius) and a stacked bar chart (BarChart with `stackId`). Both components follow the exact same "use client" + `useTheme()` + `getChartColors()` + `Card > CardHeader > CardTitle > CardContent` pattern established by the existing 4 chart components.

The most important non-obvious finding: `DashboardContent.filteredData` currently only filters `data.daily` / `data.weekly`. The `customerTypeDaily` and `customerTypeWeekly` arrays pass through unfiltered (they equal `data.customerTypeDaily` / `data.customerTypeWeekly`). Phase 10 must extend the `useMemo` in `DashboardContent` to also filter these arrays by period, using the same date-range filter functions already in `lib/period-utils.ts`. Without this extension, CTYPE-03 will not work.

The existing `globals.css` already has `--chart-3`, `--chart-4`, `--chart-5` CSS variables defined for both light and dark themes. The only missing piece is adding `chart3`, `chart4`, `chart5` to the `ChartColorMode` interface and `CHART_COLORS` object in `chart-colors.ts`.

**Primary recommendation:** Build in 2 plans — Plan 01: extend ChartColorMode + filter customerType in DashboardContent + add CustomerTypeSection skeleton. Plan 02: implement DonutChart + StackedBarChart components and add mock data for dev testing.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.7.0 | PieChart (donut) + BarChart (stacked) | Already installed, used by all 4 existing charts |
| next-themes | 0.4.6 | `useTheme()` for dark/light color switching | Same as all existing chart components |
| react | 19.2.3 | "use client" component | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Card | installed | Card > CardHeader > CardTitle + CardContent | Wrapping each chart (existing pattern) |
| tailwindcss v4 | 4.x | grid/flex layout for side-by-side charts | Two-column row layout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts PieChart | D3 directly | D3 is too low-level; Recharts is already the project standard |
| CSS absolute overlay for center text | Recharts Label component | Label with position="center" works in Recharts 3.7 (bug was fixed in 3.0 era). SVG `<text>` at cx/cy is the reliable fallback. |

**Installation:** No new packages needed. All dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
components/dashboard/charts/
├── chart-colors.ts           # ADD: chart3, chart4, chart5 fields
├── charts-section.tsx        # ADD: import + render <CustomerTypeSection>
├── customer-type-section.tsx # NEW: wrapper with grid layout (donut + stacked bar)
├── customer-type-donut.tsx   # NEW: PieChart donut component
├── customer-type-trend.tsx   # NEW: stacked BarChart component
├── revenue-trend-chart.tsx   # existing
├── profit-trend-chart.tsx    # existing
├── utilization-trend-chart.tsx # existing
└── usage-trend-chart.tsx     # existing

components/dashboard/
└── dashboard-content.tsx     # MODIFY: extend filteredData useMemo for customerType arrays

lib/
└── mock-data.ts              # MODIFY: populate customerTypeDaily/Weekly with sample data
```

### Pattern 1: Period Filter Extension for CustomerType (CRITICAL for CTYPE-03)

**What:** Extend `DashboardContent.filteredData` useMemo to filter `customerTypeDaily` and `customerTypeWeekly` in parallel with `data.daily`.

**When to use:** Required for CTYPE-03 — without this, period filter changes don't affect customer type charts.

**Current behavior:** The `filteredData` useMemo uses `{ ...data, daily: filtered }` spread — so `customerTypeDaily` equals `data.customerTypeDaily` (unfiltered full array).

**Example:**
```typescript
// components/dashboard/dashboard-content.tsx
// Source: derived from existing filterDailyByPeriod pattern in lib/period-utils.ts

const filteredData = useMemo<TeamDashboardData>(() => {
  if (tab === 'daily') {
    const range = getDateRange(period);
    const filtered = filterDailyByPeriod(data.daily, range);
    // NEW: filter customerTypeDaily using date field (same ISO format)
    const filteredCustomerTypeDaily = data.customerTypeDaily.filter(
      (r) => r.date !== undefined && r.date >= range.start && r.date <= range.end
    );
    return { ...data, daily: filtered, customerTypeDaily: filteredCustomerTypeDaily };
  } else {
    const weeklyPeriod = (period === 'last-month' ? 'last-month' : 'this-month') as
      | 'this-month'
      | 'last-month';
    const filtered = filterWeeklyByPeriod(data.weekly, weeklyPeriod);
    // NEW: filter customerTypeWeekly using week field (same month parsing)
    const filteredCustomerTypeWeekly = filterWeeklyCustomerType(
      data.customerTypeWeekly, weeklyPeriod
    );
    return { ...data, weekly: filtered, customerTypeWeekly: filteredCustomerTypeWeekly };
  }
}, [data, tab, period]);
```

Note: `filterWeeklyCustomerType` follows the same logic as `filterWeeklyByPeriod` but operates on `CustomerTypeRow` (which has `week?` not a WeeklyRecord). The planner can implement this as a helper in `period-utils.ts` or inline in `dashboard-content.tsx`.

### Pattern 2: Donut Chart (PieChart with innerRadius)

**What:** Recharts `PieChart > Pie` with `innerRadius` and `outerRadius`. Three `Cell` components for segment colors. `Legend` for type names. Center total count via SVG `<text>` element.

**When to use:** CTYPE-01 — donut shows proportion.

**Example:**
```typescript
// components/dashboard/charts/customer-type-donut.tsx
"use client";

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerTypeRow } from "@/types/dashboard";
import { getChartColors } from "./chart-colors";

// Source: Recharts PieChart pattern — https://recharts.github.io/en-US/examples/
// Center text via SVG <text> at cx/cy (reliable across Recharts 2.x → 3.x)

interface CustomerTypeDonutProps {
  data: CustomerTypeRow[];
}

export function CustomerTypeDonut({ data }: CustomerTypeDonutProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === "dark");

  // Aggregate all rows into single totals for the donut
  const totals = data.reduce(
    (acc, r) => ({
      roundTrip: acc.roundTrip + r.roundTripCount,
      call: acc.call + r.callCount,
      oneWay: acc.oneWay + r.oneWayCount,
    }),
    { roundTrip: 0, call: 0, oneWay: 0 }
  );

  const total = totals.roundTrip + totals.call + totals.oneWay;

  const pieData = [
    { name: "왕복", value: totals.roundTrip },
    { name: "부름", value: totals.call },
    { name: "편도", value: totals.oneWay },
  ];

  const segmentColors = [colors.chart1, colors.chart2, colors.chart3];

  return (
    <Card>
      <CardHeader>
        <CardTitle>고객 유형 분포</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius="60%"
              outerRadius="80%"
              label={false}
              labelLine={false}
            >
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={segmentColors[index]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => {
                const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0;
                return [`${value}건 (${pct}%)`, name];
              }}
              contentStyle={{
                backgroundColor: colors.tooltip.bg,
                border: `1px solid ${colors.tooltip.border}`,
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend />
            {/* Center total — SVG text directly in PieChart, NOT inside Pie */}
            {/* Uses percentage-based innerRadius so cx/cy from data works */}
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fill: colors.axis, fontSize: "14px", fontWeight: "600" }}
            >
              {`총 ${total}건`}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### Pattern 3: Stacked BarChart (CTYPE-02)

**What:** Recharts `BarChart` with three `Bar` components all sharing `stackId="a"`. Y-axis formatted as `건` unit.

**When to use:** CTYPE-02 — stacked bar shows per-period breakdown.

**Example:**
```typescript
// components/dashboard/charts/customer-type-trend.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerTypeRow } from "@/types/dashboard";
import { getChartColors } from "./chart-colors";

// Source: Recharts stacked bar pattern — stackId same value causes bars to stack
// https://recharts.github.io/en-US/examples/StackedBarChart/

interface CustomerTypeTrendProps {
  data: CustomerTypeRow[];
  tab: "daily" | "weekly";
}

function formatLabel(r: CustomerTypeRow, tab: "daily" | "weekly"): string {
  if (tab === "daily" && r.date) {
    const parts = r.date.split("-");
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  }
  if (tab === "weekly" && r.week) {
    return r.week.replace("주차", "주");
  }
  return "";
}

export function CustomerTypeTrend({ data, tab }: CustomerTypeTrendProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === "dark");

  const chartData = data.map((r) => ({
    label: formatLabel(r, tab),
    왕복: r.roundTripCount,
    부름: r.callCount,
    편도: r.oneWayCount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>유형별 이용건수 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis dataKey="label" tick={{ fill: colors.axis, fontSize: 11 }} />
            <YAxis
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={(v) => `${v}건`}
              width={50}
            />
            <Tooltip
              formatter={(value, name) => [`${value}건`, name]}
              contentStyle={{
                backgroundColor: colors.tooltip.bg,
                border: `1px solid ${colors.tooltip.border}`,
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend />
            {/* stackId="a" — all three bars stack on the same x position */}
            <Bar dataKey="왕복" stackId="a" fill={colors.chart1} />
            <Bar dataKey="부름" stackId="a" fill={colors.chart2} />
            <Bar dataKey="편도" stackId="a" fill={colors.chart3} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

Note: `radius` (rounded top) applies only to the topmost bar (편도) — applying it to all bars creates visual artifacts on internal segments.

### Pattern 4: CustomerTypeSection — Side-by-Side Layout

**What:** Wrapper component holding both charts in a two-column grid row below `ChartsSection`.

**Example:**
```typescript
// components/dashboard/charts/customer-type-section.tsx
"use client";

import type { CustomerTypeRow } from "@/types/dashboard";
import { CustomerTypeDonut } from "./customer-type-donut";
import { CustomerTypeTrend } from "./customer-type-trend";

interface CustomerTypeSectionProps {
  daily: CustomerTypeRow[];
  weekly: CustomerTypeRow[];
  tab: "daily" | "weekly";
}

export function CustomerTypeSection({ daily, weekly, tab }: CustomerTypeSectionProps) {
  const data = tab === "daily" ? daily : weekly;

  return (
    // grid-cols-[1fr_2fr] gives donut 1/3, trend 2/3 — discretion area
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr]">
      <CustomerTypeDonut data={data} />
      <CustomerTypeTrend data={data} tab={tab} />
    </div>
  );
}
```

### Pattern 5: ChartColorMode Extension

**What:** Add `chart3`, `chart4`, `chart5` fields to `ChartColorMode` interface and `CHART_COLORS` object.

**Key finding:** `globals.css` already has `--chart-3`, `--chart-4`, `--chart-5` defined for both light and dark. The oklch values are:
- Light: `--chart-3: oklch(0.398 0.07 227.392)` (blue-ish), `--chart-4: oklch(0.828 0.189 84.429)` (yellow), `--chart-5: oklch(0.769 0.188 70.08)` (orange-yellow)
- Dark: `--chart-3: oklch(0.769 0.188 70.08)` (orange), `--chart-4: oklch(0.627 0.265 303.9)` (purple), `--chart-5: oklch(0.645 0.246 16.439)` (red)

However, the CONTEXT.md decision maps 편도=chart3(주황). In light mode `--chart-3` is blue-ish, but in dark mode it's orange. This color mapping mismatch is a known tradeoff — the CONTEXT.md locks chart3 for 편도 regardless. The planner should use the CSS variable values as-is and let the dark/light theme handle the visual distinction.

**Example:**
```typescript
// components/dashboard/charts/chart-colors.ts — additions
export interface ChartColorMode {
  chart1: string;
  chart2: string;
  chart3: string; // NEW — 편도 색상
  chart4: string; // NEW — reserved for future use
  chart5: string; // NEW — reserved for future use
  profitPositive: string;
  // ... rest unchanged
}

export const CHART_COLORS = {
  light: {
    chart1: 'oklch(0.646 0.222 41.116)',
    chart2: 'oklch(0.6 0.118 184.704)',
    chart3: 'oklch(0.398 0.07 227.392)',   // --chart-3 라이트
    chart4: 'oklch(0.828 0.189 84.429)',   // --chart-4 라이트
    chart5: 'oklch(0.769 0.188 70.08)',    // --chart-5 라이트
    // ... rest unchanged
  },
  dark: {
    chart1: 'oklch(0.488 0.243 264.376)',
    chart2: 'oklch(0.696 0.17 162.48)',
    chart3: 'oklch(0.769 0.188 70.08)',    // --chart-3 다크
    chart4: 'oklch(0.627 0.265 303.9)',    // --chart-4 다크
    chart5: 'oklch(0.645 0.246 16.439)',   // --chart-5 다크
    // ... rest unchanged
  },
};
```

### Anti-Patterns to Avoid

- **`radius` prop on all stacked Bar segments:** Apply `radius={[2, 2, 0, 0]}` only to the topmost Bar. Applying to lower bars creates gaps and visual artifacts in the stack.
- **Filtering customerType arrays in the chart component:** Do not filter by period inside the chart components. The filtering must happen in `DashboardContent.filteredData` so all charts stay synchronized with the period state.
- **Hardcoded SVG coordinates for center text:** Do not use fixed `x={400}` pixel values. Use `x="50%"` so it works with `ResponsiveContainer`.
- **`label` prop on Pie for segment labels:** The CONTEXT.md decision is no segment labels (range-only legend). Set `label={false}` and `labelLine={false}`.
- **Treating `customerTypeDaily` as pre-filtered:** It is currently NOT filtered by period in `filteredData`. This is the most likely implementation bug.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Donut chart with proportional segments | Custom SVG arcs | Recharts `PieChart > Pie` with `innerRadius` | Already installed; handles arc math, tooltips, legend, animation |
| Stacked bar accumulation | Manual CSS/SVG stacking | Recharts `Bar` with shared `stackId` | stackId handles ordering, proportional widths, Y-axis scaling automatically |
| Color theming for dark/light | Re-reading CSS variables | `getChartColors(isDark)` from `chart-colors.ts` | Project convention; Recharts SVG can't use CSS vars directly |
| Date-range filtering of CustomerTypeRow | New filter function | Extend `filterDailyByPeriod` pattern from `period-utils.ts` | Same logic, same date format (ISO YYYY-MM-DD on `date` field) |
| Weekly period filtering of CustomerTypeRow | New week parser | Reuse `parseWeekMonth` from `period-utils.ts` | `CustomerTypeRow.week` uses same format as `WeeklyRecord.week` |

**Key insight:** The entire data pipeline is pre-built. Phase 10 is strictly a UI wiring task: take `CustomerTypeRow[]`, format for Recharts, render.

---

## Common Pitfalls

### Pitfall 1: customerTypeDaily Not Filtered by Period
**What goes wrong:** Period filter toggle changes nothing on the customer type charts; data always shows full history.
**Why it happens:** `DashboardContent.filteredData` spreads `data` and only replaces `daily` or `weekly`. `customerTypeDaily` and `customerTypeWeekly` are not in the filter logic.
**How to avoid:** Extend the `useMemo` block in `dashboard-content.tsx` to also filter `customerTypeDaily` (using `getDateRange` + date range comparison on `CustomerTypeRow.date`) and `customerTypeWeekly` (using `parseWeekMonth` month matching).
**Warning signs:** Charts show same data regardless of which period button is active.

### Pitfall 2: Empty Mock Data for customerTypeDaily/Weekly
**What goes wrong:** Charts render but show nothing during development (no Google Sheets connection).
**Why it happens:** `mock-data.ts` has `customerTypeDaily: [] as CustomerTypeRow[]` — placeholder empty arrays.
**How to avoid:** Populate `mockTeamDashboardData.customerTypeDaily` and `customerTypeWeekly` with realistic sample rows matching the ISO date format and week format used in `mockDailyRecords` / `mockWeeklyRecords`.
**Warning signs:** Donut shows no segments; stacked bar is empty.

### Pitfall 3: radius Applied to All Stacked Bars
**What goes wrong:** Visual gaps appear between stacked bar segments; the chart looks broken.
**Why it happens:** Recharts applies `radius` per-segment, not just at the top of the stack.
**How to avoid:** Apply `radius={[2, 2, 0, 0]}` only to the topmost Bar component (편도 in this case). Leave `radius` undefined on 왕복 and 부름 bars.
**Warning signs:** White gaps or ugly corners between stacked bar segments.

### Pitfall 4: Chart3 CSS Variable Already Defined — No globals.css Edit Needed
**What goes wrong:** Wasted effort trying to add `--chart-3` to globals.css.
**Why it happens:** CONTEXT.md says to add `--chart-3 ~ --chart-5` to globals.css, but they already exist (verified in current globals.css lines 72-74 and 106-108).
**How to avoid:** Skip the globals.css task. Only `chart-colors.ts` needs updating.
**Warning signs:** Build errors from duplicate CSS variable declarations if added again.

### Pitfall 5: ChartsSection Receives `filteredData` — Customer Type Must Too
**What goes wrong:** `CustomerTypeSection` receives unfiltered full data because it's passed differently.
**Why it happens:** If `CustomerTypeSection` is added below `ChartsSection` in `dashboard-content.tsx` with `data={data}` instead of `data={filteredData}`, period filtering won't apply.
**How to avoid:** Pass `data={filteredData}` (with the extended useMemo from Pitfall 1 fix) to `CustomerTypeSection`, OR pass `data.customerTypeDaily` / `data.customerTypeWeekly` from `filteredData`.
**Warning signs:** Same as Pitfall 1 — period toggle has no effect.

### Pitfall 6: PieChart Center Text Doesn't Center with ResponsiveContainer
**What goes wrong:** SVG `<text>` appears at wrong position or not at all.
**Why it happens:** Using hardcoded pixel coordinates (`x={400}`) with `ResponsiveContainer` (which has variable width).
**How to avoid:** Use `x="50%"` and `y="50%"` which are SVG percentage values relative to the viewBox. These work with `ResponsiveContainer`.
**Warning signs:** Center text appears at top-left corner or off-screen at certain viewport widths.

---

## Code Examples

Verified patterns from the project's existing codebase:

### Existing Chart Component Template
```typescript
// Source: components/dashboard/charts/revenue-trend-chart.tsx (existing pattern)
"use client";

import { /* Recharts components */ } from "recharts";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { /* TypeName */ } from "@/types/dashboard";
import { getChartColors } from "./chart-colors";

export function SomeChart({ data, tab }: Props) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === "dark");
  // ...
  return (
    <Card>
      <CardHeader><CardTitle>제목</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          {/* chart */}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### Stacked Bar Pattern (verified via Recharts docs)
```typescript
// Source: Recharts StackedBarChart example — https://recharts.github.io/en-US/examples/StackedBarChart/
// Three bars with same stackId stack vertically; Recharts handles the math
<BarChart data={chartData}>
  <Bar dataKey="왕복" stackId="a" fill={colors.chart1} />
  <Bar dataKey="부름" stackId="a" fill={colors.chart2} />
  <Bar dataKey="편도" stackId="a" fill={colors.chart3} radius={[2, 2, 0, 0]} />
</BarChart>
```

### Donut Aggregate Calculation Pattern
```typescript
// CustomerTypeRow[] may contain multiple rows (one per day/week).
// For the donut, aggregate totals across all rows in the filtered period.
const totals = data.reduce(
  (acc, r) => ({
    roundTrip: acc.roundTrip + r.roundTripCount,
    call: acc.call + r.callCount,
    oneWay: acc.oneWay + r.oneWayCount,
  }),
  { roundTrip: 0, call: 0, oneWay: 0 }
);
const total = totals.roundTrip + totals.call + totals.oneWay;
```

### CustomerTypeRow Weekly Filter Helper
```typescript
// For filtering CustomerTypeRow[] by weekly period — mirrors filterWeeklyByPeriod
// Source: derived from lib/period-utils.ts filterWeeklyByPeriod pattern
import { parseWeekMonth } from '@/lib/period-utils';

function filterCustomerTypeWeekly(
  rows: CustomerTypeRow[],
  period: 'this-month' | 'last-month',
  today: Date = new Date()
): CustomerTypeRow[] {
  const currentMonth = today.getMonth() + 1;
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const targetMonth = period === 'this-month' ? currentMonth : lastMonth;

  // Same fallback as filterWeeklyByPeriod: if any row can't be parsed, return all
  const hasUnparseable = rows.some((r) => !r.week || parseWeekMonth(r.week) === null);
  if (hasUnparseable) return rows;

  return rows.filter((r) => r.week !== undefined && parseWeekMonth(r.week) === targetMonth);
}
```

### Mock Data for customerTypeDaily/Weekly
```typescript
// lib/mock-data.ts — add realistic sample CustomerTypeRow arrays
// Source: matches existing mockDailyRecords date range and format
const mockCustomerTypeDaily: CustomerTypeRow[] = [
  // 이번 달 (2026-03) — this-month 필터에서 노출되도록
  { date: "2026-03-01", roundTripCount: 18, callCount: 12, oneWayCount: 6 },
  { date: "2026-03-02", roundTripCount: 15, callCount: 10, oneWayCount: 5 },
  { date: "2026-03-03", roundTripCount: 22, callCount: 16, oneWayCount: 8 },
  // ... 지난달 (2026-02) 포함
  { date: "2026-02-21", roundTripCount: 16, callCount: 11, oneWayCount: 5 },
];

const mockCustomerTypeWeekly: CustomerTypeRow[] = [
  { week: "2월 1주차", roundTripCount: 108, callCount: 72, oneWayCount: 35 },
  { week: "2월 2주차", roundTripCount: 115, callCount: 80, oneWayCount: 45 },
  { week: "3월 1주차", roundTripCount: 98, callCount: 65, oneWayCount: 32 },
];
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x Label in donut center | Same Label component with position="center" — bug fixed in 3.x | Recharts 3.0→3.x patch | Label works; also SVG `<text x="50%" y="50%">` is a reliable fallback |
| Manual SVG arc calculations | Recharts PieChart + innerRadius | Recharts 1.0+ | No custom math needed |
| stackOffset prop for stacking | stackId per Bar | Recharts v1+ | stackId is the standard; stackOffset is for special layouts like "expand" (100% stack) |

**Deprecated/outdated:**
- Hard-coded `x={width/2}` pixel center for donut text: Use `x="50%"` with SVG percentage coordinates instead. Only works when PieChart width is fixed; breaks with ResponsiveContainer.

---

## Open Questions

1. **globals.css chart-3 color choice for 편도**
   - What we know: Light mode `--chart-3` is `oklch(0.398 0.07 227.392)` (grayish-blue, not orange). Dark mode `--chart-3` is `oklch(0.769 0.188 70.08)` (orange-yellow). CONTEXT.md says "편도=chart3(주황)".
   - What's unclear: In light mode, chart3 is not orange. The CONTEXT.md intuition (orange = 편도) may look different than expected in light mode.
   - Recommendation: Use chart3 as locked. If color is visually wrong in light mode after implementation, consider swapping to chart5 (which is orange-yellow in light: `oklch(0.769 0.188 70.08)`). This is a discretion area per CONTEXT.md.

2. **Tooltip "합계 N건" for stacked bar**
   - What we know: CONTEXT.md specifies "툴팁: 왕복 N건, 부름 N건, 편도 N건, 합계 N건".
   - What's unclear: Recharts default Tooltip shows each dataKey separately. Adding a "합계" row requires a custom `content` function on `<Tooltip>`.
   - Recommendation: Implement a custom Tooltip content function that renders the three values + sums them for the 합계 row. This is standard React pattern — not a library limitation.

---

## Sources

### Primary (HIGH confidence)
- Project codebase: `components/dashboard/charts/*.tsx` — existing chart component patterns verified by reading source
- Project codebase: `components/dashboard/dashboard-content.tsx` — filteredData useMemo verified (no customerType filtering exists)
- Project codebase: `lib/period-utils.ts` — filterDailyByPeriod, filterWeeklyByPeriod, parseWeekMonth verified
- Project codebase: `app/globals.css` — chart-1 through chart-5 CSS variables verified for light (lines 70-74) and dark (lines 104-108)
- Project codebase: `types/dashboard.ts` — CustomerTypeRow interface verified (roundTripCount, callCount, oneWayCount, date?, week?)
- Project codebase: `lib/mock-data.ts` — customerTypeDaily/Weekly confirmed as empty arrays

### Secondary (MEDIUM confidence)
- [Recharts stacked BarChart example](https://recharts.github.io/en-US/examples/StackedBarChart/) — stackId pattern verified via multiple sources
- [Recharts Label center bug fix](https://github.com/recharts/recharts/issues/5985) — bug in 3.0 confirmed fixed via PR #5987
- [GeeksforGeeks Recharts donut](https://www.geeksforgeeks.org/reactjs/create-a-donut-chart-using-recharts-in-reactjs/) — SVG `<text>` center pattern

### Tertiary (LOW confidence)
- WebSearch: radius on top Bar only for stacked charts — multiple sources agree but no official Recharts doc link found

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts 3.7.0 already installed; all APIs verified in existing usage
- Architecture: HIGH — patterns directly derived from reading existing chart components
- Pitfalls: HIGH (Pitfall 1, 2, 3, 4, 5) — verified against actual codebase state; LOW (Pitfall 6) — verified via multiple community sources
- Color values: HIGH — read directly from globals.css source

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (Recharts 3.x stable; Next.js/React stack stable)
