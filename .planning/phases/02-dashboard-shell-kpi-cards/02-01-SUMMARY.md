---
phase: 02-dashboard-shell-kpi-cards
plan: "01"
subsystem: ui
tags: [shadcn, tailwind, kpi, skeleton, typescript]

# Dependency graph
requires:
  - phase: 01-data-layer-foundation
    provides: DailyRecord/WeeklyRecord/TeamDashboardData 타입 정의, 데이터 레이어

provides:
  - shadcn Tabs 컴포넌트 (components/ui/tabs.tsx)
  - shadcn Progress 컴포넌트 (components/ui/progress.tsx)
  - shadcn Skeleton 컴포넌트 (components/ui/skeleton.tsx)
  - KPI 계산/포맷팅 유틸리티 7개 함수 (lib/kpi-utils.ts)
  - KpiCardsSkeleton Suspense 폴백 컴포넌트 (components/dashboard/kpi-cards-skeleton.tsx)

affects:
  - 02-02 (KPI 카드, Tabs 컴포넌트 구현에서 모두 import)
  - 02-03 (대시보드 페이지 조립 시 KpiCardsSkeleton Suspense fallback으로 사용)

# Tech tracking
tech-stack:
  added:
    - shadcn/ui Tabs (Radix UI 기반)
    - shadcn/ui Progress (Radix UI 기반)
    - shadcn/ui Skeleton
  patterns:
    - KPI 달성률 임계값 패턴: 80%+ 녹색 / 60~80% 주황 / 60% 미만 빨간 (KPI-05)
    - 금액 포맷: ₩${amount/10000}만 (만원 단위, CLAUDE.md 규칙)
    - 델타 포맷: "▲ +12% / ₩120만" (▲/▼ 화살표 + 퍼센트 + 절댓값, CONTEXT.md 결정)
    - Progress 바 색상 오버라이드: [&>div]:bg-{color} Tailwind 패턴

key-files:
  created:
    - components/ui/tabs.tsx
    - components/ui/progress.tsx
    - components/ui/skeleton.tsx
    - lib/kpi-utils.ts
    - components/dashboard/kpi-cards-skeleton.tsx
  modified: []

key-decisions:
  - "달성률 상한을 999%로 cap — 이상치 데이터 방어"
  - "previous=0일 때 percent=0 반환 — 0으로 나누기 방지"
  - "getDeltaColorClass는 percent 기준 (양수=녹색, 음수=빨간) — 매출/이용건수 모두 동일 방향"
  - "formatDelta unit 파라미터로 원/건/%/시간 분기 — KPI 카드에서 단위별 표시 통일"

patterns-established:
  - "getAchievementColorClass/getProgressColorClass: 동일 임계값(80/60) 사용 — 색상 일관성 보장"
  - "KpiCardsSkeleton: KpiCards와 동일한 반응형 그리드 클래스 — 레이아웃 이동 없음"

requirements-completed: [KPI-02, KPI-03, KPI-04, KPI-05, UX-01]

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 02 Plan 01: shadcn UI 설치 + KPI 유틸리티 + 스켈레턴 Summary

**shadcn Tabs/Progress/Skeleton 설치, 달성률·델타·포맷팅 함수 7개 구현, 5개 카드 Suspense 폴백 스켈레턴 생성**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T06:12:15Z
- **Completed:** 2026-02-22T06:16:50Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- shadcn Tabs, Progress, Skeleton 컴포넌트 설치 (components/ui/)
- KPI 계산/포맷팅 유틸리티 7개 named export 구현 (lib/kpi-utils.ts)
- KpiCardsSkeleton Suspense 폴백 컴포넌트 구현 (5개 카드 형태 스켈레턴)

## Task Commits

Each task was committed atomically:

1. **Task 1: shadcn Tabs, Progress, Skeleton 컴포넌트 설치** - `fe51218` (chore)
2. **Task 2: KPI 계산/포맷팅 유틸리티 구현** - `d6e9361` (feat)
3. **Task 3: KpiCardsSkeleton 컴포넌트 구현** - `58addb7` (feat)

## Files Created/Modified
- `components/ui/tabs.tsx` - shadcn Tabs (Radix UI Tabs 래퍼)
- `components/ui/progress.tsx` - shadcn Progress (Radix UI Progress 래퍼)
- `components/ui/skeleton.tsx` - shadcn Skeleton (펄싱 로딩 박스)
- `lib/kpi-utils.ts` - KPI 계산/포맷팅 7개 유틸리티 함수
- `components/dashboard/kpi-cards-skeleton.tsx` - KpiCardsSkeleton Suspense fallback

## Decisions Made
- 달성률 상한 999%로 cap: 비정상적인 실적 데이터가 UI를 깨지 않도록 방어
- previous=0 시 percent=0 반환: 0으로 나누기 방지, absolute는 current 값 반환
- formatDelta unit 파라미터: 원/건/%/시간 4가지로 분기하여 KPI 종류별 표시 통일
- Progress 바 색상은 [&>div]:bg-{color} 패턴: shadcn Progress의 내부 div 직접 오버라이드

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 02-02에서 import 가능한 상태:
  - `import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'`
  - `import { Progress } from '@/components/ui/progress'`
  - `import { Skeleton } from '@/components/ui/skeleton'`
  - `import { calcAchievementRate, calcDelta, formatKpiValue, ... } from '@/lib/kpi-utils'`
  - `import { KpiCardsSkeleton } from '@/components/dashboard/kpi-cards-skeleton'`
- TypeScript 컴파일 오류 없음 확인됨

---
*Phase: 02-dashboard-shell-kpi-cards*
*Completed: 2026-02-22*

## Self-Check: PASSED

- FOUND: components/ui/tabs.tsx
- FOUND: components/ui/progress.tsx
- FOUND: components/ui/skeleton.tsx
- FOUND: lib/kpi-utils.ts
- FOUND: components/dashboard/kpi-cards-skeleton.tsx
- FOUND: .planning/phases/02-dashboard-shell-kpi-cards/02-01-SUMMARY.md
- Commit fe51218: chore(02-01): shadcn Tabs, Progress, Skeleton 컴포넌트 설치
- Commit d6e9361: feat(02-01): KPI 계산/포맷팅 유틸리티 구현 (lib/kpi-utils.ts)
- Commit 58addb7: feat(02-01): KpiCardsSkeleton 컴포넌트 구현
