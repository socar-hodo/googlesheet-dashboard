# Roadmap: 경남울산사업팀 매출 대시보드

## Overview

기존 Next.js 16 스타터킷 대시보드를 경남울산사업팀 매출 대시보드로 전환한다. 데이터 레이어(타입 + 파서)를 먼저 교체하고, 대시보드 셸과 KPI 카드를 구축한 뒤, 차트 컴포넌트를 추가하고, 데이터 테이블로 마무리한 다음, 기존 스타터킷 잔여 코드를 정리한다. 모든 단계가 Google Sheets Daily/Weekly 시트 데이터를 기반으로 하며, 페이지 접속 시 실시간 데이터를 반영한다.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Layer Foundation** - 팀 전용 타입 정의, Sheets 파서, mock 폴백을 구축하여 모든 UI의 데이터 기반을 마련한다
- [x] **Phase 2: Dashboard Shell + KPI Cards** - Daily/Weekly 탭 전환과 KPI 카드로 대시보드의 핵심 구조를 완성한다
- [ ] **Phase 3: Chart Components** - 매출, 손익, 가동률, 이용 추이 차트로 데이터를 시각화한다
- [ ] **Phase 4: Data Table + Polish** - 상세 데이터 테이블과 요약 행, 업데이트 타임스탬프를 추가한다
- [ ] **Phase 5: Cleanup + Migration** - 스타터킷 범용 컴포넌트를 제거하고 팀 전용 컴포넌트로 완전 교체한다

## Phase Details

### Phase 1: Data Layer Foundation
**Goal**: 팀 데이터가 TypeScript 타입으로 안전하게 파싱되어 모든 UI 컴포넌트에 전달될 수 있다
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, UX-02
**Success Criteria** (what must be TRUE):
  1. Daily 시트에서 일자별 매출/손익/이용시간/이용건수/가동률 데이터가 타입 안전하게 파싱되어 반환된다 (목표 데이터는 Weekly에만 존재)
  2. Weekly 시트에서 주차별 매출/손익/이용시간/이용건수/가동률/목표 데이터가 타입 안전하게 파싱되어 반환된다
  3. 한국어 숫자 포맷(콤마, 원화 기호)이 포함된 값이 NaN 없이 Number로 변환된다
  4. Google Sheets 미연결 시 mock 데이터로 폴백하여 대시보드 페이지가 정상 렌더링된다
  5. 페이지 접속/새로고침 시 Google Sheets에서 최신 데이터를 가져온다
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — 팀 전용 TypeScript 타입 정의 (DailyRecord, WeeklyRecord, TeamDashboardData)
- [x] 01-02-PLAN.md — 팀 mock 데이터 + Korean 숫자 파서 + getTeamDashboardData 구현

### Phase 2: Dashboard Shell + KPI Cards
**Goal**: 사용자가 Daily/Weekly 탭을 전환하며 핵심 KPI 지표를 목표 대비 달성률과 기간 비교로 즉시 확인할 수 있다
**Depends on**: Phase 1
**Requirements**: TAB-01, TAB-02, TAB-03, KPI-01, KPI-02, KPI-03, KPI-04, KPI-05, UX-01
**Success Criteria** (what must be TRUE):
  1. 단일 페이지에서 Daily/Weekly 탭 전환이 가능하고 탭 상태가 URL searchParams에 반영되어 공유/북마크할 수 있다
  2. 매출, 손익, 이용건수, 가동률, 이용시간 5개 KPI 카드가 목표 대비 달성률(%)과 프로그레스 바를 표시한다
  3. 각 KPI 카드에 기간 비교 델타(이번 주 vs 지난 주 / 이번 달 vs 지난 달 증감)가 표시된다
  4. 달성률에 따라 KPI 카드 색상이 조건부로 적용된다 (80%+ 녹색, 60-80% 주황, 60% 미만 빨간)
  5. 데이터 로딩 중 스켈레턴 플레이스홀더가 표시된다
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — shadcn 컴포넌트 설치 + KPI 유틸리티 (lib/kpi-utils.ts) + KpiCardsSkeleton
- [x] 02-02-PLAN.md — TabNav Client Component + KpiCard + KpiCards Server Component
- [x] 02-03-PLAN.md — page.tsx 교체 (getTeamDashboardData + Suspense 탭 분기) + 브라우저 검증

### Phase 3: Chart Components
**Goal**: 매출, 손익, 가동률, 이용 추이를 차트로 시각화하여 데이터 트렌드를 한눈에 파악할 수 있다
**Depends on**: Phase 2
**Requirements**: CHART-01, CHART-02, CHART-03, CHART-04, CHART-05
**Success Criteria** (what must be TRUE):
  1. 매출 추이 차트가 기간별 실적 Bar와 목표 Line을 오버레이하여 표시된다
  2. 손익 추이 차트가 수익(양수) 파란색, 손실(음수) 빨간색으로 구분된 Bar 차트로 표시된다
  3. 가동률 추이 차트가 라인 차트로 표시되며 임계값 기준선이 표시된다
  4. 이용건수/이용시간 추이 차트가 기간별로 표시된다
  5. 모든 차트가 다크/라이트 테마에서 올바른 색상으로 렌더링된다
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md — 차트 공유 인프라 (chart-colors.ts, ChartsSkeleton, ChartsSection 래퍼)
- [ ] 03-02-PLAN.md — 매출 추이 차트(CHART-01) + 손익 추이 차트(CHART-02)
- [ ] 03-03-PLAN.md — 가동률 추이 차트(CHART-03) + 이용건수/이용시간 차트(CHART-04)
- [ ] 03-04-PLAN.md — ChartsSection 최종 연결 + page.tsx 통합 + 브라우저 검증(CHART-05)

### Phase 4: Data Table + Polish
**Goal**: 상세 데이터를 테이블로 확인하고, 합계/평균 요약과 마지막 업데이트 시각을 볼 수 있다
**Depends on**: Phase 3
**Requirements**: TABLE-01, TABLE-02, TABLE-03, UX-03
**Success Criteria** (what must be TRUE):
  1. Daily 탭에서 일자별 전체 데이터(날짜, 매출, 손익, 이용시간, 이용건수, 가동률)가 테이블로 표시된다
  2. Weekly 탭에서 주차별 전체 데이터가 테이블로 표시된다
  3. 테이블 하단에 전체 합계 및 평균 요약 행이 표시된다
  4. 대시보드 상단에 마지막 데이터 업데이트 타임스탬프가 표시된다
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Cleanup + Migration
**Goal**: 스타터킷 범용 컴포넌트가 완전히 제거되고 팀 전용 대시보드만 남는다
**Depends on**: Phase 4
**Requirements**: UX-04
**Success Criteria** (what must be TRUE):
  1. 기존 스타터킷 범용 컴포넌트(revenue-chart, category-chart, recent-orders-table)가 삭제되었다
  2. 삭제된 컴포넌트에 대한 import 참조가 없고 빌드가 성공한다
  3. 대시보드가 팀 전용 컴포넌트만으로 정상 동작한다
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Layer Foundation | 2/2 | Complete    | 2026-02-22 |
| 2. Dashboard Shell + KPI Cards | 3/3 | Complete    | 2026-02-24 |
| 3. Chart Components | 1/4 | In Progress|  |
| 4. Data Table + Polish | 0/TBD | Not started | - |
| 5. Cleanup + Migration | 0/TBD | Not started | - |
