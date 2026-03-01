# Phase 9: v1.2 Data Layer - Research

**Researched:** 2026-03-01
**Domain:** TypeScript 타입 확장 + Google Sheets 다중 시트 파싱 레이어
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **고객 유형 컬럼 위치**: 기존 `일별` / `주차별` 시트의 기존 파서(parseDailySheet / parseWeeklySheet)에 필드 추가
- **매출 세분화 + 비용 분석 위치**: `[d] raw` / `[w] raw` 별도 시트 — 신규 파서 함수 작성
- **`[d] raw` / `[w] raw` 시트 구조**: 기존 일별/주차별과 동일한 2행 헤더 구조 (1행: 식별자, 2행: 헤더명, 3행~: 데이터)
- **`buildColumnIndex` 패턴 재사용**: 신규 파서에서 동일한 헤더 기반 컬럼 인덱싱 패턴 사용
- **`[d] raw`의 `일자` 컬럼**: `normalizeDateToISO` 재사용하여 `date` 필드로 파싱
- **고객 유형 헤더명**: `왕복_건수` / `부름_건수` / `편도_건수` (언더스코어 포함, 정확히 일치)
- **비용 드릴다운 범위**: 세부 운반비 컬럼(충전운반비, 부름운반비, 존편도운반비 등) Phase 9에서 모두 파싱
- **타입 컨테이너**: `TeamDashboardData`에 6개 배열 추가, `DailyRecord` / `WeeklyRecord`에 optional 필드 추가하지 않음
- **Mock 데이터 수준**: 0 값 플레이스홀더로 충분

### Claude's Discretion

- `[d] raw` / `[w] raw` 시트명 환경변수 재정의 패턴 (기존 `GOOGLE_DAILY_SHEET_NAME` 패턴 참고)
- `CustomerTypeRow`, `RevenueBreakdownRow`, `CostBreakdownRow` 내부 필드 정확한 TypeScript camelCase 이름
- `getTeamDashboardData`에서 새 시트 병렬 fetch 추가 방식
- 누락 컬럼 0 폴백 처리 로직 (기존 `safeNumber` 패턴 재사용)

### Deferred Ideas (OUT OF SCOPE)

- **시트 통합**: `[d] raw`/`[w] raw`와 기존 `일별`/`주차별`을 하나의 시트로 합치기 — 이 Phase에서 구현하지 않음

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTYPE-01 (data) | 왕복/부름/편도 이용건수 비율 — 데이터 파싱 부분 | `parseDailySheet` / `parseWeeklySheet`에 3개 필드 추가로 구현 |
| CTYPE-02 (data) | 왕복/부름/편도 일별/주차별 추이 — 데이터 파싱 부분 | `CustomerTypeRow[]` 배열로 daily/weekly 모두 제공 |
| REV-01 (data) | 대여/PF/주행/부름/기타 매출 구성 — 데이터 파싱 부분 | `[d] raw` / `[w] raw` 시트에서 `parseRevenueBreakdownFromRaw` 파서 구현 |
| REV-02 (data) | 매출 유형별 금액과 비율 — 데이터 파싱 부분 | `RevenueBreakdownRow`의 각 필드에서 UI가 합계·비율 계산 가능 |
| COST-01 (data) | 운반비/유류비/주차료/점검비/감가상각비/수수료 합계 — 데이터 파싱 부분 | `CostBreakdownRow`의 6개 카테고리 필드 파싱 |
| COST-02 (data) | 비용 카테고리 드릴다운 세부 항목 — 데이터 파싱 부분 | `CostBreakdownRow`에 세부 서브 컬럼까지 포함하여 Phase 12가 재파싱 없이 사용 |

</phase_requirements>

---

## Summary

Phase 9는 UI가 없는 순수 데이터 인프라 단계다. 기존의 `lib/data.ts` + `types/dashboard.ts` + `lib/mock-data.ts` 3-레이어 패턴을 확장하여 세 가지 신규 영역(고객 유형, 매출 세분화, 비용 분석)의 데이터를 후속 UI 단계(Phase 10, 11, 12)에 안전하게 전달한다.

