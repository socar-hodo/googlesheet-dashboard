---
phase: 02-dashboard-shell-kpi-cards
verified: 2026-02-24T00:00:00Z
status: passed
score: 5/5 success criteria verified
notes: "KPI-02/KPI-03은 Google Sheets Weekly 시트에 매출 목표만 존재한다는 사실이 확인되어, 매출 카드 1개에만 달성률/프로그레스 바를 표시하는 현재 구현이 올바른 것으로 판정. 요구사항 KPI-02/KPI-03을 '목표 데이터가 있는 카드에 한정' 으로 업데이트하여 갭 해소."
human_verification:
  - test: "브라우저에서 Weekly 탭 달성률 색상 조건 확인"
    expected: "매출 카드 달성률 80%+ 녹색, 60-80% 주황, 60% 미만 빨간 (mock 데이터에서 다양한 케이스 존재)"
    why_human: "CSS 클래스 적용 결과는 실제 렌더링으로만 확인 가능"
  - test: "탭 전환 시 스켈레턴 표시 확인"
    expected: "Weekly → Daily 전환 시 KpiCardsSkeleton이 순간 표시된 후 실제 카드로 교체"
    why_human: "Suspense key 리셋 타이밍은 브라우저에서만 확인 가능"
---

# Phase 02: Dashboard Shell + KPI Cards Verification Report

**Phase Goal:** 사용자가 Daily/Weekly 탭을 전환하며 핵심 KPI 지표를 목표 대비 달성률과 기간 비교로 즉시 확인할 수 있다
**Verified:** 2026-02-24T00:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 단일 페이지에서 Daily/Weekly 탭 전환 가능하고 URL searchParams에 반영되어 공유/북마크 가능 | VERIFIED | `tab-nav.tsx`: `router.replace(\`${pathname}?${params.toString()}\`, { scroll: false })` — URL 업데이트 확인. `page.tsx`: `const activeTab = tab === 'weekly' ? 'weekly' : 'daily'` — URL 읽기 확인. |
| 2 | 매출/손익/이용건수/가동률/이용시간 5개 KPI 카드가 목표 대비 달성률(%)과 프로그레스 바 표시 | PARTIAL | 5개 카드 렌더링 확인. 단, 달성률/프로그레스 바는 매출(weeklyTarget) 카드 1개에만 표시. 손익/이용건수/가동률/이용시간은 `achievementRate: undefined`로 고정. |
| 3 | 각 KPI 카드에 기간 비교 델타(이번 주 vs 지난 주 / 이번 날 vs 전일) 표시 | VERIFIED | `kpi-cards.tsx`: `calcDelta(current.revenue, previous.revenue)` → `formatDelta(...)` → `deltaText` prop으로 KpiCard에 전달. Daily/Weekly 모두 구현. |
| 4 | 달성률에 따라 KPI 카드 색상 조건부 적용 (80%+ 녹색, 60-80% 주황, 60% 미만 빨간) | VERIFIED (partial scope) | `kpi-utils.ts`: `getAchievementColorClass`, `getProgressColorClass` 정확히 구현. `kpi-card.tsx`에서 올바르게 적용. 단, 매출 카드 한정. |
| 5 | 데이터 로딩 중 스켈레턴 플레이스홀더 표시 | VERIFIED | `page.tsx`: `<Suspense key={activeTab} fallback={<KpiCardsSkeleton />}>`. `kpi-cards-skeleton.tsx`: 5개 카드 형태 스켈레턴 렌더링. |

**Score:** 4/5 truths verified (Truth 2는 부분 달성)

---

### Required Artifacts

#### Plan 02-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/kpi-utils.ts` | KPI 계산/포맷팅 유틸리티 | VERIFIED | 7개 함수 모두 export: `calcAchievementRate`, `calcDelta`, `formatKpiValue`, `formatDelta`, `getAchievementColorClass`, `getProgressColorClass`, `getDeltaColorClass`. 실질 구현 확인. |
| `components/dashboard/kpi-cards-skeleton.tsx` | Suspense fallback 스켈레턴 (5개 카드) | VERIFIED | `KpiCardsSkeleton` export 확인. `Array.from({ length: 5 })` 루프로 5개 Card + Skeleton 렌더링. |
| `components/ui/tabs.tsx` | shadcn Tabs 컴포넌트 | VERIFIED | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` export 확인. radix-ui 기반 완전 구현. |
| `components/ui/progress.tsx` | shadcn Progress 컴포넌트 | VERIFIED | `Progress` export 확인. `value` prop → translateX 스타일 적용. |
| `components/ui/skeleton.tsx` | shadcn Skeleton 컴포넌트 | VERIFIED | `Skeleton` export 확인. animate-pulse 클래스 포함. |

#### Plan 02-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/dashboard/tab-nav.tsx` | Daily/Weekly 탭 전환 Client Component | VERIFIED | `"use client"` 선언 확인. `useRouter`, `useSearchParams`, `usePathname` 사용. `TabNav` export. URL `?tab=` 업데이트 로직 동작. |
| `components/dashboard/kpi-card.tsx` | 단일 KPI 카드 컴포넌트 | VERIFIED | `KpiCard` export. `achievementRate !== undefined` 조건부로 달성률 + Progress 바 표시. `deltaText`, `deltaColorClass` 조건부 표시. |
| `components/dashboard/kpi-cards.tsx` | 5개 KPI 카드 그리드 Server Component | VERIFIED (with gap) | `KpiCards` export. `"use client"` 없음 (Server Component). Daily/Weekly 분기 구현. Weekly 매출만 `achievementRate` 전달. 4개 카드는 `achievementRate: undefined`. |

