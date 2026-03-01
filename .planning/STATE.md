# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** 오늘 매출이 목표 대비 어디에 있는지, 지난 주/지난 달 대비 어떻게 변하고 있는지를 한 페이지에서 즉시 파악할 수 있어야 한다.
**Current focus:** v1.1 milestone — Phase 8: Sparkline

## Current Position

Phase: 8 — Sparkline
Plan: 1/2 complete
Status: in-progress
Last activity: 2026-03-01 — 08-01 KPI 카드 스파크라인 구현 완료 (AreaChart, sparklineData 추출)

Progress: [Phase 8/8] ██████████████████░░ 87%

## Accumulated Context

### Decisions

- xlsx CDN tarball 설치: npm 레지스트리 0.18.5 보안 취약점 회피 — cdn.sheetjs.com 0.20.3 사용 (07-01)
- toDateString named export: 단위 테스트 가능성 및 재사용을 위해 내부 헬퍼를 export 처리 (07-01)
- 브라우저 API 테스트 제외: exportToCsv/exportToXlsx는 브라우저 검증으로 대체 (07-01)
- export 핸들러 배치 순서: filteredData useMemo 이후 선언 — deps 참조 오류 방지 (07-02)
- 단방향 데이터 흐름: 핸들러 DashboardContent 소유, DashboardHeader props 수신 (07-02)
- Playwright 자동 검증: channel: 'chrome'으로 시스템 Chrome 활용 (07-02)
- DEFAULT_DAILY_PERIOD = 'this-month': 기존 동작과 유사하며 가장 자주 쓸 기간 (06-01)
- filterWeeklyByPeriod 파싱 불가 폴백: 데이터 포맷 불일치에도 빈 화면 방지 (06-01)
- toISODate 직접 구현: Date.toISOString() UTC 기준 날짜 오류 방지 (06-01)
- vitest 선택: ESM/TypeScript 네이티브, Next.js 독립 실행 (06-01)
- 탭 전환 시 period 리셋: 탭별 유효 period 범위가 달라 DEFAULT 값으로 리셋 (06-02)
- 'use client' 추가만으로 Client Component 전환: 순수 렌더링 컴포넌트는 내부 로직 변경 불필요 (06-02)
- DashboardContent가 period 상태 소유: 기간 필터가 KPI/차트/테이블 전체 영향 — 단일 소유자 (06-03)
- page.tsx에서 TabNav 제거: DashboardHeader가 DashboardContent 내부에서 탭+기간 통합 처리 (06-03)
- 단일 Suspense(KpiCardsSkeleton fallback)로 통합: 별도 DashboardSkeleton 불필요 (06-03)
- KpiCard 'use client' 전환: Recharts는 브라우저 DOM 필수 (08-01)
- weeklySorted를 sparklineData 전용으로 분리: 기존 current/previous는 data.weekly 기반 유지 (08-01)
- var(--chart-1) CSS 변수 직접 사용: useTheme import 없이 다크/라이트 테마 자동 전환 (08-01)
- isAnimationActive={false}: 5개 카드 동시 렌더링 시 애니메이션 충돌 방지 (08-01)

### v1.1 Phase Map

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 6 | Period Filter | FILT-01, FILT-02, FILT-03 | Complete (3/3 plans done) |
| 7 | Export | EXPO-01, EXPO-02, EXPO-03 | Complete (2/2 plans done) |
| 8 | Sparkline | SPRK-01, SPRK-02 | In progress (1/2 plans done) |

### Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 06 | 01 | 10min | 1 | 3 |
| 06 | 02 | 10min | 2 | 5 |
| 06 | 03 | 20min | 3 | 2 |
| 07 | 01 | 8min | 2 | 4 |
| 07 | 02 | 7min | 2 | 2 |
| 08 | 01 | 4min | 2 | 2 |

### Pending Todos

None

### Blockers/Concerns

None

## Session Continuity

Last session: 2026-03-01
Stopped at: Completed 08-01-PLAN.md — KPI 카드 스파크라인 구현 완료 (08-02 브라우저 검증 대기)
Resume file: None
