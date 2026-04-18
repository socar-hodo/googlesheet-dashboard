# 호도 대시보드 재배치 추천 v1.3 통합 설계

**작성일**: 2026-04-18
**작성자**: hodo (부울경사업팀)
**상태**: Draft (브레인스토밍 완료)
**관련 문서**:
- zone-simulator repo: `docs/superpowers/specs/2026-04-18-zone-simulator-zone-reallocation-v13-design.md` (v1.3 백엔드)
- `_workspace/…` (gu-dashboard allocation 패턴 참고)

---

## 1. 배경 및 동기

### 1.1 현재 상태

- **gu-dashboard**(`/relocation`): v1.1 가동률·매출·사전예약 weight 기반 재배치 추천. `RelocationForm` 290줄, 자체 API (`/api/relocation/run`).
- **zone-simulator**(프로덕션 `zone-simulator-00011-4cz`): v1.3 Macro는 `/api/optimize`로 클러스터 α + 탁송비 + zone-level 이동 명령 299건 생성 (+74.0억 재현, 순이득 +73.9억).
- **네비게이션 위치**: 호도 대시보드 좌측 "재배치 추천" 메뉴가 이미 존재.

### 1.2 목표

호도 대시보드 `/relocation` 페이지를 **v1.3 zone-simulator Macro API를 소비하는 UI**로 전면 교체. 신차 배분 페이지와 동일한 design system(요약 카드 + 카드 그리드 + 테이블 + CSV)으로 일관성 확보.

### 1.3 비목표

- v1.3 백엔드 로직 변경 (zone-simulator는 그대로, 재배포 없음)
- region1 include/exclude 필터 추가 (v1.4 후보)
- 차종별 재배치 (v1.4)
- 지도 시각화 (텍스트/테이블 중심)

---

## 2. 아키텍처

```
호도 대시보드 (Next.js 16, gu-dashboard, Vercel)
├─ app/(dashboard)/relocation/page.tsx  ← 진입 (UI 전면 교체)
├─ components/relocation/ (기존 4개 삭제, 신규 6개 생성)
├─ app/api/relocation/run/route.ts  ← 교체 (v1.1 로직 제거, proxy)
├─ lib/zone-simulator-client.ts  ← 신규 (쿠키 프록시 로그인 + API 호출)
└─ types/relocation.ts  ← 교체 (v1.3 응답 스키마)
         ↓
zone-simulator (Cloud Run, 변경 없음)
└─ /login (POST password) + /api/optimize (POST mode=macro)
```

### 2.1 데이터 흐름

1. 사용자가 `/relocation` 진입 → 4개 파라미터 입력 (total_transfer, max_pct, min_cars, top_n)
2. "시뮬레이션 실행" 클릭 → `POST /api/relocation/run` (gu-dashboard 자체)
3. API route가 NextAuth 세션 검증 → 유효 시 zone-simulator 호출
4. `ZoneSimulatorClient`: 쿠키 캐시 확인 → 없거나 만료면 `/login` POST 로 세션 획득
5. `/api/optimize` 호출 (`mode: "macro"` + 파라미터)
6. 응답을 그대로 pass-through (shape 일치)
7. 클라이언트: summary cards + cluster breakdown + top N cards + move_orders table 렌더

### 2.2 모듈 책임

