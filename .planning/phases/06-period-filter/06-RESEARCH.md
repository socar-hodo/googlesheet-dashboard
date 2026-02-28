# Phase 6: Period Filter - Research

**Researched:** 2026-03-01
**Domain:** React URL state management, client-side date filtering, Next.js 16 App Router searchParams
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **클라이언트 사이드 필터링** — Sheets API는 기존대로 전체 데이터 한 번 로드, React 상태로 기간 필터링
- 서버 재페칭 없음 — 기존 서버 컴포넌트 구조 변경 최소화
- 필터 로직은 클라이언트 컴포넌트(현재 dashboard-tabs.tsx 등)에서 처리
- Daily 탭 4개 토글: **이번 주 / 지난 주 / 이번 달 / 지난 달**
- Weekly 탭 2개 토글: **이번 달 / 지난 달**
- UI 위치: **대시보드 탭 오른쪽** (헤더 오른쪽에 버튼 그룹), 탭과 같은 줄, 오른쪽 정렬
- shadcn/ui Button 컴포넌트 (variant="outline", 활성 시 variant="default") 사용
- URL searchParams에 period 파라미터 추가 (예: ?tab=daily&period=this-month)
- 기존 탭 searchParams(?tab=) 패턴과 동일하게 처리
- 필터 변경 시 별도 로딩 상태 불필요 (즉시 클라이언트 필터링)

### Claude's Discretion
- 기간 계산 로직 구현 (이번 주 = 월~일, 이번 달 = 1일~말일 등 한국 기준)
- Daily 탭 기본 기간 (전체 vs 이번 달)
- 데이터가 없는 기간 선택 시 빈 상태 처리

### Deferred Ideas (OUT OF SCOPE)
- 사용자 지정 날짜 범위 (달력 피커) — v2 요구사항
- Daily 탭의 "전체" 옵션 — 필요 시 추가 검토
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILT-01 | 사용자가 이번 주/지난 주/이번 달/지난 달 중 하나를 선택할 수 있다 | PeriodFilter 클라이언트 컴포넌트, shadcn Button 토글 UI, URL searchParams 저장 패턴 |
| FILT-02 | 기간 선택 시 KPI 카드, 차트, 테이블이 해당 기간 데이터로 즉시 업데이트된다 | 클라이언트 필터링 함수 (filterDailyByPeriod, filterWeeklyByPeriod), props drilling 또는 Context 패턴 |
| FILT-03 | 선택된 기간이 URL searchParams에 유지되어 공유/북마크 가능하다 | useSearchParams + useRouter.replace 패턴 (기존 tab-nav.tsx와 동일) |
</phase_requirements>

## Summary

Phase 6는 대시보드에 기간 선택기(이번 주/지난 주/이번 달/지난 달)를 추가하고, 클라이언트 사이드에서 기존에 서버에서 받은 전체 데이터를 필터링하여 KPI 카드, 차트 4종, 데이터 테이블을 갱신하는 작업이다. 서버 컴포넌트 구조는 최소한으로만 변경한다.

현재 아키텍처의 핵심 문제는 KpiCards, ChartsSection, DataTable이 모두 **Server Component**이며, page.tsx에서 `data`와 `tab` prop을 받는다는 점이다. 기간 필터는 클라이언트 상태에 달려 있으므로, 이 세 Server Component를 **Client Component로 전환**하거나, 필터링된 데이터를 Client Component에서 내려받아 넘기는 새로운 클라이언트 래퍼(wrapper) 컴포넌트를 도입해야 한다. 새 클라이언트 래퍼 패턴이 기존 Server Component를 보존하면서 변경을 최소화한다.

URL 상태 관리는 이미 tab-nav.tsx에서 검증된 패턴(`useSearchParams`, `useRouter.replace`, `new URLSearchParams(searchParams.toString())`)을 그대로 재사용한다. period 파라미터를 tab 파라미터와 함께 유지하는 것이 핵심이다.

