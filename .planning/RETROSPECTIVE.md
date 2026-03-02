# Retrospective: 경남울산사업팀 매출 대시보드

---

## Milestone: v1.1 — 분析 도구 强化

**Shipped:** 2026-03-01
**Phases:** 3 (Phase 6-8) | **Plans:** 7

### What Was Built

- **Period Filter** — 이번 주/지난 주/이번 달/지난 달 토글, URL searchParams 동기화, vitest 25개 단위 테스트 완비
- **DashboardContent Client Component** — period 상태 단일 소유자, filteredData useMemo, 전체 대시보드 통합
- **Export (CSV/Excel)** — SheetJS 0.20.3 CDN tarball, UTF-8 BOM CSV, vitest 21개 단위 테스트
- **KPI 스파크라인 × 5** — Recharts AreaChart, CSS var(--chart-1) 다크모드 자동 대응
- **Google Sheets 날짜 정규화** — `"2026. 2. 26"` → ISO `"2026-02-26"` (Playwright 검증 중 발견·수정)

### What Worked

- **TDD 패턴**: period-utils.ts와 export-utils.ts 모두 Red-Green 사이클로 구현 — 순수 함수 유틸리티는 단위 테스트가 빠르고 신뢰성 높음
- **단일 소유자 패턴**: DashboardContent가 period 상태 소유 — 컴포넌트 간 상태 충돌 없음
- **CSS 변수 직접 사용 (sparkline)**: useTheme 없이 var(--chart-1)만으로 다크/라이트 자동 전환 — 코드 간결
- **Playwright 검증**: 자동 브라우저 검증으로 수동 체크 불필요, 숨겨진 데이터 버그(날짜 형식) 조기 발견
- **fullData prop 분리**: sparkline이 filteredData 대신 전체 이력 사용 — 기간 필터와 스파크라인이 서로 간섭 없음

### What Was Inefficient

- **Turbopack 캐시 미반영**: 코드 변경 후 Turbopack이 이전 컴파일 결과를 캐시해 재실행 필요 — `.next/dev/cache/turbopack` 삭제 패턴을 조기에 알았더라면 불필요한 디버깅 시간 절감 가능
- **Google Sheets 날짜 형식 불일치**: 브라우저 검증(Phase 8-02) 중에야 발견 — Sheets 날짜 형식은 Phase 1 파싱 시 정규화했어야 함
- **xlsl 보안 취약점 확인**: npm 레지스트리 패키지 설치 전 보안 취약점 확인이 필요함을 인식 — xlsx 0.18.5 설치 시도 후 CDN tarball로 전환하는 추가 단계 발생

### Patterns Established

- **lib/ 순수 함수 패턴**: period-utils.ts, export-utils.ts — 외부 의존성 없음, vitest 단위 테스트, named export
- **Client Component 전환 패턴**: 'use client' 추가만으로 순수 렌더링 컴포넌트 전환 — 내부 로직 변경 불필요
- **initialPeriod prop 패턴**: Server → initialPeriod prop → Client useState 초기값으로 SSR 복원
- **sparklineData 분리 패턴**: 표시값(filteredData) vs 트렌드(fullData) 배열을 별도 유지
- **Playwright channel: 'chrome'**: 시스템 설치 Chrome 활용 — Playwright Chromium 바이너리 미설치 환경 우회

### Key Lessons

1. **Sheets 데이터 정규화는 파싱 시점(서버사이드)에 처리하라** — 모든 컨슈머가 일관된 형식을 받도록 입력단에서 처리해야 함
2. **npm 패키지 설치 전 보안 취약점 확인** — `npm audit` 또는 공식 릴리즈 노트 확인 후 설치
3. **sparkline처럼 전체 이력이 필요한 컴포넌트는 필터된 데이터와 별도 prop을 받아야 함** — 상태 공유 범위 설계 시 고려
4. **Turbopack 캐시 이슈 발생 시**: `.next/dev/cache/turbopack` 삭제 + 서버 재시작으로 해결

### Cost Observations

- Sessions: ~4 sessions (Phase 6, 7, 8-01, 8-02)
- Notable: Phase 8-02 (26분)가 전체 v1.1 중 가장 길었음 — Google Sheets 날짜 버그 3개 자동 수정 포함

---

## Milestone: v1.2 — 고객 유형 분析

**Shipped:** 2026-03-02
**Phases:** 2 (Phase 9-10) | **Plans:** 4

### What Was Built