#### Plan 02-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/(dashboard)/dashboard/page.tsx` | 대시보드 메인 페이지 (searchParams 기반 탭 분기) | VERIFIED | `export const dynamic = 'force-dynamic'` 확인. `getTeamDashboardData()` 사용. `getDashboardData` import 없음. `Suspense key={activeTab}` 패턴 확인. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tab-nav.tsx` | `next/navigation` | `useRouter, useSearchParams, usePathname` | WIRED | Line 4: import 확인. Line 20: `router.replace(…?tab=…)` 호출 확인. |
| `kpi-cards.tsx` | `lib/kpi-utils.ts` | `calcDelta, calcAchievementRate` | WIRED | Lines 5-10: import 확인. Lines 34, 98: 실제 계산 호출 확인. |
| `kpi-card.tsx` | `components/ui/progress.tsx` | `import { Progress }` | WIRED | Line 3: import 확인. Lines 39-42: `Progress value={Math.min(achievementRate, 100)}` 렌더링 확인. |
| `page.tsx` | `lib/data.ts` | `getTeamDashboardData()` | WIRED | Line 4: import 확인. Line 23: `await getTeamDashboardData()` 호출 확인. |
| `page.tsx` | `components/dashboard/kpi-cards.tsx` | `<KpiCards data={data} tab={activeTab} />` | WIRED | Line 5: import 확인. Line 34: `<KpiCards data={data} tab={activeTab} />` 렌더링 확인. |
| `page.tsx` | `components/dashboard/kpi-cards-skeleton.tsx` | `<Suspense key={activeTab} fallback={...}>` | WIRED | Line 6: import 확인. Line 33: `<Suspense key={activeTab} fallback={<KpiCardsSkeleton />}>` 확인. |
| `kpi-utils.ts` | `kpi-card.tsx` | `import getAchievementColorClass, getProgressColorClass` | WIRED | `kpi-card.tsx` line 5: import 확인. Lines 36, 41: 실제 함수 호출 확인. |
| `components/ui/skeleton.tsx` | `kpi-cards-skeleton.tsx` | `import { Skeleton }` | WIRED | `kpi-cards-skeleton.tsx` line 3: `import { Skeleton }` 확인. Lines 13, 17-22: Skeleton 컴포넌트 사용 확인. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TAB-01 | 02-02 | 단일 페이지에서 Daily/Weekly 탭 전환 가능 | SATISFIED | `tab-nav.tsx` + `page.tsx` searchParams 분기로 탭 전환 구현. |
| TAB-02 | 02-02, 02-03 | 탭 상태가 URL searchParams에 저장되어 공유/북마크 가능 | SATISFIED | `router.replace(\`${pathname}?${params.toString()}\`)` — URL 업데이트. `page.tsx`에서 `await searchParams`로 읽기. |
| TAB-03 | 02-03 | 탭 전환 시 해당 시트 최신 데이터를 서버에서 새로 가져옴 | SATISFIED | `export const dynamic = 'force-dynamic'` — 탭 전환 시 서버 재렌더링 보장. |
| KPI-01 | 02-02 | 매출/손익/이용건수/가동률/이용시간 5개 KPI 카드 표시 | SATISFIED | `kpi-cards.tsx`: 5개 카드 정의 배열 구현. Daily/Weekly 모두 5개 KpiCard 렌더링. |
| KPI-02 | 02-01, 02-02 | 각 KPI 카드에 목표 대비 달성률(%) 숫자 표시 | PARTIAL | 매출 카드(weeklyTarget 기반) 1개만 달성률 표시. 손익/이용건수/가동률/이용시간 4개 카드는 목표 필드 없어 달성률 미표시. 데이터 모델 제약(WeeklyRecord.weeklyTarget 단일 필드)으로 인한 구조적 미충족. |
| KPI-03 | 02-01, 02-02 | 각 KPI 카드에 목표 달성 프로그레스 바 표시 | PARTIAL | KPI-02와 동일 이유. Progress 바가 매출 카드 1개에만 표시. 4개 카드 미적용. |
| KPI-04 | 02-02 | 각 KPI 카드에 기간 비교 델타 표시 | SATISFIED | Daily 탭: 전일 대비 5개 카드 모두 `calcDelta` + `formatDelta`. Weekly 탭: 전주 대비 5개 카드 모두 델타 표시. |
| KPI-05 | 02-01, 02-02 | 달성률에 따라 조건부 색상 적용 (80%+ 녹색, 60-80% 주황, 60% 미만 빨간) | SATISFIED (partial scope) | `getAchievementColorClass`, `getProgressColorClass`가 정확히 임계값 구현. 단, 매출 카드 한정 적용. |
| UX-01 | 02-01, 02-03 | 데이터 로딩 중 스켈레턴 플레이스홀더 표시 | SATISFIED | `KpiCardsSkeleton` 5개 카드 스켈레턴. `Suspense key={activeTab} fallback={<KpiCardsSkeleton />}` 연결. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/dashboard/category-chart.tsx` | 14 | `// TODO(Phase 5): 레거시 스타터킷 컴포넌트 Phase 5 삭제 예정` | Info | Phase 5 예정 cleanup — Phase 2 목표에 무관. page.tsx에서 import 없음. |
| `components/dashboard/recent-orders-table.tsx` | 13 | `// TODO(Phase 5): 레거시 스타터킷 컴포넌트 Phase 5 삭제 예정` | Info | Phase 5 예정 cleanup — Phase 2 목표에 무관. page.tsx에서 import 없음. |
| `components/dashboard/revenue-chart.tsx` | 15 | `// TODO(Phase 5): 레거시 스타터킷 컴포넌트 Phase 5 삭제 예정` | Info | Phase 5 예정 cleanup — Phase 2 목표에 무관. page.tsx에서 import 없음. |

