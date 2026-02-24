# Requirements: 경남울산사업팀 매출 대시보드

**Defined:** 2026-02-21
**Core Value:** 오늘 매출이 목표 대비 어디에 있는지, 지난 주/지난 달 대비 어떻게 변하고 있는지를 한 페이지에서 즉시 파악할 수 있어야 한다.

## v1 Requirements

### Data Layer

- [x] **DATA-01**: Google Sheets Daily 시트에서 일자별 매출, 손익, 이용시간, 이용건수, 가동률, 매월 목표를 파싱한다
- [x] **DATA-02**: Google Sheets Weekly 시트에서 주차별 매출, 손익, 이용시간, 이용건수, 가동률을 파싱한다
- [x] **DATA-03**: 한국어 숫자 포맷("1,234,567", "₩1,234,567")을 NaN 없이 안전하게 Number로 변환한다
- [x] **DATA-04**: Google Sheets 미연결 또는 API 실패 시 mock 데이터로 폴백하여 페이지가 정상 렌더링된다
- [x] **DATA-05**: 기존 범용 타입(KpiData, MonthlyRevenue, CategoryDistribution, RecentOrder)을 팀 전용 타입(DailyRecord, WeeklyRecord, TeamKpi, TeamDashboardData)으로 완전 교체한다

### KPI Cards

- [x] **KPI-01**: 매출, 손익, 이용건수, 가동률, 이용시간 총 5개 KPI 카드를 표시한다
- [x] **KPI-02**: 목표 데이터가 있는 KPI 카드에 목표 대비 달성률(%)을 숫자로 표시한다 (Weekly 시트는 매출 목표만 존재)
- [x] **KPI-03**: 목표 데이터가 있는 KPI 카드에 목표 달성 프로그레스 바(0~100% 게이지)를 표시한다 (Weekly 시트는 매출 목표만 존재)
- [x] **KPI-04**: 각 KPI 카드에 기간 비교 델타(이번 주 vs 지난 주 또는 이번 달 vs 지난 달 증감)를 표시한다
- [x] **KPI-05**: 달성률에 따라 KPI 카드 색상이 조건부로 적용된다 (80%+ 녹색, 60~80% 주황, 60% 미만 빨간)

### Tab Navigation

- [x] **TAB-01**: 단일 페이지에서 Daily/Weekly 탭 전환이 가능하다
- [x] **TAB-02**: 탭 상태가 URL searchParams(?tab=daily|weekly)에 저장되어 공유/북마크가 가능하다
- [x] **TAB-03**: 탭 전환 시 해당 시트의 최신 데이터를 서버에서 새로 가져온다

### Charts

- [x] **CHART-01**: 매출 추이 차트 — 기간별 실적 Bar와 목표 Line을 오버레이하여 표시한다
- [x] **CHART-02**: 손익 추이 차트 — 수익(양수)은 파란색, 손실(음수)은 빨간색으로 구분된 Bar 차트로 표시한다
- [x] **CHART-03**: 가동률 추이 차트 — 기간별 가동률(%) 라인 차트로 표시하며 임계값 기준선을 표시한다
- [x] **CHART-04**: 이용건수/이용시간 차트 — 두 지표의 기간별 추이를 차트로 표시한다
- [x] **CHART-05**: 모든 차트가 다크/라이트 테마에서 올바른 색상으로 렌더링된다

### Data Table

- [x] **TABLE-01**: Daily 탭에서 일자별 전체 데이터를 테이블로 표시한다 (날짜, 매출, 손익, 이용시간, 이용건수, 가동률)
- [x] **TABLE-02**: Weekly 탭에서 주차별 전체 데이터를 테이블로 표시한다
- [x] **TABLE-03**: 테이블 하단에 전체 합계 및 평균 요약 행을 표시한다

### UX

- [x] **UX-01**: 데이터 로딩 중 스켈레턴 플레이스홀더를 표시한다
- [x] **UX-02**: 페이지 접속 및 새로고침 시 Google Sheets에서 최신 데이터를 가져온다
- [ ] **UX-03**: 대시보드 상단에 마지막 데이터 업데이트 타임스탬프를 표시한다
- [ ] **UX-04**: 기존 스타터킷 범용 컴포넌트(revenue-chart, category-chart, recent-orders-table)를 삭제하고 팀 전용 컴포넌트로 교체한다

## v2 Requirements

### Filters & Export

- **FILT-01**: 기간 선택기 버튼 (이번 주/지난 주/이번 달/지난 달 토글)
- **FILT-02**: 사용자 지정 날짜 범위 필터

### Export

- **EXP-01**: 데이터 CSV/Excel 내보내기
- **EXP-02**: 대시보드 인쇄 최적화 CSS

### Enhanced Charts

- **ECHRT-01**: KPI 카드에 미니 스파크라인 차트
- **ECHRT-02**: 이중 축 복합 차트 (Bar + Line 심화 구성)

## Out of Scope

| Feature | Reason |
|---------|--------|
| 데이터 편집/입력 | 대시보드는 읽기 전용; 시트 직접 편집 |
| 자동 새로고침 (polling) | 페이지 접속 시 fetch로 충분; API 호출 최소화 |
| 멀티팀/지역 지원 | 경남울산사업팀 전용 -- 다른 팀은 별도 프로젝트 |
| 알림/Push 기능 | 조회 전용 v1 범위 초과 |
| 실시간 WebSocket | Google Sheets는 준실시간 수준이면 충분 |
| 사용자별 레이아웃 커스터마이징 | 고정 레이아웃이 팀 전체 일관성 보장 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| KPI-01 | Phase 2 | Complete |
| KPI-02 | Phase 2 | Complete |
| KPI-03 | Phase 2 | Complete |
| KPI-04 | Phase 2 | Complete |
| KPI-05 | Phase 2 | Complete |
| TAB-01 | Phase 2 | Complete |
| TAB-02 | Phase 2 | Complete |
| TAB-03 | Phase 2 | Complete |
| CHART-01 | Phase 3 | Complete |
| CHART-02 | Phase 3 | Complete |
| CHART-03 | Phase 3 | Complete |
| CHART-04 | Phase 3 | Complete |
| CHART-05 | Phase 3 | Complete |
| TABLE-01 | Phase 4 | Complete |
| TABLE-02 | Phase 4 | Complete |
| TABLE-03 | Phase 4 | Complete |
| UX-01 | Phase 2 | Complete |
| UX-02 | Phase 1 | Complete |
| UX-03 | Phase 4 | Pending |
| UX-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-24 after Phase 4 Plan 04-01 completion (TABLE-01~03 완료)*
