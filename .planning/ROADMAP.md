# Roadmap: 경남울산사업팀 매출 대시보드

## Milestones

- ✅ **v1.0 MVP** — Phase 1-5 (shipped 2026-02-27)
- ✅ **v1.1 분析 도구 강化** — Phase 6-8 (shipped 2026-03-01)
- ✅ **v1.2 고객 유형 분석** — Phase 9-10 (shipped 2026-03-02)
- 📋 **v1.3 매출/비용 분석** — Phase 11-12 (planned)

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

<details>
<summary>✅ v1.1 분析 도구 强化 (Phase 6-8) — SHIPPED 2026-03-01</summary>

- [x] **Phase 6: Period Filter** (3/3 plans) — 기간 선택기 (이번 주/지난 주/이번 달/지난 달 토글 + URL 상태)
- [x] **Phase 7: Export** (2/2 plans) — 현재 데이터 CSV/Excel 다운로드 + 파일명 규칙
- [x] **Phase 8: Sparkline** (2/2 plans) — KPI 카드 미니 스파크라인 차트 (다크/라이트 테마 대응)

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 고객 유형 분析 (Phase 9-10) — SHIPPED 2026-03-02</summary>

- [x] **Phase 9: v1.2 Data Layer** (2/2 plans) — 고객 유형·매출 세분화·비용 분析용 TypeScript 타입 + Sheets 파싱 + 단위 테스트
- [x] **Phase 10: Customer Type Analysis** (2/2 plans) — 왕복/부름/편도 이용건수 도넛·추이 차트 + 기간 필터 연동

Full details: `.planning/milestones/v1.2-ROADMAP.md`

</details>

### 📋 v1.3 매출/비용 분析 (Phase 11-12) — Planned

- [ ] **Phase 11: Revenue Breakdown** - 매출 유형별 구성 차트 + 금액/비율 표시 + 기간 필터 연동
- [ ] **Phase 12: Cost Analysis** - 비용 카테고리 합계 + 드릴다운 세부항목 + 기간 필터 연동

## Phase Details

### Phase 11: Revenue Breakdown
**Goal**: 사용자가 매출을 대여/PF/주행/부름/기타 유형별로 나눠 구성 비율과 금액을 한눈에 파악할 수 있다
**Depends on**: Phase 9
**Requirements**: REV-01, REV-02, REV-03
**Success Criteria** (what must be TRUE):
  1. 도넛 또는 스택 바 차트에서 대여/PF/주행/부름/기타 매출 유형을 색상으로 구분해 확인할 수 있다
  2. 각 매출 유형별로 합계 금액(₩XX만 포맷)과 전체 매출 대비 비율(%)이 숫자로 표시된다
  3. 기간 필터 토글을 바꾸면 차트와 수치가 해당 기간 합산값으로 즉시 갱신된다
**Plans**: TBD

### Phase 12: Cost Analysis
**Goal**: 사용자가 비용 카테고리별 합계를 확인하고 각 카테고리를 클릭해 세부 항목을 드릴다운으로 펼쳐볼 수 있다
**Depends on**: Phase 9
**Requirements**: COST-01, COST-02, COST-03
**Success Criteria** (what must be TRUE):
  1. 운반비/유류비/주차료/점검비/감가상각비/수수료 카테고리별 합계 금액이 목록 형태로 표시된다
  2. 각 카테고리 행을 클릭하면 해당 카테고리의 세부 항목(예: 운반비 → 충전/부름/존편도 운반비)이 아코디언으로 펼쳐지고 다시 클릭하면 닫힌다
  3. 펼친 상태에서 세부 항목별 금액이 개별적으로 표시된다
  4. 기간 필터 토글을 바꾸면 카테고리 합계와 세부 항목 금액 모두 해당 기간 합산값으로 즉시 갱신된다
**Plans**: TBD

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
| 9. v1.2 Data Layer | v1.2 | 2/2 | Complete | 2026-03-01 |
| 10. Customer Type Analysis | v1.2 | 2/2 | Complete | 2026-03-02 |
| 11. Revenue Breakdown | v1.3 | 0/? | Not started | - |
| 12. Cost Analysis | v1.3 | 0/? | Not started | - |
