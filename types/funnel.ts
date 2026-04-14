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
