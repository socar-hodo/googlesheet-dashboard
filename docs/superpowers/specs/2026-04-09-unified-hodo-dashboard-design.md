# 호도 대시보드 통합 설계

**작성일:** 2026-04-09
**목적:** 분산된 3개 앱(ROAS 시뮬레이터, 존 시뮬레이터, googlesheet-dashboard)을 하나의 Next.js 앱으로 통합
**앱 이름:** 호도 대시보드

---

## 1. 배경

현재 쏘카 지역사업팀 도구가 3곳에 분산되어 있다:

| 위치 | 스택 | 기능 |
|------|------|------|
| `socar/roas-simulator/` | FastAPI + Vanilla JS | 쿠폰 ROAS 시뮬레이션, 캠페인 분석 |
| `socar/zone-simulator/` | FastAPI + Vanilla JS | 존 개설/폐쇄/비교/최적화 (카카오맵) |
| `googlesheet-dashboard/` | Next.js 16 + React 19 + shadcn/ui | KPI 대시보드, 신차배분, 재배치, 워크스페이스 |

문제: 프로젝트 간 탐색이 어렵고, 기술 스택이 혼재하며, 인증/BQ 클라이언트가 중복 구현되어 있다.

**결정:** `googlesheet-dashboard`를 베이스 앱으로 삼고, ROAS/Zone 시뮬레이터를 Next.js API Routes + React 컴포넌트로 이관한다.

---

## 2. 기술 접근

**A안 채택: SQL 파일 + Next.js API Routes**

- Python `bq.py`의 인라인 SQL을 `.sql` 파일로 추출
- Next.js API Routes에서 기존 `lib/bigquery.ts`의 `runQuery()`로 실행
- Python 비즈니스 로직(geo.py, crosstab, verdict 등)은 TypeScript로 포팅
- Chart.js → Recharts 전환 (기존 dashboard와 통일)
- UI는 shadcn/ui 기반으로 새로 디자인

---

## 3. 라우팅 구조

```
app/
├── (auth)/login/                        ← 기존 유지
├── (dashboard)/
│   ├── dashboard/                       ← 기존: KPI 대시보드
│   ├── work-history/                    ← 기존: 워크스페이스 (투두/메모/드라이브)
│   ├── allocation/                      ← 기존: 신차 배분
│   ├── relocation/                      ← 기존: 재배치
│   ├── roas/                            ← 신규: ROAS 시뮬레이터
│   │   ├── page.tsx                     ← 시뮬레이션 실행
│   │   └── analysis/page.tsx            ← 캠페인 분석
│   └── zone/                            ← 신규: 존 시뮬레이터
│       └── page.tsx                     ← 카카오맵 + 4모드 패널
├── api/
│   ├── roas/                            ← 신규: ROAS API (15개 엔드포인트)
│   │   ├── regions/route.ts
│   │   ├── zones/route.ts
│   │   ├── performance/route.ts
│   │   ├── campaigns/route.ts
│   │   ├── campaign/detail/route.ts
│   │   ├── campaign/impact/route.ts
│   │   ├── campaign/vs-forecast/route.ts
│   │   └── scenarios/route.ts
│   └── zone/                            ← 신규: Zone API (7개 엔드포인트)
│       ├── zones/route.ts
│       ├── simulate/open/route.ts
│       ├── simulate/close/route.ts
│       ├── compare/route.ts
│       ├── optimize/route.ts
│       ├── scenarios/route.ts
│       └── report/route.ts
```

---

## 4. 데이터 레이어

```
sql/
├── allocation.sql                ← 기존
├── allocation_r2.sql             ← 기존
├── relocation.sql                ← 기존
├── relocation-candidates.sql     ← 기존
├── roas/                         ← 신규: ROAS SQL (8개 파일)
│   ├── regions.sql
│   ├── zones.sql
│   ├── performance.sql
│   ├── campaigns.sql
│   ├── campaign-detail.sql
│   ├── campaign-impact.sql
│   ├── campaign-vs-forecast.sql
│   └── scenarios.sql
└── zone/                         ← 신규: Zone SQL (5개 파일)
    ├── zones-with-coords.sql
    ├── simulate-open.sql
    ├── simulate-close.sql
    ├── compare.sql
    └── optimize.sql

lib/
├── bigquery.ts                   ← 기존: runQuery() 공통 래퍼
├── roas.ts                       ← 신규: crosstab 변환, verdict 계산, 상수
├── zone-geo.ts                   ← 신규: haversine, 카니발리제이션, 수요이전
└── zone.ts                       ← 신규: 벤치마크, 클러스터 비교 헬퍼
```

