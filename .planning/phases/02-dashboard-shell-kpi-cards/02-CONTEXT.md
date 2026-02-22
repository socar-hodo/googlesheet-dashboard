# Phase 2: Dashboard Shell + KPI Cards - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Daily/Weekly 탭 전환 UI와 5개 KPI 카드(매출, 손익, 이용건수, 가동률, 이용시간)를 구현한다. 각 카드에 달성률(%), 프로그레스 바, 기간 비교 델타를 표시한다. 차트, 테이블, 상세 분석 UI는 별도 Phase.

</domain>

<decisions>
## Implementation Decisions

### KPI 카드 레이아웃
- 카드당 표시 정보: KPI명, 실적값, 목표값, 달성률(%) + 프로그레스 바 모두 포함
- 달성률은 숫자(예: "85%")와 프로그레스 바를 함께 표시
- 5개 카드 배치 방식과 순서: Claude의 재량 (화면 너비에 맞게 반응형 그리드)

### 탭 전환 UX
- 기본 탭: 페이지 진입 시 Daily 탭이 기본으로 선택됨
- URL searchParams에 탭 상태 반영 (공유/북마크 가능)
- 탭 UI 스타일, 탭 전환 시 표시할 데이터 기준: Claude의 재량

### 기간 비교 델타
- 위치: KPI 수치 바로 아래 서브텍스트로 표시
- 형식: 퍼센트 + 절대값 둘 다 표시 (예: "▲ 12% / ₩120만")
- 색상: 모든 KPI에서 오르면 녹색, 내리면 빨간색 (방향 무관하게 단순 증감 기준)
- 비교 기준(Daily: 전일 vs 당일, Weekly: 전주 vs 이번 주 등): Claude의 재량

### 에러 상태
- API 실패 시: 에러 카드 또는 모달로 사용자에게 안내
- 에러 안내 시 유도할 행동(재시도 버튼 등): Claude의 재량

### Claude의 재량
- 5개 KPI 카드 배치 순서 및 그리드 방식
- Daily/Weekly 탭 UI 컴포넌트 선택 (shadcn Tabs 등)
- Daily 탭 기본 표시 데이터 범위 (가장 최근 날짜 단일 vs 현재 주 집계 등)
- 기간 비교 기준 정의 (Daily: 전일 vs 최신일, Weekly: 전주 vs 이번 주)
- 로딩 스켈레턴 모양 (카드 형태 맞춤 또는 일반 블록)
- Google Sheets 미연결 시 mock 데이터 표시 여부 안내 방식

</decisions>

<specifics>
## Specific Ideas

- 달성률 색상 규칙(80%+ 녹색, 60-80% 주황, 60% 미만 빨간)은 ROADMAP 성공 기준에 명시됨 — 반드시 구현
- 델타 형식: "▲ 12% / ₩120만" 스타일로 퍼센트와 절대값 동시 표시

</specifics>

<deferred>
## Deferred Ideas

없음 — 논의가 Phase 2 범위 내에서 진행됨

</deferred>

---

*Phase: 02-dashboard-shell-kpi-cards*
*Context gathered: 2026-02-22*
