# 신차 배분 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Python/FastAPI 신차 배분 시스템을 Next.js 대시보드에 통합하여 단일 서비스로 운영한다.

**Architecture:** `sql/allocation.sql` 템플릿을 그대로 재사용하고, Python 로직(SQL 파라미터 치환, 스피어만 계산)을 `lib/allocation.ts`로 포팅한다. `/api/allocation/run` POST 라우트가 BigQuery를 실행하고 JSON을 반환하면, Client Component인 `AllocationForm`이 폼 상태와 결과 렌더링을 담당한다. CSV 다운로드는 별도 서버 엔드포인트 없이 클라이언트에서 직접 생성한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, `@google-cloud/bigquery`, shadcn/ui, Tailwind v4

---

## 파일 구조

```
sql/
  allocation.sql              # Python 프로젝트에서 복사 (그대로 재사용)

types/
  allocation.ts               # AllocationRow, AllocationResult, AllocationParams, 상수 타입

lib/
  allocation.ts               # validateParams(), loadSql(), computeSpearman(), runAllocation()
  allocation.test.ts          # 위 함수 단위 테스트

app/
  api/allocation/run/
    route.ts                  # POST 핸들러 — 검증 → BQ 실행 → JSON 반환
  (dashboard)/allocation/
    layout.tsx                # "신차 배분" 헤더 타이틀 레이아웃
    page.tsx                  # Server Component (AllocationForm 마운트)

components/allocation/
  allocation-form.tsx         # Client Component: 폼 + fetch + 결과 조율
  results-tabs.tsx            # Client Component: 시/도별·시/군/구별 탭 + 테이블
  score-rationale.tsx         # Client Component: 점수 산출 근거 아코디언 패널

components/layout/
  sidebar.tsx                 # 수정: "신차 배분" 메뉴 추가 + usePathname active 처리
```

---

## Task 1: SQL 파일 복사 + 타입 정의

**Files:**
- Create: `sql/allocation.sql`
- Create: `types/allocation.ts`

- [ ] **Step 1: SQL 파일 복사**

Python 프로젝트의 `allocation.sql` 내용을 그대로 `sql/allocation.sql`에 복사한다.
(Python 프로젝트 경로: `C:/Users/socar/socar/.worktrees/feature/new-car-allocation-web/scripts/new_car_allocation/allocation.sql`)

- [ ] **Step 2: `types/allocation.ts` 작성**

```typescript
// 신차 배분 시스템 타입 정의

/** 폼 입력 파라미터 */
export interface AllocationParams {
  carModel: string;    // 차종 모델명 (예: 아반떼)
  carSegment: string;  // 세그먼트 (예: 준중형)
  totalCars: number;   // 총 배분 물량
  baseDate: string;    // 기준 날짜 (YYYY-MM-DD)
}

/** BigQuery 결과 한 행 */
export interface AllocationRow {
  region1: string;
  region2: string;
  ref_type: "model" | "segment" | "fallback";
  final_score: number;
  rev_yoy: number | null;
  util_yoy: number | null;
  allocated_cars: number;
  score_s1: number;  // α=0.3 (가동률 중시)
  score_s2: number;  // α=0.4
  score_s3: number;  // α=0.5 (채택값)
  score_s4: number;  // α=0.6
  score_s5: number;  // α=0.7 (수익 중시)
  rank_s1: number;   // α=0.3 기준 순위
  rank_s5: number;   // α=0.7 기준 순위
}

/** /api/allocation/run 성공 응답 */
export interface AllocationResult {
  rows: AllocationRow[];
  spearman: number | null;
  totalAllocated: number;
  region1Count: number;
  region2Count: number;
}

/** /api/allocation/run 에러 응답 */
export interface AllocationError {
  errors: string[];
}

/** 민감도 분석 α값과 score 컬럼 대응 관계 */
export const ALPHA_SCORE_MAP = [
  { alpha: 0.3, key: "score_s1" as const, label: "α=0.3" },
  { alpha: 0.4, key: "score_s2" as const, label: "α=0.4" },
  { alpha: 0.5, key: "score_s3" as const, label: "α=0.5 ★" },
  { alpha: 0.6, key: "score_s4" as const, label: "α=0.6" },
  { alpha: 0.7, key: "score_s5" as const, label: "α=0.7" },
] as const;

export const SEGMENTS = [
  "준중형", "중형", "중형SUV", "준대형", "준대형SUV",
  "소형SUV", "경형", "승합", "EV", "수입", "RV",
] as const;

export type Segment = typeof SEGMENTS[number];

/** CSV 출력 컬럼 목록 (순서 보존) */
export const CSV_HEADERS: (keyof AllocationRow)[] = [
  "region1", "region2", "ref_type", "final_score",
  "rev_yoy", "util_yoy", "allocated_cars",
  "score_s1", "score_s2", "score_s3", "score_s4", "score_s5",
  "rank_s1", "rank_s5",
];
```

