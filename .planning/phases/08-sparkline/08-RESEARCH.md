# Phase 8: Sparkline - Research

**Researched:** 2026-03-01
**Domain:** Recharts AreaChart 미니 스파크라인 — KPI 카드 내 인라인 차트
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 데이터 포인트 수
- 탭 연동 방식: daily 탭에서는 최근 7일, weekly 탭에서는 최근 8주 표시
- `kpi-cards.tsx`에 이미 정렬된 배열(`sorted`)이 있으므로 끝에서 N개 slice로 추출
- 데이터가 N개 미만이면 있는 것만 표시 (오류 없이 graceful 처리)

#### 차트 유형 & 배치
- Recharts `AreaChart` + `ResponsiveContainer` 사용 (라이브러리 이미 설치됨)
- 높이: 40px, 축/라벨/툴팁 없음 — 순수 트렌드 시각화
- 배치: `CardContent` 하단, `deltaText` 아래에 추가
- `KpiCard` 컴포넌트에 `sparklineData?: number[]` prop 추가

#### 색상 & 테마 대응
- 단일 색상: `var(--chart-1)` CSS 변수 사용 (다크/라이트 자동 전환됨)
- 영역 채우기: stroke는 `var(--chart-1)`, fill은 같은 색에 낮은 투명도
- Recharts SVG에서 CSS 변수 직접 사용 (`stroke="var(--chart-1)"`)

### Claude's Discretion
- 정확한 stroke width, fill opacity 값
- `ResponsiveContainer` width/height 세부 조정
- Weekly 탭 매출 카드(달성률 + 프로그레스 바 있음)에서의 수직 간격 처리
- Area gradient 여부 (단색 fill vs `<defs><linearGradient>` 그라디언트)

### Deferred Ideas (OUT OF SCOPE)
없음 — 토론이 AskUserQuestion 응답 문제로 제한되어 기본값으로 결정됨.
사용자가 이 파일을 직접 편집해 다른 선택(차트 유형, 데이터 포인트 수, 색상 전략 등)을 지정할 수 있음.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SPRK-01 | KPI 카드 각각에 최근 데이터 추이를 보여주는 미니 차트가 표시된다 | Recharts AreaChart + ResponsiveContainer 패턴, kpi-cards.tsx sorted 배열에서 slice 추출, kpi-card.tsx prop 추가 방법 |
| SPRK-02 | 스파크라인이 다크/라이트 테마에 맞는 색상으로 렌더링된다 | 프로젝트 테마 패턴 조사 (useTheme vs CSS 변수 직접 사용) — 중요 발견 사항 참조 |
</phase_requirements>

## Summary

Phase 8은 기존 Recharts 3.7.0 라이브러리만으로 구현 가능하다. `AreaChart` + `Area` + `ResponsiveContainer`를 `height={40}`으로 설정하고, 모든 축/툴팁/그리드를 제거하면 순수 트렌드 미니 차트가 완성된다. 추가 패키지 설치가 불필요하며, 작업 범위는 두 파일(`kpi-card.tsx`, `kpi-cards.tsx`)로 제한된다.

**중요 발견:** CONTEXT.md는 `stroke="var(--chart-1)"`로 CSS 변수를 SVG 속성에서 직접 사용하도록 결정하였다. 그러나 프로젝트의 기존 차트들(`chart-colors.ts`)은 `useTheme`를 통해 테마를 감지하고 하드코딩된 oklch 색상 값을 사용한다. 이 두 접근의 트레이드오프를 문서화한다. 스파크라인은 `kpi-card.tsx`가 이미 `'use client'`를 선언하지 않으므로, CSS 변수 방식을 선택하면 `useTheme` 의존성 없이 구현 가능하다 — 이는 더 단순한 접근이다.

