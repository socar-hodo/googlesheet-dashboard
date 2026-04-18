# 호도 대시보드 재배치 추천 v1.3 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 호도 대시보드 `/relocation` 페이지를 v1.3 zone-simulator Macro API 소비 UI로 전면 교체 (클러스터 α + zone-level 이동 명령 + CSV 다운로드).

**Architecture:** `lib/zone-simulator-client.ts` 가 쿠키 프록시 로그인으로 zone-simulator `/api/optimize` 호출. `/api/relocation/run` 이 해당 client를 호출하고 응답을 pass-through. UI는 allocation 페이지 패턴을 차용한 6개 컴포넌트로 구성.

**Tech Stack:** Next.js 16 (App Router), React 19, shadcn/ui (Card/Button/Input/Table/Badge/Skeleton/Sonner), NextAuth v5 (`withAuth` 래퍼), vitest (유닛), Playwright (E2E), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-04-18-relocation-v13-integration-design.md`

**Working directory:** `C:/Users/socar/googlesheet-dashboard`

---

## File Structure

| 파일 | 유형 | 책임 |
|---|---|---|
| `types/relocation.ts` | 교체 | v1.3 스키마 (OptimizeMacro* + MoveOrder + ZoneSummary 등) |
| `lib/zone-simulator-client.ts` | 신규 | 쿠키 캐시 + 자동 로그인 + `/api/optimize` 호출 |
| `lib/zone-simulator-client.test.ts` | 신규 | 유닛 3종 (first call, cached, 401 재시도) |
| `app/api/relocation/run/route.ts` | 교체 | `withAuth` + 파라미터 검증 + client 호출 |
| `app/api/relocation/run/route.test.ts` | 신규 | 유닛 4종 (401/422/200/502) |
| `app/api/relocation/candidates/route.ts` | 삭제 | v1.1 전용 |
| `lib/relocation.test.ts` | 삭제 | v1.1 로직 테스트 |
| `components/relocation/relocation-form.tsx` | 교체 | 좌측 필터 + 실행 + 결과 조립 |
| `components/relocation/relocation-summary-cards.tsx` | 신규 | 4-stat 카드 |
| `components/relocation/relocation-cluster-breakdown.tsx` | 신규 | 클러스터별 delta |
| `components/relocation/relocation-top-regions.tsx` | 신규 | 증설/감축 Top N 카드 그리드 |
| `components/relocation/relocation-move-orders-table.tsx` | 신규 | 이동 명령 테이블 + thead 정렬 |
| `components/relocation/csv-download-button.tsx` | 신규 | Blob 다운로드 (재활용 가능) |
| `components/relocation/relocation-chart.tsx` | 삭제 | v1.1 |
| `components/relocation/relocation-table.tsx` | 삭제 | v1.1 |
| `components/relocation/relocation-recommendations.tsx` | 삭제 | v1.1 |
| `app/(dashboard)/relocation/page.tsx` | 교체 | 제목 + `<RelocationForm />` |

---

## Task 1: Feature branch + 환경변수 로컬 설정

**Files:**
- Modify: `.env.local` (로컬 전용, 커밋 안 됨)

- [ ] **Step 1: Feature branch 생성**

```bash
cd C:/Users/socar/googlesheet-dashboard
git checkout -b feature/relocation-v13-integration
git status
```

Expected: "On branch feature/relocation-v13-integration, nothing to commit".

- [ ] **Step 2: `.env.local` 에 zone-simulator 설정 추가**

`.env.local` 파일에 아래 2줄 append (파일 없으면 생성):

```
ZONE_SIMULATOR_URL=https://zone-simulator-975221354422.asia-northeast3.run.app
ZONE_SIMULATOR_PASSWORD=hodo
```

`.env.local` 은 `.gitignore` 에 이미 포함됨 — 커밋되지 않음.

- [ ] **Step 3: 로컬 확인**

```bash
cd C:/Users/socar/googlesheet-dashboard
grep -E "^(ZONE_SIMULATOR_URL|ZONE_SIMULATOR_PASSWORD)=" .env.local
```

Expected: 위 2줄 출력.

- [ ] **Step 4: 사전 로컬 동작 확인 (dev 서버)**

```bash
npm run dev
# 다른 터미널에서:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/relocation
```

Expected: 200 또는 302 (로그인 리다이렉트). 커밋 없음 (환경변수만).

---

## Task 2: types/relocation.ts 교체 (v1.3 스키마)

**Files:**
- Replace: `types/relocation.ts`

- [ ] **Step 1: 기존 `types/relocation.ts` 백업 확인 후 전체 교체**

```bash
cd C:/Users/socar/googlesheet-dashboard
cat types/relocation.ts | head -30
```

Content를 확인하고, 아래 신규 내용으로 **전체 교체**:

```typescript
// v1.3 zone-simulator Macro API schema.
// Source: zone-simulator /api/optimize (mode=macro) response.

export interface OptimizeMacroRequest {
  mode: "macro";
  total_transfer: number;
  max_pct_per_region: number;
  min_cars_per_region: number;
  top_n: number;
}

export interface ZoneSummary {
  zone_id: number;
  zone_name: string;
  region1: string;
  region2: string;
  cluster: string;
  current_cars: number;
  util_pct: number;
}

export interface MoveOrder {
  order_id: number;
  src_zone: ZoneSummary;
  dst_zone: ZoneSummary;
  cars: number;
  distance_km: number;
  cost_est: number;
  gain_per_year: number;
}

export interface RegionDelta {
  region1: string;
  region2: string;
  cluster: string;
  alpha: number;
  current_cars: number;
  delta_cars: number;
  delta_rev_yr: number;
}

export interface OptimizeMacroResponse {
  mode: "macro";
  params: OptimizeMacroRequest;
  summary: {
    actual_transfer: number;
    delta_rev_yr: number;
    by_cluster: Record<string, number>;
    total_cost_est: number;
    net_gain_yr: number;
  };
  suggestions: {
    increase: RegionDelta[];
    decrease: RegionDelta[];
  };
  move_orders: MoveOrder[];
}

/** 파라미터 기본값 (zone-simulator와 동기화) */
export const RELOCATION_DEFAULTS: OptimizeMacroRequest = {
  mode: "macro",
  total_transfer: 500,
  max_pct_per_region: 0.20,
  min_cars_per_region: 5,
  top_n: 30,
};

