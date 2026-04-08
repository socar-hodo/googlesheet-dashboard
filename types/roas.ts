// types/roas.ts

// ── 존/지역 ──────────────────────────────────────────────────

export interface Zone {
  id: number;
  name: string;
  address: string;
}

// ── 성능 매트릭스 (Performance) ──────────────────────────────

export interface MatrixRow {
  age_group: string;
  age_label: string;
  duration_group: string;
  duration_label: string;
  day_type: string;
  nuse: number;
  revenue: number;
}

export interface PerformanceData {
  matrix: MatrixRow[];
  age_groups: string[];
  age_labels: Record<string, string>;
  duration_groups: string[];
  duration_labels: Record<string, string>;
  summary: {
    total_nuse: number;
    total_revenue: number;
    avg_rev_per_use: number;
  };
}

// ── 쿠폰 입력 ───────────────────────────────────────────────

export interface CouponInput {
  id: string;           // 고유 키 (React key 용)
  name: string;
  qty: number;
  conv_rate: number;    // 전환율 (%)
  discount: number;     // 할인금액 (원)
  rev_per_use: number;  // 건당 매출 (원)
  organic_rate: number; // 자연전환율 (%)
}

// ── 시뮬레이션 결과 (클라이언트 계산) ──────────────────────────

export interface CouponResult {
  name: string;
  conversions: number;
  revenue: number;
  cost: number;
  roas: number | null;
  incrementalConv: number;
  incrementalRev: number;
}

export interface SimulationResult {
  totalConversions: number;
  totalRevenue: number;
  totalCouponCost: number;
  totalCost: number;       // couponCost + adCost + etcCost
  roas: number | null;
  incrementalConv: number;
  incrementalRoas: number | null;
  breakEvenRate: number | null;
  perCoupon: CouponResult[];
}

// ── 시나리오 ──────────────────────────────────────────────────

export interface ScenarioInput {
  zone_ids: number[];
  region1: string;
  region2: string[];
  start_date: string;
  end_date: string;
  coupons: Omit<CouponInput, "id">[];
  ad_cost: number;
  etc_cost: number;
}

export interface Scenario {
  id: string;
  name: string;
  inputs: ScenarioInput;
  results: {
    conversions: number;
    revenue: number;
    total_cost: number;
    roas: number;
    incremental_roas: number;
  };
  created_at: string;
}

// ── 캠페인 목록 ──────────────────────────────────────────────

export interface CampaignListItem {
  policy_id: number;
  name: string;
  division: string;
  start_date: string;
  end_date: string;
  issued: number;
  used: number;
  usage_rate: number;
  revenue: number;
  discount: number;
  roas: number;
  is_ongoing: boolean;
}

// ── 캠페인 상세 ──────────────────────────────────────────────

export interface CampaignSummary {
  issued: number;
  used: number;
  usage_rate: number;
  revenue: number;
  discount: number;
  net_revenue: number;
  roas: number;
}

export interface CrosstabRow {
  age_group: string;
  age_label: string;
  duration_group: string;
  duration_label: string;
  nuse: number;
  revenue: number;
}

export interface DailyTrendItem {
  date: string;
  used_count: number;
  revenue: number;
  discount: number;
}

export interface CampaignDetailData {
  summary: CampaignSummary;
  crosstab: {
    matrix: CrosstabRow[];
    age_groups: string[];
    age_labels: Record<string, string>;
    duration_groups: string[];
    duration_labels: Record<string, string>;
  };
  daily_trend: DailyTrendItem[];
  target_zones: number[];
  target_regions: { region1: string; region2: string[] };
}

// ── 영향도 분석 ──────────────────────────────────────────────

export interface AnalysisA {
  title: string;
  coupon_users: { count: number; avg_revenue: number; avg_utime: number };
  non_coupon_users: { count: number; avg_revenue: number; avg_utime: number };
  diff_pct: { revenue: number; utime: number };
}

export interface AnalysisB {
  title: string;
  before: { period: string; nuse: number; revenue: number };
  after: { period: string; nuse: number; revenue: number; note?: string };
  change_pct: { nuse: number; revenue: number };
}

export interface DailySeriesItem {
  date: string;
  target_nuse: number;
  target_revenue: number;
  control_nuse: number;
  control_revenue: number;
}

export interface AnalysisC {
  title: string;
  target_change?: { nuse_pct: number; revenue_pct: number };
  control_change?: { nuse_pct: number; revenue_pct: number };
  did_effect?: { nuse_pct: number; revenue_pct: number };
  note?: string;
  daily_series: DailySeriesItem[];
  camp_start: string;
}

export interface Verdict {
  score: number;
  label: string;
  summary: string;
  insights: string[];
  note?: string;
}

export interface CampaignImpactData {
  analysis_a: AnalysisA;
  analysis_b: AnalysisB;
  analysis_c: AnalysisC;
  verdict: Verdict;
  is_ongoing: boolean;
}

// ── 예측 vs 실적 비교 ───────────────────────────────────────

export interface ForecastItem {
  label: string;
  predicted: number;
  actual: number;
  diff?: number;
  diff_pct?: number;
  unit?: string;
}

export interface ForecastComparisonData {
  scenario_name: string;
  items: ForecastItem[];
}