| 파일 | 유형 | 책임 |
|---|---|---|
| `lib/zone-simulator-client.ts` | 신규 | 쿠키 캐시 + 자동 로그인 + `/api/optimize` 호출 |
| `types/relocation.ts` | 교체 | v1.3 OptimizeMacroRequest/Response 타입 |
| `app/api/relocation/run/route.ts` | 교체 | 인증 + 파라미터 검증 + client 호출 |
| `app/api/relocation/candidates/route.ts` | 삭제 | v1.1 로직, 더 이상 필요 없음 |
| `app/(dashboard)/relocation/page.tsx` | 교체 | 제목 섹션 + `<RelocationForm />` |
| `components/relocation/relocation-form.tsx` | 신규 | 좌측 필터 + 실행 + 결과 집계 |
| `components/relocation/relocation-summary-cards.tsx` | 신규 | 상단 4-stat 카드 |
| `components/relocation/relocation-cluster-breakdown.tsx` | 신규 | 클러스터별 영향 |
| `components/relocation/relocation-top-regions.tsx` | 신규 | 증설/감축 Top N 카드 그리드 |
| `components/relocation/relocation-move-orders-table.tsx` | 신규 | 이동 명령 테이블 + CSV |
| `components/relocation/csv-download-button.tsx` | 신규 | Blob 다운로드 (재활용) |
| `components/relocation/{relocation-chart,relocation-table,relocation-recommendations}.tsx` | 삭제 | v1.1 컴포넌트 |

---

## 3. ZoneSimulatorClient (인증 프록시)

### 3.1 공개 인터페이스

```typescript
// lib/zone-simulator-client.ts
export async function callOptimize(
  body: OptimizeMacroRequest
): Promise<OptimizeMacroResponse>;
```

### 3.2 내부 구현

```typescript
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
  if (!setCookie || ![200, 303, 302].includes(res.status)) {
    throw new Error(`zone-simulator login failed: ${res.status}`);
  }
  const match = setCookie.match(/session=([^;]+)/);
  if (!match) throw new Error("session cookie missing");

  const cookieValue = match[1];
  // zone-simulator 쿠키 8h 만료 → 보수적으로 7h 캐시
  cached = { value: cookieValue, expiresAt: Date.now() + 7 * 3600 * 1000 };
  return cookieValue;
}

async function ensureCookie(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  return login();
}

export async function callOptimize(body: OptimizeMacroRequest): Promise<OptimizeMacroResponse> {
  const base = process.env.ZONE_SIMULATOR_URL!;
  let cookie = await ensureCookie();

  const doFetch = () =>
    fetch(`${base}/api/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${cookie}` },
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
  return res.json();
}
```

### 3.3 환경변수 (Vercel 등록 필요)

- `ZONE_SIMULATOR_URL`: `https://zone-simulator-975221354422.asia-northeast3.run.app`
- `ZONE_SIMULATOR_PASSWORD`: `hodo`
- **`NEXT_PUBLIC_*` 금지** — 서버 전용

### 3.4 타입 정의 (`types/relocation.ts`)

```typescript
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
```

### 3.5 에러 처리

| 상황 | 동작 |
|---|---|
| 환경변수 누락 | API route 500 + "backend 설정 오류" (로그 기록) |
| 로그인 실패 (password 오류) | 500 + "backend 인증 실패" (로그 기록) |
| 쿠키 만료 | 자동 1회 재로그인 재시도 → 실패 시 401 그대로 |
| zone-simulator 5xx | 502 + "backend 일시 오류" |
| Timeout | 504 + "응답 지연" (기본 60초) |

---

## 4. API Route (`app/api/relocation/run/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callOptimize } from "@/lib/zone-simulator-client";
import type { OptimizeMacroRequest } from "@/types/relocation";

