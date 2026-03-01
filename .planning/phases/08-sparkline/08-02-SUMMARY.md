---
phase: 08-sparkline
plan: 02
subsystem: ui
tags: [playwright, browser-verify, sparkline, recharts, areachart, kpi, date-normalization]

# Dependency graph
requires:
  - phase: 08-01
    provides: kpi-card.tsx AreaChart 스파크라인, kpi-cards.tsx sparklineData 추출
provides:
  - Playwright @playwright/test 설치 및 playwright.config.ts
  - verify-sparkline-08-02.spec.js: Daily/Weekly/다크모드 3개 브라우저 검증 테스트
  - Google Sheets 날짜 YYYY. M. D → ISO YYYY-MM-DD 정규화 (normalizeDateToISO)
  - KpiCards fullData prop: 스파크라인용 전체 이력 데이터 분리
affects: [future-browser-verify]

# Tech tracking
tech-stack:
  added:
    - "@playwright/test (1.58.2) — 브라우저 기반 Playwright 테스트 프레임워크"
  patterns:
    - "Playwright 검증 패턴: last-month URL로 이동 후 ResponsiveContainer 수 카운트"
    - "Google Sheets 날짜 정규화: parseDailySheet에서 normalizeDateToISO 적용"
    - "KpiCards fullData prop: 필터링된 데이터(current/previous)와 sparkline 이력 분리"

key-files:
  created:
    - playwright.config.ts
    - verify-sparkline-08-02.spec.js
  modified:
    - lib/data.ts
    - lib/mock-data.ts
    - components/dashboard/kpi-cards.tsx
    - components/dashboard/dashboard-content.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Google Sheets 날짜 형식 'YYYY. M. D' → ISO 변환을 parseDailySheet에서 처리: filterDailyByPeriod 문자열 비교 수정"
  - "KpiCards fullData prop 추가: sparkline에 필터링 전 전체 이력 사용, 기간 필터에 관계없이 최근 7일 트렌드 표시"
  - "Playwright 검증은 last-month 기간 사용: Google Sheets에 이번 달(3월) 데이터 없어서 지난 달로 테스트"
  - "mock-data.ts에 2026-03 데이터 추가: this-month 기본값에서 mock 폴백 환경에서도 KPI 카드 렌더링 가능"

patterns-established:
  - "브라우저 검증 패턴: Playwright @playwright/test로 3개 테스트 (Daily/Weekly/Dark mode) 구조"
  - "날짜 정규화 패턴: 서버사이드 데이터 파싱 시 ISO 형식 보장 (YYYY-MM-DD)"
  - "스파크라인 데이터 분리 패턴: filteredData(표시값) vs fullData(트렌드) 구분"

requirements-completed: [SPRK-01, SPRK-02]

# Metrics
duration: 26min
completed: 2026-03-01
---

# Phase 8 Plan 02: 브라우저 검증 Summary

**Playwright로 5개 KPI 카드 스파크라인 렌더링 확인, Google Sheets 날짜 형식 정규화 자동 수정, daily/weekly/다크모드 3가지 시나리오 검증 통과**

## Performance

- **Duration:** 26 min
- **Started:** 2026-03-01T06:55:39Z
- **Completed:** 2026-03-01T07:21:35Z
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments

- Playwright @playwright/test 설치 및 playwright.config.ts 추가
- verify-sparkline-08-02.spec.js 3개 테스트 (Daily/Weekly/다크모드) 작성 및 전부 PASS
- Google Sheets 날짜 형식 (`"2026. 2. 26"`) → ISO (`"2026-02-26"`) 변환 추가 (lib/data.ts)
- KpiCards에 `fullData` prop 추가 — sparkline이 필터링된 기간 데이터가 아닌 전체 이력에서 최근 7일 사용
- daily/weekly 탭 전환 및 다크모드 테마 전환 시 모두 9개 ResponsiveContainer 확인
- 스크린샷: `.playwright-mcp/verify-08-02-daily.png`, `.../weekly.png`, `.../dark.png`

## Task Commits

각 Task를 원자적으로 커밋:

1. **Task 1: Playwright 브라우저 검증 — 스파크라인 렌더링 확인 성공** - `6c92f64` (feat)

**Plan metadata:** (docs 커밋 예정)

## Files Created/Modified

- `playwright.config.ts` - Playwright 설정 (chromium, headless, baseURL)
- `verify-sparkline-08-02.spec.js` - 스파크라인 렌더링 검증 3개 테스트
- `lib/data.ts` - normalizeDateToISO 함수 추가, parseDailySheet에 적용
- `lib/mock-data.ts` - 2026-03-01~08 daily 데이터 8개 추가, fetchedAt 업데이트
- `components/dashboard/kpi-cards.tsx` - fullData prop 추가, sparklineSource/sparklineSorted 분리
- `components/dashboard/dashboard-content.tsx` - KpiCards에 fullData={data} 전달
- `package.json` - @playwright/test 개발 의존성 추가
- `package-lock.json` - lock 파일 업데이트

## Decisions Made

