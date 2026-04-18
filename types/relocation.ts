// v1.4 zone-simulator Macro API schema.
// Source: zone-simulator /api/optimize (mode=macro) response.

export interface OptimizeMacroRequest {
  mode: "macro";
  total_transfer: number;
  max_pct_per_region: number;
  min_cars_per_region: number;
  top_n: number;
  // v1.4 — 보수 기본값 + 지역 제외
  alpha_scale: number;
  churn_penalty: number;
  exclude_regions: string[];
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

/** 파라미터 기본값 (zone-simulator v1.4 와 동기화) */
export const RELOCATION_DEFAULTS: OptimizeMacroRequest = {
  mode: "macro",
  total_transfer: 500,
  max_pct_per_region: 0.20,
  min_cars_per_region: 5,
  top_n: 30,
  // v1.4 보수 기본값
  alpha_scale: 0.7,
  churn_penalty: 0.05,
  exclude_regions: [],
};

/** CSV 컬럼 헤더 (배차팀 전달용) */
export const MOVE_ORDER_CSV_HEADERS = [
  "순위", "출발존ID", "출발존명", "출발지역1", "출발지역2",
  "도착존ID", "도착존명", "도착지역1", "도착지역2",
  "대수", "거리km", "탁송비", "연이득",
] as const;

/**
 * 광역시도 17개 (region include filter용)
 * 주의: zone-simulator 백엔드 데이터(zone_baseline_90d.json)는 구명칭
 *   (강원도, 전라북도)을 사용하므로 여기서도 구명칭으로 맞춤.
 *   신명칭(강원특별자치도, 전북특별자치도)으로 바꾸면 exclude_regions 매칭 실패.
 */
export const REGION1_OPTIONS = [
  "서울특별시", "경기도", "인천광역시",
  "부산광역시", "대구광역시", "울산광역시",
  "광주광역시", "대전광역시", "세종특별자치시",
  "강원도", "충청북도", "충청남도",
  "전라북도", "전라남도", "경상북도",
  "경상남도", "제주특별자치도",
] as const;