const DEFAULTS = {
  total_transfer: 500,
  max_pct_per_region: 0.20,
  min_cars_per_region: 5,
  top_n: 30,
} as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Partial<OptimizeMacroRequest>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const payload: OptimizeMacroRequest = {
    mode: "macro",
    total_transfer: Number.isFinite(body.total_transfer) ? Number(body.total_transfer) : DEFAULTS.total_transfer,
    max_pct_per_region: Number.isFinite(body.max_pct_per_region) ? Number(body.max_pct_per_region) : DEFAULTS.max_pct_per_region,
    min_cars_per_region: Number.isFinite(body.min_cars_per_region) ? Number(body.min_cars_per_region) : DEFAULTS.min_cars_per_region,
    top_n: Number.isFinite(body.top_n) ? Number(body.top_n) : DEFAULTS.top_n,
  };

  if (payload.total_transfer < 0 || payload.total_transfer > 10000)
    return NextResponse.json({ error: "total_transfer는 0-10000 범위" }, { status: 422 });
  if (payload.max_pct_per_region <= 0 || payload.max_pct_per_region > 1)
    return NextResponse.json({ error: "max_pct_per_region는 0-1 범위" }, { status: 422 });
  if (payload.min_cars_per_region < 0)
    return NextResponse.json({ error: "min_cars_per_region는 0 이상" }, { status: 422 });
  if (payload.top_n < 1 || payload.top_n > 200)
    return NextResponse.json({ error: "top_n은 1-200 범위" }, { status: 422 });

  try {
    const data = await callOptimize(payload);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[relocation/run] upstream error:", msg);
    return NextResponse.json({ error: "backend 오류", detail: msg.slice(0, 200) }, { status: 502 });
  }
}
```

---

## 5. UI 컴포넌트

### 5.1 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ RELOCATION                                       [🌙] [avatar] │
│ # 재배치 추천 — v1.3 Zone-level 이동 명령                     │
│ p: 클러스터 α + 탁송비 반영 순이득 기반 최적 재배치           │
├─────────────────────────────────────────────────────────────┤
│ [좌측 280px 필터]  │  [우측: 요약카드 4장 → 클러스터별       │
│  총 이동 대수      │   영향 → 증설/감축 Top N → 이동 명령    │
│  지역당 상한%      │   테이블 + CSV]                         │
│  최소 유지대수     │                                          │
│  Top N            │                                          │
│  [실행]            │                                          │
└─────────────────────────────────────────────────────────────┘
```

모바일: `md:grid-cols-[280px_1fr]` 이하에서 stack.

### 5.2 컴포넌트 간 책임

| 컴포넌트 | 책임 | props |
|---|---|---|
| `RelocationForm` | 입력 state 관리 + API 호출 + 하위 컴포넌트 조립 | 없음 |
| `RelocationSummaryCards` | 4-stat 카드 (actual_transfer/delta_rev_yr/total_cost_est/net_gain_yr) | `summary` |
| `RelocationClusterBreakdown` | 클러스터별 delta 표시 | `by_cluster` |
| `RelocationTopRegions` | 증설/감축 Top N 카드 그리드 | `increase`, `decrease` |
| `RelocationMoveOrdersTable` | 이동 명령 테이블 + thead 정렬 + CSV 버튼 | `moveOrders` |
| `CsvDownloadButton` | Blob URL 다운로드 | `data`, `filename`, `headers` |

### 5.3 디자인 토큰 (allocation 패턴 재사용)

- 페이지 제목: `text-3xl font-semibold tracking-[-0.05em]`
- 섹션 카드: `rounded-[1.75rem] border border-border/60 bg-card/90 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]`
- 카테고리 label: `text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground`
- 수치 강조: `text-2xl font-bold tabular-nums`
- 배지: shadcn `Badge` (variant에 따라 클러스터별 색상)

### 5.4 상태 처리

| 상태 | UI |
|---|---|
| 초기 | 필터만 표시, 우측 "시뮬레이션을 실행해주세요" 안내 |
| 로딩 | 우측 영역 Skeleton 4장 + 하단 테이블 skeleton |
| 성공 | 전체 결과 렌더 |
| 에러 | toast (sonner) + 우측 영역 숨김 유지 |
| 빈 결과 (move_orders=0) | Alert: "생성 가능한 이동 명령 없음 (운영 zone 부족)" |

### 5.5 이동 명령 테이블

**컬럼**: 순위 / 출발 존 / 도착 존 / 대수 / 거리 / 탁송비 / 연 이득

- 존 셀: zone_name 주, region1·region2 부 (작은 글씨 `text-muted-foreground`)
- thead 클릭 → 정렬 전환 (순위/대수/거리/탁송비/연이득, 기본 gain_per_year desc)
- 하단 tfoot: 합계 행 (총 대수, 평균 거리, 총 비용, 총 이득)
- `overflow-y: auto`, max-height 400~500px
- "CSV 다운로드" 버튼 — `배치명령_YYYY-MM-DD.csv`, BOM 포함, 13 컬럼