**Primary recommendation:** 새로운 `DashboardContent` Client Component를 만들어 전체 데이터를 받고, 기간 필터 상태에 따라 데이터를 클라이언트에서 필터링한 뒤 기존 KpiCards/ChartsSection/DataTable에 필터된 데이터를 전달한다. TabNav + PeriodFilter를 하나의 행에 배치하는 `DashboardHeader` 컴포넌트도 신규 생성한다.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 (프로젝트 기준) | useState, useMemo, useCallback | 클라이언트 상태 관리 |
| Next.js | 16 (App Router) | useRouter, useSearchParams, usePathname | URL searchParams 읽기/쓰기 |
| shadcn/ui Button | 설치됨 (new-york) | 기간 토글 버튼 UI | 이미 프로젝트에 설치됨 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 미설치 | 날짜 계산 | 복잡한 날짜 연산 필요 시 — **이 프로젝트에서는 불필요** (아래 설명) |
| lucide-react | 설치됨 | 아이콘 | 필요 시 Calendar 아이콘 |

### Why No date-fns Needed
이 프로젝트의 날짜 필터링 요구사항은 순수 JavaScript Date 객체와 문자열 비교만으로 충분히 구현 가능하다:
- `DailyRecord.date`는 `"YYYY-MM-DD"` 형식 문자열 (예: "2026-02-21")
- `WeeklyRecord.week`는 `"N주차"` 또는 `"N월 N주차"` 형식 문자열 (예: "2주차", "2월 3주차")
- ISO 8601 날짜 문자열은 사전순(lexicographic) 비교가 날짜 순서와 동일 — `"2026-02-01" <= date <= "2026-02-28"` 같은 문자열 비교로 직접 필터링 가능

**Installation:** 추가 설치 불필요

---

## Architecture Patterns

### 현재 컴포넌트 구조 (변경 전)

```
page.tsx (Server Component)
├── searchParams 읽기 → tab (daily|weekly)
├── getTeamDashboardData() → data (전체 Sheets 데이터)
├── <TabNav activeTab={tab} />          ← Client Component, Suspense로 감쌈
├── <KpiCards data={data} tab={tab} />  ← Server Component (현재)
├── <ChartsSection data={data} tab={tab} /> ← Server Component (현재)
└── <DataTable data={data} tab={tab} /> ← Server Component (현재)
```

### 권장 아키텍처 (변경 후)

```
page.tsx (Server Component)
├── searchParams 읽기 → tab, period (신규)
├── getTeamDashboardData() → data (변경 없음)
└── <Suspense>
      <DashboardContent data={data} tab={tab} initialPeriod={period} />
      ↑ 신규 Client Component — 기간 필터 상태 소유
    </Suspense>

DashboardContent (신규 Client Component)
├── state: period (PeriodKey)
├── URL sync: useSearchParams + useRouter.replace
├── 기간 계산: getDateRange(period, tab) → { start, end }
├── 데이터 필터링: filterDailyByPeriod(data.daily, range), filterWeeklyByPeriod(data.weekly, period)
├── <DashboardHeader tab={tab} period={period} onPeriodChange={setPeriod} />  ← 탭+필터 버튼 행
├── <KpiCards data={filteredData} tab={tab} />  ← 필터된 데이터 전달
├── <ChartsSection data={filteredData} tab={tab} />
└── <DataTable data={filteredData} tab={tab} />
```

### 대안 아키텍처 고려

**대안 A: page.tsx에서 period searchParam 읽기 → 각 Server Component에 전달**
- 장점: Server Component 유지 → KpiCards, ChartsSection, DataTable 변경 불필요
- 단점: period 변경 시 URL 변경 → 서버 재렌더링 발생 (force-dynamic이므로 서버 재fetch까지 발생). 이는 "서버 재페칭 없음" 결정 위반

