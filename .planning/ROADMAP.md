# Roadmap: 경남울산사업팀 매출 대시보드

## Milestones

- ✅ **v1.0 MVP** — Phase 1-5 (shipped 2026-02-27)
- ✅ **v1.1 분석 도구 강화** — Phase 6-8 (shipped 2026-03-01)

## Phases

<details>
<summary>✅ v1.0 MVP (Phase 1-5) — SHIPPED 2026-02-27</summary>

- [x] **Phase 1: Data Layer Foundation** (2/2 plans) — 팀 전용 타입, Sheets 파서, mock 폴백
- [x] **Phase 2: Dashboard Shell + KPI Cards** (3/3 plans) — Daily/Weekly 탭, KPI 카드 5개
- [x] **Phase 3: Chart Components** (4/4 plans) — 매출/손익/가동률/이용 차트
- [x] **Phase 4: Data Table + Polish** (3/3 plans) — 데이터 테이블, 업데이트 타임스탬프
- [x] **Phase 5: Cleanup + Migration** (1/1 plan) — 레거시 컴포넌트 삭제, 빌드 검증

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details open>
<summary>✅ v1.1 분석 도구 강화 (Phase 6-8) — SHIPPED 2026-03-01</summary>

- [x] **Phase 6: Period Filter** — 기간 선택기 (이번 주/지난 주/이번 달/지난 달 토글 + URL 상태)
- [x] **Phase 7: Export** — 현재 데이터 CSV/Excel 다운로드 + 파일명 규칙 (2/2 plans done)
- [x] **Phase 8: Sparkline** — KPI 카드 미니 스파크라인 차트 (다크/라이트 테마 대응) [2/2 plans done]

</details>

## Phase Details

### Phase 6: Period Filter
**Goal**: 사용자가 보고 싶은 기간(이번 주/지난 주/이번 달/지난 달)을 선택하면 대시보드 전체가 해당 기간 데이터로 즉시 반영된다
**Depends on**: Phase 1-5 (v1.0 complete)
**Requirements**: FILT-01, FILT-02, FILT-03
**Success Criteria** (what must be TRUE):
  1. 대시보드 상단에 이번 주/지난 주/이번 달/지난 달 토글 버튼이 표시되고 하나만 활성화된다
  2. 기간 토글을 클릭하면 KPI 카드, 차트 4종, 데이터 테이블이 해당 기간 데이터로 즉시 업데이트된다
  3. 기간 선택 상태가 URL searchParams에 저장되어 링크 공유 시 동일 기간이 선택된 상태로 열린다
  4. 페이지를 새로고침해도 URL의 기간 파라미터가 유지되어 동일 기간 뷰가 복원된다
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md — 기간 필터 유틸리티 (PeriodKey 타입, 날짜 계산, 필터 함수)
- [x] 06-02-PLAN.md — UI 컴포넌트 (PeriodFilter, DashboardHeader, Client Component 전환)
- [x] 06-03-PLAN.md — 통합 (DashboardContent, page.tsx 업데이트, 브라우저 검증)

### Phase 7: Export
**Goal**: 사용자가 현재 대시보드에 보이는 데이터를 CSV 또는 Excel 파일로 즉시 다운로드할 수 있다
**Depends on**: Phase 6 (period filter — export reflects filtered data)
**Requirements**: EXPO-01, EXPO-02, EXPO-03
**Success Criteria** (what must be TRUE):
  1. 대시보드에 CSV 다운로드 버튼이 있고 클릭하면 현재 보이는 데이터가 .csv 파일로 즉시 다운로드된다
  2. 대시보드에 Excel 다운로드 버튼이 있고 클릭하면 현재 보이는 데이터가 .xlsx 파일로 즉시 다운로드된다
  3. 다운로드된 파일명에 현재 탭(daily 또는 weekly)과 날짜(YYYY-MM-DD 형식)가 포함된다
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md — export-utils 라이브러리 (xlsx CDN 설치, exportToCsv, exportToXlsx 순수 함수)
- [x] 07-02-PLAN.md — UI 통합 (DashboardContent에 CSV/Excel 버튼 추가, 브라우저 검증)

### Phase 8: Sparkline
**Goal**: KPI 카드 각각에 최근 데이터의 추이를 한눈에 파악할 수 있는 미니 차트가 표시된다
**Depends on**: Phase 6 (period filter determines which data slice feeds sparkline)
**Requirements**: SPRK-01, SPRK-02
**Success Criteria** (what must be TRUE):
  1. 5개 KPI 카드 각각에 최근 기간 데이터 포인트를 시각화하는 미니 스파크라인 차트가 표시된다
  2. 스파크라인이 다크 모드에서 적절한 색상으로, 라이트 모드에서 적절한 색상으로 각각 올바르게 렌더링된다
  3. 스파크라인이 기존 KPI 카드 레이아웃(달성률, 프로그레스 바, 델타)을 가리거나 깨뜨리지 않는다
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — kpi-card.tsx + kpi-cards.tsx 스파크라인 구현 (AreaChart prop 추가, 5개 KPI 데이터 추출)
- [x] 08-02-PLAN.md — Playwright 브라우저 검증 (5개 카드 렌더링, 테마 전환, 레이아웃 확인)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Layer Foundation | v1.0 | 2/2 | Complete | 2026-02-21 |
| 2. Dashboard Shell + KPI Cards | v1.0 | 3/3 | Complete | 2026-02-22 |
| 3. Chart Components | v1.0 | 4/4 | Complete | 2026-02-23 |
| 4. Data Table + Polish | v1.0 | 3/3 | Complete | 2026-02-24 |
| 5. Cleanup + Migration | v1.0 | 1/1 | Complete | 2026-02-24 |
| 6. Period Filter | v1.1 | 3/3 | Complete | 2026-03-01 |
| 7. Export | v1.1 | 2/2 | Complete | 2026-03-01 |
| 8. Sparkline | v1.1 | 2/2 | Complete | 2026-03-01 |