- [ ] **Step 3: 커밋**

```bash
git add sql/allocation.sql types/allocation.ts
git commit -m "feat(allocation): SQL 템플릿 복사 및 타입 정의"
```

---

## Task 2: `lib/allocation.ts` 핵심 로직

**Files:**
- Create: `lib/allocation.ts`
- Create: `lib/allocation.test.ts`

### 핵심 함수 설명

- `validateParams()` → 입력 검증, 오류 메시지 배열 반환
- `loadSql(params, alpha?, sqlPath?)` → SQL 파일 읽어서 `{car_model}` 등 치환. `sqlPath`를 선택적으로 받아 테스트 시 모킹 가능
- `computeSpearman()` → 스피어만 순위 상관계수 (scipy 불필요, 수식 직접 구현)
- `runAllocation()` → 위 함수들 조합, BigQuery 실행 후 AllocationResult 반환

- [ ] **Step 1: 테스트 파일 작성**

`lib/allocation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { validateParams, computeSpearman, loadSql } from "./allocation";

describe("validateParams", () => {
  const valid = {
    carModel: "아반떼",
    carSegment: "준중형",
    totalCars: 50,
    baseDate: "2026-01-01",
  };

  it("유효한 파라미터는 빈 배열 반환", () => {
    expect(validateParams(valid)).toEqual([]);
  });

  it("단따옴표 포함 시 오류", () => {
    expect(validateParams({ ...valid, carModel: "아반'떼" })).toHaveLength(1);
  });

  it("총 대수 0 이하 시 오류", () => {
    expect(validateParams({ ...valid, totalCars: 0 })).toHaveLength(1);
  });

  it("올바르지 않은 세그먼트 오류", () => {
    expect(validateParams({ ...valid, carSegment: "없는세그먼트" })).toHaveLength(1);
  });

  it("날짜 형식 오류", () => {
    expect(validateParams({ ...valid, baseDate: "20260101" })).toHaveLength(1);
  });

  it("오늘 이후 날짜 오류", () => {
    expect(validateParams({ ...valid, baseDate: "2099-01-01" })).toHaveLength(1);
  });
});

describe("computeSpearman", () => {
  it("완전 일치 순위는 1.0 반환", () => {
    expect(computeSpearman([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0);
  });

  it("완전 역순위는 -1.0 반환", () => {
    expect(computeSpearman([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1.0);
  });

  it("길이가 다르면 null 반환", () => {
    expect(computeSpearman([1, 2], [1, 2, 3])).toBeNull();
  });

  it("길이 0이면 null 반환", () => {
    expect(computeSpearman([], [])).toBeNull();
  });
});

describe("loadSql", () => {
  it("파라미터가 SQL에 치환됨", () => {
    // 임시 SQL 파일 생성
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "test.sql");
    writeFileSync(tmpSql, "SELECT '{car_model}' AS m, {total_cars} AS n, {alpha} AS a");

    const result = loadSql(
      { carModel: "아반떼", carSegment: "준중형", totalCars: 50, baseDate: "2026-01-01" },
      0.5,
      tmpSql
    );
    expect(result).toContain("아반떼");
    expect(result).toContain("50");
    expect(result).toContain("0.5");
    expect(result).not.toContain("{car_model}");
  });

  it("선두 주석 블록(--) 제거됨", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "test-comment.sql");
    writeFileSync(tmpSql, "-- 주석\n-- 주석2\nSELECT 1");

    const result = loadSql(
      { carModel: "x", carSegment: "준중형", totalCars: 1, baseDate: "2026-01-01" },
      0.5,
      tmpSql
    );
    expect(result.trim()).toBe("SELECT 1");
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
npm test -- allocation
```

