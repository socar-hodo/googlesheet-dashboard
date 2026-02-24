# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** 오늘 매출이 목표 대비 어디에 있는지, 지난 주/지난 달 대비 어떻게 변하고 있는지를 한 페이지에서 즉시 파악할 수 있어야 한다.
**Current focus:** Phase 4: Data Table Polish

## Current Position

Phase: 4 of 5 (Data Table Polish)
Plan: 2 of 3 in current phase
Status: In Progress — Plan 04-02 완료 (UpdateTimestamp Client Component 구현)
Last activity: 2026-02-24 -- Plan 04-02 완료 (UpdateTimestamp 상대+절대 타임스탬프 컴포넌트)

Progress: [████████████] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 3.1 min
- Total execution time: 0.32 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-layer-foundation | 2 | 5 min | 2.5 min |
| 02-dashboard-shell-kpi-cards | 3 | 12 min | 4.0 min |
| 03-chart-components | 2 | 6 min | 3.0 min |
| 04-data-table-polish | 1 | 3 min | 3.0 min |

**Recent Trend:**
- Last 5 plans: 02-02 (2 min), 02-03 (5 min), 03-01 (2 min), 03-03 (4 min), 04-01 (3 min)
- Trend: steady

*Updated after each plan completion*
| Phase 02-dashboard-shell-kpi-cards P03 | 2 | 2 tasks | 2 files |
| Phase 03-chart-components P01 | 2 | 2 tasks | 3 files |
| Phase 03-chart-components P03 | 4 | 2 tasks | 2 files |
| Phase 03-chart-components P02 | 4 | 2 tasks | 2 files |
| Phase 03-chart-components P04 | 5 | 3 tasks | 2 files |
| Phase 04-data-table-polish P01 | 3 | 2 tasks | 2 files |
| Phase 04-data-table-polish P02 | 2 | 1 tasks | 1 files |

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
- [Phase 04-01]: 테이블 금액 포맷: 원 단위 전체(₩1,234,567) — KPI 카드 만원 단위와 명확히 분리
- [Phase 04-01]: 가동률 합계 행 → '-' 표시, 평균 행에만 가동률 표시 (합계 무의미)
- [Phase 04-01]: Striped rows: index % 2 === 1 조건으로 짝수 행에 bg-muted/30 직접 적용
- [Phase 04-02]: hydration 안전 패턴: mounted 상태 전 null 반환 — SSR 클라이언트 locale 불일치 방지
- [Phase 04-02]: 자동 새로고침 없음 — 마운트 시 1회 계산만 (CONTEXT.md 결정)

### Pending Todos

None

### Blockers/Concerns

- [Phase 1]: Actual Google Sheet column structure needs validation before parser implementation
- [Phase 1]: Korean number formatting behavior (FORMATTED_VALUE vs UNFORMATTED_VALUE) needs testing with real API call

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 04-data-table-polish-04-02-PLAN.md (UpdateTimestamp Client Component 구현)
Resume file: None
