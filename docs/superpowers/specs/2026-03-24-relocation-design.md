# 차량 재배치 의사결정 도구 — 설계 문서

## 목표

존(Zone/region2) 단위 복합 스코어를 실시간 BigQuery 조회로 산출하여, 담당자가 어느 존에서 어느 존으로 차량을 이동해야 하는지 판단할 수 있도록 지원한다.

## 배경 및 제약

- 기존 신차 배분(`lib/allocation.ts`, `lib/bigquery.ts`)과 동일한 3-레이어 패턴 재사용
- 사전예약 데이터는 `tianjin_replica.reservation_info` 기반 시간 슬롯 분해 방식 사용 (사용자 제공 쿼리 패턴)
- 분석 단위: region2 (시/군/구) — 실질적 존 대리 지표
- 조회 시마다 BigQuery 실행 (실시간, 캐시 없음)

---

## 스코어 산출

### 입력 지표 (3개)

| 지표 | 데이터 소스 | 계산 방법 |
|------|------------|-----------|
| 가동률 | `operation_per_car_daily_v2` | SUM(op_min) / SUM(dp_min), 최근 N일 |
| 대당매출 | `profit_socar_car_daily` | SUM(revenue) / COUNT(DISTINCT car_id), 최근 N일 |
| 사전예약률 | `tianjin_replica.reservation_info` + `operation_per_car_hourly_v2` | SUM(occupied_minutes) / SUM(dp_min), 향후 M일 |

### 스코어 공식

```
score = α × norm(가동률) + β × norm(대당매출) + γ × norm(사전예약률)
```

- Min-Max 정규화 (0~1 스케일, SAFE_DIVIDE 사용)
- 기본 가중치: α=0.4, β=0.4, γ=0.2
- UI 슬라이더로 조절 가능 (합계 = 1.0 강제)

### 재배치 추천 로직

- **송출 후보**: 스코어 하위 20% 존
- **수신 후보**: 스코어 상위 20% 존
- 매칭 우선순위: 동일 region1(시/도) 내 → 그 외
- 출력 형태: "A존 → B존으로 N대 이동 권장" (N = 송출 존 보유 차량의 20% 반올림)

---

## UI 구조

```
[필터 패널 — 좌측 고정]
  • region1 선택 (전체 / 특정 시도)
  • 과거 실적 기간: 7 / 14 / 30일
  • 사전예약 조회: 향후 3 / 7 / 14일
  • 가중치 슬라이더: α(가동률) β(매출) γ(사전예약)
  • [조회 실행] 버튼

[존별 스코어 테이블]
  region2 | 가동률 | 대당매출 | 사전예약률 | 종합스코어
  → 스코어 내림차순 정렬
  → 상위 20% 초록, 하위 20% 빨강 하이라이트

[재배치 추천 카드]           [막대 차트]
  송출 존 → 수신 존 N대       존별 스코어 비교 (Recharts)
```

---

## 파일 구조

```
sql/
  relocation.sql                       # BigQuery 집계 쿼리 (파라미터 치환)

types/
  relocation.ts                        # RelocationRow, RelocationResult, RelocationParams

lib/
  relocation.ts                        # computeScore(), computeRecommendations(), runRelocation()
  relocation.test.ts                   # 단위 테스트

app/
  api/relocation/run/route.ts          # POST 핸들러
  (dashboard)/relocation/
    layout.tsx                         # 패스스루 레이아웃
    page.tsx                           # Server Component (RelocationForm 마운트)

components/relocation/
  relocation-form.tsx                  # Client Component: 필터 폼 + fetch 조율
  relocation-table.tsx                 # 존별 스코어 테이블 (색상 하이라이트)
  relocation-chart.tsx                 # 존별 스코어 막대 차트 (Recharts)
  relocation-recommendations.tsx       # 재배치 추천 카드 목록

components/layout/
  sidebar.tsx                          # 수정: "차량 재배치" 메뉴 추가
```

---

## 데이터 흐름

1. 사용자가 필터 설정 → [조회 실행]
2. `POST /api/relocation/run` 요청 (region1, pastDays, futureDays, weights)
3. `runRelocation()` → `loadSql()` → BigQuery 실행 (단일 쿼리, 약 10~30초)
4. 서버에서 `computeScore()` — Min-Max 정규화 + 가중 합산
5. `computeRecommendations()` — 하위/상위 20% 매칭
6. `RelocationResult` JSON 반환
7. Client Component에서 테이블 + 차트 + 추천 카드 렌더링

---

## SQL 쿼리 구조 (relocation.sql)

```sql
-- 파라미터: {region1_filter}, {past_days}, {future_days}

WITH past_operation AS (
  -- 최근 {past_days}일 존별 가동률
  -- socar-data.socar_biz.operation_per_car_daily_v2
),
past_revenue AS (
  -- 최근 {past_days}일 존별 대당매출
  -- socar-data.socar_biz_profit.profit_socar_car_daily
),
reserved_base AS (
  -- 사전예약 기본 집계 (사용자 제공 패턴 재사용)
  -- tianjin_replica.reservation_info
),
reserved_slots AS (
  -- 시간 슬롯별 점유시간 분해
),
future_reservation AS (
  -- 향후 {future_days}일 존별 사전예약률
  -- operation_per_car_hourly_v2 + reserved_slots JOIN
)
SELECT
  region1, region2,
  util_rate,       -- 가동률
  rev_per_car,     -- 대당매출
  prereserv_rate,  -- 사전예약률
  car_count        -- 존 내 차량 수
FROM past_operation
JOIN past_revenue   USING (region2)
JOIN future_reservation USING (region2)
[WHERE region1 = '{region1_filter}' 또는 전체]
ORDER BY region2
```

---

## 타입 정의

```typescript
interface RelocationParams {
  region1: string;      // "전체" 또는 특정 시/도
  pastDays: number;     // 7 | 14 | 30
  futureDays: number;   // 3 | 7 | 14
  weights: {
    utilization: number;    // α (0~1)
    revenue: number;        // β (0~1)
    prereservation: number; // γ (0~1), 합계 = 1.0
  };
}

interface RelocationRow {
  region1: string;
  region2: string;
  utilRate: number;       // 가동률 (0~1)
  revPerCar: number;      // 대당매출 (원)
  prereservRate: number;  // 사전예약률 (0~1)
  carCount: number;       // 차량 수
  score: number;          // 복합 스코어 (0~1)
  tier: "top" | "mid" | "bottom";  // 상위20% / 중간 / 하위20%
}

interface RelocationRecommendation {
  fromZone: string;   // 송출 존 (region2)
  toZone: string;     // 수신 존 (region2)
  carCount: number;   // 권장 이동 대수
  region1: string;    // 동일 시/도 여부 확인용
}

interface RelocationResult {
  rows: RelocationRow[];
  recommendations: RelocationRecommendation[];
  fetchedAt: string;
}
```

---

## 에러 처리

- BigQuery 미설정: `GOOGLE_APPLICATION_CREDENTIALS_B64` 없으면 400 반환
- 쿼리 실패: 500 + 구체적 메시지 (신차 배분 패턴 동일)
- 결과 0건: 빈 테이블 + "데이터가 없습니다" 안내

---

## 테스트 범위

- `computeScore()` — 정규화 경계값, 가중치 합계 1.0 검증
- `computeRecommendations()` — 상위/하위 20% 분류, 동일 region1 우선 매칭
- API route — 유효하지 않은 파라미터 400 응답
