# Phase 7: Export - Research

**Researched:** 2026-03-01
**Domain:** Client-side file download (CSV / Excel .xlsx) in Next.js App Router
**Confidence:** HIGH (architecture), MEDIUM (xlsx install method — CDN-based install is non-standard but well-documented)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
사용자 선호가 지정되지 않아 아래 모든 항목은 Claude가 코드베이스 패턴과 요구사항 기반으로 결정한다.

- **버튼 배치**: DashboardHeader에 통합 (탭 + 기간 컨트롤과 동일 영역) — 기존 컨트롤과 자연스러운 그룹핑
- **버튼 UI**: CSV / Excel 두 개의 별도 버튼, lucide-react Download 아이콘 활용
- **Excel 라이브러리**: `xlsx` (SheetJS) — 클라이언트사이드, 경량, 별도 API 라우트 불필요
- **내보내기 데이터 범위**: DataTable과 동일한 현재 필터링된 데이터 (tab, period 기반)
- **파일명 형식**: `{tab}-{YYYY-MM-DD}.csv` / `{tab}-{YYYY-MM-DD}.xlsx`
- **숫자 포맷**: CSV/Excel에서 원화 포맷이 아닌 순수 숫자값으로 내보내기 (데이터 처리 용이)

### Claude's Discretion
- 모든 구현 결정이 위에서 명시됨 — 추가 재량 영역 없음

### Deferred Ideas (OUT OF SCOPE)
- 차트 이미지(PNG) 내보내기 — v2 범위 (REQUIREMENTS.md 참조)
- 인쇄 최적화 CSS — v2 범위 (EXPO-04)
- 전체 미필터 데이터를 별도 시트로 포함 — 범위 초과, 단순하게 필터된 데이터만 내보내기
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXPO-01 | 사용자가 현재 보이는 데이터를 CSV 파일로 다운로드할 수 있다 | CSV: 라이브러리 없이 Blob + URL.createObjectURL 패턴으로 구현. SheetJS는 불필요. |
| EXPO-02 | 사용자가 현재 보이는 데이터를 Excel(.xlsx) 파일로 다운로드할 수 있다 | SheetJS CDN 버전(0.20.3)으로 구현. XLSX.utils.json_to_sheet + XLSX.writeFile 조합. |
| EXPO-03 | 내보내기 파일명에 현재 탭(Daily/Weekly)과 날짜가 포함된다 | 파일명: `{tab}-{YYYY-MM-DD}.csv/xlsx`. toISODate 패턴은 period-utils.ts에 이미 존재. |
</phase_requirements>

---

## Summary

