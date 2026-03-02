# Milestones

## v1.2 고객 유형 분析 (Shipped: 2026-03-02)

**Phases completed:** 2 phases (9-10), 4 plans, ~718 LOC added

**Key accomplishments:**
- TypeScript 인터페이스 3개 신규 정의 (CustomerTypeRow, RevenueBreakdownRow, CostBreakdownRow) + TeamDashboardData 6개 배열 필드 확장 — Phase 10/11/12 데이터 기반 완비
- 파서 함수 3개 (parseCustomerTypeFromRows, parseRevenueBreakdownFromRaw, parseCostBreakdownFromRaw) + getTeamDashboardData 4-fetch 병렬 확장 + vitest 14개 단위 테스트 전체 통과
- chart3/4/5 oklch 색상 추가, filterCustomerTypeWeekly 헬퍼, customerType 샘플 데이터(8+4행), filteredData 기간 필터 연동 완비
- CustomerTypeDonut(도넛 차트) + CustomerTypeTrend(스택 바 추이) + CustomerTypeSection 신규 생성 → ChartsSection 연결, Playwright 브라우저 4/4 검증 통과

---

## v1.0 MVP (Shipped: 2026-02-27)

**Phases completed:** 5 phases, 13 plans, 0 tasks

**Key accomplishments:**
- Google Sheets Daily/Weekly 시트 파싱 — 헤더 이름 기반 컬럼 매핑, 한국어 숫자 포맷 안전 변환, 2단계 mock 폴백
- Daily/Weekly 탭 전환 대시보드 — URL searchParams 탭 상태 저장, force-dynamic 서버 재페칭
- KPI 카드 5개 — 목표 대비 달성률, 기간 비교 델타, 80/60% 임계값 조건부 색상
- 차트 4종 (매출 ComposedChart, 손익 Cell 색상 BarChart, 가동률 LineChart+ReferenceLine, 이용 이중 YAxis)
- DataTable + UpdateTimestamp — 합계/평균 요약 행, hydration 안전 상대 시간 표시
- 레거시 스타터킷 컴포넌트 3개 삭제 — 팀 전용 컴포넌트로 완전 교체, 빌드 성공

---

## v1.1 분析 도구 강化 (Shipped: 2026-03-01)

**Phases completed:** 3 phases (6-8), 7 plans, ~967 LOC added

**Key accomplishments:**
- 기간 필터 유틸리티 (period-utils.ts) — PeriodKey 타입, ISO 주차 기반 날짜 계산, vitest 25개 단위 테스트
- 기간 선택 UI — 이번 주/지난 주/이번 달/지난 달 토글, URL searchParams 동기화, DashboardContent 통합
- Export 유틸리티 (export-utils.ts) — CSV(UTF-8 BOM) + Excel(SheetJS 0.20.3 CDN), vitest 21개 단위 테스트
- CSV/Excel 다운로드 버튼 UI — DashboardHeader 우측, 파일명에 탭·날짜 포함
- KPI 카드 스파크라인 5개 — Recharts AreaChart, CSS var(--chart-1) 다크모드 자동 대응
- Google Sheets 날짜 정규화 자동 수정 + Playwright 브라우저 3/3 검증 통과

---