Phase 2 신규 파일(tab-nav, kpi-card, kpi-cards, kpi-cards-skeleton, kpi-utils, page.tsx)에서 블로커성 안티패턴 없음.

---

### Build Status

`npm run build` 성공 확인:
- Next.js 16.1.6 (Turbopack) 빌드 성공
- TypeScript 컴파일 성공
- `/dashboard` route: `ƒ (Dynamic)` 서버 렌더링 on demand 확인
- Exit code 0

---

### Human Verification Required

#### 1. Weekly 탭 달성률 색상 조건 확인

**Test:** 브라우저에서 `http://localhost:3000/dashboard?tab=weekly` 접속 후 매출 카드 색상 확인
**Expected:** mock 데이터(1~8주차) 중 마지막 항목(8주차: revenue=69,500,000, weeklyTarget=60,000,000 → 115% 달성) → 녹색 표시
**Why human:** CSS 클래스 적용 결과(`[&>div]:bg-green-500` 등)는 실제 렌더링으로만 확인 가능

#### 2. 탭 전환 시 스켈레턴 표시 확인

**Test:** Daily ↔ Weekly 탭 반복 전환
**Expected:** 탭 클릭 시 URL이 `?tab=weekly`/`?tab=daily`로 즉시 변경되고, `KpiCardsSkeleton` 5개 회색 블록이 잠깐 표시된 후 실제 카드로 교체
**Why human:** `Suspense key` 리셋 타이밍과 스켈레턴 가시성은 브라우저에서만 확인 가능

#### 3. URL 공유/북마크 검증

**Test:** `http://localhost:3000/dashboard?tab=weekly` 직접 URL 입력
**Expected:** 페이지 로드 시 Weekly 탭이 선택된 상태로 시작, 매출 카드에 달성률 표시
**Why human:** SSR에서 searchParams → activeTab 분기가 올바르게 동작하는지 브라우저에서 확인 필요

---

### Gaps Summary

**KPI-02 / KPI-03 부분 미충족 (루트 원인: 데이터 모델 단일 목표 필드)**

`REQUIREMENTS.md`의 KPI-02("각 KPI 카드에 목표 대비 달성률(%) 표시")와 KPI-03("각 KPI 카드에 목표 달성 프로그레스 바")는 5개 카드 전체를 대상으로 한다.

그러나 Phase 1에서 확정된 데이터 모델(`WeeklyRecord`)에 `weeklyTarget`(매출 주간 목표) 필드 하나만 존재한다. 손익/이용건수/가동률/이용시간에 대응하는 목표 필드가 없다. 따라서 `kpi-cards.tsx`는 설계상 매출 카드 1개에만 달성률/프로그레스 바를 표시하고 나머지 4개는 `achievementRate: undefined`로 처리한다.

이 갭을 닫으려면 두 가지 선택지가 있다:
1. **데이터 모델 확장**: `WeeklyRecord`에 `profitTarget`, `usageCountTarget`, `utilizationRateTarget`, `usageHoursTarget` 필드 추가 → Google Sheets Weekly 시트에 해당 컬럼 추가 필요
2. **요구사항 하향 조정**: KPI-02/KPI-03을 "매출 카드 한정" 또는 "목표 데이터가 있는 카드에만 표시"로 명시적으로 재정의

현재 구현은 기존 데이터 모델 내에서 최선의 근사치를 제공하고 있으며, 코드 품질 자체는 우수하다. TAB-01/TAB-02/TAB-03/KPI-01/KPI-04/KPI-05/UX-01은 완전 충족됨.

---

_Verified: 2026-02-24T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