**대안 B: TabNav에 period state 병합**
- 단점: 하나의 컴포넌트가 탭 관리 + 기간 관리 + 데이터 필터링까지 담당 → 책임 과중

**결론: 신규 DashboardContent Client Component 래퍼 패턴 채택**
- page.tsx에서 period searchParam을 `initialPeriod`로 전달
- DashboardContent가 URL sync + 필터링 + 렌더링 담당
- KpiCards, ChartsSection, DataTable은 변경 없이 그대로 사용 (단, "use client" 없으면 Data 타입 props만 받으면 됨 — Server Component로 유지 가능하나 Client Component로 변경해야 DashboardContent에서 사용 가능)

**주의:** 현재 KpiCards, ChartsSection, DataTable은 Server Component. DashboardContent가 Client Component이면 그 하위에서 Server Component 직접 사용 불가. 두 가지 해결책:
1. KpiCards, ChartsSection, DataTable을 Client Component로 전환 (작업량 적음, 단순)
2. DashboardContent를 별도로 두고 page.tsx에서 children으로 Server Component 주입 (복잡)
→ **방법 1 채택**: KpiCards/ChartsSection/DataTable을 Client Component로 전환 (데이터 fetch 없고 순수 렌더링이므로 문제 없음)

### Pattern 1: Period 타입 정의

```typescript
// lib/period-utils.ts (신규)
export type PeriodKey =
  | 'this-week'    // 이번 주 (Daily 전용)
  | 'last-week'    // 지난 주 (Daily 전용)
  | 'this-month'   // 이번 달 (Daily + Weekly)
  | 'last-month';  // 지난 달 (Daily + Weekly)

export const DAILY_PERIODS: PeriodKey[] = ['this-week', 'last-week', 'this-month', 'last-month'];
export const WEEKLY_PERIODS: PeriodKey[] = ['this-month', 'last-month'];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  'this-week': '이번 주',
  'last-week': '지난 주',
  'this-month': '이번 달',
  'last-month': '지난 달',
};

// Daily 탭 기본값: 이번 달 (가장 최근 데이터 범위가 자연스러움)
export const DEFAULT_DAILY_PERIOD: PeriodKey = 'this-month';
// Weekly 탭 기본값: 이번 달
export const DEFAULT_WEEKLY_PERIOD: PeriodKey = 'this-month';
```

### Pattern 2: 날짜 범위 계산 (한국 기준, 순수 JS)

```typescript
// lib/period-utils.ts (신규)

/** YYYY-MM-DD 형식 날짜 문자열 반환 */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 한국 기준 이번 주 월요일 계산
 * ISO 주: 월요일(1) ~ 일요일(7)
 * JS getDay(): 일(0) 월(1) 화(2) ... 토(6)
 */
function getMonday(d: Date): Date {
  const day = d.getDay(); // 0=일, 1=월 ...
  const diff = day === 0 ? -6 : 1 - day; // 일요일이면 -6, 나머지는 1-day
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD (inclusive)
}

/** 기간 키 → 날짜 범위 (오늘 기준) */
export function getDateRange(period: PeriodKey, today: Date = new Date()): DateRange {
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  switch (period) {
    case 'this-week': {
      const monday = getMonday(today);
      return {
        start: toISODate(monday),
        end: toISODate(today),
      };
    }
    case 'last-week': {
      const thisMonday = getMonday(today);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      return {
        start: toISODate(lastMonday),
        end: toISODate(lastSunday),
      };
    }
    case 'this-month': {
      const firstDay = new Date(year, month, 1);
      return {
        start: toISODate(firstDay),
        end: toISODate(today),
      };
    }
    case 'last-month': {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0); // 전달 말일
      return {
        start: toISODate(firstDay),
        end: toISODate(lastDay),
      };
    }
  }
}
```

### Pattern 3: Daily 데이터 필터링