기존 코드 패턴이 이미 완성도가 높다. `buildColumnIndex` + `safeNumber` + `parseKoreanNumber` + `normalizeDateToISO`의 4개 헬퍼, 2행 헤더 구조 파서 패턴, per-sheet fallback + `Promise.all` 병렬 fetch 패턴이 그대로 재사용 가능하다. 신규 파서 2개(`parseRevenueBreakdownFromRaw`, `parseCostBreakdownFromRaw`)와 기존 파서 2개에 필드 추가, 타입 파일과 mock 파일 확장으로 구성되는 작은 범위의 단계다.

가장 중요한 위험 요소는 Google Sheets의 실제 헤더명과 코드의 상수가 불일치하는 것이다. `왕복_건수` 등 헤더명은 CONTEXT.md에 명시되어 있고, 매출/비용 세분화 컬럼명은 REQUIREMENTS.md에 제시된 이름(`대여/PF/주행/부름/기타`, `운반비/유류비/주차료/점검비/감가상각비/수수료`) 기반으로 작성하되 시트에 실제 컬럼이 없어도 `safeNumber`의 0 폴백으로 안전하게 대응한다.

**Primary recommendation:** 기존 `parseDailySheet` 패턴을 복사-확장하여 2개의 raw 파서를 작성하고, `TeamDashboardData`에 6개 배열을 추가하며, `getTeamDashboardData`를 4-fetch 병렬로 확장한다.

---

## Standard Stack

### Core (이미 설치됨 — 추가 설치 없음)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5 | 타입 정의 (CustomerTypeRow 등) | 프로젝트 기본 |
| googleapis | ^171.4.0 | Google Sheets API v4 접근 | 기존 sheets.ts가 이미 사용 |
| vitest | ^4.0.18 | 단위 테스트 (파서 함수) | Phase 6에서 도입, 기존 테스트 파일 있음 |

### Supporting (이미 사용 중)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Next.js | 16.1.6 | App Router Server Component | 모든 서버 데이터 페칭 |
| next-auth | beta.30 | 인증 (이 Phase에서 직접 사용 안 함) | 기존 proxy.ts가 처리 |

**Installation:**
```bash
# 추가 패키지 없음 — 기존 스택으로 구현
```

---

## Architecture Patterns

### Recommended Project Structure (변경 없음, 기존 확장)

```
types/
└── dashboard.ts        # CustomerTypeRow, RevenueBreakdownRow, CostBreakdownRow 추가
                        # TeamDashboardData에 6개 배열 추가
lib/
├── data.ts             # DAILY_RAW_SHEET / WEEKLY_RAW_SHEET 상수 추가
│                       # parseDailySheet — 3개 고객유형 필드 추가
│                       # parseWeeklySheet — 3개 고객유형 필드 추가
│                       # parseRevenueBreakdownFromRaw — 신규
│                       # parseCostBreakdownFromRaw — 신규
│                       # getTeamDashboardData — 4-fetch 병렬 확장
├── mock-data.ts        # mockTeamDashboardData에 6개 배열 추가 (0 플레이스홀더)
└── sheets.ts           # 변경 없음 (fetchSheetData 재사용)
```

### Pattern 1: 2행 헤더 컬럼 기반 파서

**What:** Google Sheets의 1행(식별자)/2행(헤더명)/3행~(데이터) 구조를 파싱하는 패턴. `buildColumnIndex`로 헤더명→인덱스 Map을 만들고 `getCell` 클로저로 행 데이터를 안전하게 읽는다.

**When to use:** 새 raw 시트 파서(`parseRevenueBreakdownFromRaw`, `parseCostBreakdownFromRaw`) 작성 시. 기존 `parseDailySheet`를 1:1로 복사한 뒤 필드만 교체한다.

**Example:**
```typescript
// 기존 패턴 (lib/data.ts parseDailySheet에서 발췌) — 신규 파서도 동일 구조
function parseRevenueBreakdownFromRaw(rows: string[][]): RevenueBreakdownRow[] {
  if (rows.length < 3) return [];
  const colIndex = buildColumnIndex(rows[1]);  // rows[1] = 2행 헤더

  const getCell = (row: string[], headerName: string): string | undefined => {
    const idx = colIndex.get(headerName);
    return idx !== undefined ? row[idx] : undefined;
  };

  const dateIdx = colIndex.get(RAW_HEADERS.date) ?? -1;
  return rows
    .slice(2)
    .filter((row) => (row[dateIdx] ?? "").trim() !== "")
    .map((row): RevenueBreakdownRow => ({
      date: normalizeDateToISO((getCell(row, RAW_HEADERS.date) ?? "").trim()),
      rentalRevenue: safeNumber(getCell(row, RAW_REVENUE_HEADERS.rental)),
      pfRevenue: safeNumber(getCell(row, RAW_REVENUE_HEADERS.pf)),
      drivingRevenue: safeNumber(getCell(row, RAW_REVENUE_HEADERS.driving)),
      callRevenue: safeNumber(getCell(row, RAW_REVENUE_HEADERS.call)),
      otherRevenue: safeNumber(getCell(row, RAW_REVENUE_HEADERS.other)),
    }));
}
```