Expected: FAIL (모듈 없음)

- [ ] **Step 3: `lib/allocation.ts` 구현**

```typescript
import { readFileSync } from "fs";
import { resolve } from "path";
import type { AllocationParams, AllocationRow, AllocationResult } from "@/types/allocation";
import { SEGMENTS } from "@/types/allocation";
import { runQuery } from "@/lib/bigquery";

// sql/allocation.sql 기본 경로 (프로젝트 루트 기준)
const DEFAULT_SQL_PATH = resolve(process.cwd(), "sql/allocation.sql");

/** 입력 파라미터 검증. 오류 메시지 배열 반환 (비어있으면 통과). */
export function validateParams(params: AllocationParams): string[] {
  const errors: string[] = [];
  const { carModel, carSegment, totalCars, baseDate } = params;

  if (carModel.includes("'")) {
    errors.push("차종 모델명에 단따옴표(')가 포함될 수 없습니다.");
  }
  if (totalCars < 1) {
    errors.push("총 배분 물량은 1 이상이어야 합니다.");
  }
  if (!(SEGMENTS as readonly string[]).includes(carSegment)) {
    errors.push(`세그먼트 값이 올바르지 않습니다: ${carSegment}`);
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(baseDate)) {
    errors.push("기준 날짜 형식이 올바르지 않습니다 (YYYY-MM-DD).");
  } else {
    const bd = new Date(baseDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(bd.getTime())) {
      errors.push("기준 날짜 형식이 올바르지 않습니다 (YYYY-MM-DD).");
    } else if (bd >= today) {
      errors.push("기준 날짜는 오늘 이전이어야 합니다.");
    }
  }

  return errors;
}

/**
 * allocation.sql 파일을 읽어 파라미터 치환 후 반환.
 * @param sqlPath - 테스트 시 임시 파일 경로 주입 가능 (기본: sql/allocation.sql)
 */
export function loadSql(
  params: AllocationParams,
  alpha = 0.5,
  sqlPath: string = DEFAULT_SQL_PATH
): string {
  const raw = readFileSync(sqlPath, "utf-8");
  const formatted = raw
    .replace(/\{car_model\}/g, params.carModel)
    .replace(/\{car_segment\}/g, params.carSegment)
    .replace(/\{total_cars\}/g, String(params.totalCars))
    .replace(/\{base_date\}/g, params.baseDate)
    .replace(/\{alpha\}/g, String(alpha));

  // 선두 주석 블록(-- ...) 제거
  const lines = formatted.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (stripped && !stripped.startsWith("--")) {
      return lines.slice(i).join("\n");
    }
  }
  return formatted;
}

/**
 * 스피어만 순위 상관계수 계산.
 * ρ = 1 - (6 * Σd²) / (n * (n² - 1))
 */
export function computeSpearman(rankS1: number[], rankS5: number[]): number | null {
  const n = rankS1.length;
  if (n === 0 || n !== rankS5.length) return null;

  const sumD2 = rankS1.reduce((acc, r1, i) => acc + (r1 - rankS5[i]) ** 2, 0);
  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
  return Math.round(rho * 10000) / 10000;
}

/** SQL 실행 후 AllocationResult 반환. */
export async function runAllocation(params: AllocationParams): Promise<AllocationResult> {
  const sql = loadSql(params);
  const rawRows = await runQuery(sql);
  if (!rawRows) throw new Error("BigQuery가 설정되지 않았습니다 (GOOGLE_APPLICATION_CREDENTIALS_B64).");

  // BigQuery 반환값을 AllocationRow로 캐스팅
  // rev_yoy / util_yoy는 NULL일 수 있으므로 null 처리
  const rows: AllocationRow[] = rawRows.map((r) => ({
    region1:       String(r.region1 ?? ""),
    region2:       String(r.region2 ?? ""),
    ref_type:      (r.ref_type as "model" | "segment" | "fallback") ?? "fallback",
    final_score:   Number(r.final_score ?? 0),
    rev_yoy:       r.rev_yoy != null ? Number(r.rev_yoy) : null,
    util_yoy:      r.util_yoy != null ? Number(r.util_yoy) : null,
    allocated_cars: Number(r.allocated_cars ?? 0),
    score_s1:      Number(r.score_s1 ?? 0),
    score_s2:      Number(r.score_s2 ?? 0),
    score_s3:      Number(r.score_s3 ?? 0),
    score_s4:      Number(r.score_s4 ?? 0),
    score_s5:      Number(r.score_s5 ?? 0),
    rank_s1:       Number(r.rank_s1 ?? 0),
    rank_s5:       Number(r.rank_s5 ?? 0),
  }));

  const spearman = computeSpearman(rows.map((r) => r.rank_s1), rows.map((r) => r.rank_s5));

  return {
    rows,
    spearman,
    totalAllocated: rows.reduce((s, r) => s + r.allocated_cars, 0),
    region1Count:   new Set(rows.map((r) => r.region1)).size,
    region2Count:   rows.length,
  };
}
```