```typescript
// lib/period-utils.ts (신규)
import type { DailyRecord, WeeklyRecord } from '@/types/dashboard';

/**
 * DailyRecord 배열을 날짜 범위로 필터링한다.
 * DailyRecord.date는 "YYYY-MM-DD" 형식 — 사전순 비교가 날짜 순서와 동일.
 */
export function filterDailyByPeriod(
  records: DailyRecord[],
  range: DateRange
): DailyRecord[] {
  return records.filter(r => r.date >= range.start && r.date <= range.end);
}
```

### Pattern 4: Weekly 데이터 필터링

Weekly 필터링은 `WeeklyRecord.week` 필드가 `"N주차"` 또는 `"N월 N주차"` 형식이라 날짜 범위로 직접 비교할 수 없다. 두 가지 접근 중 하나를 선택해야 한다:

**접근 A: week 필드에서 월 정보 파싱** (권장)

```typescript
/**
 * WeeklyRecord.week에서 월 번호를 추출한다.
 * "1주차" → 컨텍스트 필요 (현재 월 기준으로 역산)
 * "2월 3주차" → 2
 * "3주차" → 현재/직전 월 중 어느 것인지 알 수 없음
 *
 * 실제 데이터: "1주차", "2주차", ... 형식
 * → 시트 데이터의 순서가 시간순이므로 인덱스 기반 분류가 더 안정적
 */

/**
 * WeeklyRecord.week 문자열에서 월 숫자 파싱 시도.
 * "2월 3주차" → 2
 * "3주차" → null (월 정보 없음)
 */
export function parseWeekMonth(week: string): number | null {
  const match = week.match(/^(\d+)월/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Weekly 레코드를 기간으로 필터링한다.
 * this-month: week 문자열에서 월 파싱 가능 → 현재 월과 일치하는 항목
 * last-month: 전달과 일치하는 항목
 * 월 파싱 불가("N주차" 형식) → 전체 포함 (안전한 폴백)
 */
export function filterWeeklyByPeriod(
  records: WeeklyRecord[],
  period: Extract<PeriodKey, 'this-month' | 'last-month'>,
  today: Date = new Date()
): WeeklyRecord[] {
  const currentMonth = today.getMonth() + 1; // 1-indexed
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const targetMonth = period === 'this-month' ? currentMonth : lastMonth;

  return records.filter(r => {
    const month = parseWeekMonth(r.week);
    if (month === null) return true; // 월 정보 없으면 포함 (폴백)
    return month === targetMonth;
  });
}
```

**중요한 발견:** mock 데이터의 WeeklyRecord.week 값은 `"1주차"`, `"2주차"` 형식이라 월 정보가 없다. 실제 Sheets 데이터가 `"2월 1주차"` 형식인지 `"1주차"` 형식인지는 연결 없이 확인 불가. 따라서:
- 월 파싱 가능 → 월 기준 필터
- 월 파싱 불가 → 전체 데이터 반환 (빈 화면보다 전체 표시가 낫다)

### Pattern 5: URL 동기화 (기존 tab-nav.tsx 패턴 확장)