**원칙:**
- SQL은 `.sql` 파일에 분리, API Route에서 파라미터 바인딩 후 `runQuery()` 호출
- `runQuery()`는 projectId `hodo-op-sim` 고정, cross-project 쿼리로 `socar-data` 접근
- GCS 시나리오 저장 → Upstash Redis로 전환 (기존 workspace 패턴)

---

## 5. 컴포넌트 구조

```
components/
├── ui/                               ← 기존 shadcn/ui
├── layout/                           ← 기존 사이드바, 헤더
├── dashboard/                        ← 기존 KPI
├── allocation/                       ← 기존 신차배분
├── relocation/                       ← 기존 재배치
├── work-history/                     ← 기존 워크스페이스
├── roas/                             ← 신규
│   ├── roas-simulator.tsx            ← 시뮬레이션 메인 (지역→존→쿠폰 입력 → 결과)
│   ├── roas-result-charts.tsx        ← Recharts 차트 (Bar, Line, Heatmap)
│   ├── roas-scenario-manager.tsx     ← 시나리오 저장/불러오기/비교
│   ├── campaign-list.tsx             ← 캠페인 목록 테이블
│   ├── campaign-detail.tsx           ← 캠페인 상세 (크로스탭, 일별 추이)
│   ├── campaign-impact.tsx           ← 3-view 임팩트 분석
│   └── campaign-vs-forecast.tsx      ← 예측 vs 실적 비교
└── zone/                             ← 신규
    ├── zone-map.tsx                  ← 카카오맵 래퍼 (ref 기반, SSR 제외)
    ├── zone-mode-tabs.tsx            ← 개설/폐쇄/비교/최적화 탭 전환
    ├── panels/
    │   ├── open-panel.tsx
    │   ├── close-panel.tsx
    │   ├── compare-panel.tsx
    │   └── optimize-panel.tsx
    ├── zone-search.tsx               ← 주소 검색 (카카오 Geocoding)
    └── zone-legend.tsx               ← 지도 범례
```

---

## 6. 카카오맵 통합

- `next/script`로 카카오맵 JS SDK 로드 (`strategy="afterInteractive"`)
- `/zone` 페이지에서만 SDK 스크립트 로드 (전역 아님)
- 별도 라이브러리 없이 직접 ref 래퍼 작성
- `"use client"` + `dynamic(() => import(...), { ssr: false })`

```tsx
// zone-map.tsx props
interface ZoneMapProps {
  zones: Zone[];
  candidatePin?: LatLng;
  radiusCircle?: { center: LatLng; radius: number };
  cannibalizationZones?: Zone[];
  demandArrows?: DemandTransfer[];
  onMapClick?: (latlng: LatLng) => void;
}
```

**레이아웃:** 좌측 70% 카카오맵 + 우측 30% 사이드 패널 (기존 zone-simulator와 동일)

---

## 7. Python → TypeScript 포팅 범위

### ROAS (`bq.py` → `lib/roas.ts`)

| Python | TypeScript | 설명 |
|--------|-----------|------|
| `_build_crosstab()` | `buildCrosstab()` | 연령×이용시간 매트릭스 변환 |
| `_compute_verdict()` | `computeVerdict()` | 캠페인 효과 판정 (가중 점수: ROAS 30%, usage_rate 20%, before-after 20%, DID 30%) |
| `_safe_int()`, `_safe_float()` | 불필요 | TS에서 `?? 0` 처리 |
| `AGE_LABELS`, `DURATION_LABELS` | 상수 export | 매핑 딕셔너리 |
| 16개 `get_*()` 함수 | API Route에서 직접 처리 | SQL 파일 실행 → JSON 응답 |

### Zone (`geo.py` → `lib/zone-geo.ts`)

