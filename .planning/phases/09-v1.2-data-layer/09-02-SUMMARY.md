---
phase: 09-v1.2-data-layer
plan: "02"
subsystem: database
tags: [typescript, parser, google-sheets, vitest, tdd]

# Dependency graph
requires:
  - phase: 09-v1.2-data-layer
    plan: "01"
    provides: "CustomerTypeRow, RevenueBreakdownRow, CostBreakdownRow 타입 + TeamDashboardData 6개 배열 필드"
provides:
  - "parseCustomerTypeFromRows — 일별/주차별 시트에서 고객 유형 건수 파싱 (export)"
  - "parseRevenueBreakdownFromRaw — [d] raw / [w] raw 시트에서 매출 세분화 파싱 (export)"
  - "parseCostBreakdownFromRaw — [d] raw / [w] raw 시트에서 비용 분석 파싱, 드릴다운 포함 (export)"
  - "getTeamDashboardData 4-fetch 병렬 구조 — 6개 신규 배열 실제 데이터로 채워짐"
  - "lib/data.test.ts — 14개 단위 테스트, 정상 파싱 + 0 폴백 + 빈 입력 검증"
affects:
  - 10-customer-type-analysis
  - 11-revenue-breakdown
  - 12-cost-analysis

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "safeNumber 0 폴백 패턴: 누락 컬럼 → undefined → safeNumber → 0, 명시적 경고 없이 안전 처리"
    - "2행 헤더 파싱 패턴: rows[0]=식별자, rows[1]=헤더, rows[2~]=데이터 — 모든 시트 파서 공통"
    - "날짜 필드명 주입 패턴: dateFieldName 파라미터로 일별('일자')/주차별('주차') 구분 — 단일 함수로 두 시트 지원"
    - "특수문자 시트명 처리: 시트명에 대괄호 포함([d] raw) → fetchSheetData 호출 시 단일 따옴표 감싸기"

key-files:
  created:
    - lib/data.test.ts
  modified:
    - lib/data.ts

key-decisions:
  - "parseCustomerTypeFromRows가 dateFieldName 파라미터로 일별/주차별 시트를 구분 — 별도 함수 없이 단일 함수로 두 시트 대응"
  - "고객 유형 파싱은 dailyRows/weeklyRows(기존 시트) 재활용, 추가 fetch 없음 — raw 시트는 매출/비용 전용"
  - "'${DAILY_RAW_SHEET}'!A1:DZ 형식: 대괄호 특수문자 시트명에 단일 따옴표 감싸기 필수"

patterns-established:
  - "파서 함수 export: Phase 10/11/12 UI 단계가 직접 import 가능하도록 export 처리"
  - "TDD Red-Green: 함수 미구현 상태에서 테스트 작성(14개 실패) → 구현 후 전체 통과"

requirements-completed: [CTYPE-01, CTYPE-02, REV-01, REV-02, COST-01, COST-02]

# Metrics
duration: 8min
completed: 2026-03-01
---

# Phase 9 Plan 02: 파서 구현 및 데이터 레이어 완성 Summary

**파서 함수 3개(parseCustomerTypeFromRows, parseRevenueBreakdownFromRaw, parseCostBreakdownFromRaw) + getTeamDashboardData 4-fetch 병렬 확장 + vitest 14개 단위 테스트 전체 통과**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-01T13:55:30Z
- **Completed:** 2026-03-01T14:03:00Z
- **Tasks:** 2 (TDD: RED 1 + GREEN 1)
- **Files modified:** 2

## Accomplishments

- `lib/data.ts`에 파서 함수 3개 구현 + export — Phase 10/11/12 UI 단계가 타입 안전하게 사용 가능
- `getTeamDashboardData` 2-fetch → 4-fetch 병렬 구조 확장, 6개 신규 배열 필드 실제 데이터로 채움
- `lib/data.test.ts` 신규 생성 — 14개 단위 테스트 전부 통과 (정상 파싱, 누락 컬럼 0 폴백, 빈 배열 입력)
- `[d] raw` / `[w] raw` 시트 특수문자 처리: 단일 따옴표 감싸기 패턴 확립
- TDD Red-Green 사이클 완료: 함수 미구현 14개 실패 → 구현 후 14개 통과

## Task Commits

각 Task별 원자적 커밋:

1. **Task 1: lib/data.ts — 파서 함수 3개 + getTeamDashboardData 4-fetch 확장** - `c7287fb` (feat)
2. **Task 2: lib/data.test.ts — 파서 단위 테스트** - `7184c13` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/data.ts` - import 확장, RAW 시트 상수 추가, 헤더 상수 3세트, 파서 함수 3개 export, getTeamDashboardData 4-fetch 구조로 교체
- `lib/data.test.ts` - 파서 3개에 대한 단위 테스트 14개 (정상 파싱 + 누락 컬럼 0 폴백 + 빈 입력 처리)

## Decisions Made

- `parseCustomerTypeFromRows`에 `dateFieldName` 파라미터 주입: 일별("일자")/주차별("주차") 구분을 파라미터로 처리하여 단일 함수로 두 시트 지원. 별도 함수 분리 불필요.
- 고객 유형은 기존 dailyRows/weeklyRows 재활용: 고객 유형 컬럼(왕복_건수 등)은 "일별"/"주차별" 시트에 있으므로 raw 시트 추가 fetch 없이 처리.
- `'${DAILY_RAW_SHEET}'!A1:DZ` 형식: 대괄호 포함 시트명([d] raw)을 Google Sheets API에 전달 시 단일 따옴표로 감싸야 파싱 오류 방지.

## Deviations from Plan

None - 계획대로 정확하게 실행됨. TDD Red(14 fail) → Green(14 pass) 사이클 정상 완료.

## Issues Encountered

없음 — 모든 파서 함수가 첫 구현에 정상 동작. 누락 컬럼 0 폴백은 safeNumber 헬퍼가 자동 처리.

## User Setup Required

없음 — 외부 서비스 설정 불필요. Google Sheets [d] raw / [w] raw 시트가 없어도 mock 데이터로 폴백.

## Next Phase Readiness

- **Phase 10 (고객 유형 분석):** `parseCustomerTypeFromRows`, `CustomerTypeRow[]` 준비 완료 — UI 컴포넌트에서 `data.customerTypeDaily` / `data.customerTypeWeekly` 바로 사용 가능
- **Phase 11 (매출 세분화):** `parseRevenueBreakdownFromRaw`, `RevenueBreakdownRow[]` 준비 완료
- **Phase 12 (비용 분석):** `parseCostBreakdownFromRaw`, `CostBreakdownRow[]` 준비 완료, 드릴다운 세부 컬럼(충전/부름/존편도 운반비) 포함
- **주의:** Google Sheets에 왕복_건수/부름_건수/편도_건수 컬럼이 없을 경우 0 폴백 처리됨 — Phase 10에서 실제 시트 확인 필요

## Self-Check: PASSED

- `lib/data.ts` — FOUND
- `lib/data.test.ts` — FOUND
- `.planning/phases/09-v1.2-data-layer/09-02-SUMMARY.md` — FOUND
- Commit `c7287fb` (feat: 파서 함수 3개 + 4-fetch) — FOUND
- Commit `7184c13` (test: 14개 단위 테스트) — FOUND

---
*Phase: 09-v1.2-data-layer*
*Completed: 2026-03-01*
