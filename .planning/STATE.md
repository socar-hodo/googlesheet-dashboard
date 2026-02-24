# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** 오늘 매출이 목표 대비 어디에 있는지, 지난 주/지난 달 대비 어떻게 변하고 있는지를 한 페이지에서 즉시 파악할 수 있어야 한다.
**Current focus:** Phase 3: Charts

## Current Position

Phase: 3 of 5 (Charts)
Plan: 4 of 4 in current phase
Status: Complete — Phase 3 완료, CHART-01~05 전체 충족 (ChartsSection 최종 통합 + 브라우저 검증)
Last activity: 2026-02-24 -- Plan 03-04 완료 (charts-section.tsx 최종 구현, page.tsx ChartsSection 통합)

Progress: [██████████] 72%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 3.3 min
- Total execution time: 0.29 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-layer-foundation | 2 | 5 min | 2.5 min |
| 02-dashboard-shell-kpi-cards | 3 | 12 min | 4.0 min |
| 03-chart-components | 2 | 6 min | 3.0 min |

**Recent Trend:**
- Last 5 plans: 02-01 (5 min), 02-02 (2 min), 02-03 (5 min), 03-01 (2 min), 03-03 (4 min)
- Trend: steady

*Updated after each plan completion*
| Phase 02-dashboard-shell-kpi-cards P03 | 2 | 2 tasks | 2 files |
| Phase 03-chart-components P01 | 2 | 2 tasks | 3 files |
| Phase 03-chart-components P03 | 4 | 2 tasks | 2 files |
| Phase 03-chart-components P02 | 4 | 2 tasks | 2 files |
| Phase 03-chart-components P04 | 5 | 3 tasks | 2 files |

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
- [Phase 02-dashboard-shell-kpi-cards]: Daily 탭에서 달성률/Progress 바 숨김 — DailyRecord에 목표값 없음 (Phase 1 결정 준수)
- [Phase 02-dashboard-shell-kpi-cards]: Weekly 탭에서 매출 카드만 weeklyTarget 대비 달성률 표시 — 타 KPI는 목표값 없음
- [Phase 02-dashboard-shell-kpi-cards]: Progress value 상한 Math.min(achievementRate, 100) — 100% 초과 시 Progress 바 오버플로우 방지
- [Phase 02-03]: Next.js 16 searchParams는 Promise — await 필수, 타입도 Promise<{tab?:string}> 선언
- [Phase 02-03]: TabNav(useSearchParams)는 Suspense fallback=null로 래핑 — SSR 오류 방지
- [Phase 02-03]: Suspense key={activeTab} — 탭 전환 시 스켈레턴 재마운트 (UX-01 구현)
- [Phase 02-03]: lib/data.ts buildMergedColumnIndex — 2단 헤더 병합 셀 빈 문자열을 앞 값으로 전파
- [Phase 03-01]: ChartColorMode를 typeof CHART_COLORS.light 대신 명시적 interface로 정의 — TS 리터럴 타입 충돌 방지
- [Phase 03-01]: ChartsSection 임시 placeholder로 ChartsSkeleton 반환 — 03-02/03-03 완성 전 빌드 통과 우선
- [Phase 03-01]: Recharts SVG fill/stroke에 CSS 변수 직접 불가 → 테마별 하드코딩 oklch + hex 색상 상수 패턴 확립
- [Phase 03-03]: ComposedChart 사용 for usage-trend — BarChart도 가능하나 RESEARCH.md Pattern 6 일관성 유지
- [Phase 03-03]: yAxisId="left"/"right" Bar 모두 명시 — Pitfall 3(yAxisId 불일치 경고) 사전 방지
- [Phase 03-03]: .next 캐시 오염 시 rm -rf .next 후 클린 빌드 — Next.js 16 dev 타입 캐시 이슈
- [Phase 03-chart-components]: formatDailyLabel/formatWeeklyLabel 로컬 선언 — 별도 utils 파일 없이 각 차트 파일에 로컬 정의
- [Phase 03-chart-components]: ChartsSection에서 Daily 최근 30일 슬라이싱 처리 — 개별 차트에 중복 코드 없음

### Pending Todos

None

### Blockers/Concerns

- [Phase 1]: Actual Google Sheet column structure needs validation before parser implementation
- [Phase 1]: Korean number formatting behavior (FORMATTED_VALUE vs UNFORMATTED_VALUE) needs testing with real API call

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 03-chart-components-03-04-PLAN.md (ChartsSection 최종 통합, Phase 3 완료)
Resume file: None
