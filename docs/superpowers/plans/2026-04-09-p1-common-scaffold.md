# P1. 공통 기반 스캐폴드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 호도 대시보드에 ROAS 시뮬레이터와 존 시뮬레이터의 라우팅, 사이드바 메뉴, SQL 디렉토리 구조, 빈 페이지 스캐폴드를 추가하여 후속 단계(P2~P5)의 기반을 만든다.

**Architecture:** 기존 `(dashboard)` route group 안에 `/roas`, `/roas/analysis`, `/zone` 페이지를 추가한다. 사이드바 `navItems` 배열에 메뉴 2개를 추가한다. `sql/roas/`, `sql/zone/` 디렉토리를 생성한다. 브랜딩을 "호도 대시보드"로 변경한다.

**Tech Stack:** Next.js 16 App Router, React 19, shadcn/ui, lucide-react, TypeScript

---

## File Structure

```
components/layout/sidebar.tsx         ← 수정: navItems에 ROAS/Zone 메뉴 추가, 브랜딩 변경
app/(dashboard)/roas/page.tsx         ← 신규: ROAS 시뮬레이터 빈 페이지
app/(dashboard)/roas/analysis/page.tsx ← 신규: 캠페인 분석 빈 페이지
app/(dashboard)/zone/page.tsx         ← 신규: 존 시뮬레이터 빈 페이지
sql/roas/.gitkeep                     ← 신규: ROAS SQL 디렉토리 placeholder
sql/zone/.gitkeep                     ← 신규: Zone SQL 디렉토리 placeholder
```

---

## Task 1: 사이드바에 ROAS/Zone 메뉴 추가 및 브랜딩 변경

**Files:**
- Modify: `components/layout/sidebar.tsx:1-24` (navItems 배열 + import)

- [ ] **Step 1: lucide-react import에 아이콘 추가**

`components/layout/sidebar.tsx`의 import 문에 `MapPin`, `TrendingUp` 아이콘을 추가한다:

```tsx
import {
  ArrowLeftRight,
  Car,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  MapPin,
  Menu,
  SearchCheck,
  TrendingUp,
  X,
} from "lucide-react";
```

- [ ] **Step 2: navItems 배열에 ROAS/Zone 항목 추가**

`components/layout/sidebar.tsx`의 `navItems` 배열을 다음으로 교체한다:

```tsx
const navItems = [
  { icon: LayoutDashboard, label: "대시보드", href: "/dashboard" },
  { icon: Car, label: "신차 배분", href: "/allocation" },
  { icon: ArrowLeftRight, label: "재배치 추천", href: "/relocation" },
  { icon: TrendingUp, label: "ROAS 시뮬레이터", href: "/roas" },
  { icon: MapPin, label: "존 시뮬레이터", href: "/zone" },
  { icon: SearchCheck, label: "워크스페이스", href: "/work-history" },
];
```

- [ ] **Step 3: 브랜딩 텍스트를 "호도 대시보드"로 변경**

`components/layout/sidebar.tsx`에서 사이드바 헤더 텍스트를 변경한다:

```tsx
<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
  HODO
</p>
<p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-foreground">
  호도 대시보드
</p>
<p className="mt-2 text-sm leading-6 text-muted-foreground">
  지역사업팀 통합 업무 도구
</p>
```

- [ ] **Step 4: 개발 서버에서 사이드바 확인**

Run: `cd /c/Users/socar/googlesheet-dashboard && npm run dev`

Expected: 사이드바에 6개 메뉴 항목 표시 (대시보드, 신차 배분, 재배치 추천, ROAS 시뮬레이터, 존 시뮬레이터, 워크스페이스). 헤더에 "HODO / 호도 대시보드" 표시.

- [ ] **Step 5: 커밋**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat: 사이드바에 ROAS/Zone 메뉴 추가, 호도 대시보드 브랜딩"
```

---

## Task 2: ROAS 시뮬레이터 빈 페이지 생성

**Files:**
- Create: `app/(dashboard)/roas/page.tsx`
- Create: `app/(dashboard)/roas/analysis/page.tsx`

- [ ] **Step 1: ROAS 시뮬레이션 실행 페이지 생성**

`app/(dashboard)/roas/page.tsx`:

```tsx
export const metadata = { title: "ROAS 시뮬레이터 | 호도 대시보드" };

export default function RoasPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            ROAS Simulator
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            쿠폰 캠페인 ROAS 시뮬레이션
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            지역, 존, 쿠폰 조건을 설정하고 투자 대비 수익을 예측합니다.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-12 text-center shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <p className="text-sm text-muted-foreground">시뮬레이터 컴포넌트가 여기에 들어갑니다 (P2/P3에서 구현)</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 캠페인 분석 페이지 생성**

`app/(dashboard)/roas/analysis/page.tsx`:

```tsx
export const metadata = { title: "캠페인 분석 | 호도 대시보드" };

export default function RoasAnalysisPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Campaign Analysis
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            캠페인 사후 분석
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            실행된 쿠폰 캠페인의 효과를 데이터로 분석하고 판정합니다.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-12 text-center shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <p className="text-sm text-muted-foreground">캠페인 분석 컴포넌트가 여기에 들어갑니다 (P2/P3에서 구현)</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: 브라우저에서 페이지 접근 확인**

Expected:
- `http://localhost:3000/roas` → ROAS 시뮬레이션 페이지 표시
- `http://localhost:3000/roas/analysis` → 캠페인 분석 페이지 표시
- 사이드바에서 "ROAS 시뮬레이터" 클릭 시 `/roas`로 이동, 활성 상태 표시

