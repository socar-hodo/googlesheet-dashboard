---
phase: 04-data-table-polish
plan: "01"
subsystem: ui
tags: [table, server-component, shadcn, tailwind, typescript]

# Dependency graph
requires:
  - phase: 01-data-layer-foundation
    provides: DailyRecord, WeeklyRecord, TeamDashboardData 타입 정의
  - phase: 02-dashboard-shell-kpi-cards
    provides: 탭 구조(daily/weekly), shadcn Table 컴포넌트 설치
provides:
  - DataTable Server Component — Daily/Weekly 탭별 상세 데이터 테이블 (합계/평균 요약 행 포함)
  - DataTableSkeleton — Suspense fallback용 스켈레톤 플레이스홀더
affects: [04-02, page.tsx Suspense 통합]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "원 단위 전체 금액 표시 — KPI 카드(만원 단위)와 별도 포맷 기준"
    - "합계/평균 요약 행 패턴 — TableBody 내 font-bold bg-muted/60 행"
    - "손익 음수 → text-red-600 dark:text-red-400 조건부 스타일"
    - "이용시간 Xh Ym 포맷 — Math.floor(hours) + Math.round((hours % 1) * 60)"

key-files:
  created:
    - components/dashboard/data-table.tsx
    - components/dashboard/data-table-skeleton.tsx
  modified: []

key-decisions:
  - "금액 포맷: 테이블에서는 원 단위 전체(₩1,234,567) — KPI 카드 만원 단위와 명확히 분리"
  - "가동률 합계 행 → '-' 표시, 평균 행에만 가동률 표시 (합계는 의미 없음)"
  - "striped rows: index % 2 === 1 조건으로 짝수 행에 bg-muted/30 직접 적용 (even: 유틸리티 대신)"
  - "0 나누기 방어: records.length === 0 이면 평균 0 반환"

patterns-established:
  - "DataTable: props { data: TeamDashboardData; tab: 'daily' | 'weekly' } — tab prop으로 렌더링 분기"
  - "요약 행 스타일: className='font-bold bg-muted/60' on TableRow"

requirements-completed: [TABLE-01, TABLE-02, TABLE-03]

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 4 Plan 01: DataTable Server Component Summary

**Daily/Weekly 탭별 상세 테이블 + 합계/평균 요약 행, 손익 음수 빨간색, 이용시간 Xh Ym 포맷, shadcn Table 기반 Server Component**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T07:14:03Z
- **Completed:** 2026-02-24T07:17:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- DataTable Server Component 구현 — Daily(6컬럼)/Weekly(7컬럼) 탭별 테이블, 합계/평균 요약 2행 포함
- 손익 음수 text-red-600 dark:text-red-400, 이용시간 Xh Ym, 가동률 소수점 1자리 %, 금액 원 단위 전체
- DataTableSkeleton 구현 — Suspense fallback용 헤더 1행 + 데이터 8행 스켈레톤

## Task Commits

Each task was committed atomically:

1. **Task 1: DataTable Server Component 구현** - `7d1b58a` (feat)
2. **Task 2: DataTableSkeleton 구현** - `8cc0940` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `components/dashboard/data-table.tsx` - DataTable Server Component — Daily/Weekly 탭 분기, 요약 행 포함
- `components/dashboard/data-table-skeleton.tsx` - DataTableSkeleton — Suspense fallback 스켈레톤

## Decisions Made
- 금액 포맷: 원 단위 전체 (`₩${value.toLocaleString()}`) — KPI 카드 만원 단위와 분리
- 가동률: 합계 행 → "-", 평균 행에만 표시 (합계 무의미)
- Striped rows: `index % 2 === 1` 조건으로 짝수 행에 `bg-muted/30` 직접 적용
- 0 나누기 방어: `len > 0 ? sum / len : 0` 패턴

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- DataTable, DataTableSkeleton 모두 준비 완료
- 다음 플랜(04-02)에서 page.tsx에 DataTable + DataTableSkeleton Suspense 블록 통합 가능
- fetchedAt 타임스탬프 표시 컴포넌트도 04-02 범위

---
*Phase: 04-data-table-polish*
*Completed: 2026-02-24*

## Self-Check: PASSED

- FOUND: components/dashboard/data-table.tsx
- FOUND: components/dashboard/data-table-skeleton.tsx
- FOUND: .planning/phases/04-data-table-polish/04-01-SUMMARY.md
- FOUND commit 7d1b58a (DataTable Server Component)
- FOUND commit 8cc0940 (DataTableSkeleton)
