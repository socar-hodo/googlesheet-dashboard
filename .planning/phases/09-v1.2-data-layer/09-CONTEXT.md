# Phase 9: v1.2 Data Layer - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

고객 유형, 매출 세분화, 비용 분석 세 영역의 데이터를 Google Sheets에서 안전하게 읽고
`TeamDashboardData` 반환 타입을 통해 후속 UI 단계(Phase 10, 11, 12)에 전달한다.
사용자에게 직접 보이는 UI는 이 Phase에서 제공하지 않는다. 데이터 인프라 레이어만 담당.

</domain>

<decisions>
## Implementation Decisions

### 시트 데이터 위치

- **고객 유형 컬럼** (왕복_건수, 부름_건수, 편도_건수): 기존 `일별` / `주차별` 시트에 컬럼이 추가되어 있음
  → 별도 `parseCustomerTypeFromRows(rows, dateFieldName)` 함수 신규 작성 (기존 rows 재사용, parseDailySheet / parseWeeklySheet 미수정)
  → `DailyRecord` / `WeeklyRecord` 타입 변경 없이 `CustomerTypeRow[]` 별도 배열로 분리
- **매출 세분화 + 비용 분석 컬럼**: `[d] raw` / `[w] raw` 별도 시트에 있음
  → 별도 파서 함수 (`parseRevenueBreakdownFromRaw`, `parseCostBreakdownFromRaw`) 신규 작성
- `[d] raw` / `[w] raw`도 기존 일별/주차별 시트와 동일한 **2행 헤더 구조** (1행: 컬럼 식별자, 2행: 헤더명, 3행~: 데이터)
  → 기존 `buildColumnIndex` 패턴 재사용 가능
- `[d] raw` 시트에도 `일자` 컬럼 있음 (일별시트와 동일 컬럼명)
  → `RevenueBreakdownRow` / `CostBreakdownRow`에 `date` 필드 포함

### 컬럼명 (헤더 기반 매핑)

- 고객 유형: `왕복_건수` / `부름_건수` / `편도_건수` (언더스코어 포함)
- 매출 세분화 / 비용 분석 정확한 헤더명: researcher가 실제 시트 또는 REQUIREMENTS.md를 참조하여 확인
  (성공기준에 명시된 이름: 대여/PF/주행/부름/기타 매출, 운반비/유류비/주차료/점검비/감가상각비/수수료)

### 비용 드릴다운 범위

- `[d] raw` 시트에 세부 운반비 컬럼(충전운반비, 부름운반비, 존편도운반비 등)이 **이미 존재**
- Phase 9에서 세부 서브 컬럼까지 **모두 파싱**하여 `CostBreakdownRow`에 포함
- Phase 12가 별도 파싱 없이 `CostBreakdownRow`의 서브 필드를 그대로 사용하도록 설계

### 타입 컨테이너 구조

- 새 3개 영역을 `TeamDashboardData`에 **6개 별도 배열**로 추가:
  ```typescript
  customerTypeDaily: CustomerTypeRow[];
  customerTypeWeekly: CustomerTypeRow[];
  revenueBreakdownDaily: RevenueBreakdownRow[];
  revenueBreakdownWeekly: RevenueBreakdownRow[];
  costBreakdownDaily: CostBreakdownRow[];
  costBreakdownWeekly: CostBreakdownRow[];
  ```
- `DailyRecord` / `WeeklyRecord`에 optional 필드 추가하지 않음 (타입 복잡도 방지)

### Mock 데이터 수준

- 0 값 플레이스홀더로 충분 (`0`으로 채운 배열 항목)
- UI 레이아웃 확인용이며, 실제 Google Sheets 연결 후 교체

### Claude's Discretion

- `[d] raw` / `[w] raw` 시트명 환경변수 재정의 패턴 (기존 `GOOGLE_DAILY_SHEET_NAME` 패턴 참고)
- `CustomerTypeRow`, `RevenueBreakdownRow`, `CostBreakdownRow` 내부 필드 정확한 TypeScript 이름 (camelCase 변환)
- `getTeamDashboardData`에서 새 시트 병렬 fetch 추가 방식
- 누락 컬럼 0 폴백 처리 로직 (기존 `safeNumber` 패턴 재사용)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `buildColumnIndex(headers: string[]): Map<string, number>` (`lib/data.ts`): 헤더명 → 인덱스 Map 빌더. 새 파서에서 그대로 재사용.
- `safeNumber(value, fallback)` (`lib/data.ts`): 빈 값 / null 안전 숫자 변환. 모든 새 필드에 적용.
- `parseKoreanNumber(value)` (`lib/data.ts`): ₩, %, 콤마 제거 후 숫자 변환. 매출/비용 컬럼에 필요.
- `fetchSheetData(range: string)` (`lib/sheets.ts`): 단일 함수로 모든 시트 범위 조회. 신규 raw 시트도 동일 함수.
- `normalizeDateToISO(date: string)` (`lib/data.ts`): `[d] raw`의 일자 컬럼 정규화에 재사용.

### Established Patterns

- **2행 헤더 + 컬럼 기반 파싱**: `rows[0]` 식별자, `rows[1]` 헤더, `rows.slice(2)` 데이터. 새 파서도 동일.
- **Per-sheet fallback**: 개별 시트 null 반환 시 해당 mock 배열로 대체 → 기존 패턴 확장.
- **DAILY_SHEET / WEEKLY_SHEET 환경변수 패턴**: 시트명을 process.env로 재정의 가능하게 상수 선언.
- **`Promise.all` 병렬 fetch** (`getTeamDashboardData`): 새 raw 시트 2개 추가하여 4-fetch 병렬로 확장.

### Integration Points

- `types/dashboard.ts`: `CustomerTypeRow`, `RevenueBreakdownRow`, `CostBreakdownRow`, `TeamDashboardData` 수정
- `lib/data.ts`: 새 파서 함수 추가, `getTeamDashboardData` 확장, `DAILY_RAW_SHEET` / `WEEKLY_RAW_SHEET` 상수 추가
- `lib/mock-data.ts`: `mockTeamDashboardData`에 6개 새 필드 추가 (0 값 플레이스홀더)
- `app/(dashboard)/dashboard/page.tsx`: `getDashboardData` 반환 타입 변경에 따른 타입 오류 없어야 함 (UI 변경 없음)

</code_context>

<specifics>
## Specific Ideas

- "시트 합치기는 나중에" — Phase 9는 현재 이중 시트 구조([d] raw 별도)로 구현. 향후 통합 시 파서만 수정하면 UI는 그대로 유지됨.
- `[w] raw`에는 주차별 매출세분화/비용이 있음 (일별 raw와 동일 컬럼 구조 가정)

</specifics>

<deferred>
## Deferred Ideas

- **시트 통합**: `[d] raw`/`[w] raw`와 기존 `일별`/`주차별`을 하나의 시트로 합치기 — Google Sheets 구조 변경 + 파서 수정이 필요하여 별도 작업으로 분리

</deferred>

---

*Phase: 09-v1.2-data-layer*
*Context gathered: 2026-03-01*