### Pattern 2: Per-Sheet Fallback + Promise.all 병렬 fetch

**What:** `Promise.all`로 여러 시트를 동시에 fetch하고, 각 시트가 null을 반환하면 해당 mock 배열로 대체한다.

**When to use:** `getTeamDashboardData`를 4-fetch로 확장할 때. 기존 2-fetch 코드를 그대로 연장한다.

**Example:**
```typescript
// 기존 2-fetch → 4-fetch 확장 패턴
const [dailyRows, weeklyRows, dailyRawRows, weeklyRawRows] = await Promise.all([
  fetchSheetData(`${DAILY_SHEET}!A1:DZ`),
  fetchSheetData(`${WEEKLY_SHEET}!A1:DZ`),
  fetchSheetData(`${DAILY_RAW_SHEET}!A1:DZ`),
  fetchSheetData(`${WEEKLY_RAW_SHEET}!A1:DZ`),
]);

// Per-sheet fallback
const revenueBreakdownDaily = dailyRawRows
  ? parseRevenueBreakdownFromRaw(dailyRawRows)
  : mockTeamDashboardData.revenueBreakdownDaily;
```

### Pattern 3: 환경변수 기반 시트명 상수

**What:** 시트명을 환경변수로 재정의 가능하도록 상수로 선언. 테스트 환경이나 시트 이름 변경 시 코드 수정 없이 대응.

**When to use:** `[d] raw` / `[w] raw` 시트명 상수 선언 시.

**Example:**
```typescript
// 기존 패턴과 동일한 방식으로 raw 시트 상수 추가
const DAILY_RAW_SHEET = process.env.GOOGLE_DAILY_RAW_SHEET_NAME ?? "[d] raw";
const WEEKLY_RAW_SHEET = process.env.GOOGLE_WEEKLY_RAW_SHEET_NAME ?? "[w] raw";
```

### Pattern 4: 헤더 상수 객체

**What:** 파서 함수 내에서 매직 스트링을 피하기 위해 헤더명을 `as const` 상수 객체로 선언.

**When to use:** 새 파서의 헤더명 관리. 기존 `DAILY_HEADERS`, `WEEKLY_HEADERS` 패턴과 동일.

**Example:**
```typescript
const CUSTOMER_TYPE_HEADERS = {
  roundTrip: "왕복_건수",
  call: "부름_건수",
  oneWay: "편도_건수",
} as const;

const RAW_REVENUE_HEADERS = {
  date: "일자",
  rental: "대여매출",   // 실제 시트 헤더명 확인 필요 (safeNumber 0 폴백으로 안전)
  pf: "PF매출",
  driving: "주행매출",
  call: "부름매출",
  other: "기타매출",
} as const;

const RAW_COST_HEADERS = {
  date: "일자",
  transport: "운반비",
  fuel: "유류비",
  parking: "주차료",
  inspection: "점검비",
  depreciation: "감가상각비",
  commission: "수수료",
  // 세부 드릴다운 컬럼
  chargeTransport: "충전운반비",
  callTransport: "부름운반비",
  zoneOneWayTransport: "존편도운반비",
} as const;
```

### Anti-Patterns to Avoid

