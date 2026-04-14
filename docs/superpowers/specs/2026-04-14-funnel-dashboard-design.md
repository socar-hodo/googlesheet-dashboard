# Funnel Dashboard Design Spec

> 존클릭 → 예약 전환율 퍼널 대시보드. HODO 대시보드 7번째 메뉴.

## Overview

사용자가 제공한 검증 쿼리(`get_car_classes` + `reservation_info`)를 기반으로, 전국 시/도 및 구/군 단위의 주간 존클릭 → 예약 전환율(CVR)을 시각화하는 대시보드.

### Goals

- 전국 region1(시/도) 단위 CVR 비교를 한눈에 파악
- 특정 시/도 클릭 시 region2(구/군) 드릴다운
- 주간 추이(WoW) 변동 즉시 확인
- 기간 프리셋(4주/8주/12주/커스텀)으로 빠른 필터링

### Non-Goals

- 존(zone_id) 단위 드릴다운 (서버로그 쿼리 영역)
- 실시간 데이터 (주간 배치 기준)
- 퍼널 중간 단계(차량상세 조회) 시각화

## Architecture

### Approach

SQL 파일 + API route 방식. 기존 ROAS/존 시뮬레이터와 동일 패턴.

### File Structure

```
app/(dashboard)/funnel/
├── page.tsx              # 서버 컴포넌트
├── loading.tsx           # 스켈레톤
└── error.tsx             # 에러 바운더리

app/api/funnel/
├── regions/route.ts      # GET — region1 목록
├── weekly/route.ts       # GET ?weeks=12 — region1 레벨 주간 CVR
└── detail/route.ts       # GET ?region1=부산광역시&weeks=12 — region2 레벨

sql/funnel/
├── regions.sql
├── weekly-by-region1.sql
└── weekly-by-region2.sql

components/funnel/
├── funnel-content.tsx    # 'use client' 메인 상태 관리
├── funnel-header.tsx     # 필터 (기간 프리셋)
├── kpi-cards.tsx         # 4개 KPI 카드
├── cvr-trend-chart.tsx   # Recharts 복합차트 (바+라인)
├── region-ranking.tsx    # CVR 랭킹 가로바
└── detail-table.tsx      # 정렬/WoW 테이블

types/funnel.ts           # TypeScript 인터페이스
lib/funnel.ts             # SQL 로딩, 파라미터 치환
```

### Sidebar

`components/layout/sidebar.tsx`의 `navItems`에 추가:

```typescript
{ icon: MousePointerClick, label: "전환율 퍼널", href: "/funnel" }
```

## API Design

### `GET /api/funnel/regions`

region1 목록 반환. 초기 로드 시 1회 호출.

**Response:** `string[]`

```json
["강원특별자치도", "경기도", "경상남도", "부산광역시", ...]
```

### `GET /api/funnel/weekly?weeks=12`

전국 region1 레벨 주간 CVR 데이터. 최근 N주 + 직전주(WoW 계산용).

**Parameters:**
- `weeks` (number, default: 12) — 조회 주차 수

**Response:**

```json
{
  "summary": {
    "total_click_members": 24287,
    "total_converted_members": 4593,
    "cvr": 0.189,
    "clicks_per_user": 3.4,
    "wow_click_members": 0.032,
    "wow_converted_members": -0.011,
    "wow_cvr": -0.008
  },
  "trend": [
    {
      "year_week": "2026-W10",
      "click_member_cnt": 120000,
      "converted_member_cnt": 23000,
      "cvr": 0.192
    }
  ],
  "ranking": [
    {
      "region": "부산광역시",
      "click_member_cnt": 24287,
      "converted_member_cnt": 4593,
      "zone_click_cnt": 210000,
      "cvr": 0.189,
      "wow_cvr": -0.008
    }
  ]
}
```

### `GET /api/funnel/detail?region1=부산광역시&weeks=12`

특정 region1 내 region2 드릴다운. 응답 구조 동일, `region` 필드가 region2 값.

**Parameters:**
- `region1` (string, required) — 시/도명
- `weeks` (number, default: 12) — 조회 주차 수

**Response:** `weekly` 와 동일 구조. `ranking[].region`이 구/군명.

## SQL Design

### Source Tables

| 용도 | 테이블 |
|------|--------|
| 존 마스터 | `socar-data.tianjin_replica.carzone_info` |
| 존 클릭 | `socar-data.socar_server_2.get_car_classes` |
| 예약 | `socar-data.tianjin_replica.reservation_info` |

### Core Logic

사용자 제공 쿼리를 그대로 활용. 핵심 CTE 구조:

1. `zone_master` — `carzone_info`에서 region1/region2 매핑 (imaginary=0)
2. `click_base` — `get_car_classes`에서 ISO week 기준 클릭 추출
3. `reservation_base` — `reservation_info`에서 채널 필터 적용 후 예약 추출
4. `click_member_week` — 주차+지역별 고유 클릭 유저 집계, `MIN(click_ts)` 저장
5. `converted_member_week` — 같은 주+같은 지역에서 클릭 후 예약한 유저
6. `weekly_summary` — 클릭유저/전환유저 집계 + `LAG()` 윈도우로 WoW 계산

### Channel Exclusion

예약 데이터에서 제외할 채널 (사용자 쿼리 기준):

```sql
r.channel NOT IN (
  'admin', 'system', 'alliance/naver_place', 'alliance/web_partners',
  'test_drive/owned', 'mobile/web', 'mobile/ios/web/korailtalk',
  'mobile/android/web/korailtalk', 'alliance/ota', 'test_drive'
)
```

