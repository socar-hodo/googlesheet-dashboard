# Phase 7: Export - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

현재 선택된 기간의 필터링된 대시보드 데이터를 CSV 또는 Excel(.xlsx) 파일로 즉시 다운로드한다.
파일명에 현재 탭(daily/weekly)과 날짜(YYYY-MM-DD)가 포함된다.
차트 이미지 내보내기, 인쇄 최적화 CSS는 v2 범위이며 이 Phase에서 제외된다.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
사용자 선호가 지정되지 않아 아래 모든 항목은 Claude가 코드베이스 패턴과 요구사항 기반으로 결정한다.

- **버튼 배치**: DashboardHeader에 통합 (탭 + 기간 컨트롤과 동일 영역) — 기존 컨트롤과 자연스러운 그룹핑
- **버튼 UI**: CSV / Excel 두 개의 별도 버튼, lucide-react Download 아이콘 활용
- **Excel 라이브러리**: `xlsx` (SheetJS) — 클라이언트사이드, 경량, 별도 API 라우트 불필요
- **내보내기 데이터 범위**: DataTable과 동일한 현재 필터링된 데이터 (tab, period 기반)
- **파일명 형식**: `{tab}-{YYYY-MM-DD}.csv` / `{tab}-{YYYY-MM-DD}.xlsx`
- **숫자 포맷**: CSV/Excel에서 원화 포맷이 아닌 순수 숫자값으로 내보내기 (데이터 처리 용이)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardContent` (Client Component): `filteredData` 소유 — export 함수가 이 데이터에 접근해야 함
- `DashboardHeader`: 탭 전환 + 기간 선택 컨트롤 위치 — export 버튼 통합 지점
- `Button` (shadcn/ui, `components/ui/button.tsx`): 설치된 컴포넌트 — export 버튼에 직접 사용
- `DropdownMenu` (shadcn/ui): 설치됨 — CSV/Excel 단일 드롭다운으로 묶을 경우 활용 가능
- `lucide-react`: 이미 사용 중 — `Download` 아이콘 사용 가능
- `DailyRecord[]` / `WeeklyRecord[]` (types/dashboard.ts): 내보낼 데이터 타입 명확히 정의됨

### Established Patterns
- Client Component에서 사용자 인터랙션 처리 (`useState`, `useCallback`)
- 유틸리티 함수는 `lib/` 디렉터리에 위치 (예: `lib/period-utils.ts`) — export 유틸은 `lib/export-utils.ts`에 배치
- 금액 포맷: `₩${(amount / 10000).toLocaleString()}만` (UI 표시용) — 내보내기는 raw 숫자값 권장
- 파일명에 Korean 문자 대신 영문 탭명 사용 (daily, weekly)

### Integration Points
- `DashboardContent` → `DashboardHeader`에 export 핸들러 props로 전달
- `DashboardHeader`: 탭 + 기간 컨트롤 옆에 export 버튼 그룹 배치
- `filteredData.daily` 또는 `filteredData.weekly` (현재 탭에 따라) 를 내보내기 대상으로 사용
- `xlsx` 패키지 신규 설치 필요 (`npm install xlsx`)

</code_context>

<specifics>
## Specific Ideas

- 내보내기 버튼은 현재 탭에 맞는 데이터만 내보낸다 (daily 탭 → daily 데이터, weekly 탭 → weekly 데이터)
- 파일명에 `period` 파라미터 대신 다운로드 시점의 실제 날짜(`new Date()`)를 사용한다
- EXPO-03 요구사항: 파일명 형식 예시 → `daily-2026-03-01.csv`, `weekly-2026-03-01.xlsx`

</specifics>

<deferred>
## Deferred Ideas

- 차트 이미지(PNG) 내보내기 — v2 범위 (REQUIREMENTS.md 참조)
- 인쇄 최적화 CSS — v2 범위 (EXPO-04)
- 전체 미필터 데이터를 별도 시트로 포함 — 범위 초과, 단순하게 필터된 데이터만 내보내기

</deferred>

---

*Phase: 07-export*
*Context gathered: 2026-03-01*