---

## 6. 테스트

### 6.1 유닛

- `lib/__tests__/zone-simulator-client.test.ts`:
  - 첫 호출 시 login + fetch 순차
  - 캐시 재사용 (login mock 호출 횟수 확인)
  - 401 시 자동 재로그인 1회
- `app/api/relocation/__tests__/run.test.ts`:
  - 인증 없음 → 401
  - 파라미터 범위 초과 → 422
  - upstream mock 성공 → 200 + shape 확인
  - upstream 실패 → 502

### 6.2 E2E (Playwright)

- `/relocation` 페이지 진입
- 필터 입력 + 실행
- 요약 카드 4장 렌더
- 이동 명령 테이블 > 0 rows
- CSV 다운로드 버튼 클릭 (파일 저장 확인)

### 6.3 수동 스모크 (Preview/Production)

- 다양한 파라미터 조합 (total=100/500/1000, top_n=10/30)
- CSV 파일 Excel에서 한글 표시 확인
- 다크 모드 전환 시 레이아웃 깨짐 없는지

---

## 7. 배포 플랜

1. Feature branch: `feature/relocation-v13-integration`
2. 로컬 `npm run dev` + 수동 확인
3. Vercel PR preview 자동 배포 → preview URL 생성
4. **Vercel 환경변수 추가** (Preview + Production 범위):
   - `ZONE_SIMULATOR_URL`
   - `ZONE_SIMULATOR_PASSWORD`
5. Preview URL 수동 검증 (파라미터 변경 시뮬)
6. `main` merge → Production 자동 배포
7. 프로덕션 스모크: `https://gu-dashboard.vercel.app/relocation`
8. 팀 공유

---

## 8. 리스크 및 대응

| 리스크 | 확률 | 영향 | 대응 |
|---|---|---|---|
| zone-simulator cold start | 중 | 중 | 첫 요청 ~10초 — 로딩 skeleton 명확히, timeout 60초 |
| 쿠키 in-memory 캐시 race | 낮음 | 낮음 | login이 idempotent — race 발생해도 결과 같음 |
| Edge runtime 실수 | 중 | 높 | `export const runtime = "nodejs"` 명시 |
| Vercel env 누락 | 중 | 치명 | 배포 전 체크리스트 (memory 참조) |
| Password 노출 | 낮음 | 높 | 서버 전용 환경변수, `NEXT_PUBLIC_*` 금지 |
| zone-simulator API 스키마 변경 | 낮음 | 높 | types 수동 동기화, 불일치 시 컴파일 에러로 조기 감지 |
| 기존 컴포넌트 import 깨짐 | 중 | 중 | grep `from "@/components/relocation` 으로 모든 참조 찾아 삭제 |
| UI 디자인 system 불일치 | 낮음 | 중 | allocation 패턴 그대로 복사, Tailwind 토큰 재사용 |

---

## 9. 완료 기준 (DoD)

- [ ] `lib/zone-simulator-client.ts` + 3 테스트 PASS
- [ ] `types/relocation.ts` v1.3 스키마 정의
- [ ] `app/api/relocation/run/route.ts` 교체 + 4 테스트 PASS
- [ ] `app/api/relocation/candidates/route.ts` 삭제
- [ ] `components/relocation/*.tsx` 기존 4개 삭제
- [ ] 신규 UI 컴포넌트 6개 생성
- [ ] `/relocation` 페이지 렌더 확인
- [ ] E2E 스모크 1건 이상
- [ ] `npm run typecheck` + `npm run lint` PASS
- [ ] Vercel env 추가 + Preview 검증
- [ ] Production 배포 + 스모크
- [ ] Obsidian `Projects/호도-대시보드-통합.md` 또는 `Zone-시뮬레이터.md` 업데이트