```typescript
// components/dashboard/dashboard-content.tsx (신규 Client Component)
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';
import type { TeamDashboardData } from '@/types/dashboard';
import type { PeriodKey } from '@/lib/period-utils';
import { getDateRange, filterDailyByPeriod, filterWeeklyByPeriod, DEFAULT_DAILY_PERIOD, DEFAULT_WEEKLY_PERIOD } from '@/lib/period-utils';

interface DashboardContentProps {
  data: TeamDashboardData;
  tab: 'daily' | 'weekly';
  initialPeriod?: string; // URL에서 읽은 초기값 (검증 전 raw string)
}

function parsePeriod(raw: string | undefined, tab: 'daily' | 'weekly'): PeriodKey {
  const daily: PeriodKey[] = ['this-week', 'last-week', 'this-month', 'last-month'];
  const weekly: PeriodKey[] = ['this-month', 'last-month'];
  const valid = tab === 'daily' ? daily : weekly;
  return valid.includes(raw as PeriodKey)
    ? (raw as PeriodKey)
    : tab === 'daily' ? DEFAULT_DAILY_PERIOD : DEFAULT_WEEKLY_PERIOD;
}

export function DashboardContent({ data, tab, initialPeriod }: DashboardContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [period, setPeriodState] = useState<PeriodKey>(
    () => parsePeriod(initialPeriod, tab)
  );

  const handlePeriodChange = useCallback((newPeriod: PeriodKey) => {
    setPeriodState(newPeriod);
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', newPeriod);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  // 필터링 — useMemo로 재계산 방지
  const filteredData = useMemo(() => {
    if (tab === 'daily') {
      const range = getDateRange(period);
      const daily = filterDailyByPeriod(data.daily, range);
      return { ...data, daily };
    } else {
      const weekly = filterWeeklyByPeriod(data.weekly, period as 'this-month' | 'last-month');
      return { ...data, weekly };
    }
  }, [data, tab, period]);

  return (
    <div className="space-y-6">
      <DashboardHeader tab={tab} period={period} onPeriodChange={handlePeriodChange} />
      <KpiCards data={filteredData} tab={tab} />
      <ChartsSection data={filteredData} tab={tab} />
      <DataTable data={filteredData} tab={tab} />
    </div>
  );
}
```

### Pattern 6: PeriodFilter UI 컴포넌트

```typescript
// components/dashboard/period-filter.tsx (신규)
'use client';

import { Button } from '@/components/ui/button';
import type { PeriodKey } from '@/lib/period-utils';
import { PERIOD_LABELS } from '@/lib/period-utils';

interface PeriodFilterProps {
  periods: PeriodKey[];       // 현재 탭에서 지원하는 기간 목록
  active: PeriodKey;          // 현재 선택된 기간
  onChange: (p: PeriodKey) => void;
}

export function PeriodFilter({ periods, active, onChange }: PeriodFilterProps) {
  return (
    <div className="flex gap-1">
      {periods.map(p => (
        <Button
          key={p}
          size="sm"
          variant={active === p ? 'default' : 'outline'}
          onClick={() => onChange(p)}
        >
          {PERIOD_LABELS[p]}
        </Button>
      ))}
    </div>
  );
}
```

### Pattern 7: DashboardHeader (탭 + 필터 한 행)

```typescript
// components/dashboard/dashboard-header.tsx (신규)
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PeriodFilter } from './period-filter';
import type { PeriodKey } from '@/lib/period-utils';
import { DAILY_PERIODS, WEEKLY_PERIODS } from '@/lib/period-utils';

interface DashboardHeaderProps {
  tab: 'daily' | 'weekly';
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
}

export function DashboardHeader({ tab, period, onPeriodChange }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    // 탭 전환 시 period 초기화 (weekly는 this-week 없으므로)
    params.set('period', value === 'daily' ? 'this-month' : 'this-month');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const periods = tab === 'daily' ? DAILY_PERIODS : WEEKLY_PERIODS;

  return (
    <div className="flex items-center justify-between">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="daily">일별</TabsTrigger>
          <TabsTrigger value="weekly">주차별</TabsTrigger>
        </TabsList>
      </Tabs>
      <PeriodFilter periods={periods} active={period} onChange={onPeriodChange} />
    </div>
  );
}
```

### Pattern 8: page.tsx 변경 사항 (최소 변경)

```typescript
// app/(dashboard)/dashboard/page.tsx 변경 사항
// SearchParams 타입에 period 추가
type SearchParams = Promise<{ tab?: string; period?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { tab = 'daily', period } = await searchParams;
  const activeTab = tab === 'weekly' ? 'weekly' : 'daily';
  const data = await getTeamDashboardData();

  return (
    <div className="space-y-6">
      {/* UpdateTimestamp 유지 */}
      <div className="flex justify-end">
        <UpdateTimestamp fetchedAt={data.fetchedAt} />
      </div>
      {/* Suspense로 DashboardContent 감싸기 (useSearchParams 사용) */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent data={data} tab={activeTab} initialPeriod={period} />
      </Suspense>
    </div>
  );
}
```