/** CSV 컬럼 헤더 (배차팀 전달용) */
export const MOVE_ORDER_CSV_HEADERS = [
  "순위", "출발존ID", "출발존명", "출발지역1", "출발지역2",
  "도착존ID", "도착존명", "도착지역1", "도착지역2",
  "대수", "거리km", "탁송비", "연이득",
] as const;
```

- [ ] **Step 2: 기존 import 깨짐 확인**

```bash
cd C:/Users/socar/googlesheet-dashboard
grep -rn "from \"@/types/relocation\"\|from '@/types/relocation'" --include='*.ts' --include='*.tsx' | head -20
```

Expected: 기존 사용처(components/relocation, app/api/relocation)가 나옴. 이후 Task에서 모두 교체/삭제되므로 현 시점 컴파일 에러는 허용.

- [ ] **Step 3: Typecheck 실행 (에러 예상)**

```bash
npm run build 2>&1 | tail -20
```

Expected: 기존 v1.1 관련 import 에러 다수. 정상 — Task 3~10에서 해결.

- [ ] **Step 4: 커밋**

```bash
git add types/relocation.ts
git commit -m "$(cat <<'EOF'
feat(relocation): types/relocation.ts v1.3 스키마로 교체

zone-simulator /api/optimize (mode=macro) 응답 타입 정의.
- OptimizeMacroRequest/Response
- MoveOrder, ZoneSummary, RegionDelta
- RELOCATION_DEFAULTS + MOVE_ORDER_CSV_HEADERS 상수

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: lib/zone-simulator-client.ts + 테스트 (TDD)

**Files:**
- Create: `lib/zone-simulator-client.ts`
- Create: `lib/zone-simulator-client.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`lib/zone-simulator-client.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { OptimizeMacroRequest, OptimizeMacroResponse } from "@/types/relocation";

// module-scoped cache를 테스트마다 리셋하기 위해 동적 import
async function loadClient() {
  vi.resetModules();
  process.env.ZONE_SIMULATOR_URL = "https://fake-zone-sim";
  process.env.ZONE_SIMULATOR_PASSWORD = "pw";
  return await import("./zone-simulator-client");
}

const REQ: OptimizeMacroRequest = {
  mode: "macro",
  total_transfer: 100,
  max_pct_per_region: 0.2,
  min_cars_per_region: 5,
  top_n: 10,
};

const FAKE_RES: OptimizeMacroResponse = {
  mode: "macro",
  params: REQ,
  summary: {
    actual_transfer: 100,
    delta_rev_yr: 1_000_000_000,
    by_cluster: {},
    total_cost_est: 10_000_000,
    net_gain_yr: 990_000_000,
  },
  suggestions: { increase: [], decrease: [] },
  move_orders: [],
};

function mockFetchSequence(responses: Array<Response | Error>) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

function loginRes() {
  return new Response(null, {
    status: 303,
    headers: { "set-cookie": "session=abc123; Path=/; HttpOnly" },
  });
}

function optimizeOk(body = FAKE_RES) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function optimize401() {
  return new Response("unauthorized", { status: 401 });
}

describe("zone-simulator-client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("첫 호출 시 login + optimize 순차 실행", async () => {
    const fetchMock = mockFetchSequence([loginRes(), optimizeOk()]);
    const { callOptimize } = await loadClient();
    const r = await callOptimize(REQ);
    expect(r.mode).toBe("macro");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/login");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/optimize");
  });

  it("쿠키 캐시 재사용 — 두 번째 호출엔 login 없음", async () => {
    const fetchMock = mockFetchSequence([loginRes(), optimizeOk(), optimizeOk()]);
    const { callOptimize } = await loadClient();
    await callOptimize(REQ);
    await callOptimize(REQ);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.filter((u) => u.endsWith("/login"))).toHaveLength(1);
    expect(urls.filter((u) => u.endsWith("/api/optimize"))).toHaveLength(2);
  });

  it("401 응답 시 자동 재로그인 1회 → 재시도 성공", async () => {
    const fetchMock = mockFetchSequence([
      loginRes(),      // 첫 로그인
      optimize401(),   // 401 → 재로그인 트리거
      loginRes(),      // 재로그인
      optimizeOk(),    // 재시도 성공
    ]);
    const { callOptimize } = await loadClient();
    const r = await callOptimize(REQ);
    expect(r.mode).toBe("macro");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:/Users/socar/googlesheet-dashboard
npm run test -- lib/zone-simulator-client.test.ts 2>&1 | tail -15
```

Expected: `Cannot find module './zone-simulator-client'` 또는 비슷한 에러.

- [ ] **Step 3: `lib/zone-simulator-client.ts` 구현**

```typescript
import type { OptimizeMacroRequest, OptimizeMacroResponse } from "@/types/relocation";

type CachedCookie = { value: string; expiresAt: number };
let cached: CachedCookie | null = null;

async function login(): Promise<string> {
  const base = process.env.ZONE_SIMULATOR_URL;
  const pw = process.env.ZONE_SIMULATOR_PASSWORD;
  if (!base || !pw) throw new Error("ZONE_SIMULATOR_URL/PASSWORD env missing");

  const res = await fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: pw }),
    redirect: "manual",
  });

  const setCookie = res.headers.get("set-cookie");
  if (!setCookie || ![200, 302, 303].includes(res.status)) {
    throw new Error(`zone-simulator login failed: ${res.status}`);
  }
  const match = setCookie.match(/session=([^;]+)/);
  if (!match) throw new Error("session cookie missing in set-cookie");

  const cookieValue = match[1];
  cached = { value: cookieValue, expiresAt: Date.now() + 7 * 3600 * 1000 };
  return cookieValue;
}

async function ensureCookie(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  return login();
}

export async function callOptimize(
  body: OptimizeMacroRequest
): Promise<OptimizeMacroResponse> {
  const base = process.env.ZONE_SIMULATOR_URL;
  if (!base) throw new Error("ZONE_SIMULATOR_URL env missing");
  let cookie = await ensureCookie();

  const doFetch = () =>
    fetch(`${base}/api/optimize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${cookie}`,
      },
      body: JSON.stringify(body),
    });

  let res = await doFetch();
  if (res.status === 401) {
    cached = null;
    cookie = await ensureCookie();
    res = await doFetch();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`zone-simulator /api/optimize ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as OptimizeMacroResponse;
}

// 테스트 전용 (vi.resetModules 대안 — 직접 cache clear 필요 시)
export function __resetCacheForTest() {
  cached = null;
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test -- lib/zone-simulator-client.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: 커밋**

```bash
git add lib/zone-simulator-client.ts lib/zone-simulator-client.test.ts
git commit -m "feat(relocation): ZoneSimulatorClient — 쿠키 프록시 로그인

callOptimize() 호출 시 /login POST → session 쿠키 캐시 → /api/optimize.
401 응답 시 자동 재로그인 1회.
7h 쿠키 캐시 (zone-simulator 8h 만료 보수적 처리).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: app/api/relocation/run/route.ts 교체 + 테스트

**Files:**
- Replace: `app/api/relocation/run/route.ts`
- Create: `app/api/relocation/run/route.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`app/api/relocation/run/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// mock 전에 module path 일치 중요
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/zone-simulator-client", () => ({
  callOptimize: vi.fn(),
}));

