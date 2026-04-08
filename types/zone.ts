/** 존 기본 정보 (목록 조회 결과) */
export interface ZoneInfo {
  id: number;
  name: string;
  lat: number;
  lng: number;
  region1: string;
  region2: string;
  car_count: number;
}

/** 존 실적 (90일 평균) */
export interface ZonePerformance {
  zone_id: number;
  revenue_per_car: number;
  utilization: number;
  total_nuse: number;
  car_count: number;
  avg_daily_cost_fixed: number;
}

/** 클러스터 벤치마크 */
export interface ClusterBenchmark {
  avg_revenue_per_car: number;
  avg_utilization: number;
  zone_count: number;
}

/** 지역 존 통계 (최적화 모드) */
export interface RegionZoneStat {
  zone_id: number;
  zone_name: string;
  lat: number;
  lng: number;
  region1: string;
  region2: string;
  car_count: number;
  revenue_per_car: number;
  utilization: number;
  total_nuse: number;
}

/** 개설 시뮬레이션 요청 */
export interface OpenSimParams {
  lat: number;
  lng: number;
  radius_m?: number;   // default 1000
  alpha?: number;      // default 0.5
}

/** 폐쇄 시뮬레이션 요청 */
export interface CloseSimParams {
  zone_id: number;
}

/** 비교 요청 */
export interface CompareParams {
  zone_ids: number[];  // 2~5개
}

/** 최적화 요청 */
export interface OptimizeParams {
  region1: string;
  region2?: string;
}

/** 시나리오 저장 요청 */
export interface ScenarioSaveParams {
  mode: string;
  parameters: Record<string, unknown>;
  results: Record<string, unknown>;
}

/** 저장된 시나리오 */
export interface ZoneScenario {
  id: string;
  mode: string;
  parameters: Record<string, unknown>;
  results: Record<string, unknown>;
  created_at: string;
}

/** Slack 리포트 요청 */
export interface SlackReportParams {
  mode: string;
  data: Record<string, unknown>;
}