- **`DailyRecord` / `WeeklyRecord`에 optional 필드 추가**: 기존 컨슈머(KPI 카드, 차트)에 TypeScript 오류 없어야 한다. 별도 Row 타입 사용.
- **시트 전체 실패를 catch 없이 방치**: `Promise.all` 내부에서 개별 시트 null 처리는 필수.
- **헤더명 매직 스트링 인라인 사용**: 상수 객체로 분리해야 수정 용이.
- **`parseKoreanNumber` 결과를 직접 사용**: 반드시 `safeNumber`로 래핑하여 null 가능성 제거.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 빈 값 안전 숫자 변환 | 커스텀 null-체크 로직 | `safeNumber` (이미 존재) | ₩, % 등 한국어 포맷 엣지케이스 이미 처리됨 |
| 헤더→인덱스 Map | 직접 array.findIndex 호출 | `buildColumnIndex` (이미 존재) | 빈 헤더 셀 건너뜀 처리 포함 |
| 날짜 문자열 정규화 | 커스텀 split/join | `normalizeDateToISO` (이미 존재) | "YYYY. M. D" 형식 처리 포함 |
| Google Sheets fetch | googleapis 직접 호출 | `fetchSheetData` (이미 존재) | 인증 클라이언트 생성 추상화 |
| 한국어 숫자 파싱 | parseInt/parseFloat 직접 | `parseKoreanNumber` (이미 존재) | ₩, %, 콤마 제거 + NaN 경고 포함 |

**Key insight:** 이 Phase는 신규 코드가 최소화된다. 기존 4개 헬퍼를 재사용하면 각 파서 함수는 헤더 상수 선언 + `.map()` 블록만 작성하면 된다.

---

## Common Pitfalls

### Pitfall 1: 헤더명 불일치 (가장 높은 위험)

**What goes wrong:** `RAW_REVENUE_HEADERS.rental = "대여매출"`로 선언했는데 실제 시트의 2행이 `"대여 매출"` (공백 포함) 또는 다른 한국어 표기라면 모든 값이 0으로 파싱된다.

**Why it happens:** Google Sheets 편집자가 컬럼명을 다르게 입력했을 때 코드에서 알 방법이 없다. `buildColumnIndex`의 `trimmed` 처리로 앞뒤 공백은 제거되지만 내부 공백이나 철자 차이는 감지 안 됨.

**How to avoid:** CONTEXT.md에 명시된 헤더명(왕복_건수 등)은 그대로 사용. 매출/비용 헤더명은 REQUIREMENTS.md 텍스트를 기반으로 추정하되, `console.warn`으로 헤더 누락 시 로그 출력. `safeNumber` 0 폴백으로 기존 기능은 보호됨.

**Warning signs:** 데이터가 연결 후에도 모두 0으로 표시됨. 서버 콘솔에 `[parseRevenueBreakdownFromRaw] 헤더를 찾을 수 없음: "..."` 경고.

### Pitfall 2: `[d] raw` 시트명의 특수문자

**What goes wrong:** Google Sheets API `range` 파라미터에서 `[d] raw!A1:DZ`가 에러를 유발할 수 있다. 대괄호 `[]`는 명명된 범위 참조로 해석될 수 있다.

**Why it happens:** Google Sheets API는 시트명에 특수문자가 있을 때 단일 따옴표로 감싸야 한다.

**How to avoid:** range 문자열을 `'[d] raw'!A1:DZ`처럼 시트명을 단일 따옴표로 감싸서 전달한다.

```typescript
// 잘못된 방식
fetchSheetData(`${DAILY_RAW_SHEET}!A1:DZ`)  // [d] raw!A1:DZ → API 에러 가능

// 올바른 방식
fetchSheetData(`'${DAILY_RAW_SHEET}'!A1:DZ`)  // '[d] raw'!A1:DZ → 안전
```

**Warning signs:** 실제 시트 연결 시 `Invalid named range` 또는 `Unable to parse range` API 에러.

**주의:** 기존 `일별`, `주차별`은 특수문자 없어서 따옴표 없이 동작. `[d] raw`, `[w] raw`는 대괄호 있어서 따옴표 필요.

### Pitfall 3: `TeamDashboardData` 타입 변경이 기존 컨슈머에 TypeScript 오류 유발

**What goes wrong:** `TeamDashboardData` 인터페이스에 6개 필수 필드를 추가하면 `mockTeamDashboardData`가 `TeamDashboardData`를 만족하지 못해 빌드 실패.

**Why it happens:** `mock-data.ts`에서 `mockTeamDashboardData: TeamDashboardData`로 명시적 타입 선언을 사용 중. 인터페이스에 새 필드 추가 즉시 오류 발생.