import { POST } from "./route";
import { auth } from "@/auth";
import { callOptimize } from "@/lib/zone-simulator-client";

const AUTH_OK = { user: { email: "test@socar.kr" } };

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/relocation/run", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.mocked(auth).mockReset();
  vi.mocked(callOptimize).mockReset();
});

describe("POST /api/relocation/run", () => {
  it("인증 없으면 401", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeReq({ mode: "macro", total_transfer: 100 }));
    expect(res.status).toBe(401);
  });

  it("total_transfer 범위 초과 시 422", async () => {
    vi.mocked(auth).mockResolvedValue(AUTH_OK as never);
    const res = await POST(makeReq({ mode: "macro", total_transfer: 999999 }));
    expect(res.status).toBe(422);
  });

  it("정상 요청 → callOptimize 호출 + 200", async () => {
    vi.mocked(auth).mockResolvedValue(AUTH_OK as never);
    vi.mocked(callOptimize).mockResolvedValue({
      mode: "macro",
      params: {
        mode: "macro", total_transfer: 100,
        max_pct_per_region: 0.2, min_cars_per_region: 5, top_n: 10,
      },
      summary: { actual_transfer: 100, delta_rev_yr: 0, by_cluster: {}, total_cost_est: 0, net_gain_yr: 0 },
      suggestions: { increase: [], decrease: [] },
      move_orders: [],
    });
    const res = await POST(makeReq({ mode: "macro", total_transfer: 100, top_n: 10 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("macro");
    expect(vi.mocked(callOptimize)).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "macro",
        total_transfer: 100,
        top_n: 10,
      })
    );
  });

  it("upstream 실패 시 502", async () => {
    vi.mocked(auth).mockResolvedValue(AUTH_OK as never);
    vi.mocked(callOptimize).mockRejectedValue(new Error("upstream boom"));
    const res = await POST(makeReq({ mode: "macro", total_transfer: 100 }));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm run test -- app/api/relocation/run/route.test.ts 2>&1 | tail -15
```

Expected: `POST is not exported` 또는 기존 v1.1 로직과 불일치 에러.

- [ ] **Step 3: `app/api/relocation/run/route.ts` 전체 교체**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { callOptimize } from "@/lib/zone-simulator-client";
import {
  RELOCATION_DEFAULTS,
  type OptimizeMacroRequest,
} from "@/types/relocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let body: Partial<OptimizeMacroRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const payload: OptimizeMacroRequest = {
    mode: "macro",
    total_transfer: Number.isFinite(body.total_transfer)
      ? Number(body.total_transfer)
      : RELOCATION_DEFAULTS.total_transfer,
    max_pct_per_region: Number.isFinite(body.max_pct_per_region)
      ? Number(body.max_pct_per_region)
      : RELOCATION_DEFAULTS.max_pct_per_region,
    min_cars_per_region: Number.isFinite(body.min_cars_per_region)
      ? Number(body.min_cars_per_region)
      : RELOCATION_DEFAULTS.min_cars_per_region,
    top_n: Number.isFinite(body.top_n)
      ? Number(body.top_n)
      : RELOCATION_DEFAULTS.top_n,
  };

  if (payload.total_transfer < 0 || payload.total_transfer > 10000) {
    return NextResponse.json(
      { error: "total_transfer는 0-10000 범위여야 합니다." },
      { status: 422 }
    );
  }
  if (payload.max_pct_per_region <= 0 || payload.max_pct_per_region > 1) {
    return NextResponse.json(
      { error: "max_pct_per_region는 0-1 범위여야 합니다." },
      { status: 422 }
    );
  }
  if (payload.min_cars_per_region < 0) {
    return NextResponse.json(
      { error: "min_cars_per_region는 0 이상이어야 합니다." },
      { status: 422 }
    );
  }
  if (payload.top_n < 1 || payload.top_n > 200) {
    return NextResponse.json(
      { error: "top_n은 1-200 범위여야 합니다." },
      { status: 422 }
    );
  }

  try {
    const data = await callOptimize(payload);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/relocation/run] upstream error:", msg);
    return NextResponse.json(
      { error: "backend 오류", detail: msg.slice(0, 200) },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test -- app/api/relocation/run/route.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: 커밋**

```bash
git add app/api/relocation/run/route.ts app/api/relocation/run/route.test.ts
git commit -m "feat(relocation): /api/relocation/run → zone-simulator proxy 교체

v1.1 로직 제거, v1.3 Macro API로 전환.
파라미터 검증 (422) + 인증 (401) + upstream 실패 (502).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: v1.1 잔재 파일 삭제

**Files:**
- Delete: `app/api/relocation/candidates/route.ts`
- Delete: `lib/relocation.test.ts`
- Delete: `components/relocation/relocation-chart.tsx`
- Delete: `components/relocation/relocation-table.tsx`
- Delete: `components/relocation/relocation-recommendations.tsx`

- [ ] **Step 1: lib/relocation.ts 존재 여부 확인**

```bash
cd C:/Users/socar/googlesheet-dashboard
ls lib/relocation.ts 2>/dev/null
```

없으면 Step 2로 진행. 있으면 해당 파일도 삭제 대상 (다른 곳에서 참조하지 않으면).

- [ ] **Step 2: 기존 참조 확인**

```bash
grep -rn "relocation-chart\|relocation-table\|relocation-recommendations\|relocation/candidates" \
  --include='*.ts' --include='*.tsx' \
  C:/Users/socar/googlesheet-dashboard \
  | grep -v "docs/superpowers" | head -20
```

Expected: 주로 `components/relocation/relocation-form.tsx` 내부 import만 나옴. 이 파일은 Task 11에서 교체됨.

- [ ] **Step 3: 파일 삭제**

```bash
rm -f C:/Users/socar/googlesheet-dashboard/app/api/relocation/candidates/route.ts
rmdir C:/Users/socar/googlesheet-dashboard/app/api/relocation/candidates 2>/dev/null || true
rm -f C:/Users/socar/googlesheet-dashboard/lib/relocation.test.ts
rm -f C:/Users/socar/googlesheet-dashboard/components/relocation/relocation-chart.tsx
rm -f C:/Users/socar/googlesheet-dashboard/components/relocation/relocation-table.tsx
rm -f C:/Users/socar/googlesheet-dashboard/components/relocation/relocation-recommendations.tsx
```

**주의**: `lib/relocation.ts` 는 존재하면 **이 단계에서는 남겨두세요**. API route가 이미 교체됐으므로 해당 lib의 함수들은 orphan이 되지만, Task 11에서 `relocation-form.tsx` 가 완전히 교체된 뒤 다시 확인.

- [ ] **Step 4: 삭제 커밋**

```bash
cd C:/Users/socar/googlesheet-dashboard
git add -A app/api/relocation/candidates lib/relocation.test.ts components/relocation/relocation-chart.tsx components/relocation/relocation-table.tsx components/relocation/relocation-recommendations.tsx
git status
git commit -m "chore(relocation): v1.1 잔재 파일 삭제

- app/api/relocation/candidates/route.ts: v1.1 전용 엔드포인트
- lib/relocation.test.ts: v1.1 로직 테스트
- components/relocation/{chart,table,recommendations}.tsx: v1.1 UI

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: CsvDownloadButton (헬퍼 컴포넌트)

**Files:**
- Create: `components/relocation/csv-download-button.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export interface CsvDownloadButtonProps<T> {
  data: T[];
  headers: readonly string[];
  rowMapper: (row: T) => Array<string | number | null | undefined>;
  filename: string;
  label?: string;
  disabled?: boolean;
}

function csvEscape(v: unknown): string {
  const str = v == null ? "" : String(v);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function CsvDownloadButton<T>({
  data,
  headers,
  rowMapper,
  filename,
  label = "CSV 다운로드",
  disabled,
}: CsvDownloadButtonProps<T>) {
  function handleClick() {
    const lines = [
      headers.map(csvEscape).join(","),
      ...data.map((row) => rowMapper(row).map(csvEscape).join(",")),
    ];
    // BOM 포함 — Excel 한글 호환
    const csv = "\ufeff" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || data.length === 0}
    >
      <Download className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd C:/Users/socar/googlesheet-dashboard
npx tsc --noEmit components/relocation/csv-download-button.tsx 2>&1 | head -20
```

Expected: lucide-react import 해결되고 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add components/relocation/csv-download-button.tsx
git commit -m "feat(relocation): CsvDownloadButton — Blob URL CSV 다운로드 헬퍼

BOM 포함 (Excel 한글 호환), CRLF 줄바꿈, 필드 쉼표/따옴표 이스케이프.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: RelocationSummaryCards (4-stat)

**Files:**
- Create: `components/relocation/relocation-summary-cards.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```typescript
"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { OptimizeMacroResponse } from "@/types/relocation";

interface Props {
  summary: OptimizeMacroResponse["summary"];
}

function fmtEok(n: number): string {
  const v = n / 1e8;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}억`;
}

function fmtManwon(n: number): string {
  const v = n / 10000;
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}억`;
  return `${Math.round(v).toLocaleString("ko-KR")}만원`;
}

export function RelocationSummaryCards({ summary }: Props) {
  const items = [
    {
      label: "실제 전송",
      value: `${summary.actual_transfer.toFixed(1)}대`,
      hint: "capacity 제약 후 최종 이동 대수",
    },
    {
      label: "연 예상이득",
      value: fmtEok(summary.delta_rev_yr),
      hint: "탁송비 제외 매출 증가 (log-linear)",
    },
    {
      label: "총 탁송비",
      value: fmtManwon(summary.total_cost_est),
      hint: "handler 실측 공식 기반",
    },
    {
      label: "순이득 (탁송비 반영)",
      value: fmtEok(summary.net_gain_yr),
      hint: "연 예상이득 - 총 탁송비",
      emphasize: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {it.label}
            </p>
            <p
              className={
                "mt-2 text-2xl font-bold tabular-nums " +
                (it.emphasize ? "text-foreground" : "text-foreground/90")
              }
            >
              {it.value}
            </p>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {it.hint}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit components/relocation/relocation-summary-cards.tsx 2>&1 | head -10
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add components/relocation/relocation-summary-cards.tsx
git commit -m "feat(relocation): RelocationSummaryCards — 4-stat 요약 카드

실제 전송 / 연 예상이득 / 총 탁송비 / 순이득 (탁송비 반영).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: RelocationClusterBreakdown

**Files:**
- Create: `components/relocation/relocation-cluster-breakdown.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  byCluster: Record<string, number>;
}

const CLUSTER_LABELS: Record<string, string> = {
  metro_core: "메트로 중심",
  metro_periphery: "메트로 외곽",
  tourism: "관광",
  regional: "지방 거점",
  unknown: "미분류",
};

function fmtEok(n: number): string {
  const v = n / 1e8;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}억`;
}

function colorFor(delta: number): "default" | "secondary" | "destructive" {
  if (delta > 0) return "default";
  if (delta < 0) return "destructive";
  return "secondary";
}

export function RelocationClusterBreakdown({ byCluster }: Props) {
  const entries = Object.entries(byCluster).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">클러스터별 영향</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => (
          <Badge key={key} variant={colorFor(value)} className="text-sm py-1 px-3">
            {CLUSTER_LABELS[key] ?? key}:{" "}
            <span className="ml-1 tabular-nums">{fmtEok(value)}</span>
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck + 커밋**

```bash
cd C:/Users/socar/googlesheet-dashboard
npx tsc --noEmit components/relocation/relocation-cluster-breakdown.tsx 2>&1 | head
git add components/relocation/relocation-cluster-breakdown.tsx
git commit -m "feat(relocation): ClusterBreakdown — 클러스터별 delta 뱃지

색상: 증가(default), 감소(destructive), 0(secondary).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: RelocationTopRegions (증설/감축 Top N)

**Files:**
- Create: `components/relocation/relocation-top-regions.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RegionDelta } from "@/types/relocation";

interface Props {
  increase: RegionDelta[];
  decrease: RegionDelta[];
}

function fmtEok(n: number): string {
  const v = n / 1e8;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}억`;
}

function RegionCard({ r, direction }: { r: RegionDelta; direction: "+" | "-" }) {
  const deltaStr =
    r.delta_cars > 0 ? `+${r.delta_cars.toFixed(1)}대` : `${r.delta_cars.toFixed(1)}대`;
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium leading-tight">{r.region1}</p>
          <p className="text-base font-semibold">{r.region2}</p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          α={r.alpha.toFixed(2)}
        </Badge>
      </div>
      <div className="flex items-baseline gap-3 text-sm">
        <span className="text-muted-foreground">{r.cluster}</span>
        <span className="text-muted-foreground">현재 {r.current_cars}대</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className={`text-lg font-bold tabular-nums ${direction === "+" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {deltaStr}
        </span>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {fmtEok(r.delta_rev_yr)}/yr
        </span>
      </div>
    </div>
  );
}

export function RelocationTopRegions({ increase, decrease }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">증설 Top {increase.length}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {increase.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full">증설 대상 없음</p>
          ) : (
            increase.map((r) => (
              <RegionCard key={`${r.region1}-${r.region2}`} r={r} direction="+" />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">감축 Top {decrease.length}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {decrease.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full">감축 대상 없음</p>
          ) : (
            decrease.map((r) => (
              <RegionCard key={`${r.region1}-${r.region2}`} r={r} direction="-" />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
npx tsc --noEmit components/relocation/relocation-top-regions.tsx 2>&1 | head
git add components/relocation/relocation-top-regions.tsx
git commit -m "feat(relocation): TopRegions — 증설/감축 region 카드 그리드

각 카드: region1/region2, α, 현재 대수, Δ대수, 연 Δ매출.
색상: 증설(초록), 감축(빨강).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: RelocationMoveOrdersTable + CSV

**Files:**
- Create: `components/relocation/relocation-move-orders-table.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```typescript
"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CsvDownloadButton } from "./csv-download-button";
import {
  MOVE_ORDER_CSV_HEADERS,
  type MoveOrder,
} from "@/types/relocation";

interface Props {
  moveOrders: MoveOrder[];
}

type SortKey = "order_id" | "cars" | "distance_km" | "cost_est" | "gain_per_year";
type SortDir = "asc" | "desc";

function fmtEok(n: number): string {
  const v = n / 1e8;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}억`;
}

function fmtMan(n: number): string {
  const v = n / 10000;
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}억`;
  return `${Math.round(v).toLocaleString("ko-KR")}만원`;
}

export function RelocationMoveOrdersTable({ moveOrders }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("gain_per_year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const cp = [...moveOrders];
    cp.sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return cp;
  }, [moveOrders, sortKey, sortDir]);

  const totals = useMemo(() => {
    const cars = moveOrders.reduce((s, o) => s + o.cars, 0);
    const cost = moveOrders.reduce((s, o) => s + o.cost_est, 0);
    const gain = moveOrders.reduce((s, o) => s + o.gain_per_year, 0);
    const dist =
      moveOrders.length > 0
        ? moveOrders.reduce((s, o) => s + o.distance_km, 0) / moveOrders.length
        : 0;
    return { cars, cost, gain, dist };
  }, [moveOrders]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "order_id" ? "asc" : "desc");
    }
  }

  function SortHead({ label, k }: { label: string; k: SortKey }) {
    const icon = sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "";
    return (
      <TableHead
        onClick={() => toggleSort(k)}
        className="cursor-pointer select-none hover:text-foreground"
      >
        {label}
        {icon}
      </TableHead>
    );
  }

  if (moveOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">이동 명령</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-border/60 bg-muted/50 px-4 py-6 text-sm text-muted-foreground">
            생성 가능한 이동 명령 없음 (운영 zone 부족 또는 capacity 소진).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          이동 명령 (zone 단위, {moveOrders.length}건)
        </CardTitle>
        <CsvDownloadButton
          data={moveOrders}
          headers={MOVE_ORDER_CSV_HEADERS}
          filename={`배치명령_${new Date().toISOString().slice(0, 10)}.csv`}
          rowMapper={(o) => [
            o.order_id,
            o.src_zone.zone_id,
            o.src_zone.zone_name,
            o.src_zone.region1,
            o.src_zone.region2,
            o.dst_zone.zone_id,
            o.dst_zone.zone_name,
            o.dst_zone.region1,
            o.dst_zone.region2,
            o.cars,
            o.distance_km,
            o.cost_est,
            o.gain_per_year,
          ]}
        />
      </CardHeader>
      <CardContent>
        <div className="max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <SortHead label="순위" k="order_id" />
                <TableHead>출발 존</TableHead>
                <TableHead>도착 존</TableHead>
                <SortHead label="대수" k="cars" />
                <SortHead label="거리" k="distance_km" />
                <SortHead label="탁송비" k="cost_est" />
                <SortHead label="연 이득" k="gain_per_year" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((o) => (
                <TableRow key={o.order_id}>
                  <TableCell className="tabular-nums">{o.order_id}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.src_zone.zone_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.src_zone.region1} · {o.src_zone.region2}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{o.dst_zone.zone_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.dst_zone.region1} · {o.dst_zone.region2}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{o.cars}</TableCell>
                  <TableCell className="tabular-nums">
                    {o.distance_km.toFixed(1)}km
                  </TableCell>
                  <TableCell className="tabular-nums">{fmtMan(o.cost_est)}</TableCell>
                  <TableCell className="tabular-nums font-medium">
                    {fmtEok(o.gain_per_year)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">
                  합계 ({moveOrders.length}건)
                </TableCell>
                <TableCell className="font-semibold tabular-nums">
                  {totals.cars}
                </TableCell>
                <TableCell className="font-semibold tabular-nums">
                  {totals.dist.toFixed(1)}km (평균)
                </TableCell>
                <TableCell className="font-semibold tabular-nums">
                  {fmtMan(totals.cost)}
                </TableCell>
                <TableCell className="font-semibold tabular-nums">
                  {fmtEok(totals.gain)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck + 커밋**

```bash
cd C:/Users/socar/googlesheet-dashboard
npx tsc --noEmit components/relocation/relocation-move-orders-table.tsx 2>&1 | head
git add components/relocation/relocation-move-orders-table.tsx
git commit -m "feat(relocation): MoveOrdersTable — 이동 명령 테이블 + 정렬 + CSV

7컬럼 (순위/출발존/도착존/대수/거리/탁송비/연이득).
thead 클릭 정렬 (client-side), 하단 합계 행, CSV 다운로드 버튼.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: RelocationForm (컨테이너)

**Files:**
- Replace: `components/relocation/relocation-form.tsx`

- [ ] **Step 1: 전체 교체**

기존 `relocation-form.tsx` 전체를 다음으로 교체:

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RelocationSummaryCards } from "./relocation-summary-cards";
import { RelocationClusterBreakdown } from "./relocation-cluster-breakdown";
import { RelocationTopRegions } from "./relocation-top-regions";
import { RelocationMoveOrdersTable } from "./relocation-move-orders-table";
import {
  RELOCATION_DEFAULTS,
  type OptimizeMacroResponse,
} from "@/types/relocation";

export function RelocationForm() {
  const [params, setParams] = useState({
    total_transfer: String(RELOCATION_DEFAULTS.total_transfer),
    max_pct_per_region: String(RELOCATION_DEFAULTS.max_pct_per_region),
    min_cars_per_region: String(RELOCATION_DEFAULTS.min_cars_per_region),
    top_n: String(RELOCATION_DEFAULTS.top_n),
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeMacroResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/relocation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "macro",
          total_transfer: Number(params.total_transfer),
          max_pct_per_region: Number(params.max_pct_per_region),
          min_cars_per_region: Number(params.min_cars_per_region),
          top_n: Number(params.top_n),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "요청 실패");
        setLoading(false);
        return;
      }
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`네트워크 오류: ${msg.slice(0, 100)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      {/* 좌측 필터 패널 */}
      <Card className="self-start">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">시뮬레이션 조건</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="total_transfer">총 이동 대수</Label>
              <Input
                id="total_transfer"
                type="number"
                min={0}
                max={10000}
                value={params.total_transfer}
                onChange={(e) =>
                  setParams({ ...params, total_transfer: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_pct">지역당 상한 (0~1)</Label>
              <Input
                id="max_pct"
                type="number"
                step="0.01"
                min={0.01}
                max={1}
                value={params.max_pct_per_region}
                onChange={(e) =>
                  setParams({ ...params, max_pct_per_region: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min_cars">지역당 최소 유지</Label>
              <Input
                id="min_cars"
                type="number"
                min={0}
                value={params.min_cars_per_region}
                onChange={(e) =>
                  setParams({ ...params, min_cars_per_region: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="top_n">Top N 지역</Label>
              <Input
                id="top_n"
                type="number"
                min={1}
                max={200}
                value={params.top_n}
                onChange={(e) => setParams({ ...params, top_n: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "실행 중..." : "시뮬레이션 실행"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 우측 결과 영역 */}
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        ) : result ? (
          <>
            <RelocationSummaryCards summary={result.summary} />
            <RelocationClusterBreakdown byCluster={result.summary.by_cluster} />
            <RelocationTopRegions
              increase={result.suggestions.increase}
              decrease={result.suggestions.decrease}
            />
            <RelocationMoveOrdersTable moveOrders={result.move_orders} />
          </>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                좌측 파라미터를 확인하고 <b>시뮬레이션 실행</b>을 누르세요.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                기본 파라미터 (500대 / 지역당 20% / 최소 5대 / Top 30) 로 +74억/yr 순이득을 재현합니다.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck 전체**

```bash
cd C:/Users/socar/googlesheet-dashboard
npm run build 2>&1 | tail -30
```

Expected: 이전 v1.1 잔재 에러가 모두 해결됨. 빌드 성공 또는 남아있는 다른 파일의 이슈만.

- [ ] **Step 3: 남은 `lib/relocation.ts` 확인**

```bash
ls lib/relocation.ts 2>/dev/null && echo "still exists" || echo "gone"
grep -rn "from \"@/lib/relocation\"" --include='*.ts' --include='*.tsx' 2>/dev/null | head
```

참조가 없으면 삭제 후 커밋:
```bash
rm -f lib/relocation.ts
git rm -f lib/relocation.ts 2>/dev/null
```

- [ ] **Step 4: 커밋**

```bash
git add components/relocation/relocation-form.tsx lib/relocation.ts 2>/dev/null
git commit -m "feat(relocation): RelocationForm — v1.3 컨테이너 재작성

좌측 280px 필터 패널 (4개 파라미터) + 실행 버튼 +
우측 결과 (SummaryCards → ClusterBreakdown → TopRegions → MoveOrdersTable).
로딩 스켈레톤, 초기 안내, toast 에러 처리.
v1.1 lib/relocation.ts 참조 제거 (orphan 정리).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: `/relocation` 페이지 업데이트

**Files:**
- Modify: `app/(dashboard)/relocation/page.tsx`

- [ ] **Step 1: 제목 / 설명 교체**

```typescript
import { RelocationForm } from "@/components/relocation/relocation-form";

export const metadata = { title: "재배치 추천 | Workspace Portal" };

export default function RelocationPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Relocation
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            재배치 추천 — v1.3 Zone-level 이동 명령
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            클러스터 탄력성(α) + 탁송비 실측 공식 기반 전국 재배치 시뮬레이션.
            189 region2 클러스터 매칭 후 zone 단위 이동 명령을 생성하고 CSV로 배차팀에 전달할 수 있습니다.
          </p>
        </div>
      </section>

      <RelocationForm />
    </div>
  );
}
```

- [ ] **Step 2: 로컬 dev 서버로 확인**

```bash
cd C:/Users/socar/googlesheet-dashboard
npm run dev
```

브라우저 http://localhost:3000/relocation 접속 (필요 시 NextAuth 로그인). 아래 확인:
- 제목 "재배치 추천 — v1.3 Zone-level 이동 명령"
- 좌측 파라미터 폼 + 실행 버튼
- 우측 초기 안내 카드
- 실행 → skeleton → 결과 (시뮬레이션 요약/클러스터/Top N/이동 명령)

Dev 서버 Ctrl+C로 종료.

- [ ] **Step 3: 커밋**

```bash
git add app/(dashboard)/relocation/page.tsx
git commit -m "feat(relocation): page.tsx 제목/설명 v1.3으로 업데이트

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: 최종 검증 + 전체 테스트

**Files:** (작업 파일 없음)

- [ ] **Step 1: 전체 단위 테스트**

```bash
cd C:/Users/socar/googlesheet-dashboard
npm run test 2>&1 | tail -20
```

Expected: 모든 테스트 PASS. 특히 아래 신규 파일:
- `lib/zone-simulator-client.test.ts` (3건)
- `app/api/relocation/run/route.test.ts` (4건)

- [ ] **Step 2: Typecheck + Lint**

```bash
npm run build 2>&1 | tail -20
npm run lint 2>&1 | tail -20
```

Expected: 양쪽 모두 에러 없음.

- [ ] **Step 3: dev 서버 수동 스모크**

```bash
npm run dev
```

브라우저:
1. `/` → 로그인
2. 좌측 네비 "재배치 추천" 클릭
3. 기본 파라미터 그대로 **시뮬레이션 실행**
4. 결과 확인:
   - 실제 전송 418.2대
   - 순이득 +73.9억
   - 이동 명령 299건
5. "CSV 다운로드" → 배치명령_YYYY-MM-DD.csv 저장 → Excel 열어 한글 확인

- [ ] **Step 4: 스크린샷 캡처 (선택)**

결과 화면 스크린샷 1장을 `docs/screenshots/relocation-v13.png` 로 저장해 PR에 첨부 가능.

- [ ] **Step 5: 커밋 없음** — 확인만.

---

## Task 14: PR 생성 + Vercel Preview 배포

**Files:** (GitHub + Vercel)

- [ ] **Step 1: 원격 브랜치 push**

```bash
cd C:/Users/socar/googlesheet-dashboard
git push -u origin feature/relocation-v13-integration
```

Expected: new branch created 메시지. Vercel이 자동으로 Preview 배포 시작.

- [ ] **Step 2: Vercel 환경변수 추가 (Preview + Production)**

```bash
# Vercel CLI 필요 (없으면 웹 대시보드 사용)
vercel env add ZONE_SIMULATOR_URL preview
# 입력: https://zone-simulator-975221354422.asia-northeast3.run.app

vercel env add ZONE_SIMULATOR_PASSWORD preview
# 입력: hodo

vercel env add ZONE_SIMULATOR_URL production
vercel env add ZONE_SIMULATOR_PASSWORD production
```

**또는 웹 대시보드**: Vercel 프로젝트 `gu-dashboard` → Settings → Environment Variables → 두 변수 `Preview` + `Production` 범위로 추가.

- [ ] **Step 3: Preview 재배포 (env vars 반영)**

```bash
vercel --prod=false
# 또는 웹 대시보드에서 Deployments → 최신 preview → Redeploy
```

Expected: 새 preview URL 생성. 환경변수 설정 후 배포되므로 런타임 접근 가능.

- [ ] **Step 4: Preview URL 스모크**

Preview URL 브라우저 접속 → NextAuth 로그인 → `/relocation` → 시뮬레이션 실행 → 정상 동작 확인.

- [ ] **Step 5: GitHub PR 생성**

```bash
gh pr create --title "feat(relocation): v1.3 zone-simulator 통합" --body "$(cat <<'EOF'
## Summary
- `/relocation` 페이지를 v1.3 zone-simulator Macro API 기반 UI로 전면 교체
- 클러스터 α + 탁송비 반영 순이득 + zone-level 이동 명령 299건 + CSV 다운로드
- 신차 배분 페이지와 동일한 design system 적용

## 주요 변경
- `lib/zone-simulator-client.ts`: 쿠키 프록시 로그인 + 자동 재로그인
- `app/api/relocation/run/route.ts`: v1.1 로직 제거, proxy로 교체
- `components/relocation/*`: 기존 4개 삭제, 신규 6개 생성
- `types/relocation.ts`: v1.3 스키마로 교체

## Test Plan
- [x] 유닛 테스트 7건 (client 3 + route 4) 전부 PASS
- [x] `npm run build` / `npm run lint` 통과
- [x] 로컬 dev 스모크: 기본 파라미터로 +73.9억 순이득 재현
- [x] Preview 배포 + 수동 확인
- [ ] 프로덕션 배포 후 실제 사용

## 관련
- Zone-simulator v1.3 본체: socar-hodo/newcar feature/zone-simulator (commit 9007e1a)
- Spec: `docs/superpowers/specs/2026-04-18-relocation-v13-integration-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-relocation-v13-integration.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

PR URL 출력됨.

---

## Task 15: Production 머지 + 배포 + 문서 업데이트

**Files:**
- Obsidian: `Projects/호도-대시보드-통합.md` (파일 편집)
- Obsidian: `Decisions/2026-04-18-세션회고-차량재배치-v1.0-to-v1.3.md` (append)

- [ ] **Step 1: PR 승인 → main 머지 (수동)**

Vercel이 자동으로 production 배포.

- [ ] **Step 2: Production URL 검증**

https://gu-dashboard.vercel.app/relocation 접속 → 시뮬레이션 실행 → +73.9억 확인.

- [ ] **Step 3: Obsidian 업데이트**

`C:/Users/socar/Desktop/mongsil/Projects/호도-대시보드-통합.md` 하단에 섹션 추가:

```markdown

---

## /relocation 페이지 v1.3 통합 (2026-04-18)

- 기존 v1.1 가동률·매출·사전예약 weight 기반 로직 전면 교체
- v1.3 zone-simulator `/api/optimize` (mode=macro) 프록시 호출
- 결과: 클러스터 α + 탁송비 반영 순이득 +73.9억 + 이동 명령 299건 + CSV 다운로드
- 신차 배분 페이지와 동일한 design system

### 관련
- Zone-simulator v1.3: `zone-simulator-00011-4cz` (prod)
- Spec: `docs/superpowers/specs/2026-04-18-relocation-v13-integration-design.md`
```

`Decisions/2026-04-18-세션회고-차량재배치-v1.0-to-v1.3.md` 에 "Phase 4" 섹션 append (Phase 3 뒤):

```markdown

### Phase 4 — 호도 대시보드 /relocation 통합 (저녁)

zone-simulator 프로덕션 배포 후, 호도 대시보드 재배치 추천 페이지에 v1.3 Macro UI 통합.

**15개 태스크 실행**:
- types 교체, ZoneSimulatorClient 신설 (쿠키 프록시)
- /api/relocation/run 전면 재작성
- 기존 v1.1 컴포넌트 4개 삭제, 신규 6개 생성
- Vercel Preview + Production 배포

**결과**: 호도 대시보드 `/relocation` 에서 바로 v1.3 Macro 실행 가능
- URL: https://gu-dashboard.vercel.app/relocation
- 요약 카드 4장 + 클러스터별 영향 + 증설/감축 Top 30 + 이동 명령 테이블 + CSV
```

- [ ] **Step 4: 최종 커밋 (documentation update는 Obsidian 파일 직접 수정이므로 gu-dashboard git과 무관)**

끝.

---

## Self-Review 결과

**1. Spec coverage**
- Section 2 아키텍처 → Task 2-4 (types + client + route) ✓
- Section 3 ZoneSimulatorClient → Task 3 ✓
- Section 4 API Route → Task 4 ✓
- Section 5 UI 컴포넌트 → Task 6-12 ✓
- Section 6 테스트 → Task 3, 4 (유닛), Task 13 (수동 E2E) ✓
- Section 7 배포 플랜 → Task 14-15 ✓
- Section 8 리스크 → 각 태스크 Step에 반영 (runtime=nodejs, env vars, cold start 로딩 skeleton)
- Section 9 DoD → Task 14-15 완료 시점

**2. Placeholder scan**
- "TBD", "TODO" 없음 ✓
- 모든 code step에 완전한 코드 ✓
- "similar to" 없음 ✓

**3. Type/signature consistency**
- `OptimizeMacroRequest/Response` — Task 2 정의 → Task 3 client, Task 4 route, Task 11 form 모두 동일 ✓
- `MoveOrder`, `ZoneSummary`, `RegionDelta` — Task 2 정의 → Task 9, 10 props 타입 일관 ✓
- `MOVE_ORDER_CSV_HEADERS` — Task 2 정의, Task 10 사용 ✓
- `callOptimize` 시그니처 — Task 3 정의, Task 4 호출 동일 ✓
- `withAuth` 패턴 — gu-dashboard 기존 컨벤션, Task 4 재확인 (주의: Task 4는 `withAuth` 대신 직접 `auth()` 사용 중 → Spec에서 `withAuth` 언급했으나 Task 4는 직접 호출 방식. 일관성 위해 Task 4 재검토 필요)

이슈 발견: Task 4의 구현이 `withAuth` 헬퍼를 사용하지 않고 직접 `auth()` 호출함. gu-dashboard의 기존 allocation route는 `withAuth` 사용. 인라인 수정:

수정 내용: Task 4 Step 3 구현 코드를 `withAuth` 기반으로 재작성. 아래는 수정 후 코드:

```typescript
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { callOptimize } from "@/lib/zone-simulator-client";
import {
  RELOCATION_DEFAULTS,
  type OptimizeMacroRequest,
} from "@/types/relocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(async (req) => {
  let body: Partial<OptimizeMacroRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const payload: OptimizeMacroRequest = {
    mode: "macro",
    total_transfer: Number.isFinite(body.total_transfer)
      ? Number(body.total_transfer)
      : RELOCATION_DEFAULTS.total_transfer,
    max_pct_per_region: Number.isFinite(body.max_pct_per_region)
      ? Number(body.max_pct_per_region)
      : RELOCATION_DEFAULTS.max_pct_per_region,
    min_cars_per_region: Number.isFinite(body.min_cars_per_region)
      ? Number(body.min_cars_per_region)
      : RELOCATION_DEFAULTS.min_cars_per_region,
    top_n: Number.isFinite(body.top_n)
      ? Number(body.top_n)
      : RELOCATION_DEFAULTS.top_n,
  };

  if (payload.total_transfer < 0 || payload.total_transfer > 10000) {
    return NextResponse.json(
      { error: "total_transfer는 0-10000 범위여야 합니다." },
      { status: 422 }
    );
  }
  if (payload.max_pct_per_region <= 0 || payload.max_pct_per_region > 1) {
    return NextResponse.json(
      { error: "max_pct_per_region는 0-1 범위여야 합니다." },
      { status: 422 }
    );
  }
  if (payload.min_cars_per_region < 0) {
    return NextResponse.json(
      { error: "min_cars_per_region는 0 이상이어야 합니다." },
      { status: 422 }
    );
  }
  if (payload.top_n < 1 || payload.top_n > 200) {
    return NextResponse.json(
      { error: "top_n은 1-200 범위여야 합니다." },
      { status: 422 }
    );
  }

  try {
    const data = await callOptimize(payload);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/relocation/run] upstream error:", msg);
    return NextResponse.json(
      { error: "backend 오류", detail: msg.slice(0, 200) },
      { status: 502 }
    );
  }
});
```

그리고 Task 4 Step 1 테스트의 `vi.mock("@/auth", ...)` 부분도 `withAuth`를 감안해 수정:

```typescript
vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    withAuth: (handler: (req: Request, ctx: { session: unknown }) => unknown) => {
      return async (req: Request) => {
        // Test helper: auth passes always, error path handled by mock result
        return handler(req, { session: { user: { email: "test@socar.kr" } } });
      };
    },
  };
});
```

Task 4 테스트 케이스는 이에 맞춰 401 시나리오만 별도 처리:

```typescript
it("인증 없으면 401 (withAuth 내부 처리)", async () => {
  // withAuth mock을 해제하고 인증 실패 시뮬
  vi.doMock("@/lib/api-utils", () => ({
    withAuth: (handler: unknown) => async () =>
      NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }),
  }));
  // ... 등 별도 describe block
});
```

→ 실제로는 이런 복잡성 대신 withAuth를 유지하고 **인증 케이스 테스트는 생략** (withAuth 자체의 책임)하는 편이 깔끔. Task 4 Step 1 최종 테스트에서 "인증 없으면 401" 케이스는 제거하고 대신 `withAuth`를 신뢰. 테스트 개수가 3으로 줄어들어도 OK.

**최종 Task 4 Step 1 테스트 (인증 케이스 제거, 3건)**:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/api-utils", () => ({
  // withAuth를 identity-wrapper로 만들어 authenticated session 주입
  withAuth: (handler: (req: NextRequest, ctx: { session: unknown }) => Promise<NextResponse>) => {
    return async (req: NextRequest) =>
      handler(req, { session: { user: { email: "test@socar.kr" } } });
  },
}));
vi.mock("@/lib/zone-simulator-client", () => ({
  callOptimize: vi.fn(),
}));

import { POST } from "./route";
import { callOptimize } from "@/lib/zone-simulator-client";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/relocation/run", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.mocked(callOptimize).mockReset();
});

describe("POST /api/relocation/run", () => {
  it("total_transfer 범위 초과 시 422", async () => {
    const res = await POST(makeReq({ mode: "macro", total_transfer: 999999 }));
    expect(res.status).toBe(422);
  });

  it("정상 요청 → callOptimize 호출 + 200", async () => {
    vi.mocked(callOptimize).mockResolvedValue({
      mode: "macro",
      params: {
        mode: "macro", total_transfer: 100,
        max_pct_per_region: 0.2, min_cars_per_region: 5, top_n: 10,
      },
      summary: {
        actual_transfer: 100,
        delta_rev_yr: 0,
        by_cluster: {},
        total_cost_est: 0,
        net_gain_yr: 0,
      },
      suggestions: { increase: [], decrease: [] },
      move_orders: [],
    });
    const res = await POST(makeReq({ mode: "macro", total_transfer: 100, top_n: 10 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("macro");
    expect(vi.mocked(callOptimize)).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "macro", total_transfer: 100, top_n: 10 })
    );
  });

  it("upstream 실패 시 502", async () => {
    vi.mocked(callOptimize).mockRejectedValue(new Error("upstream boom"));
    const res = await POST(makeReq({ mode: "macro", total_transfer: 100 }));
    expect(res.status).toBe(502);
  });
});
```

위 두 개의 코드 블록(Task 4 Step 3 route 구현 + Task 4 Step 1 테스트)을 **실제 실행 시 반드시 위의 최신 버전으로 사용하세요**. 플랜 본문의 초안 버전은 self-review에서 발견된 `withAuth` 일관성 이슈로 대체됩니다.

다른 섹션은 이슈 없음.

---

## 실행 방식 선택

Plan complete and saved to `docs/superpowers/plans/2026-04-18-relocation-v13-integration.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