Phase 7는 두 개의 독립적인 기술 문제로 나뉜다. CSV 내보내기는 순수 브라우저 API(Blob + URL.createObjectURL)만으로 구현 가능하며 외부 라이브러리가 불필요하다. Excel(.xlsx) 내보내기는 SheetJS 라이브러리가 필요하지만, **중요한 함정이 있다**: npm 공개 레지스트리의 `xlsx` 패키지는 v0.18.5에서 멈춰 있고 보안 취약점이 있으며, 최신 버전(0.20.3)은 SheetJS CDN(https://cdn.sheetjs.com/)에서만 배포된다. 따라서 설치 명령어가 일반적인 `npm install xlsx`가 아니라 `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` 형태이다.

아키텍처 측면에서 이 Phase는 단순하다. `DashboardContent`가 이미 `filteredData`를 소유하고 있으며, export 핸들러를 `DashboardHeader`에 props로 전달하는 패턴이 기존 `onPeriodChange` 패턴과 완전히 일치한다. 새로 만들 파일은 `lib/export-utils.ts` (순수 함수), `DashboardHeader`에 export 버튼 추가 (UI), 그리고 `DashboardContent`에 핸들러 연결로 최소화된다.

**Primary recommendation:** CSV는 Blob 패턴으로 직접 구현하고, Excel은 SheetJS CDN 버전을 사용한다. `lib/export-utils.ts`에 모든 내보내기 로직을 캡슐화하고, DashboardContent → DashboardHeader props 체인으로 연결한다.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SheetJS (xlsx) | 0.20.3 (CDN) | .xlsx 파일 생성 및 브라우저 다운로드 | 업계 표준, 클라이언트사이드 지원, 4.2M/주 다운로드 |
| Browser Blob API | 내장 | CSV 데이터 바이너리화 | 라이브러리 불필요, 모든 모던 브라우저 지원 |
| URL.createObjectURL | 내장 | Blob에서 다운로드 URL 생성 | 표준 Web API, 추가 의존성 없음 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react Download | 이미 설치됨 | 다운로드 버튼 아이콘 | 버튼 UI에 사용 |
| shadcn/ui Button | 이미 설치됨 | 버튼 컴포넌트 | period-filter.tsx와 동일 패턴 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SheetJS CDN | ExcelJS | ExcelJS가 스타일링 지원 더 좋지만 번들 크기 크고 브라우저 지원 복잡; 이 프로젝트에는 과잉 |
| SheetJS CDN | 순수 XML 생성 | 단순 데이터는 가능하지만 문자 인코딩, 날짜 포맷 등 엣지 케이스 많음 |
| Blob/URL pattern | FileSaver.js | FileSaver.js는 단지 이 패턴의 wrapper; 직접 구현이 의존성 없이 동일 |

**Installation:**
```bash
# 주의: npm install xlsx 는 0.18.5 (취약점 있는 구버전) — 사용 금지
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

---

## Architecture Patterns

### Recommended Project Structure
```
lib/
└── export-utils.ts        # CSV/Excel 내보내기 순수 함수 (라이브러리 없음 or xlsx import)

components/dashboard/
├── dashboard-content.tsx  # filteredData 소유, export 핸들러 정의, DashboardHeader에 전달
└── dashboard-header.tsx   # export 버튼 UI 추가 (기존 컨트롤 우측)
```

### Pattern 1: lib/export-utils.ts — 순수 함수 캡슐화

**What:** export 로직을 `lib/` 유틸리티로 분리. 컴포넌트에서 직접 XLSX API 호출 금지.

**When to use:** 이 프로젝트의 기존 패턴 (`lib/period-utils.ts`, `lib/kpi-utils.ts`)과 일치.

**Example:**
```typescript
// Source: SheetJS Official Docs https://docs.sheetjs.com/docs/getting-started/examples/export/
import { utils, writeFile } from 'xlsx';
import type { DailyRecord, WeeklyRecord } from '@/types/dashboard';

/** YYYY-MM-DD 형식 날짜 문자열 생성 (로컬 시간 기준) */
function toDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** DailyRecord[] → 내보내기용 plain object 배열 변환 (raw 숫자값) */
function dailyToRows(records: DailyRecord[]) {
  return records.map(r => ({
    날짜: r.date,
    매출: r.revenue,
    손익: r.profit,
    이용시간: r.usageHours,
    이용건수: r.usageCount,
    가동률: r.utilizationRate,
  }));
}

/** WeeklyRecord[] → 내보내기용 plain object 배열 변환 (raw 숫자값) */
function weeklyToRows(records: WeeklyRecord[]) {
  return records.map(r => ({
    주차: r.week,
    매출: r.revenue,
    손익: r.profit,
    이용시간: r.usageHours,
    이용건수: r.usageCount,
    가동률: r.utilizationRate,
    목표: r.weeklyTarget,
  }));
}

/** CSV 내보내기 — Blob + URL.createObjectURL 패턴 (라이브러리 불필요) */
export function exportToCsv(
  records: DailyRecord[] | WeeklyRecord[],
  tab: 'daily' | 'weekly',
): void {
  const rows = tab === 'daily'
    ? dailyToRows(records as DailyRecord[])
    : weeklyToRows(records as WeeklyRecord[]);

  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = (row as Record<string, unknown>)[h];
        // 문자열에 콤마/따옴표 포함 시 이스케이프
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ),
  ];

  const csvContent = '\uFEFF' + csvLines.join('\n'); // BOM for Excel UTF-8 인식
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${tab}-${toDateString()}.csv`;
  link.click();
  URL.revokeObjectURL(url); // 메모리 누수 방지
}

/** Excel(.xlsx) 내보내기 — SheetJS writeFile */
export function exportToXlsx(
  records: DailyRecord[] | WeeklyRecord[],
  tab: 'daily' | 'weekly',
): void {
  const rows = tab === 'daily'
    ? dailyToRows(records as DailyRecord[])
    : weeklyToRows(records as WeeklyRecord[]);

  if (rows.length === 0) return;

  const worksheet = utils.json_to_sheet(rows);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, tab === 'daily' ? '일별' : '주차별');
  writeFile(workbook, `${tab}-${toDateString()}.xlsx`);
  // writeFile은 브라우저에서 자동으로 다운로드 트리거
}
```