- [ ] **Step 4: 테스트 실행 → PASS 확인**

```bash
npm test -- allocation
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: 임시 테스트 디렉토리 `.gitignore`에 추가 확인**

`tmp-test/`가 `.gitignore`에 없으면 추가:
```
tmp-test/
```

- [ ] **Step 6: 커밋**

```bash
git add lib/allocation.ts lib/allocation.test.ts .gitignore
git commit -m "feat(allocation): 핵심 로직 포팅 (validateParams, loadSql, computeSpearman, runAllocation)"
```

---

## Task 3: API 라우트

**Files:**
- Create: `app/api/allocation/run/route.ts`

- [ ] **Step 1: API 라우트 작성**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateParams, runAllocation } from "@/lib/allocation";
import type { AllocationParams } from "@/types/allocation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const params: AllocationParams = {
    carModel:   body.carModel   ?? "",
    carSegment: body.carSegment ?? "",
    totalCars:  Number(body.totalCars ?? 0),
    baseDate:   body.baseDate   ?? "",
  };

  const errors = validateParams(params);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const result = await runAllocation(params);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[allocation/run]", err);
    let message = "BQ 실행 중 오류가 발생했습니다. 서버 로그를 확인해주세요.";
    if (err instanceof Error) {
      if (err.message.includes("ENOENT")) {
        message = "SQL 파일을 찾을 수 없습니다 (sql/allocation.sql).";
      } else if (err.message.includes("GOOGLE_APPLICATION_CREDENTIALS")) {
        message = "BigQuery 인증이 설정되지 않았습니다 (GOOGLE_APPLICATION_CREDENTIALS_B64).";
      }
    }
    return NextResponse.json({ errors: [message] }, { status: 500 });
  }
}
```

- [ ] **Step 2: 개발 서버에서 수동 확인**

```bash
npm run dev
# 별도 터미널:
curl -X POST http://localhost:3000/api/allocation/run \
  -H "Content-Type: application/json" \
  -d '{"carModel":"아반떼","carSegment":"준중형","totalCars":50,"baseDate":"2026-01-01"}'
```

Expected: JSON 결과 또는 `{"errors": [...]}` 형태 응답

- [ ] **Step 3: 커밋**

```bash
git add app/api/allocation/run/route.ts
git commit -m "feat(allocation): POST /api/allocation/run 라우트 추가"
```

---

## Task 4: 사이드바 네비게이션 업데이트

**Files:**
- Modify: `components/layout/sidebar.tsx`

사이드바에 "신차 배분" 메뉴를 추가하고, `usePathname()`으로 현재 경로와 일치하는 항목을 하이라이트한다.