**How to avoid:** `types/dashboard.ts` 수정 후 `lib/mock-data.ts`의 `mockTeamDashboardData`에 6개 새 필드를 동시에 추가. TypeScript 빌드(`npm run build`)로 검증.

**Warning signs:** `Property 'customerTypeDaily' is missing in type` 빌드 오류.

### Pitfall 4: `getTeamDashboardData` catch 블록의 전체 폴백 패턴

**What goes wrong:** `Promise.all` 전체가 throw되면 catch에서 `mockTeamDashboardData`로 폴백하는데, 이 객체에 새 6개 필드가 없으면 타입 오류 또는 undefined 런타임 에러.

**Why it happens:** catch 블록의 spread `{ ...mockTeamDashboardData, fetchedAt: ... }`는 mock 객체 기반이므로 mock이 완전해야 한다.

**How to avoid:** mock 파일 수정을 types 수정과 동시에 진행. mock에 0 플레이스홀더 배열이 있으면 catch 폴백도 자동으로 완전해짐.

### Pitfall 5: 비용 드릴다운 서브 컬럼이 일부 시트에만 존재

**What goes wrong:** `[w] raw` (주차별 raw)에 세부 운반비 컬럼이 없고 `[d] raw` (일별 raw)에만 있을 수 있다.

**Why it happens:** CONTEXT.md는 "`[d] raw` 시트에 세부 운반비 컬럼이 이미 존재"라고 명시했지만 `[w] raw`는 "동일 컬럼 구조 가정"이다.

**How to avoid:** `safeNumber`의 0 폴백이 자동 처리. 헤더 누락 경고는 console.warn으로 로그. `CostBreakdownRow`의 드릴다운 필드를 optional(`?:`)로 선언하는 것도 고려 가능하지만, CONTEXT.md에서 0 플레이스홀더로 충분하다고 명시했으므로 required + 0 폴백 방식 유지.

---

## Code Examples

### CustomerTypeRow 타입 정의

```typescript
// types/dashboard.ts 추가분
/** 고객 유형별 이용 건수 — 일별/주차별 공용 */
export interface CustomerTypeRow {
  date?: string;    // 일별 시트용 (YYYY-MM-DD)
  week?: string;    // 주차별 시트용
  roundTripCount: number;  // 왕복_건수
  callCount: number;       // 부름_건수
  oneWayCount: number;     // 편도_건수
}

/** 매출 세분화 한 행 — [d] raw / [w] raw 시트 */
export interface RevenueBreakdownRow {
  date: string;           // 일자 (ISO)
  rentalRevenue: number;  // 대여매출
  pfRevenue: number;      // PF매출
  drivingRevenue: number; // 주행매출
  callRevenue: number;    // 부름매출
  otherRevenue: number;   // 기타매출
}

/** 비용 분석 한 행 — 카테고리 합계 + 세부 드릴다운 포함 */
export interface CostBreakdownRow {
  date: string;                // 일자 (ISO)
  // 카테고리 합계
  transportCost: number;       // 운반비
  fuelCost: number;            // 유류비
  parkingCost: number;         // 주차료
  inspectionCost: number;      // 점검비
  depreciationCost: number;    // 감가상각비
  commissionCost: number;      // 수수료
  // 드릴다운 세부 (Phase 12용)
  chargeTransportCost: number;   // 충전운반비
  callTransportCost: number;     // 부름운반비
  zoneOneWayTransportCost: number; // 존편도운반비
}

/** 대시보드 전체 데이터 컨테이너 (확장) */
export interface TeamDashboardData {
  daily: DailyRecord[];
  weekly: WeeklyRecord[];
  // Phase 9 신규 추가
  customerTypeDaily: CustomerTypeRow[];
  customerTypeWeekly: CustomerTypeRow[];
  revenueBreakdownDaily: RevenueBreakdownRow[];
  revenueBreakdownWeekly: RevenueBreakdownRow[];
  costBreakdownDaily: CostBreakdownRow[];
  costBreakdownWeekly: CostBreakdownRow[];
  fetchedAt: string;
}
```

### 고객 유형 필드 추가 (기존 parseDailySheet 확장)