| Python | TypeScript | 설명 |
|--------|-----------|------|
| `haversine()` | `haversine()` | 두 좌표 간 거리(km) |
| `find_nearby_zones()` | `findNearbyZones()` | 반경 내 존 필터링 |
| `cannibalization_score()` | `cannibalizationScore()` | 카니발리제이션 위험도 |
| `estimate_demand_transfer()` | `estimateDemandTransfer()` | 수요 이전 추정 |

### Zone (`bq.py` → SQL 파일 + `lib/zone.ts`)

| Python | 처리 방식 |
|--------|----------|
| 9개 `get_*()` 함수 | SQL 추출 → `sql/zone/*.sql`, API Route에서 `runQuery()` |
| 벤치마크/클러스터 비교 | `lib/zone.ts` 헬퍼 함수 |

### 포팅하지 않는 것

| 기존 | 대체 |
|------|------|
| GCS 시나리오 저장 | Upstash Redis (기존 workspace 패턴) |
| FastAPI 인증 | NextAuth.js (이미 구현) |
| Python logging | Next.js console + error boundary |
| Slack 리포트 엔드포인트 | Zone API Route에서 직접 Slack webhook 호출 |

---

## 8. 마이그레이션 단계

| 단계 | 내용 | 의존성 | 산출물 |
|------|------|--------|--------|
| **P1. 공통 기반** | 사이드바 메뉴 추가, 라우팅 스캐폴드, SQL 디렉토리 구조 | 없음 | 빈 페이지 + 네비게이션 동작 |
| **P2. ROAS 백엔드** | bq.py SQL 추출 → `sql/roas/*.sql`, `lib/roas.ts`, API Routes 15개 | P1 | 모든 API 엔드포인트 응답 검증 |
| **P3. ROAS 프론트** | 시뮬레이터 + 분석 페이지 React/shadcn/Recharts 재작성 | P2 | 시뮬레이션 실행 → 차트 표시 E2E |
| **P4. Zone 백엔드** | bq.py SQL 추출 → `sql/zone/*.sql`, `lib/zone-geo.ts` + `lib/zone.ts`, API Routes 7개 | P1 | 모든 API 엔드포인트 응답 검증 |
| **P5. Zone 프론트** | 카카오맵 래퍼 + 4개 모드 패널 React 재작성 | P4 | 지도 + 4모드 패널 E2E |
| **P6. 통합 QA** | 전체 기능 검증, 시나리오 저장, 다크모드, 반응형 | P3 + P5 | Playwright 테스트 통과 |

P2+P4 (백엔드), P3+P5 (프론트)는 각각 병렬 진행 가능.

---

## 9. 완료 기준

- 기존 ROAS 시뮬레이터의 모든 API 엔드포인트가 Next.js에서 동일 응답 반환
- 기존 Zone 시뮬레이터의 4개 모드가 모두 동작 (지도 + 패널 + BQ 쿼리)
- 시나리오 저장/불러오기 동작 (Upstash Redis)
- 사이드바에서 모든 페이지 접근 가능 (호도 대시보드 브랜딩)
- 다크모드/반응형 대응
- Playwright 기반 E2E 테스트 통과

---

## 10. 폐기 대상 (통합 완료 후)

- `socar/roas-simulator/` — Cloud Run 서비스 중단 후 디렉토리 삭제
- `socar/zone-simulator/` — 디렉토리 삭제 (Cloud Run 배포 전)
- `socar/shared/` — Next.js로 통합되어 불필요, 삭제

---

## 11. 환경변수

기존 googlesheet-dashboard 환경변수에 추가:

| 변수 | 용도 | 신규/기존 |
|------|------|----------|
| `GOOGLE_APPLICATION_CREDENTIALS_B64` | BQ 인증 | 기존 |
| `KAKAO_JS_KEY` | 카카오맵 SDK 앱 키 | 신규 |
| `SLACK_WEBHOOK_URL` | Zone 리포트 Slack 발송 | 신규 |

기존 ROAS/Zone의 `APP_PASSWORD`, `SECRET_KEY`, `GCS_BUCKET` 등은 NextAuth + Upstash로 대체되어 불필요.
