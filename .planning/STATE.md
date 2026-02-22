# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** 오늘 매출이 목표 대비 어디에 있는지, 지난 주/지난 달 대비 어떻게 변하고 있는지를 한 페이지에서 즉시 파악할 수 있어야 한다.
**Current focus:** Phase 2: Dashboard Shell + KPI Cards

## Current Position

Phase: 2 of 5 (Dashboard Shell + KPI Cards)
Plan: 1 of 3 in current phase
Status: In Progress
Last activity: 2026-02-22 -- Plan 02-01 완료 (shadcn 설치 + KPI 유틸리티 + 스켈레턴)

Progress: [███░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 3.0 min
- Total execution time: 0.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-layer-foundation | 2 | 5 min | 2.5 min |
| 02-dashboard-shell-kpi-cards | 1 | 5 min | 5.0 min |

**Recent Trend:**
- Last 5 plans: 01-01 (2 min), 01-02 (3 min), 02-01 (5 min)
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 5-phase structure derived from 24 requirements across 6 categories
- [Roadmap]: Phase 1 includes UX-02 (real-time fetch) because it is a data layer concern
- [Roadmap]: Phase 2 includes UX-01 (loading skeleton) alongside KPI/Tab requirements
- [Phase 01-data-layer-foundation]: DailyRecord에 monthlyTarget 없음 — Daily 시트에는 목표 컬럼이 존재하지 않음 (CONTEXT.md 결정)
- [Phase 01-data-layer-foundation]: 기존 범용 e-커머스 타입 5개(KpiData 등) 완전 삭제, DailyRecord/WeeklyRecord/TeamDashboardData로 교체
- [Phase 01-02]: parseKoreanNumber를 export function으로 공개 — Phase 2 컴포넌트에서 포맷팅 재사용 가능
- [Phase 01-02]: GOOGLE_DAILY_SHEET_NAME/GOOGLE_WEEKLY_SHEET_NAME 환경변수로 시트 탭명 재정의 가능
- [Phase 01-02]: 헤더 이름 기반 컬럼 매핑(buildColumnIndex) — 인덱스 고정 파싱 완전 배제
- [Phase 02-01]: 달성률 상한 999%로 cap — 이상치 데이터 방어
- [Phase 02-01]: previous=0일 때 percent=0 반환 — 0으로 나누기 방지
- [Phase 02-01]: formatDelta unit 파라미터로 원/건/%/시간 분기 — KPI 카드에서 단위별 표시 통일
- [Phase 02-01]: Progress 바 색상은 [&>div]:bg-{color} 패턴으로 shadcn Progress 내부 div 오버라이드

### Pending Todos

- Phase 2: app/(dashboard)/dashboard/page.tsx를 getTeamDashboardData()로 교체 필요 (02-03)
- Phase 2: page.tsx에 `export const dynamic = 'force-dynamic'` 추가 필요 (02-03)

### Blockers/Concerns

- [Phase 1]: Actual Google Sheet column structure needs validation before parser implementation
- [Phase 1]: Korean number formatting behavior (FORMATTED_VALUE vs UNFORMATTED_VALUE) needs testing with real API call

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 02-dashboard-shell-kpi-cards-02-01-PLAN.md (shadcn 설치 + KPI 유틸리티 + 스켈레턴 완료)
Resume file: None