### Parameterization

`replaceSqlParams()` 패턴 사용:
- `{weeks}` — INTERVAL 계산에 사용 (정수)
- `{region1}` — WHERE 절 필터 (문자열, weekly-by-region2.sql에서만)

### WoW Calculation

SQL 내 `LAG()` 윈도우 함수:

```sql
LAG(cvr) OVER (PARTITION BY region ORDER BY iso_week_num) AS prev_cvr
```

API에서 최종 주차의 `cvr - prev_cvr`로 WoW 변동 계산.

### clicks_per_user

`zone_click_cnt / click_member_cnt`로 계산. API 레벨에서 `SAFE_DIVIDE` 처리.

## UI Components

### Layout (전폭 1680px max, 기존 대시보드 레이아웃)

```
┌─────────────────────────────────────────────┐
│ 전환율 퍼널          [4주][8주][12주][커스텀] │  ← funnel-header
├────────┬────────┬────────┬─────────────────┤
│클릭유저│전환유저│  CVR   │ 인당클릭        │  ← kpi-cards (4 cards)
│ WoW ▲ │ WoW ▼ │WoW ▼  │ WoW —          │
├────────┴────────┴────────┴─────────────────┤
│ 주간 CVR 추이 (ComposedChart)               │  ← cvr-trend-chart
│ Bar: 클릭유저(green), 전환유저(purple)       │
│ Line: CVR(blue)                             │
├──────────────┬──────────────────────────────┤
│ CVR 랭킹     │ 상세 테이블            [📥]  │  ← region-ranking + detail-table
│ 가로바+순위  │ 지역|클릭|전환|CVR|WoW|인당  │
│ 클릭→드릴다운│ 행 클릭→드릴다운              │
└──────────────┴──────────────────────────────┘
```

### State Management (funnel-content.tsx)

```typescript
// Client state
const [weeks, setWeeks] = useState(12);           // 기간 프리셋
const [drillRegion, setDrillRegion] = useState<string | null>(null); // 드릴다운 region1
const [data, setData] = useState<FunnelData | null>(null);
const [loading, setLoading] = useState(true);
```

### Data Flow

1. 페이지 로드 → `/api/funnel/weekly?weeks=12` 호출 → 전국 뷰
2. 기간 프리셋 변경 → `weeks` state 변경 → 같은 API 재호출
3. 테이블/랭킹 행 클릭 → `setDrillRegion("부산광역시")` → `/api/funnel/detail?region1=부산광역시&weeks=12`
4. "← 전국" 버튼 → `setDrillRegion(null)` → `/api/funnel/weekly` 재호출

### Drilldown UX

- region1 뷰: 타이틀 "전환율 퍼널", 뱃지 "전국"
- region2 뷰: 타이틀 "전환율 퍼널", 뱃지 "부산광역시", "← 전국" 버튼 표시
- 테이블 행에 `→` 화살표로 클릭 가능 표시 (region1 뷰에서만)
- region2 뷰 테이블에는 드릴다운 화살표 없음

### Chart Specifications

**cvr-trend-chart (ComposedChart):**
- Left Y axis: 클릭유저/전환유저 (숫자)
- Right Y axis: CVR (%)
- X axis: year_week (W04, W05, ...)
- Bar: 클릭유저 (#34d399 green), 전환유저 (#a78bfa purple)
- Line: CVR (#60a5fa blue), dot enabled
- Tooltip: 3개 값 모두 표시

**region-ranking (BarChart horizontal):**
- Y axis: region 이름
- X axis: CVR (%)
- 상위 10개까지 표시, 나머지 "더보기"
- 바 클릭 시 드릴다운

### Custom Period Picker

"커스텀" 버튼 클릭 시 시작 주차 / 끝 주차 드롭다운 2개 표시. 선택 가능한 주차 범위는 `2023-W48` ~ 현재 주차. 선택 후 "적용" 버튼으로 데이터 갱신.

### Excel Export

기존 `lib/export-utils.ts` 패턴 활용. 테이블 우측 상단 다운로드 버튼.

## Error Handling

- BQ 미설정 시: `runQuery()` returns null → "BigQuery가 설정되지 않았습니다" 메시지
- 빈 결과: "해당 기간에 데이터가 없습니다" 메시지
- API 에러: `withAuth()` 래퍼의 기본 에러 핸들링 (500 + 로깅)
- 네트워크 에러: `error.tsx` 바운더리 + 재시도 버튼

## TypeScript Types

```typescript
// types/funnel.ts

export interface FunnelSummary {
  total_click_members: number;
  total_converted_members: number;
  cvr: number;
  clicks_per_user: number;
  wow_click_members: number;
  wow_converted_members: number;
  wow_cvr: number;
}

export interface FunnelTrendRow {
  year_week: string;
  click_member_cnt: number;
  converted_member_cnt: number;
  cvr: number;
}

export interface FunnelRankingRow {
  region: string;
  click_member_cnt: number;
  converted_member_cnt: number;
  zone_click_cnt: number;
  cvr: number;
  wow_cvr: number;
}

export interface FunnelData {
  summary: FunnelSummary;
  trend: FunnelTrendRow[];
  ranking: FunnelRankingRow[];
}
```

## Deployment

기존 Vercel 배포 파이프라인 그대로. `next.config.ts`에 SQL 파일 트레이싱 추가:

```typescript
outputFileTracingIncludes: {
  '/api/funnel/weekly': ['./sql/funnel/**'],
  '/api/funnel/detail': ['./sql/funnel/**'],
  '/api/funnel/regions': ['./sql/funnel/**'],
}
```
