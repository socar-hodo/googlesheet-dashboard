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
