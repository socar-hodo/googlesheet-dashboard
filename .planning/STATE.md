---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: 매출/비용 분析
status: planning
last_updated: "2026-03-02T00:00:00.000Z"
progress:
  total_phases: 12
  completed_phases: 10
  total_plans: 24
  completed_plans: 24
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** 오늘 매출이 목표 대비 어디에 있는지, 지난 주/지난 달 대비 어떻게 변하고 있는지를 한 페이지에서 즉시 파악할 수 있어야 한다.
**Current focus:** v1.3 milestone — 매출 세분화 + 비용 분析 UI (Phase 11-12)

## Current Position

Milestone: v1.2 — COMPLETE ✅ (shipped 2026-03-02)
Milestone: v1.3 — PLANNING (Phase 11-12 not started)
Last activity: 2026-04-17 - Completed quick task 260417-glt: 고객 유형 분석 BQ 직접 연동

## v1.3 Phase Map

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 11 | Revenue Breakdown | REV-01, REV-02, REV-03 | Not started |
| 12 | Cost Analysis | COST-01, COST-02, COST-03 | Not started |

**Data layer:** Phase 9 already provides RevenueBreakdownRow + CostBreakdownRow + parsers — Phase 11/12 need UI only.

## Accumulated Context

### Inherited Decisions (from v1.2)

- parseRevenueBreakdownFromRaw, parseCostBreakdownFromRaw 파서 구현 완료 — Phase 11/12 UI는 data.revenueBreakdownDaily/Weekly, data.costBreakdownDaily/Weekly 바로 사용 가능
- chart3/4/5 oklch 색상 시스템 확립 (chart-colors.ts)
- filteredData useMemo 패턴 확립 (dashboard-content.tsx)
- CustomerTypeSection의 1/3+2/3 그리드 레이아웃 패턴 — Revenue/Cost에도 재사용 가능

### Blockers/Concerns

- Google Sheets에 대여/PF/주행/부름/기타 매출 컬럼 실제 존재 여부 확인 필요 — 없으면 0 폴백
- COST-02 드릴다운 UI: shadcn/ui Collapsible 사용 여부 결정 필요

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260417-glt | 고객 유형 분석 BQ 직접 연동 — reservation_v2에서 way 기준 왕복/배달/편도 건수 집계 API 추가 | 2026-04-17 | f178a65 | [260417-glt-bq-reservation-v2-way-api](./quick/260417-glt-bq-reservation-v2-way-api/) |

## Session Continuity

Last session: 2026-03-02
Stopped at: FORECAST 탭 기능 구현 시작 전 (컨텍스트 한계)

## Next Task: FORECAST 탭 구현

### 요구사항
- Google Sheets에 **FORECAST** 시트 추가됨 (일별)
- 컬럼: `날짜(일자)`, `사전 매출`, `사전 달성률`
- 대시보드에 **세 번째 탭 "예측"** 추가하여 차트로 표시
- 주차별은 나중에 (우선 일별만)

### 구현 계획

**1. `types/dashboard.ts`**
- `ForecastRow` 인터페이스 추가: `{ date: string; forecastRevenue: number; forecastRate: number }`
- `TeamDashboardData`에 `forecastDaily: ForecastRow[]` 필드 추가

**2. `lib/data.ts`**
- `FORECAST_SHEET` 상수 추가 (`"FORECAST"`)
- `FORECAST_HEADERS` 상수: `{ date: "일자", revenue: "사전 매출", rate: "사전 달성률" }`
- `parseForecastFromRows()` 파서 함수 추가
- `getTeamDashboardData()` 5-fetch로 확장 (FORECAST 시트 추가)
- mock 폴백: `forecastDaily: []`

**3. `lib/mock-data.ts`**
- `mockTeamDashboardData.forecastDaily` 샘플 데이터 추가 (2026-03 기준)

**4. `components/dashboard/charts/forecast-chart.tsx`** (신규)
- ComposedChart: Bar(사전 매출) + Line(사전 달성률, 우측 Y축)
- 일별 X축, 만원 단위 포맷, 달성률 % 포맷

**5. `app/(dashboard)/dashboard/page.tsx`**
- `activeTab` 타입에 `'forecast'` 추가

**6. `components/dashboard/dashboard-header.tsx`**
- TabsTrigger에 `<TabsTrigger value="forecast">예측</TabsTrigger>` 추가
- `forecast` 탭에서는 기간 필터 / 내보내기 버튼 숨김 (데이터 전체 표시)

**7. `components/dashboard/dashboard-content.tsx`**
- `tab` 타입 `'daily' | 'weekly' | 'forecast'`로 확장
- `forecast` 탭 분기: KpiCards/ChartsSection/DataTable 대신 ForecastChart 렌더링
- `page.tsx`에서 `activeTab` 파싱 시 `'forecast'` 포함

### 참고 파일
- `lib/data.ts` 기존 파서 패턴: `buildColumnIndex`, `safeNumber` 활용
- `charts/revenue-trend-chart.tsx` — ComposedChart 패턴 참고
- `charts/chart-colors.ts` — `getChartColors` 활용