**주의:** 기존 TabNav 컴포넌트는 DashboardHeader로 대체되므로 삭제하거나 DashboardHeader 내부로 흡수한다.

### Anti-Patterns to Avoid

- **period 변경 시 router.push 대신 router.replace 사용**: push는 뒤로가기 히스토리를 쌓아 UX 저하
- **새로운 Date() 직접 각 컴포넌트에서 호출**: 날짜 계산은 period-utils.ts에 집중, 테스트 가능하게 today 파라미터 주입
- **WeeklyRecord.week 파싱 실패 시 빈 배열 반환**: 파싱 불가 시 전체 반환이 빈 화면보다 안전
- **KpiCards/ChartsSection/DataTable의 기존 내부 로직 변경**: props로 받는 data만 필터된 것으로 교체, 내부 로직 불변 유지

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL 동기화 | 커스텀 URL 파서 | Next.js `useSearchParams`, `useRouter` | Next.js 16 App Router 표준, 이미 tab-nav.tsx에서 검증됨 |
| 날짜 범위 계산 | date-fns 의존성 추가 | 순수 JS Date + 문자열 비교 | YYYY-MM-DD 사전순 = 날짜 순서, 외부 의존성 없이 충분 |
| 버튼 토글 UI | 커스텀 Toggle 컴포넌트 | shadcn/ui Button (variant 전환) | 이미 설치됨, new-york 스타일 일관성 |
| 상태 관리 | Redux, Zustand, Context | useState + props | 단일 페이지, 깊이 2-3레벨이라 Context 불필요 |

**Key insight:** 이 기능은 외부 라이브러리 추가 없이 100% 기존 스택으로 구현 가능하다.

---

## Common Pitfalls

### Pitfall 1: period 변경 시 탭별 유효성 검사 누락
**What goes wrong:** Weekly 탭에서 `?period=this-week`가 URL에 남아있으면 유효하지 않은 기간이 활성화됨
**Why it happens:** 탭 전환 시 period 파라미터를 초기화하지 않음
**How to avoid:** 탭 전환 시 항상 period를 해당 탭의 기본값으로 리셋. parsePeriod() 함수에서 탭별 유효 목록 검증 후 폴백
**Warning signs:** Weekly 탭에서 "이번 주" 버튼이 표시되거나 빈 데이터가 나타남

### Pitfall 2: 지난 달 계산 시 1월 → 전년 12월
**What goes wrong:** `month - 1`이 0이 되어 `new Date(year, 0, 0)` → 전년 12월 31일
**Why it happens:** JavaScript Date `month`는 0-indexed
**How to avoid:** `new Date(year, month, 0)`은 month 0이면 전년 12월 31일 반환 → 올바른 동작. 단 month -1 계산 시 year 조정 주의
**Verified:** `new Date(2026, 0, 0)` → 2025-12-31 (올바름). `new Date(year, month - 1, 1)`에서 month=0이면 `new Date(2026, -1, 1)` → 2025-12-01 (올바름, JS Date는 음수 month 자동 처리)

### Pitfall 3: DashboardContent가 Client Component인데 하위에 Server Component 직접 사용
**What goes wrong:** KpiCards, ChartsSection, DataTable이 Server Component로 유지되면 Client Component 내에서 직접 import 불가 (Next.js 제한)
**Why it happens:** Next.js App Router의 Server/Client Component 경계 규칙
**How to avoid:** KpiCards, ChartsSection, DataTable에 `"use client"` 추가. 이들은 데이터 fetch 없이 순수 렌더링만 하므로 Client Component 전환에 문제 없음
**Warning signs:** `Error: createContext is not a function` 또는 hydration error