- [ ] **Step 1: `sidebar.tsx` 수정**

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";  // 추가
import {
  LayoutDashboard,
  Car,              // 추가
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: LayoutDashboard, label: "대시보드", href: "/dashboard" },
  { icon: Car,             label: "신차 배분", href: "/allocation" },  // 추가
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();  // 추가

  // ... (기존 JSX 구조 유지, navItems 루프 부분만 변경)

  // navItems.map 내부 Link의 className을 아래로 교체:
  // className={cn(
  //   "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
  //   pathname.startsWith(item.href)
  //     ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
  //     : "text-sidebar-foreground hover:bg-sidebar-accent/50"
  // )}
}
```

> **주의:** 기존 JSX 구조(aside, nav, Button 등)는 그대로 유지하고 위에 표시된 3군데(`import`, `navItems`, `className`)만 수정한다.

- [ ] **Step 2: 커밋**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat(allocation): 사이드바에 신차 배분 메뉴 추가 + active 하이라이트"
```

---

## Task 5: 배분 페이지 레이아웃 + 페이지

**Files:**
- Create: `app/(dashboard)/allocation/layout.tsx`
- Create: `app/(dashboard)/allocation/page.tsx`

- [ ] **Step 1: `layout.tsx` 작성**

```typescript
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function AllocationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="신차 배분" />
        <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `page.tsx` 작성**

```typescript
import { AllocationForm } from "@/components/allocation/allocation-form";

export const dynamic = "force-dynamic";

