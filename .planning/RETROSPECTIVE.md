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

## Cross-Milestone Trends

| Milestone | Phases | Plans | LOC | Timeline | TDD |
|-----------|--------|-------|-----|----------|-----|
| v1.0 MVP | 5 | 13 | ~3,120 | 2026-02-21 ~ 02-27 (7일) | 없음 |
| v1.1 分析 | 3 | 7 | +~967 | 2026-02-28 ~ 03-01 (2일) | period-utils, export-utils |

**Trend: TDD 도입** — v1.1에서 순수 함수 유틸리티에 TDD 적용. 단위 테스트 총 46개(vitest). 브라우저 검증은 Playwright로 자동화.

**Trend: 컴포넌트 구조** — v1.0에서 Server Component 위주 → v1.1에서 Client Component 비중 증가 (기간 필터·스파크라인). 'use client' 경계가 명확해짐.