### Pitfall 4: useSearchParams Suspense 경계 누락
**What goes wrong:** `useSearchParams()` 사용 컴포넌트가 Suspense로 감싸이지 않으면 `next/navigation` 빌드 경고 발생
**Why it happens:** Next.js 16 App Router 요구사항 — useSearchParams는 Suspense 경계 필요
**How to avoid:** DashboardContent (useSearchParams 사용)를 page.tsx에서 `<Suspense>`로 감싸기. 기존 TabNav도 동일하게 처리되어 있어 참고 가능
**Warning signs:** `Warning: useSearchParams() should be wrapped in a suspense boundary`

### Pitfall 5: KPI 델타 계산이 필터 후 깨짐
**What goes wrong:** 기간 필터 후 데이터가 1개 이하면 `sorted[length - 2]`가 undefined → delta=null → KPI 카드에 델타 미표시
**Why it happens:** 현재 KpiCards는 전체 데이터의 마지막 2개를 current/previous로 사용
**How to avoid:** 이 동작은 이미 null 처리됨 — `previous ? calcDelta(...) : null` 패턴 확인 완료. 빈 상태 메시지도 이미 존재 ("일별 데이터가 없습니다."). 추가 처리 불필요

### Pitfall 6: ChartsSection의 기존 `.slice(-30)` 로직과 기간 필터 중복
**What goes wrong:** ChartsSection이 내부적으로 `.slice(-30)` 적용 중. 기간 필터 후 이미 필터된 데이터에 다시 slice 적용 → 의도치 않은 데이터 누락
**Why it happens:** ChartsSection 내부 `records = [...data.daily].sort().slice(-30)`
**How to avoid:** 기간 필터 적용 후 ChartsSection에 넘기면 slice(-30)는 필터된 범위 내 최근 30개 → 필터 기간이 30일 이하면 영향 없음 (이번 주 = 최대 7개, 이번 달 = 최대 31개). 실제로 무해하나 명시적으로 인식해야 함

---

## Code Examples

Verified patterns from official sources:

### URL searchParams 읽기/쓰기 (검증됨: 기존 tab-nav.tsx 패턴)
```typescript
// Source: 기존 components/dashboard/tab-nav.tsx — 프로젝트에서 이미 동작 확인됨
const router = useRouter();
const pathname = usePathname();
const searchParams = useSearchParams();

function handleChange(value: string) {
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', value);
  params.set('period', newPeriod); // 기존 tab 외에 period도 동시 관리
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}
```

### 월의 마지막 날 계산 (순수 JS)
```typescript
// Source: MDN Web Docs — Date constructor behavior
// new Date(year, month, 0) → 해당 월의 마지막 날 (day=0은 이전 달 마지막 날)
const lastDayOfPrevMonth = new Date(2026, 2, 0); // → 2026-02-28
const lastDayOfFeb = new Date(2026, 3, 0);       // → 2026-03-31
```

### 한국 기준 월요일 계산 (ISO week: 월요일 시작)
```typescript
// Source: 구현 로직 — JS getDay() 기반 (0=일, 1=월, ..., 6=토)
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 일요일이면 지난 월요일(-6), 아니면 (1-day)
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}
// 검증: 2026-03-01 (일요일) → getDay()=0 → diff=-6 → 2026-02-23 (월요일) ✓
// 검증: 2026-03-04 (수요일) → getDay()=3 → diff=1-3=-2 → 2026-03-02 (월요일) ✓
```

### 문자열 날짜 범위 필터 (YYYY-MM-DD 사전순 = 날짜 순서)
```typescript
// Source: ISO 8601 명세 — "YYYY-MM-DD" 형식은 사전순 정렬이 시간순과 동일
const filtered = records.filter(r => r.date >= '2026-02-01' && r.date <= '2026-02-28');
// 정확하고 효율적 — Date 객체 변환 불필요
```

