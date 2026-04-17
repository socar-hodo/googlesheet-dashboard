// 경남울산사업팀 매출 대시보드 — 팀 전용 타입 정의

/** Daily 시트 한 행 — 일자별 기록 */
export interface DailyRecord {
  date: string;             // 일자 (시트 원본 형식 그대로, 예: "2026-02-21")
  revenue: number;          // 매출 (원)
  profit: number;           // 손익 (원, 음수 가능)
  usageHours: number;       // 이용시간 (시간)
  usageCount: number;       // 이용건수
  utilizationRate: number;  // 가동률 (%, 0-100 범위)
  // monthlyTarget 없음 — Daily 시트에는 목표 컬럼이 존재하지 않음 (CONTEXT.md 결정)
}

/** Weekly 시트 한 행 — 주차별 기록 */
export interface WeeklyRecord {
  week: string;             // 주차 (시트 원본 형식 그대로, 예: "1주차", "2월 3주차")
  revenue: number;          // 매출 (원)
  profit: number;           // 손익 (원, 음수 가능)
  usageHours: number;       // 이용시간 (시간)
  usageCount: number;       // 이용건수
  utilizationRate: number;  // 가동률 (%, 0-100 범위)
  weeklyTarget: number;     // 주차 목표 (원) — Weekly 전용 필드
}

/** 고객 유형별 이용 건수 — 일별/주차별 공용 */
export interface CustomerTypeRow {
  date?: string;           // 일별 시트용 (YYYY-MM-DD). 주차별이면 undefined
  week?: string;           // 주차별 시트용. 일별이면 undefined
  roundTripCount: number;  // 왕복_건수
  callCount: number;       // 부름_건수
  oneWayCount: number;     // 편도_건수
}

/** 매출 세분화 한 행 — [d] raw / [w] raw 시트 */
export interface RevenueBreakdownRow {
  date: string;           // 일자 (ISO YYYY-MM-DD)
  rentalRevenue: number;  // 대여매출
  pfRevenue: number;      // PF매출
  drivingRevenue: number; // 주행매출
  callRevenue: number;    // 부름매출
  otherRevenue: number;   // 기타매출
}

/** 비용 분석 한 행 — 카테고리 합계 + 세부 드릴다운 포함 */
export interface CostBreakdownRow {
  date: string;                     // 일자 (ISO YYYY-MM-DD)
  transportCost: number;            // 운반비 (카테고리 합계)
  fuelCost: number;                 // 유류비
  parkingCost: number;              // 주차료
  inspectionCost: number;           // 점검비
  depreciationCost: number;         // 감가상각비
  commissionCost: number;           // 수수료
  chargeTransportCost: number;      // 충전운반비 (드릴다운 세부)
  callTransportCost: number;        // 부름운반비 (드릴다운 세부)
  zoneOneWayTransportCost: number;  // 존편도운반비 (드릴다운 세부)
}

/** 예측 데이터 한 행 — FORECAST 시트 (일별, 1행 헤더 구조) */
export interface ForecastRow {
  date: string;                  // d 컬럼 (ISO YYYY-MM-DD)
  ulsanTarget: number;           // 울산광역시(목표)
  ulsanForecast: number;         // 울산광역시(사전)
  ulsanAchievement: number;      // 울산광역시(달성)
  gyeongnamTarget: number;       // 경상남도(목표)
  gyeongnamForecast: number;     // 경상남도(사전)
  gyeongnamAchievement: number;  // 경상남도(달성)
  combinedTarget: number;        // 경남+울산(목표)
  combinedForecast: number;      // 경남+울산(사전)
  combinedAchievement: number;   // 경남+울산(달성)
}

/** 지역 랭킹 한 행 — region1 또는 region2 레벨 */
export interface RegionRankingRow {
  region: string;           // region1 (전국) 또는 region2 (drill)
  revenue: number;
  profit: number;
  gpm: number;              // 0~1 비율 (SAFE_DIVIDE 결과)
  usageCount: number;
  usageHours: number;
  utilizationRate: number;  // 0~100 퍼센트
}

/** 대시보드 전체 데이터 컨테이너 */
export interface TeamDashboardData {
  daily: DailyRecord[];
  weekly: WeeklyRecord[];
  // Phase 9 신규 추가 — 고객유형/매출세분화/비용분석 데이터 레이어
  customerTypeDaily: CustomerTypeRow[];
  customerTypeWeekly: CustomerTypeRow[];
  revenueBreakdownDaily: RevenueBreakdownRow[];
  revenueBreakdownWeekly: RevenueBreakdownRow[];
  costBreakdownDaily: CostBreakdownRow[];
  costBreakdownWeekly: CostBreakdownRow[];
  forecastDaily: ForecastRow[]; // FORECAST 시트 (일별 사전 매출/달성률)
  regionRanking: RegionRankingRow[]; // 최근 기간 기준 region1 랭킹 (초기 SSR)
  forecastRegionRanking: RegionRankingRow[]; // 사전 매출 기준 region1 랭킹 (예측 탭)
  fetchedAt: string;        // ISO 8601 타임스탬프 (예: "2026-02-22T09:00:00.000Z")
}