- [ ] **Step 4: 커밋**

```bash
git add app/\(dashboard\)/roas/
git commit -m "feat: ROAS 시뮬레이터 빈 페이지 스캐폴드 (시뮬레이션 + 분석)"
```

---

## Task 3: 존 시뮬레이터 빈 페이지 생성

**Files:**
- Create: `app/(dashboard)/zone/page.tsx`

- [ ] **Step 1: 존 시뮬레이터 페이지 생성**

`app/(dashboard)/zone/page.tsx`:

```tsx
export const metadata = { title: "존 시뮬레이터 | 호도 대시보드" };

export default function ZonePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Zone Simulator
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            존 개설·폐쇄·비교·최적화
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            카카오맵 위에서 존 운영 의사결정을 데이터 기반으로 시뮬레이션합니다.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-12 text-center shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <p className="text-sm text-muted-foreground">카카오맵 + 모드 패널이 여기에 들어갑니다 (P4/P5에서 구현)</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 브라우저에서 페이지 접근 확인**

Expected:
- `http://localhost:3000/zone` → 존 시뮬레이터 페이지 표시
- 사이드바에서 "존 시뮬레이터" 클릭 시 `/zone`으로 이동, 활성 상태 표시

- [ ] **Step 3: 커밋**

```bash
git add app/\(dashboard\)/zone/
git commit -m "feat: 존 시뮬레이터 빈 페이지 스캐폴드"
```

---

## Task 4: SQL 디렉토리 구조 생성

**Files:**
- Create: `sql/roas/.gitkeep`
- Create: `sql/zone/.gitkeep`

- [ ] **Step 1: ROAS/Zone SQL 디렉토리 생성**

```bash
mkdir -p sql/roas sql/zone
touch sql/roas/.gitkeep sql/zone/.gitkeep
```

- [ ] **Step 2: 기존 SQL 디렉토리와 함께 확인**

```bash
ls sql/
```

Expected:
```
allocation.sql
allocation_r2.sql
relocation.sql
relocation-candidates.sql
roas/
zone/
```

- [ ] **Step 3: 커밋**

```bash
git add sql/roas/.gitkeep sql/zone/.gitkeep
git commit -m "chore: ROAS/Zone SQL 디렉토리 스캐폴드"
```

---

## Task 5: 사이드바 ROAS 하위 메뉴 (시뮬레이션/분석 탭)

ROAS는 2개 하위 페이지가 있으므로 `/roas` 접근 시 시뮬레이션/분석 탭을 제공한다. 사이드바 자체는 `/roas`만 가리키고, 페이지 내부에서 탭으로 전환한다.

**Files:**
- Create: `app/(dashboard)/roas/layout.tsx`

- [ ] **Step 1: ROAS 레이아웃에 탭 네비게이션 추가**

`app/(dashboard)/roas/layout.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const roasTabs = [
  { label: "시뮬레이션", href: "/roas" },
  { label: "캠페인 분석", href: "/roas/analysis" },
];

export default function RoasLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 rounded-2xl border border-border/60 bg-card/90 p-1.5 shadow-[0_12px_30px_-20px_rgba(20,26,36,0.12)]">
        {roasTabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 브라우저에서 탭 전환 확인**

Expected:
- `/roas` → "시뮬레이션" 탭 활성, 시뮬레이터 페이지 표시
- `/roas/analysis` → "캠페인 분석" 탭 활성, 분석 페이지 표시
- 탭 클릭으로 페이지 전환, 사이드바 "ROAS 시뮬레이터"는 두 페이지 모두에서 활성

- [ ] **Step 3: 커밋**

```bash
git add app/\(dashboard\)/roas/layout.tsx
git commit -m "feat: ROAS 시뮬레이션/분석 탭 네비게이션 레이아웃"
```

---

## Task 6: metadata 및 타이틀 정리

**Files:**
- Modify: `app/layout.tsx` (루트 레이아웃의 metadata)

- [ ] **Step 1: 루트 metadata 확인 및 변경**

`app/layout.tsx`의 metadata를 확인하고 아래로 변경한다:

```tsx
export const metadata = {
  title: {
    default: "호도 대시보드",
    template: "%s | 호도 대시보드",
  },
  description: "쏘카 지역사업팀 통합 업무 도구",
};
```

- [ ] **Step 2: 각 페이지의 metadata가 template과 결합되는지 확인**

Expected:
- `/roas` → 브라우저 탭: "ROAS 시뮬레이터 | 호도 대시보드"
- `/zone` → 브라우저 탭: "존 시뮬레이터 | 호도 대시보드"
- `/dashboard` → 브라우저 탭: "호도 대시보드"

- [ ] **Step 3: 커밋**

```bash
git add app/layout.tsx
git commit -m "chore: 호도 대시보드 metadata 및 타이틀 템플릿 적용"
```