```typescript
// lib/data.ts — DAILY_HEADERS에 추가
const DAILY_HEADERS = {
  date: "일자",
  revenue: "회계매출",
  profit: "손익",
  usageHours: "이용시간",
  usageCount: "이용건수",
  utilizationRate: "가동률",
  // Phase 9 추가
  roundTripCount: "왕복_건수",
  callCount: "부름_건수",
  oneWayCount: "편도_건수",
} as const;

// parseDailySheet의 .map() 블록 확장
.map((row): DailyRecord & { roundTripCount: number; callCount: number; oneWayCount: number } => ({
  // 기존 필드...
  // 사실 DailyRecord는 건드리지 않으므로 별도 CustomerTypeRow 배열로 추출
}))
```

**참고:** `DailyRecord`를 확장하지 않기로 결정했으므로, `parseDailySheet`에서 파싱한 raw rows를 별도 `parseCustomerTypeFromDaily` 함수에서 재처리하거나, `parseDailySheet`와 같은 rows를 받아 CustomerTypeRow를 반환하는 전용 함수를 작성하는 두 가지 구현 전략이 있다. 후자(전용 함수)가 더 깔끔하다.

```typescript
// 전용 함수 방식 — 권장
function parseCustomerTypeFromRows(
  rows: string[][],
  dateFieldName: string  // "일자" or "주차"
): CustomerTypeRow[] {
  if (rows.length < 3) return [];
  const colIndex = buildColumnIndex(rows[1]);
  const getCell = (row: string[], h: string) => {
    const idx = colIndex.get(h);
    return idx !== undefined ? row[idx] : undefined;
  };
  const dateIdx = colIndex.get(dateFieldName) ?? -1;
  const isDaily = dateFieldName === "일자";
  return rows
    .slice(2)
    .filter((row) => (row[dateIdx] ?? "").trim() !== "")
    .map((row): CustomerTypeRow => ({
      ...(isDaily
        ? { date: normalizeDateToISO((getCell(row, "일자") ?? "").trim()) }
        : { week: (getCell(row, "주차") ?? "").trim() }),
      roundTripCount: safeNumber(getCell(row, "왕복_건수")),
      callCount: safeNumber(getCell(row, "부름_건수")),
      oneWayCount: safeNumber(getCell(row, "편도_건수")),
    }));
}
```

### Google Sheets 특수문자 시트명 안전 처리

```typescript
// lib/data.ts
const DAILY_RAW_SHEET = process.env.GOOGLE_DAILY_RAW_SHEET_NAME ?? "[d] raw";
const WEEKLY_RAW_SHEET = process.env.GOOGLE_WEEKLY_RAW_SHEET_NAME ?? "[w] raw";

// 사용 시 따옴표 감싸기
fetchSheetData(`'${DAILY_RAW_SHEET}'!A1:DZ`)
```

### mock-data.ts 확장 (0 플레이스홀더)