**Primary recommendation:** `kpi-cards.tsx`의 기존 `sorted` 배열에서 slice로 sparklineData를 계산하여 `KpiCard`에 prop으로 전달하고, `kpi-card.tsx`에서 `AreaChart`로 렌더링한다. 색상은 CSS 변수 직접 사용(`stroke="var(--chart-1)"`)으로 처리하여 `useTheme` 의존성을 추가하지 않는다.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.7.0 | AreaChart, Area, ResponsiveContainer | 이미 설치됨, 프로젝트 전체 차트 라이브러리 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react | 19.2.3 | JSX 렌더링 | 이미 설치됨 |
| next-themes | 0.4.6 | 테마 감지 (`useTheme`) | CSS 변수 직접 사용 시 불필요 — 기존 큰 차트에서만 사용 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts AreaChart (결정됨) | SVG path 수작업 | SVG 수작업은 min/max 스케일링, 데이터 0 케이스 직접 처리 필요 — 금지 (Don't Hand-Roll 참조) |
| CSS 변수 직접 사용 (결정됨) | useTheme + getChartColors | useTheme 패턴이 기존 큰 차트와 일관성 있지만, 스파크라인은 간단하므로 CSS 변수가 더 적절 |

**Installation:**
```bash
# 추가 패키지 설치 불필요 — recharts 3.7.0 이미 설치됨
```

## Architecture Patterns

### 변경 대상 파일 구조
```
components/dashboard/
├── kpi-card.tsx          # sparklineData?: number[] prop 추가, AreaChart 렌더링
└── kpi-cards.tsx         # 5개 KPI별 값 배열을 slice하여 sparklineData 계산/전달
```

### Pattern 1: KPI 카드 prop 추가 + AreaChart 삽입

**What:** `KpiCard`에 `sparklineData?: number[]` optional prop을 추가하고, `CardContent` 내 `deltaText` 아래에 `AreaChart`를 렌더링한다.

**When to use:** sparklineData가 존재하고 길이가 2 이상일 때만 렌더링 (graceful 처리).

**Example:**
```typescript
// kpi-card.tsx — 스파크라인 렌더링 패턴
// kpi-card.tsx는 현재 'use client' 없음 — Recharts 추가 시 'use client' 추가 필요
'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface KpiCardProps {
  // 기존 props...
  sparklineData?: number[];
}

// CardContent 내 deltaText 아래에 추가:
{sparklineData && sparklineData.length >= 2 && (
  <div className="pt-1">
    <ResponsiveContainer width="100%" height={40} minWidth={0}>
      <AreaChart
        data={sparklineData.map((v, i) => ({ v, i }))}
        margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
      >
        <Area
          type="monotone"
          dataKey="v"
          stroke="var(--chart-1)"
          strokeWidth={1.5}
          fill="var(--chart-1)"
          fillOpacity={0.15}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
)}
```

### Pattern 2: kpi-cards.tsx에서 sparklineData 추출

**What:** 기존 `sorted` 배열에서 각 KPI 필드 값을 map으로 추출하고, slice(-N)으로 최근 N개만 선택한다.

**When to use:** daily 탭: `slice(-7)`, weekly 탭: `slice(-8)`.

**Example:**
```typescript
// kpi-cards.tsx — daily 탭 sparklineData 추출 패턴
// 기존 sorted 배열 사용
const sorted = [...data.daily].sort((a, b) => a.date.localeCompare(b.date));
const DAILY_N = 7;

const cards = [
  {
    title: '매출',
    // 기존 props...
    sparklineData: sorted.map(d => d.revenue).slice(-DAILY_N),
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    title: 'GPM',
    sparklineData: sorted
      .map(d => d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0)
      .slice(-DAILY_N),
    // ...
  },
  {
    title: '이용건수',
    sparklineData: sorted.map(d => d.usageCount).slice(-DAILY_N),
    // ...
  },
  {
    title: '가동률',
    sparklineData: sorted.map(d => d.utilizationRate).slice(-DAILY_N),
    // ...
  },
  {
    title: '이용시간',
    sparklineData: sorted.map(d => d.usageHours).slice(-DAILY_N),
    // ...
  },
];

// weekly 탭: data.weekly는 이미 순서대로 있음
// slice(-8)로 최근 8주 추출
const WEEKLY_N = 8;
const weeklyCards = [
  {
    title: '매출',
    sparklineData: data.weekly.map(d => d.revenue).slice(-WEEKLY_N),
    // ...
  },
  // ... 동일 패턴
];
```

### Pattern 3: CSS 변수 직접 사용 (결정된 테마 대응 방식)

**What:** Recharts `Area`의 `stroke`와 `fill` 속성에 CSS 변수를 문자열로 직접 전달한다.

**중요 발견:** 기존 차트들(`chart-colors.ts`, `revenue-trend-chart.tsx`)은 `useTheme`로 테마를 감지하고 하드코딩된 oklch 값을 사용한다. 이는 Recharts SVG 속성이 런타임에 CSS 변수를 해석하지 못한다는 우려 때문이다.

**실제 동작 여부:** 현대 브라우저의 SVG 속성에서는 `stroke="var(--chart-1)"`가 **동작한다**. SVG `presentation attributes`는 CSS 상속을 받으므로 CSS 변수가 해석된다. 다만 구형 브라우저(IE 등)는 지원하지 않는다 — 이 프로젝트는 구형 브라우저 대응이 요구사항에 없으므로 문제없다.

**스파크라인에서 CSS 변수 선택 이유:**
1. `kpi-card.tsx`는 현재 Server Component (순수 렌더링) — `useTheme`를 추가하려면 `'use client'` 선언이 필요하나, Recharts 컴포넌트 추가 시 어차피 필요하다
2. CSS 변수 방식은 `getChartColors` import 없이도 테마 전환이 자동으로 처리됨
3. 스파크라인은 단색 단순 차트 — 복잡한 색상 맵핑이 불필요

```typescript
// CSS 변수 직접 사용 패턴 — 스파크라인에서 권장
<Area
  type="monotone"
  dataKey="v"
  stroke="var(--chart-1)"     // CSS 변수 직접
  strokeWidth={1.5}
  fill="var(--chart-1)"       // CSS 변수 직접
  fillOpacity={0.15}          // fill opacity로 투명도 조절 (gradient 불필요)
  dot={false}
  isAnimationActive={false}   // 카드 내 미니 차트 — 애니메이션 불필요
/>
```

### Anti-Patterns to Avoid

- **축/그리드/툴팁 포함:** `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend` 컴포넌트를 절대 포함하지 않는다 — 40px 높이에서는 노이즈만 된다
- **고정 width 사용:** `width={200}` 같은 고정값 대신 반드시 `ResponsiveContainer width="100%"`를 사용한다 — 카드 크기는 그리드에 따라 동적으로 변한다
- **data가 없을 때 렌더링:** `sparklineData.length < 2`이면 빈 영역이 렌더링되어 카드 레이아웃이 깨진다 — 조건부 렌더링 필수
- **애니메이션 활성화:** `isAnimationActive={true}` (기본값)는 KPI 카드가 여러 개 리렌더링될 때 시각적 노이즈를 만든다 — `isAnimationActive={false}` 명시 권장

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 미니 추이 선 차트 | SVG path + polyline 수작업 | Recharts AreaChart | Y축 스케일링(min/max), 데이터 공백, 0값 처리 등 엣지 케이스 직접 처리 필요 |
| 테마 색상 계산 | CSS 변수를 JS에서 getComputedStyle로 읽어 oklch 계산 | `stroke="var(--chart-1)"` 직접 사용 | 복잡한 JS 계산 불필요 |

**Key insight:** Recharts는 데이터 정규화(Y축 도메인 자동 계산)와 SVG 렌더링을 모두 처리한다. 스파크라인처럼 단순한 차트도 수작업으로 구현하면 데이터 엣지 케이스(모든 값 동일, 0값 등) 처리가 복잡해진다.

## Common Pitfalls

### Pitfall 1: kpi-card.tsx에 'use client' 누락

**What goes wrong:** Recharts 컴포넌트(`AreaChart`, `ResponsiveContainer`)는 브라우저 DOM API에 의존한다 — Server Component에서 사용하면 빌드 에러 발생.

**Why it happens:** `kpi-card.tsx`는 현재 `'use client'` 선언이 없는 Server Component이다. Recharts를 추가하면 `'use client'` 선언이 필요하다.

**How to avoid:** `kpi-card.tsx` 파일 첫 줄에 `'use client';` 추가. `kpi-cards.tsx`는 이미 `'use client'` 선언이 있다.

**Warning signs:** `Error: AreaChart is only usable as a Client Component` 빌드 에러.

### Pitfall 2: ResponsiveContainer가 height 0을 반환

**What goes wrong:** `ResponsiveContainer` 부모가 `height: auto`이거나 flex 컨테이너의 height가 명시되지 않으면 height 0을 반환하여 차트가 보이지 않는다.

**Why it happens:** `ResponsiveContainer`는 부모 DOM 요소의 실제 높이를 측정한다. CardContent의 `space-y-2` 내에서는 일반적으로 문제없으나, 컨테이너 높이를 명시적으로 지정해야 안전하다.

**How to avoid:** `<ResponsiveContainer width="100%" height={40} minWidth={0}>` — `height`를 픽셀 값으로 명시하고, `minWidth={0}` 추가로 flex 컨테이너에서의 축소를 허용한다.

**Warning signs:** 차트 영역이 보이지 않거나 빈 공간만 표시됨.

### Pitfall 3: Weekly 탭 매출 카드의 레이아웃 깨짐

**What goes wrong:** Weekly 매출 카드에는 달성률 텍스트 + Progress 바 + 목표 텍스트 + 델타 텍스트가 이미 있어 스파크라인 추가 시 카드가 다른 4개 카드보다 훨씬 길어진다.

**Why it happens:** 매출 카드만 `achievementRate` + `target` prop을 받아 추가 요소들이 렌더링된다.

**How to avoid:** 스파크라인 위에 적절한 `pt-1` 또는 `mt-1` 간격을 주어 기존 요소들과 시각적으로 분리한다. 카드 높이는 그리드 레이아웃(`items-start` vs `items-stretch`)으로 자연스럽게 처리된다 — 억지로 동일 높이를 맞추지 않는다.

**Warning signs:** 매출 카드만 다른 카드보다 현저히 길거나 레이아웃이 불균형하게 보임.

### Pitfall 4: data가 1개 이하일 때 AreaChart 렌더링

**What goes wrong:** 데이터가 1개이면 Recharts AreaChart가 영역을 그리지 못하고 빈 SVG나 콘솔 경고를 발생시킨다.

**Why it happens:** AreaChart는 최소 2개의 데이터 포인트가 있어야 선/면을 그릴 수 있다.

**How to avoid:** `{sparklineData && sparklineData.length >= 2 && (<ResponsiveContainer.../>)}` 조건부 렌더링으로 방어한다.

**Warning signs:** Recharts 콘솔 경고: `"The line path has failed to be generated due to incomplete data"`.

### Pitfall 5: sorted 배열 재계산 중복

**What goes wrong:** `kpi-cards.tsx` daily 탭에서 `sorted` 배열을 이미 계산하여 `current`와 `previous`를 추출한다. sparklineData 추출을 위해 `sorted`를 다시 계산하면 중복이다.

**Why it happens:** sorted 배열이 지역 변수로만 사용되어 cards 정의에서 참조하기 어려울 수 있다.

**How to avoid:** 기존 `sorted` 변수를 cards 배열 정의 전에 선언하고, sparklineData 추출에도 동일 변수를 재사용한다. `kpi-cards.tsx` 코드 구조상 `sorted`는 daily 블록 상단에 선언되어 있어 이미 접근 가능하다.

## Code Examples

검증된 패턴:

### 최소 스파크라인 AreaChart (no axes, no tooltip)
```typescript
// Source: Recharts 공식 — AreaChart 컴포넌트, 모든 장식 요소 제거
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const sparkData = [12, 15, 11, 18, 16, 20, 19].map((v, i) => ({ v, i }));

<ResponsiveContainer width="100%" height={40} minWidth={0}>
  <AreaChart
    data={sparkData}
    margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
  >
    <Area
      type="monotone"
      dataKey="v"
      stroke="var(--chart-1)"
      strokeWidth={1.5}
      fill="var(--chart-1)"
      fillOpacity={0.15}
      dot={false}
      isAnimationActive={false}
    />
  </AreaChart>
</ResponsiveContainer>
```

### kpi-card.tsx 최종 구조 (스파크라인 포함)
```typescript
// kpi-card.tsx — 'use client' 추가, sparklineData prop 추가
'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// ... 기존 imports

interface KpiCardProps {
  title: string;
  value: string;
  target?: string;
  achievementRate?: number;
  deltaText?: string;
  deltaColorClass?: string;
  icon: React.ReactNode;
  sparklineData?: number[];   // 추가
}

export function KpiCard({ ..., sparklineData }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold">{value}</div>
        {/* 기존 achievementRate, target, deltaText 렌더링 그대로 유지 */}
        {achievementRate !== undefined && (
          <>
            <div className={cn('text-xs font-medium', getAchievementColorClass(achievementRate))}>
              달성률 {achievementRate}%
            </div>
            <Progress
              value={Math.min(achievementRate, 100)}
              className={cn('h-2', getProgressColorClass(achievementRate))}
            />
          </>
        )}
        {target && (
          <p className="text-xs text-muted-foreground">목표: {target}</p>
        )}
        {deltaText && (
          <p className={cn('text-xs', deltaColorClass)}>{deltaText}</p>
        )}
        {/* 스파크라인 — 마지막에 추가 */}
        {sparklineData && sparklineData.length >= 2 && (
          <div className="pt-1">
            <ResponsiveContainer width="100%" height={40} minWidth={0}>
              <AreaChart
                data={sparklineData.map((v, i) => ({ v, i }))}
                margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
              >
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--chart-1)"
                  strokeWidth={1.5}
                  fill="var(--chart-1)"
                  fillOpacity={0.15}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### kpi-cards.tsx sparklineData 추출 패턴 (daily)
```typescript
// daily 탭 — 기존 sorted 변수 재사용
const sorted = [...data.daily].sort((a, b) => a.date.localeCompare(b.date));
const current = sorted[sorted.length - 1];
const previous = sorted[sorted.length - 2];
const DAILY_N = 7;

const cards = [
  {
    title: '매출',
    value: formatKpiValue(current.revenue, '원'),
    delta: previous ? calcDelta(current.revenue, previous.revenue) : null,
    unit: '원' as const,
    icon: <TrendingUp className="h-4 w-4" />,
    sparklineData: sorted.map(d => d.revenue).slice(-DAILY_N),
  },
  {
    title: 'GPM',
    value: formatKpiValue(
      current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0, '%'
    ),
    delta: previous ? calcDelta(
      current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0,
      previous.revenue > 0 ? (previous.profit / previous.revenue) * 100 : 0
    ) : null,
    unit: '%' as const,
    icon: <DollarSign className="h-4 w-4" />,
    sparklineData: sorted
      .map(d => d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0)
      .slice(-DAILY_N),
  },
  // 이용건수, 가동률, 이용시간 동일 패턴
];
```

### kpi-cards.tsx sparklineData 추출 패턴 (weekly)
```typescript
// weekly 탭 — data.weekly는 이미 정렬된 순서
const WEEKLY_N = 8;

const cards = [
  {
    title: '매출',
    sparklineData: data.weekly.map(d => d.revenue).slice(-WEEKLY_N),
    // ... 기존 props
  },
  {
    title: 'GPM',
    sparklineData: data.weekly
      .map(d => d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0)
      .slice(-WEEKLY_N),
    // ...
  },
  // 동일 패턴 반복
];

// KpiCard 렌더링 시 sparklineData 전달 추가
<KpiCard
  key={card.title}
  title={card.title}
  value={card.value}
  target={card.target}
  achievementRate={card.achievementRate}
  icon={card.icon}
  deltaText={card.delta ? formatDelta(card.delta.percent, card.delta.absolute, card.unit) : undefined}
  deltaColorClass={card.delta ? getDeltaColorClass(card.delta.percent) : undefined}
  sparklineData={card.sparklineData}    // 추가
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts CSS 변수 미지원 | 현대 브라우저 SVG에서 CSS 변수 작동 | 항상 가능했으나 관행이 달랐음 | 기존 큰 차트의 useTheme 패턴과 다르게 스파크라인은 CSS 변수 직접 사용 가능 |
| isAnimationActive 기본값 true | 미니 차트는 false 권장 | Recharts 설계 — 기본값은 큰 차트 기준 | 여러 카드 동시 렌더링 시 성능과 시각적 안정성 개선 |

**Deprecated/outdated:**
- 없음 — Recharts 3.7.0은 현재 최신 메이저 버전, AreaChart API는 안정적

## Open Questions

1. **CSS 변수 직접 사용 vs useTheme 일관성**
   - What we know: CONTEXT.md가 CSS 변수 직접 사용을 결정했다. 기존 큰 차트들은 useTheme를 사용한다
   - What's unclear: 두 접근이 프로젝트에서 혼재하면 향후 유지보수 혼란이 생길 수 있다
   - Recommendation: CONTEXT.md 결정을 따라 CSS 변수를 사용한다. 스파크라인은 단순 단색 차트이므로 useTheme 없이도 완전한 테마 지원이 가능하다. 향후 필요 시 chart-colors.ts에 sparkline 색상을 추가하는 리팩토링은 별도 작업으로 처리한다.

2. **Weekly 탭 sorted 배열 정렬 여부**
   - What we know: daily 탭은 `sorted` 변수로 명시적으로 정렬한다. weekly 탭은 `data.weekly[data.weekly.length - 1]`을 직접 사용한다
   - What's unclear: weekly 데이터가 항상 시간순으로 정렬되어 있는지 sheets.ts 파싱 로직에 의존한다
   - Recommendation: 스파크라인은 시각적 추이 차트이므로 순서가 중요하다. 안전하게 weekly도 `[...data.weekly].sort((a, b) => a.week.localeCompare(b.week))`로 정렬한 후 slice를 적용하는 것이 좋다. 단, 주차 문자열("1주차", "2월 3주차")의 localeCompare 정렬이 올바른지 확인이 필요하다.

## Sources

### Primary (HIGH confidence)
- 프로젝트 소스 코드 직접 분석
  - `components/dashboard/kpi-card.tsx` — 현재 props 구조, 'use client' 없음 확인
  - `components/dashboard/kpi-cards.tsx` — sorted 배열 패턴, 'use client' 확인
  - `components/dashboard/charts/chart-colors.ts` — 프로젝트 테마 패턴 확인
  - `components/dashboard/charts/revenue-trend-chart.tsx` — Recharts 사용 패턴 확인
  - `app/globals.css` — --chart-1 CSS 변수 라이트/다크 값 확인
  - `package.json` — recharts 3.7.0, 추가 설치 불필요 확인
  - `types/dashboard.ts` — DailyRecord, WeeklyRecord 필드 구조 확인

### Secondary (MEDIUM confidence)
- `.planning/phases/08-sparkline/08-CONTEXT.md` — 사용자 결정 사항 (검증된 요구사항)
- `.planning/REQUIREMENTS.md` — SPRK-01, SPRK-02 요구사항 확인

### Tertiary (LOW confidence)
- 없음 — 모든 핵심 발견은 프로젝트 소스 코드에서 직접 검증됨

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts 3.7.0 이미 설치, AreaChart API 프로젝트 내 실사용 확인
- Architecture: HIGH — kpi-card.tsx, kpi-cards.tsx 소스 코드 직접 분석, 변경 지점 명확
- Pitfalls: HIGH — 프로젝트 기존 패턴과 CONTEXT.md 결정 간 차이를 코드 수준에서 확인
- 테마 대응: MEDIUM — CSS 변수 SVG 직접 사용은 현대 브라우저에서 동작하나, 기존 프로젝트 패턴(useTheme)과 다름

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (recharts 3.x는 안정적, 30일 유효)
