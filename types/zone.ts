/** 존 기본 정보 (목록 조회 결과) */
export interface ZoneInfo {
  id: number;
  name: string;
  lat: number;
  lng: number;
  region1: string;
  region2: string;
  car_count: number;
  [key: string]: unknown;
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

// ── Frontend-only types ──────────────────────────────────────

/** 4개 시뮬레이터 모드 */
export type ZoneMode = "open" | "close" | "compare" | "optimize";

/** 카카오맵 래퍼 imperative API */
export interface ZoneMapHandle {
  addMarker(lat: number, lng: number, opts?: MarkerOptions): void;
  clearOverlays(): void;
  setCenter(lat: number, lng: number, level?: number): void;
  addCircle(lat: number, lng: number, radiusM: number, opts?: CircleOptions): void;
  addOverlay(lat: number, lng: number, html: string): void;
  getMap(): kakao.maps.Map | null;
}

export interface MarkerOptions {
  color?: "red" | "blue" | "green" | "yellow" | "gray";
  zoneId?: number;
  title?: string;
}

export interface CircleOptions {
  strokeColor?: string;
  fillColor?: string;
  fillOpacity?: number;
}

/** 개설 시뮬레이션 응답 */
export interface OpenSimResult {
  estimated_revenue_per_car: number;
  estimated_utilization: number;
  cluster_type: string | null;
  cluster_benchmark: { avg_revenue_per_car: number; avg_utilization: number; zone_count: number };
  nearby_avg_revenue: number;
  nearby_avg_utilization: number;
  nearby_zones: Array<ZoneInfo & { distance_m: number; revenue_per_car: number; utilization: number }>;
  cannibalization: Array<{ zone_id: number; zone_name: string; distance_m: number; level: "danger" | "warning" }>;
  alpha: number;
}

/** 폐쇄 시뮬레이션 응답 */
export interface CloseSimResult {
  target_zone: {
    zone_id: number;
    name: string;
    region1: string;
    region2: string;
    revenue_per_car: number;
    utilization: number;
    car_count: number;
  };
  demand_transfer: {
    transfers: Array<{
      zone_id: number;
      zone_name: string;
      absorption_pct: number;
      lat?: number;
      lng?: number;
      current_utilization?: number;
      new_utilization?: number;
    }>;
    total_absorption_pct: number;
    churn_pct: number;
    cost_saved_monthly: number;
    churn_loss_monthly: number;
    net_effect_monthly: number;
  };
}

/** 비교 응답 */
export interface CompareResult {
  zones: Array<ZonePerformance & {
    name: string;
    region1: string;
    region2: string;
    lat: number;
    lng: number;
    cluster_type: string | null;
    cluster_benchmark: Record<string, unknown> | null;
  }>;
}

/** 최적화 응답 */
export interface OptimizeResult {
  summary: {
    total_zones: number;
    active_zones: number;
    inactive_zones: number;
    total_cars: number;
    avg_utilization: number;
    avg_revenue_per_car: number;
    avg_cars_per_zone: number;
  };
  suggestions: {
    close: Array<RegionZoneStat & { reason?: string; has_alternative?: boolean; nearby_alternatives?: number }>;
    open: Array<{ zone_id?: number; zone_name?: string; area?: string; reason?: string; lat?: number; lng?: number; nearest_active_m?: number }>;
    rebalance: Array<{
      from_zone: { zone_id: number; name: string; utilization: number; car_count?: number };
      to_zone: { zone_id: number; name: string; utilization: number; car_count?: number };
      cars: number;
      reason?: string;
    }>;
  };
  projected: {
    new_avg_utilization: number;
    monthly_savings: number;
  };
  zones: RegionZoneStat[];
}