```typescript
// lib/mock-data.ts 추가분
export const mockTeamDashboardData: TeamDashboardData = {
  daily: mockDailyRecords,
  weekly: mockWeeklyRecords,
  // Phase 9 신규 — 0 플레이스홀더 (UI 레이아웃 확인용)
  customerTypeDaily: [],
  customerTypeWeekly: [],
  revenueBreakdownDaily: [],
  revenueBreakdownWeekly: [],
  costBreakdownDaily: [],
  costBreakdownWeekly: [],
  fetchedAt: "2026-03-08T00:00:00.000Z",
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 단일 시트 파싱 | 다중 시트 병렬 fetch | Phase 9 | `Promise.all` 4-fetch로 확장 |
| `DailyRecord`에 모든 필드 | 별도 Row 타입으로 분리 | Phase 9 | 타입 복잡도 방지 |
| middleware.ts | proxy.ts | Phase 1 이전 | 이미 적용됨, 영향 없음 |

**Deprecated/outdated:**
- 단일 `daily[]` / `weekly[]`만 있는 `TeamDashboardData`: Phase 9 이후 6개 필드 추가됨

---

## Open Questions

1. **`[d] raw`의 매출/비용 컬럼 정확한 한국어 헤더명**
   - What we know: REQUIREMENTS.md에 "대여/PF/주행/부름/기타 매출", "운반비/유류비/주차료/점검비/감가상각비/수수료"라고 명시됨
   - What's unclear: 실제 시트 2행의 헤더명이 정확히 "대여매출", "PF매출", "주행매출" 등인지 아니면 "대여 매출", "P/F 매출" 등 변형인지
   - Recommendation: `safeNumber` 0 폴백으로 안전하게 시작, 실제 연결 후 콘솔 경고로 불일치 감지. 헤더 상수는 REQUIREMENTS.md 텍스트를 기반으로 작성.

2. **`[w] raw` 시트의 일자 컬럼 필드명**
   - What we know: CONTEXT.md에 "`[w] raw`에는 주차별 매출세분화/비용이 있음 (일별 raw와 동일 컬럼 구조 가정)"
   - What's unclear: `[w] raw`의 날짜 식별 컬럼이 `"일자"`인지 `"주차"`인지 (주차별 시트와 동일하면 "주차")
   - Recommendation: CONTEXT.md의 "동일 컬럼 구조 가정"에 따라 `"일자"` 컬럼을 시도하되, 없으면 `date: ""`로 폴백. 또는 `date` 필드를 optional로 선언.

3. **비용 드릴다운 서브 컬럼 정확한 한국어명**
   - What we know: CONTEXT.md에 "충전운반비, 부름운반비, 존편도운반비"가 예시로 제시됨
   - What's unclear: 다른 세부 항목이 더 있는지, 정확한 컬럼 헤더명
   - Recommendation: CONTEXT.md에 명시된 3개 서브 컬럼만 우선 구현. 0 폴백으로 누락 컬럼 처리.

---

## Validation Architecture

> `workflow.nyquist_validation`이 config.json에 정의되지 않음 (false로 판단). 이 섹션은 참고용 최소 기록만 남김.

### 기존 테스트 인프라

| 항목 | 값 |
|------|---|
| 프레임워크 | vitest ^4.0.18 |
| 설정 | package.json scripts.test: "vitest run" |
| 빠른 실행 | `npx vitest run lib/data.test.ts` (신규 파일) |
| 전체 실행 | `npm test` |

### Phase 9 단위 테스트 필요 항목

| 대상 | 테스트 유형 | 이유 |
|------|------------|------|
| `parseCustomerTypeFromRows` | unit | 순수 함수, 시트 의존 없음 |
| `parseRevenueBreakdownFromRaw` | unit | 순수 함수 |
| `parseCostBreakdownFromRaw` | unit | 순수 함수 |
| 누락 컬럼 → 0 폴백 | unit | 안전성 핵심 요구사항 |
| TypeScript 빌드 | build | `npm run build` — 타입 일관성 검증 |

### Wave 0 갭

- [ ] `lib/data.test.ts` — Phase 9 파서 함수 단위 테스트 (신규 파일)

---

## Sources

### Primary (HIGH confidence)

- 기존 `lib/data.ts` 소스코드 직접 분석 — `buildColumnIndex`, `safeNumber`, `parseKoreanNumber`, `normalizeDateToISO`, `parseDailySheet`, `parseWeeklySheet`, `getTeamDashboardData` 패턴
- 기존 `types/dashboard.ts` — `DailyRecord`, `WeeklyRecord`, `TeamDashboardData` 현재 구조
- 기존 `lib/mock-data.ts` — mock 데이터 패턴 및 구조
- `.planning/phases/09-v1.2-data-layer/09-CONTEXT.md` — 모든 구현 결정
- `.planning/REQUIREMENTS.md` — CTYPE, REV, COST 요구사항 및 컬럼명

### Secondary (MEDIUM confidence)

- Google Sheets API v4 공식 동작: 시트명 특수문자 처리에 단일 따옴표 필요 (기존 `fetchSheetData` 패턴 관찰 + API 명세 기반)
- `lib/period-utils.test.ts`, `lib/export-utils.test.ts` — vitest 기반 단위 테스트 패턴 확인

### Tertiary (LOW confidence)

- `[d] raw`, `[w] raw` 실제 시트 헤더명 — 코드 접근 불가, REQUIREMENTS.md 텍스트에서 추정

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 기존 코드 직접 확인, 추가 패키지 없음
- Architecture: HIGH — 기존 패턴의 직접 확장, 검증된 코드 기반
- Pitfalls: HIGH (코드 구조 기반) / MEDIUM (시트명 특수문자) / LOW (실제 헤더명)

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable — TypeScript + Next.js + googleapis 변경 없음)