### Pattern 2: DashboardContent → DashboardHeader 핸들러 전달

**What:** export 핸들러를 `DashboardContent`에서 정의하고 `DashboardHeader`에 props로 전달. 기존 `onPeriodChange` 패턴과 동일.

**When to use:** `filteredData`가 `DashboardContent`에 있으므로 해당 컴포넌트가 export 데이터의 소유자.

**Example:**
```typescript
// DashboardContent에 추가 (기존 패턴과 동일한 구조)
const handleExportCsv = useCallback(() => {
  const records = tab === 'daily' ? filteredData.daily : filteredData.weekly;
  exportToCsv(records, tab);
}, [filteredData, tab]);

const handleExportXlsx = useCallback(() => {
  const records = tab === 'daily' ? filteredData.daily : filteredData.weekly;
  exportToXlsx(records, tab);
}, [filteredData, tab]);

// DashboardHeader에 전달
<DashboardHeader
  tab={tab}
  period={period}
  onPeriodChange={handlePeriodChange}
  onExportCsv={handleExportCsv}
  onExportXlsx={handleExportXlsx}
/>
```

### Pattern 3: DashboardHeader export 버튼 UI

**What:** 기존 `PeriodFilter` 오른쪽에 export 버튼 그룹 추가. separator로 시각적 구분.

**Example:**
```tsx
// DashboardHeader — 오른쪽 컨트롤 영역에 추가
import { Download } from 'lucide-react';

// props 타입 추가
interface DashboardHeaderProps {
  tab: 'daily' | 'weekly';
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
}

// JSX — 기간 필터 우측에 export 버튼 그룹
<div className="flex items-center gap-2">
  <PeriodFilter periods={...} active={period} onChange={onPeriodChange} />
  <div className="h-4 w-px bg-border" /> {/* 구분선 */}
  <Button variant="outline" size="sm" onClick={onExportCsv}>
    <Download className="h-4 w-4 mr-1" />
    CSV
  </Button>
  <Button variant="outline" size="sm" onClick={onExportXlsx}>
    <Download className="h-4 w-4 mr-1" />
    Excel
  </Button>
</div>
```

### Anti-Patterns to Avoid

- **`npm install xlsx` 사용**: npm 레지스트리의 xlsx는 0.18.5 (보안 취약점 포함). CDN URL로 설치해야 함.
- **API Route 경유 export**: 클라이언트사이드 전용 데이터를 서버에 올렸다 받는 것은 불필요한 복잡도. 브라우저 API로 직접 처리.
- **컴포넌트 내 직접 xlsx import**: `lib/export-utils.ts`로 분리해야 테스트 가능성 및 재사용성 확보.
- **BOM 없는 CSV**: UTF-8 BOM(`\uFEFF`) 없으면 Excel에서 한국어(날짜, 주차 등) 깨짐.
- **URL.revokeObjectURL 누락**: 객체 URL을 해제하지 않으면 메모리 누수 발생.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| .xlsx 파일 생성 | 직접 XML/ZIP 조합 | SheetJS XLSX.utils.json_to_sheet | xlsx 파일은 내부적으로 ZIP+XML; 문자 인코딩, 날짜 직렬화, 스펙 준수 등 엣지 케이스 복잡 |
| CSV 이스케이프 | 직접 문자열 처리 | 프로젝트 내 직접 구현 가능하나 콤마/따옴표/줄바꿈 이스케이프 규칙 주의 | RFC 4180 준수 필요: 필드 내 따옴표는 `""` 로 이스케이프 |
| 브라우저 다운로드 트리거 | FileSaver.js | Blob + URL.createObjectURL + `<a>` click | FileSaver.js는 이 패턴의 thin wrapper; 직접 구현이 의존성 절약 |