### 빈 상태 처리 (기존 패턴 유지)
```typescript
// Source: 기존 components/dashboard/kpi-cards.tsx — 이미 null 처리됨
if (!current) {
  return <p className="text-muted-foreground">일별 데이터가 없습니다.</p>;
}
// → 기간 필터 후 0개가 되어도 기존 빈 상태 처리가 작동함
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| middleware.ts | proxy.ts (Next.js 16) | Next.js 16 | 라우트 보호 방식 변경됨 — Phase 6와 무관 |
| useSearchParams without Suspense | Suspense 필수 | Next.js 13+ | DashboardContent 컴포넌트를 Suspense로 감싸야 함 |
| Redux/Context for URL sync | useRouter + useSearchParams | App Router 표준 | 추가 라이브러리 없이 URL 상태 관리 |

**Deprecated/outdated:**
- `middleware.ts`: 이 프로젝트에서는 `proxy.ts`로 변경됨 — Phase 6 관련 없음

---

## Open Questions

1. **실제 WeeklyRecord.week 형식이 "N월 N주차"인가 "N주차"인가**
   - What we know: mock 데이터는 "1주차", "2주차" 형식 (월 정보 없음)
   - What's unclear: 실제 Google Sheets 데이터가 "2월 1주차" 형식인지 "1주차" 형식인지
   - Recommendation: 월 파싱 실패 시 전체 데이터 반환(폴백)으로 구현. 실제 데이터 확인 후 파싱 로직 조정 가능하도록 parseWeekMonth() 함수를 독립 모듈로 분리

2. **Daily 탭 기본 기간: 이번 달 vs 이번 주**
   - What we know: CONTEXT.md에서 Claude's Discretion으로 위임
   - What's unclear: 사용자가 주로 보는 단위가 주인지 월인지
   - Recommendation: **이번 달**을 기본값으로 설정. KPI 카드가 "이번 달 vs 지난 달" 비교로 의미있는 데이터를 보여주며, 가장 많은 데이터가 있는 범위

3. **탭 전환 시 period URL 파라미터 처리**
   - What we know: Daily에서 Weekly로 전환 시 "this-week", "last-week"는 Weekly 탭에 유효하지 않음
   - What's unclear: period를 초기화할지, "this-month"로 강제 전환할지
   - Recommendation: 탭 전환 시 period를 해당 탭 기본값으로 자동 리셋 (handleTabChange에서 params.set('period', defaultPeriod) 처리)

---

## Sources

### Primary (HIGH confidence)
- 프로젝트 코드베이스 직접 분석 — tab-nav.tsx, page.tsx, types/dashboard.ts, lib/data.ts, lib/mock-data.ts, kpi-cards.tsx, data-table.tsx, charts-section.tsx
- Next.js App Router searchParams 패턴 — 기존 tab-nav.tsx의 동작 검증됨

### Secondary (MEDIUM confidence)
- MDN Web Docs (Date constructor) — `new Date(year, month, 0)`으로 월말 계산 패턴
- ISO 8601 — YYYY-MM-DD 사전순 = 날짜 순서 (표준 명세)

### Tertiary (LOW confidence)
- Weekly 시트 week 필드 실제 형식 — mock 데이터로만 확인, 실제 Sheets 연결 불가

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 기존 프로젝트 스택 분석 기반, 추가 라이브러리 없음
- Architecture: HIGH — 실제 코드 분석으로 현재 구조 완전 파악, 변경 범위 명확
- Date filtering logic: HIGH — ISO 8601 날짜 문자열 비교 표준, JS Date API 검증됨
- Weekly filter: MEDIUM — week 문자열 형식이 실제 Sheets와 다를 수 있음

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (Next.js 16, shadcn/ui 안정 스택 — 30일 유효)