- **v1.2 Data Layer** — TypeScript 인터페이스 3개 (CustomerTypeRow, RevenueBreakdownRow, CostBreakdownRow) + TeamDashboardData 6개 배열 필드 확장 + 파서 함수 3개 + 4-fetch 병렬 확장 + vitest 14개 단위 테스트
- **Customer Type Analysis UI** — CustomerTypeDonut(PieChart 도넛, 중앙 총건수, Legend, Tooltip) + CustomerTypeTrend(stacked BarChart, 탭별 X축, 커스텀 Tooltip) + CustomerTypeSection(1/3+2/3 그리드) → ChartsSection 연결
- **chart3/4/5 oklch 색상 시스템** + filterCustomerTypeWeekly 헬퍼 + filteredData useMemo 확장

### What Worked

- **TDD 패턴 유지**: 파서 함수 3개 모두 Red(14 fail) → Green(14 pass) TDD 사이클로 구현 — 순수 함수 유틸리티에서 특히 효과적
- **Phase 9 데이터 레이어 선행 설계**: 타입 컨트랙트 먼저 확정 후 파서 구현 → Phase 10/11/12 UI 단계가 타입 안전하게 의존 가능
- **단일 따옴표 시트명 패턴**: `[d] raw` 특수문자 시트명 처리 패턴이 즉시 적용됨 — 파싱 오류 없이 첫 실행 성공
- **PieChart 중앙 텍스트 비율 좌표**: `x="50%" y="50%"` 패턴 — ResponsiveContainer 폭 변동에도 안정적 렌더링
- **Playwright 자동 검증**: 기간 필터 연동, 탭 전환, 테마 전환 모두 자동 검증

### What Was Inefficient

- **v1.2 범위 축소**: 처음에 Phase 9-12 전체를 v1.2로 계획했으나 Phase 11-12(REV/COST UI)가 미완료 → 범위 재조정 필요 — 로드맵 계획 시 UI 구현 공수를 더 보수적으로 추정해야 함
- **npm run build 파일 잠금 충돌**: Phase 10-01에서 다른 Node 프로세스와 충돌 → `npx tsc --noEmit`으로 대체. build 전에 프로세스 확인 필요
- **customerTypeDaily 인라인 필터**: CustomerTypeRow와 DailyRecord 타입 불일치로 filterDailyByPeriod 재사용 불가 — 타입 설계 시 공통 날짜 필드 인터페이스 고려할 것

### Patterns Established

- **파서 함수 dateFieldName 파라미터**: 일별("일자")/주차별("주차") 구분을 파라미터로 처리 — 단일 함수로 두 시트 지원
- **stackId 바에서 radius는 최상단 Bar만 적용**: 내부 세그먼트 radius 시 시각적 갭 방지
- **PieChart 중앙 텍스트 비율 좌표**: 픽셀 고정 금지, `x="50%" y="50%"` 비율 사용
- **데이터 레이어 단독 Phase**: UI 단계들이 병렬로 의존할 수 있도록 데이터 레이어를 별도 Phase로 선행

### Key Lessons

1. **마일스톤 범위는 실제 완성 가능한 것만** — REV/COST UI는 데이터 레이어 완성 후 별도 마일스톤으로 분리가 올바름
2. **CustomerTypeRow 타입을 DailyRecord 공통 인터페이스에서 파생시키면** filterDailyByPeriod 재사용 가능 — 다음 유사 타입 설계 시 고려
3. **TDD Red-Green 패턴은 파서 함수에 최적** — 입력/출력이 명확한 순수 함수는 선행 테스트로 스펙을 확정하면 구현이 빠름

### Cost Observations

- Sessions: ~3 sessions (Phase 9-01/02, Phase 10-01, Phase 10-02+fix)
- Notable: Phase 10-02(25분)이 가장 길었음 — 컴포넌트 3개 신규 생성 + Playwright 검증 포함

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | LOC | Timeline | TDD |
|-----------|--------|-------|-----|----------|-----|
| v1.0 MVP | 5 | 13 | ~3,120 | 2026-02-21 ~ 02-27 (7일) | 없음 |
| v1.1 分析 | 3 | 7 | +~967 | 2026-02-28 ~ 03-01 (2일) | period-utils, export-utils |
| v1.2 고객 유형 | 2 | 4 | +~718 | 2026-03-01 ~ 03-02 (2일) | data.test.ts (파서 14개) |

**Trend: TDD 정착** — v1.1 순수 함수 → v1.2 데이터 레이어로 확산. 단위 테스트 총 60개(vitest). 브라우저 검증은 Playwright로 자동화.

**Trend: 컴포넌트 구조** — v1.0 Server Component → v1.1 Client Component 비중 증가 → v1.2 Recharts 전용 컴포넌트 레이어 확립. 'use client' 경계가 chart 컴포넌트로 명확히 집중.

**Trend: 마일스톤 범위 조정** — v1.2에서 처음으로 계획 범위 축소 경험. Phase 9-12 → Phase 9-10. 데이터 레이어 선행 + UI 단계 분리 패턴이 자연스럽게 마일스톤 경계와 일치함을 확인.