export default function AllocationPage() {
  return <AllocationForm />;
}
```

> `AllocationForm`은 Client Component로 자체 `loading` 상태를 관리한다.
> 폼 제출 시 fetch가 발생하므로 Suspense가 아닌 useState로 로딩 처리한다.

- [ ] **Step 3: 커밋**

```bash
git add "app/(dashboard)/allocation/layout.tsx" "app/(dashboard)/allocation/page.tsx"
git commit -m "feat(allocation): 배분 페이지 레이아웃 및 페이지 추가"
```

---

## Task 6: 점수 산출 근거 패널

**Files:**
- Create: `components/allocation/score-rationale.tsx`

- [ ] **Step 1: `score-rationale.tsx` 작성**

`ALPHA_SCORE_MAP`을 사용해 α 값과 점수 컬럼 대응 관계를 명시적으로 표현한다.

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALPHA_SCORE_MAP } from "@/types/allocation";
import type { AllocationRow } from "@/types/allocation";

interface ScoreRationaleProps {
  rows: AllocationRow[];
  spearman: number | null;
}

export function ScoreRationale({ rows, spearman }: ScoreRationaleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="text-xs"
      >
        {open
          ? <><ChevronDown className="mr-1 h-3 w-3" />점수 산출 근거 닫기</>
          : <><ChevronRight className="mr-1 h-3 w-3" />점수 산출 근거 보기</>
        }
      </Button>

      {open && (
        <div className="mt-3 rounded-lg border p-4 text-sm space-y-4">
          {/* 배분 철학 */}
          <div className="rounded-md border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950 p-3">
            <p className="font-semibold mb-1">배분 철학</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              신차를 <em>"지금 잘 팔리는 곳"</em>이 아닌 <em>"성장하고 있는 곳"</em>에 배분합니다.
              현재 수익·가동률의 절대값 대신 <strong>전년 동기 대비 성장률(YoY)</strong>을 기준으로 삼아,
              시장이 확대되는 지역에 우선 공급합니다.
            </p>
          </div>

          {/* 7단계 프로세스 */}
          <div>
            <p className="font-semibold mb-2">산출 단계</p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
              <li><strong className="text-foreground">데이터 기간</strong> — 기준일 직전 90일 vs 전년 동기 90일 (계절성 제거)</li>
              <li><strong className="text-foreground">참조 기준 결정</strong> — 해당 차종 5대↑ → <span className="rounded bg-green-100 dark:bg-green-900 px-1">model</span>, 동일 세그먼트 5대↑ → <span className="rounded bg-blue-100 dark:bg-blue-900 px-1">segment</span>, 그 외 → <span className="rounded bg-yellow-100 dark:bg-yellow-900 px-1">fallback</span>(전국 평균)</li>
              <li><strong className="text-foreground">YoY 계산</strong> — 데이터 30일 미만이면 1.0(중립), 0.5~2.0 클리핑</li>
              <li><strong className="text-foreground">원점수</strong> — 대당수익 × 수익YoY, 가동률 × 가동률YoY</li>
              <li><strong className="text-foreground">윈저라이징</strong> — 상·하위 5% 극단값 제거</li>
              <li><strong className="text-foreground">Min-Max 정규화</strong> — 0~1 스케일 (단위 차이 제거)</li>
              <li><strong className="text-foreground">최종 점수</strong> — α×수익<sub>정규화</sub> + (1-α)×가동률<sub>정규화</sub> → 점수 비례 배분</li>
            </ol>
          </div>

          {/* 민감도 테이블 */}
          <div>
            <p className="font-semibold mb-1">
              민감도 분석
              {spearman !== null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  S1-S5 스피어만 상관계수: {spearman}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              순위차 ≥5는 빨강, ≥3은 주황 — 가중치 선택에 민감한 지역입니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="border px-2 py-1 text-left">시/도</th>
                    <th className="border px-2 py-1 text-left">시/군/구</th>
                    {ALPHA_SCORE_MAP.map(({ label, alpha }) => (
                      <th
                        key={label}
                        className={`border px-2 py-1 text-right ${alpha === 0.5 ? "bg-blue-100 dark:bg-blue-900" : ""}`}
                      >
                        {label}
                      </th>
                    ))}
                    <th className="border px-2 py-1 text-right">순위 α=0.3</th>
                    <th className="border px-2 py-1 text-right">순위 α=0.7</th>
                    <th className="border px-2 py-1 text-right">순위차</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const diff = Math.abs(r.rank_s1 - r.rank_s5);
                    const diffColor =
                      diff >= 5 ? "text-red-600 font-bold" :
                      diff >= 3 ? "text-orange-500" :
                      "text-green-600";
                    return (
                      <tr key={i} className="hover:bg-muted/50">
                        <td className="border px-2 py-1">{r.region1}</td>
                        <td className="border px-2 py-1">{r.region2}</td>
                        {ALPHA_SCORE_MAP.map(({ key, alpha }) => (
                          <td
                            key={key}
                            className={`border px-2 py-1 text-right ${alpha === 0.5 ? "bg-blue-50 dark:bg-blue-950" : ""}`}
                          >
                            {r[key].toFixed(3)}
                          </td>
                        ))}
                        <td className="border px-2 py-1 text-right">{r.rank_s1}</td>
                        <td className="border px-2 py-1 text-right">{r.rank_s5}</td>
                        <td className={`border px-2 py-1 text-right ${diffColor}`}>{diff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/allocation/score-rationale.tsx
git commit -m "feat(allocation): 점수 산출 근거 패널 컴포넌트"
```

---

## Task 7: 결과 테이블 (시/도별·시/군/구별 탭)

**Files:**
- Create: `components/allocation/results-tabs.tsx`

- [ ] **Step 1: `Tabs` 컴포넌트 존재 확인**

```bash
ls components/ui/tabs.tsx
```

없으면 설치:
```bash
npx shadcn add tabs
```

- [ ] **Step 2: `results-tabs.tsx` 작성**

```typescript
"use client";

import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AllocationRow } from "@/types/allocation";

interface ResultsTabsProps {
  rows: AllocationRow[];
  totalAllocated: number;
  region1Count: number;
  region2Count: number;
  spearman: number | null;
}

function RefBadge({ refType }: { refType: string }) {
  const styles: Record<string, string> = {
    model:    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    segment:  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    fallback: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${styles[refType] ?? ""}`}>
      {refType}
    </span>
  );
}

function YoyCell({ value }: { value: number | null }) {
  if (value === null) {
    return <td className="px-3 py-2 text-right text-xs text-muted-foreground">—</td>;
  }
  return (
    <td className={`px-3 py-2 text-right text-xs font-medium ${value >= 1.0 ? "text-green-600" : "text-red-500"}`}>
      {value.toFixed(3)}
    </td>
  );
}