**Key insight:** xlsx 포맷 생성은 단순해 보이지만 OOXML 스펙 준수, 문자 인코딩, 날짜 시리얼 등 엣지 케이스가 많아 라이브러리 없이 손으로 구현 시 높은 위험.

---

## Common Pitfalls

### Pitfall 1: npm 레지스트리 xlsx 설치 (보안 취약점)

**What goes wrong:** `npm install xlsx` 실행 시 0.18.5 설치됨. 이 버전은 Denial of Service, Prototype Pollution 취약점 포함.

**Why it happens:** SheetJS는 npm 레지스트리 게시를 중단했지만 레지스트리에는 구버전이 남아있음.

**How to avoid:** 반드시 CDN URL로 설치:
```bash
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

**Warning signs:** `npm list xlsx`에서 0.18.5 표시, npm audit에서 high severity 경고.

---

### Pitfall 2: UTF-8 BOM 누락으로 한국어 깨짐

**What goes wrong:** Excel에서 CSV 열 때 날짜, 주차(한국어) 문자가 깨짐.

**Why it happens:** Excel은 UTF-8 CSV를 자동 감지하지 못하고, BOM(`\uFEFF`)이 있어야 UTF-8 인코딩을 인식.

**How to avoid:** CSV 문자열 앞에 BOM 추가:
```typescript
const csvContent = '\uFEFF' + csvLines.join('\n');
const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
```

**Warning signs:** CSV 파일을 Excel로 열 때 한국어가 물음표나 이상한 문자로 표시됨.

---

### Pitfall 3: SSR 환경에서 Blob/URL.createObjectURL 호출

**What goes wrong:** `document`, `URL.createObjectURL`, `Blob`은 브라우저 전용 API. Next.js SSR 환경에서 호출 시 `ReferenceError: document is not defined`.

**Why it happens:** `lib/export-utils.ts`는 서버에서도 import될 수 있음 (단, 실제 함수 실행은 클라이언트에서만).

**How to avoid:** export 함수 호출은 반드시 `'use client'` 컴포넌트의 이벤트 핸들러에서만. `lib/export-utils.ts` 자체에 `'use client'` 불필요 — 함수 내부에서 `document`/`URL` 접근이 런타임에 클라이언트에서만 실행되도록 보장.

**Warning signs:** 빌드 타임 에러 `ReferenceError: document is not defined`.

---

### Pitfall 4: WeeklyRecord의 타입 분기 처리

**What goes wrong:** `exportToCsv(records, tab)` 호출 시 `DailyRecord[] | WeeklyRecord[]` 유니온 타입으로 인한 TypeScript 에러.

**Why it happens:** DailyRecord와 WeeklyRecord의 공통 필드가 있지만 구조가 다름 (`date` vs `week`, `weeklyTarget` 유무).

**How to avoid:** 함수 내부에서 `tab` 파라미터로 분기 처리:
```typescript
const rows = tab === 'daily'
  ? dailyToRows(records as DailyRecord[])
  : weeklyToRows(records as WeeklyRecord[]);
```

---

### Pitfall 5: 빈 데이터 내보내기

**What goes wrong:** 필터 결과가 비어있을 때 빈 파일 또는 헤더만 있는 파일이 다운로드됨.

**Why it happens:** records.length === 0 체크 없이 바로 export 실행.

**How to avoid:** export 함수 시작 시 조기 반환:
```typescript
if (rows.length === 0) return; // 빈 데이터 내보내기 방지
```

---

## Code Examples

### CSV 다운로드 — 완전한 패턴
```typescript
// Source: MDN Web API + 커뮤니티 표준 패턴
// https://developer.mozilla.org/en-US/docs/Web/API/Blob
// https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static

function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url); // 즉시 해제 가능
}
```

### SheetJS Excel 내보내기 — 완전한 패턴
```typescript
// Source: https://docs.sheetjs.com/docs/getting-started/examples/export/
import { utils, writeFile } from 'xlsx';