- **Google Sheets 날짜 정규화 위치**: parseDailySheet (lib/data.ts)에서 처리 — ChartsSection의 normalizeDate 패턴 참고, 모든 컨슈머가 ISO 형식을 받도록 보장
- **KpiCards fullData prop**: sparkline이 필터된 기간 데이터만 사용하면 기간 첫날에는 1개 데이터점만 있어 sparkline이 숨겨짐 → 전체 이력에서 최근 N개 슬라이스
- **Playwright 테스트 기간**: last-month (지난 달) 사용 — Google Sheets 이번 달(March 2026) 데이터 없어서 필터링 결과 0건 → sparkline 미표시. last-month는 28개 데이터 보장
- **mock-data.ts 업데이트**: this-month 기본값에서 mock 환경에서도 최소 1개 데이터 보장 (2026-03-01~08)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Google Sheets 날짜 형식 불일치로 filterDailyByPeriod 작동 불가**
- **Found during:** Task 1 (Playwright 검증 중 디버깅)
- **Issue:** Google Sheets는 `"2026. 2. 26"` 형식 날짜를 반환하는데, filterDailyByPeriod는 ISO `"2026-02-01"` 형식과 문자열 비교. `.`(ASCII 46) > `-`(ASCII 45) 이므로 모든 날짜가 upper bound를 초과하여 0건 반환
- **Fix:** lib/data.ts에 normalizeDateToISO 함수 추가, parseDailySheet에서 date 파싱 시 적용
- **Files modified:** lib/data.ts
- **Verification:** Playwright 재실행 시 날짜 ISO 형식 확인, 필터링 정상 작동
- **Committed in:** 6c92f64 (Task 1 commit)

**2. [Rule 1 - Bug] 기간 필터 후 sparklineData에 데이터 부족 (sparklineData.length < 2)**
- **Found during:** Task 1 (디버깅 중 발견)
- **Issue:** KpiCards가 filteredData만 받아 sparkline 계산 → 이번 달 1일에는 1개 데이터점 → `sparklineData.length >= 2` 조건 불충족 → sparkline 미표시
- **Fix:** KpiCards에 `fullData?: TeamDashboardData` prop 추가, sparkline은 fullData(전체 이력)에서 최근 7일(daily)/8주(weekly) 사용
- **Files modified:** components/dashboard/kpi-cards.tsx, components/dashboard/dashboard-content.tsx
- **Verification:** Playwright 검증 통과, 9개 ResponsiveContainer 확인
- **Committed in:** 6c92f64 (Task 1 commit)

**3. [Rule 1 - Bug] mock-data.ts에 이번 달(2026-03) 데이터 없어 기본 기간 렌더링 실패**
- **Found during:** Task 1 (초기 테스트 중 발견)
- **Issue:** 기본 period `this-month` = March 2026, 하지만 mock 데이터는 2026-02-22 종료
- **Fix:** lib/mock-data.ts에 2026-03-01~08 데이터 8개 추가, fetchedAt 업데이트
- **Files modified:** lib/mock-data.ts
- **Verification:** mock 환경에서 this-month로도 KPI 카드 렌더링 확인
- **Committed in:** 6c92f64 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (모두 Rule 1 - 버그)
**Impact on plan:** 모든 자동 수정이 정확성 보장에 필수적. 범위 초과 없음.

## Issues Encountered

- Turbopack 캐시가 코드 변경을 반영하지 않아 서버 재시작 및 캐시 삭제가 여러 번 필요
- `@playwright/test`가 프로젝트 node_modules에 없어 설치 필요 (npx playwright는 글로벌 캐시에 있었음)
- Playwright 브라우저 검증 시 Turbopack이 이전 컴파일 결과를 캐시하여 코드 변경이 반영되지 않는 문제 → `rm -rf .next/dev/cache/turbopack` 후 재시작으로 해결

## User Setup Required

None - 외부 서비스 설정 불필요.

## Next Phase Readiness

- Phase 8 (Sparkline) 완전히 완료 — SPRK-01, SPRK-02 충족
- v1.1 milestone 완료 (Phase 6 Period Filter + Phase 7 Export + Phase 8 Sparkline)
- 스파크라인이 실제 Google Sheets 데이터로 브라우저에서 검증됨

## Self-Check: PASSED

- FOUND: playwright.config.ts
- FOUND: verify-sparkline-08-02.spec.js
- FOUND: lib/data.ts (normalizeDateToISO 추가)
- FOUND: lib/mock-data.ts (2026-03 데이터 추가)
- FOUND: components/dashboard/kpi-cards.tsx (fullData prop)
- FOUND: components/dashboard/dashboard-content.tsx (fullData 전달)
- FOUND: commit 6c92f64 (Task 1)
- FOUND: .playwright-mcp/verify-08-02-daily.png
- FOUND: .playwright-mcp/verify-08-02-weekly.png
- FOUND: .playwright-mcp/verify-08-02-dark.png
- Playwright 3/3 테스트 PASS 확인

---
*Phase: 08-sparkline*
*Completed: 2026-03-01*