export function ResultsTabs({ rows, totalAllocated, region1Count, region2Count, spearman }: ResultsTabsProps) {
  // 시/도별 집계 (avg_score 내림차순)
  const region1Data = useMemo(() => {
    const map = new Map<string, {
      scoreSum: number; revSum: number; utilSum: number;
      cars: number; count: number; refTypes: Record<string, number>;
    }>();
    for (const r of rows) {
      const g = map.get(r.region1) ?? { scoreSum: 0, revSum: 0, utilSum: 0, cars: 0, count: 0, refTypes: {} };
      g.scoreSum += r.final_score;
      g.revSum   += r.rev_yoy ?? 0;
      g.utilSum  += r.util_yoy ?? 0;
      g.cars     += r.allocated_cars;
      g.count    += 1;
      g.refTypes[r.ref_type] = (g.refTypes[r.ref_type] ?? 0) + 1;
      map.set(r.region1, g);
    }
    return Array.from(map.entries())
      .map(([region1, g]) => ({
        region1,
        avgScore:  g.scoreSum / g.count,
        avgRev:    g.revSum / g.count,
        avgUtil:   g.utilSum / g.count,
        totalCars: g.cars,
        topRef:    Object.entries(g.refTypes).sort((a, b) => b[1] - a[1])[0][0],
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [rows]);

  // 시/군/구별 (final_score 내림차순)
  const region2Data = useMemo(
    () => [...rows].sort((a, b) => b.final_score - a.final_score),
    [rows]
  );

  return (
    <div className="space-y-3">
      {/* 요약 */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>총 배분: <strong className="text-foreground">{totalAllocated}대</strong></span>
        <span>시/도: <strong className="text-foreground">{region1Count}개</strong></span>
        <span>시/군/구: <strong className="text-foreground">{region2Count}개</strong></span>
        {spearman !== null && (
          <span>스피어만(α 안정성): <strong className="text-foreground">{spearman}</strong></span>
        )}
      </div>

      <Tabs defaultValue="region1">
        <TabsList>
          <TabsTrigger value="region1">시/도별</TabsTrigger>
          <TabsTrigger value="region2">시/군/구별</TabsTrigger>
        </TabsList>

        {/* 시/도별 탭 */}
        <TabsContent value="region1">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">시/도</th>
                  <th className="px-3 py-2 text-left">참조기준</th>
                  <th className="px-3 py-2 text-right">평균점수</th>
                  <th className="px-3 py-2 text-right">수익YoY</th>
                  <th className="px-3 py-2 text-right">가동YoY</th>
                  <th className="px-3 py-2 text-right">배분대수</th>
                </tr>
              </thead>
              <tbody>
                {region1Data.map((d) => (
                  <tr key={d.region1} className="border-t hover:bg-muted/50">
                    <td className="px-3 py-2 font-medium">{d.region1}</td>
                    <td className="px-3 py-2"><RefBadge refType={d.topRef} /></td>
                    <td className="px-3 py-2 text-right">{d.avgScore.toFixed(3)}</td>
                    <YoyCell value={d.avgRev} />
                    <YoyCell value={d.avgUtil} />
                    <td className="px-3 py-2 text-right font-bold">{d.totalCars}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 시/군/구별 탭 */}
        <TabsContent value="region2">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">시/도</th>
                  <th className="px-3 py-2 text-left">시/군/구</th>
                  <th className="px-3 py-2 text-left">참조기준</th>
                  <th className="px-3 py-2 text-right">최종점수</th>
                  <th className="px-3 py-2 text-right">수익YoY</th>
                  <th className="px-3 py-2 text-right">가동YoY</th>
                  <th className="px-3 py-2 text-right">배분대수</th>
                </tr>
              </thead>
              <tbody>
                {region2Data.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/50">
                    <td className="px-3 py-2">{r.region1}</td>
                    <td className="px-3 py-2 font-medium">{r.region2}</td>
                    <td className="px-3 py-2"><RefBadge refType={r.ref_type} /></td>
                    <td className="px-3 py-2 text-right">{r.final_score.toFixed(3)}</td>
                    <YoyCell value={r.rev_yoy} />
                    <YoyCell value={r.util_yoy} />
                    <td className="px-3 py-2 text-right font-bold">{r.allocated_cars}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add components/allocation/results-tabs.tsx
git commit -m "feat(allocation): 시/도별·시/군/구별 결과 탭 컴포넌트"
```

---

## Task 8: 메인 폼 컴포넌트 + CSV 다운로드

**Files:**
- Create: `components/allocation/allocation-form.tsx`

- [ ] **Step 1: `Card` 컴포넌트 존재 확인**

```bash
ls components/ui/card.tsx
```

없으면 설치:
```bash
npx shadcn add card
```

- [ ] **Step 2: `allocation-form.tsx` 작성**

CSV 다운로드는 `CSV_HEADERS`를 사용해 전체 컬럼 포함.

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultsTabs } from "./results-tabs";
import { ScoreRationale } from "./score-rationale";
import { SEGMENTS, CSV_HEADERS } from "@/types/allocation";
import type { AllocationResult } from "@/types/allocation";

export function AllocationForm() {
  const [form, setForm] = useState({
    carModel:   "",
    carSegment: SEGMENTS[0] as string,
    totalCars:  "50",
    baseDate:   "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<AllocationResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/allocation/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, totalCars: Number(form.totalCars) }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.errors?.join(" / ") ?? "알 수 없는 오류가 발생했습니다.");
      return;
    }
    setResult(data);
  }

  function handleDownload() {
    if (!result) return;
    const csv = [
      CSV_HEADERS.join(","),
      ...result.rows.map((r) =>
        CSV_HEADERS.map((h) => {
          const v = r[h];
          return v === null || v === undefined ? "" : String(v);
        }).join(",")
      ),
    ].join("\n");

    const bom  = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "allocation.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-6">
      {/* 좌측: 입력 폼 */}
      <div className="w-72 shrink-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">배분 파라미터</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">차종 모델명</label>
                <input
                  className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="예: 아반떼"
                  value={form.carModel}
                  onChange={(e) => setForm((f) => ({ ...f, carModel: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">세그먼트</label>
                <select
                  className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.carSegment}
                  onChange={(e) => setForm((f) => ({ ...f, carSegment: e.target.value }))}
                >
                  {SEGMENTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">총 배분 물량</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.totalCars}
                  onChange={(e) => setForm((f) => ({ ...f, totalCars: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">기준 날짜</label>
                <input
                  type="date"
                  className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.baseDate}
                  onChange={(e) => setForm((f) => ({ ...f, baseDate: e.target.value }))}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "실행 중…" : "배분 실행"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 우측: 결과 */}
      <div className="flex-1 min-w-0">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300 mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-md border bg-muted/50 p-8 text-center text-sm text-muted-foreground">
            BigQuery 실행 중입니다… (약 10~30초 소요)
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">배분 결과</h2>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                CSV 다운로드
              </Button>
            </div>

            <ResultsTabs
              rows={result.rows}
              totalAllocated={result.totalAllocated}
              region1Count={result.region1Count}
              region2Count={result.region2Count}
              spearman={result.spearman}
            />

            <ScoreRationale rows={result.rows} spearman={result.spearman} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 브라우저 수동 확인**

```bash
npm run dev
```

`http://localhost:3000/allocation` 접속 → 폼 입력 → 배분 실행 → 결과 확인 → CSV 다운로드 확인 (score_s1~s5, rank_s1, rank_s5 포함 여부 체크)

- [ ] **Step 4: 커밋**

```bash
git add components/allocation/allocation-form.tsx
git commit -m "feat(allocation): 메인 폼 컴포넌트 + CSV 다운로드 (전체 컬럼 포함)"
```

---

## Task 9: 최종 통합 확인 및 푸시

- [ ] **Step 1: 전체 테스트 실행**

```bash
npm test
```

Expected: 모든 테스트 PASS

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 에러 없음 (TypeScript 타입 오류 포함)

- [ ] **Step 3: 최종 푸시**

```bash
git push origin main
```