function downloadXlsx(rows: Record<string, unknown>[], sheetName: string, filename: string): void {
  const worksheet = utils.json_to_sheet(rows);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, sheetName);
  writeFile(workbook, filename);
  // 브라우저에서 자동으로 다운로드 트리거됨
}
```

### 파일명 생성 패턴
```typescript
// period-utils.ts의 toISODate와 동일한 로컬 시간 기준 패턴
function toDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 예: "daily-2026-03-01.csv", "weekly-2026-03-01.xlsx"
const filename = `${tab}-${toDateString()}.${format}`;
```

### CSV 특수문자 이스케이프 (RFC 4180)
```typescript
function escapeCsvField(value: unknown): string {
  const str = String(value ?? '');
  // 콤마, 따옴표, 줄바꿈 포함 시 따옴표로 감싸고, 내부 따옴표는 "" 로 이스케이프
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm install xlsx` | `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | ~2022년 SheetJS가 npm 게시 중단 | 설치 명령어 변경 필수 |
| FileSaver.js | 직접 Blob + URL.createObjectURL | 모던 브라우저 지원 이후 | 추가 라이브러리 불필요 |
| Server-side Excel 생성 | 클라이언트사이드 SheetJS writeFile | SheetJS 브라우저 지원 성숙 | API Route 불필요 |

**Deprecated/outdated:**
- `xlsx@0.18.5` (npm): 보안 취약점 포함, SheetJS CDN 버전으로 대체
- FileSaver.js: 순수 Blob API로 동일 기능 구현 가능 — 추가 의존성 불필요

---

## Open Questions

1. **xlsx CDN 버전의 TypeScript 타입 지원**
   - What we know: SheetJS 0.20.3은 공식적으로 TypeScript 지원 (@types/xlsx는 별도)
   - What's unclear: CDN tarball 설치 시 타입 정의가 포함되어 있는지, 별도 `@types/xlsx` 필요 여부
   - Recommendation: 설치 후 `import { utils, writeFile } from 'xlsx'`가 타입 에러 없이 작동하는지 확인. 문제 시 `@types/xlsx` 추가.

2. **SheetJS CDN 가용성 및 빌드 안정성**
   - What we know: SheetJS 공식 문서는 CDN 설치를 권장하며, 안정성을 위해 tarball을 로컬 벤더링 추천
   - What's unclear: CI/CD 환경에서 외부 CDN URL 의존성이 문제될 수 있음
   - Recommendation: `package.json`에 CDN URL이 명시되면 `npm install` 시 자동 다운로드. 프로덕션 CI 환경에서 CDN 접근 가능 여부 확인. 문제 시 tarball을 repo에 커밋 (`vendor/` 디렉터리).

---

## Sources

### Primary (HIGH confidence)
- https://docs.sheetjs.com/docs/getting-started/installation/nodejs/ — 설치 방법 공식 문서, CDN URL 확인
- https://docs.sheetjs.com/docs/getting-started/installation/frameworks/ — ESM/TypeScript import 패턴
- https://docs.sheetjs.com/docs/api/write-options/ — writeFile API, bookType 옵션
- https://docs.sheetjs.com/docs/getting-started/examples/export/ — 브라우저 내보내기 패턴
- https://developer.mozilla.org/en-US/docs/Web/API/Blob — CSV Blob 패턴

### Secondary (MEDIUM confidence)
- https://npmtrends.com/exceljs-vs-sheetjs-vs-xlsx — SheetJS vs ExcelJS 비교 (주간 다운로드 기준)
- https://geeksforgeeks.org/javascript/how-to-create-and-download-csv-file-in-javascript/ — CSV Blob 패턴 (MDN으로 교차 검증됨)

### Tertiary (LOW confidence)
- https://emdiya.medium.com/how-to-export-data-into-excel-in-next-js-14-820edf8eae6a — Next.js 14 SheetJS 예제 (Medium, 접근 불가로 내용 미확인)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SheetJS 공식 문서, MDN으로 교차 검증
- Architecture: HIGH — 기존 DashboardContent/DashboardHeader 패턴과 직접 매핑
- Pitfalls: HIGH — npm 취약점은 공식 SheetJS GitHub 이슈 및 npm audit으로 확인; BOM 이슈는 표준 문제
- SheetJS 설치 방법: MEDIUM — CDN URL 설치는 비표준이지만 공식 문서가 유일한 권장 방법

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (SheetJS 버전 업데이트 시 CDN URL 재확인 필요)
