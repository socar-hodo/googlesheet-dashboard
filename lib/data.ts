// 호도 매출 대시보드 — BigQuery 직접 연동 데이터 레이어
//
// Google Sheets 의존성을 제거하고 모든 데이터를 BigQuery에서 조회한다.
// 공통 필터:
//   - car_sharing_type IN ('socar', 'zplus')  — 카셰어링 차량만
//   - car_state IN ('운영', '수리')           — 실제 운영 차량만
// 지역 필터: region1/region2 선택이 있으면 해당 지역으로만 집계
import { unstable_cache } from "next/cache";
import type { TeamDashboardData, RegionOption } from "@/types/dashboard";
import { isBigQueryConfigured, runParameterizedQuery } from "./bigquery";
import { replaceSqlParams } from "./funnel";
import {
  loadDashboardSql,
  buildDailyRecords,
  buildWeeklyRecords,
  buildRevenueBreakdownDaily,
  buildRevenueBreakdownWeekly,
  buildCostBreakdownDaily,
  buildCostBreakdownWeekly,
  buildForecastRows,
  buildRegionRanking,
  buildRegionOptions,
  buildRegionFilter,
  sanitizeRegionName,
} from "./dashboard-bq";
import {
  loadCustomerTypeSql,
  buildDailyResponse as buildCustomerTypeDaily,
  buildWeeklyResponse as buildCustomerTypeWeekly,
} from "./customer-type";
import {
  loadUsageMatrixSql,
  buildMatrixResponse as buildUsageMatrix,
} from "./usage-matrix";
import { mockTeamDashboardData } from "./mock-data";

// 기본 조회 기간: 최근 90일 (어제까지)
function defaultRange(): { start: string; end: string } {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() - 1);
  const start = new Date(today);
  start.setDate(start.getDate() - 90);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// 예측 조회 기간: 지난 60일 ~ 45일 후 (미래 예약 포함)
function forecastRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 60);
  const end = new Date(today);
  end.setDate(end.getDate() + 45);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export interface RegionSelection {
  region1?: string;
  region2?: string;
}

/**
 * 지역 옵션 리스트 — 1시간 캐시 (대시보드 전체 SSR에서 공유).
 * region1/region2 목록은 일 단위로도 거의 바뀌지 않는 준정적 데이터.
 */
const getCachedRegionOptions = unstable_cache(
  async (): Promise<RegionOption[]> => {
    if (!isBigQueryConfigured()) return [];
    const sql = loadDashboardSql("region-list.sql");
    const rows = await runParameterizedQuery(sql);
    return rows ? buildRegionOptions(rows) : [];
  },
  ["dashboard-region-options"],
  { revalidate: 3600, tags: ["dashboard-region-options"] },
);

/** 지역 선택 상태에 따라 ranking의 group level을 결정:
 *  - 지역 없음   → region1 랭킹 (전국 17개 시/도)
 *  - region1만  → region2 랭킹 (해당 시/도 내 구/군)
 *  - region1+2  → 더 이상 drill 할 하위 레벨 없음 → region2 랭킹 유지 (단일 행) */
function rankingGroupField(sel: RegionSelection): "region1" | "region2" {
  return sel.region1 ? "region2" : "region1";
}

/**
 * 팀 대시보드 전체 데이터를 BigQuery에서 가져온다.
 * @param selection 선택된 region1/region2 (미지정 시 전국)
 */
export async function getTeamDashboardData(
  selection: RegionSelection = {},
): Promise<TeamDashboardData> {
  if (!isBigQueryConfigured()) {
    return mockTeamDashboardData;
  }

  // 입력 검증·sanitize (SQL injection 방지)
  const region1 = selection.region1
    ? sanitizeRegionName(selection.region1)
    : undefined;
  const region2 = selection.region2
    ? sanitizeRegionName(selection.region2)
    : undefined;
  // region2만 있고 region1 없는 경우는 불가 (region2는 region1 하위)
  const effRegion2 = region1 ? region2 : undefined;
  const regionFilter = buildRegionFilter(region1, effRegion2);

  const { start, end } = defaultRange();
  const params = {
    start_date: start,
    end_date: end,
    region_filter: regionFilter,
  };
  const fcRange = forecastRange();
  const fcParams = {
    start_date: fcRange.start,
    end_date: fcRange.end,
    region_filter: regionFilter,
  };

  // 랭킹 기간: 최근 30일
  const rankingStart = new Date();
  rankingStart.setDate(rankingStart.getDate() - 30);
  const rankingEnd = new Date();
  rankingEnd.setDate(rankingEnd.getDate() - 1);
  const rankingGroup = rankingGroupField({ region1, region2: effRegion2 });

  try {
    const dailyMetricsSql = replaceSqlParams(
      loadDashboardSql("daily-metrics.sql"),
      params,
    );
    const weeklyMetricsSql = replaceSqlParams(
      loadDashboardSql("weekly-metrics.sql"),
      params,
    );
    const forecastSql = replaceSqlParams(
      loadDashboardSql("forecast-daily.sql"),
      fcParams,
    );
    const customerDailySql = replaceSqlParams(
      loadCustomerTypeSql("daily.sql"),
      params,
    );
    const customerWeeklySql = replaceSqlParams(
      loadCustomerTypeSql("weekly.sql"),
      params,
    );
    const usageMatrixSql = replaceSqlParams(
      loadUsageMatrixSql("matrix.sql"),
      params,
    );
    const regionRankingSql = replaceSqlParams(
      loadDashboardSql("region-ranking.sql"),
      {
        start_date: rankingStart.toISOString().slice(0, 10),
        end_date: rankingEnd.toISOString().slice(0, 10),
        group_field: rankingGroup,
        parent_filter: regionFilter,
      },
    );
    const forecastRankingSql = replaceSqlParams(
      loadDashboardSql("forecast-region-ranking.sql"),
      {
        start_date: fcRange.start,
        end_date: fcRange.end,
        group_field: rankingGroup,
        parent_filter: regionFilter,
      },
    );
    const [
      dailyRows,
      weeklyRows,
      forecastRows,
      customerDailyRows,
      customerWeeklyRows,
      usageMatrixRows,
      regionRankingRows,
      forecastRankingRows,
      regionOptions,
    ] = await Promise.all([
      runParameterizedQuery(dailyMetricsSql),
      runParameterizedQuery(weeklyMetricsSql),
      runParameterizedQuery(forecastSql),
      runParameterizedQuery(customerDailySql),
      runParameterizedQuery(customerWeeklySql),
      runParameterizedQuery(usageMatrixSql),
      runParameterizedQuery(regionRankingSql),
      runParameterizedQuery(forecastRankingSql),
      getCachedRegionOptions(),
    ]);

    const daily = dailyRows ? buildDailyRecords(dailyRows) : [];
    const weekly = weeklyRows ? buildWeeklyRecords(weeklyRows) : [];
    const revenueBreakdownDaily = dailyRows
      ? buildRevenueBreakdownDaily(dailyRows)
      : [];
    const revenueBreakdownWeekly = weeklyRows
      ? buildRevenueBreakdownWeekly(weeklyRows)
      : [];
    const costBreakdownDaily = dailyRows
      ? buildCostBreakdownDaily(dailyRows)
      : [];
    const costBreakdownWeekly = weeklyRows
      ? buildCostBreakdownWeekly(weeklyRows)
      : [];
    const customerTypeDaily = customerDailyRows
      ? buildCustomerTypeDaily(customerDailyRows)
      : [];
    const customerTypeWeekly = customerWeeklyRows
      ? buildCustomerTypeWeekly(customerWeeklyRows)
      : [];
    const usageMatrix = usageMatrixRows ? buildUsageMatrix(usageMatrixRows) : [];
    const forecastDaily = forecastRows ? buildForecastRows(forecastRows) : [];
    const regionRanking = regionRankingRows
      ? buildRegionRanking(regionRankingRows)
      : [];
    const forecastRegionRanking = forecastRankingRows
      ? buildRegionRanking(forecastRankingRows)
      : [];

    return {
      daily,
      weekly,
      customerTypeDaily,
      customerTypeWeekly,
      usageMatrix,
      revenueBreakdownDaily,
      revenueBreakdownWeekly,
      costBreakdownDaily,
      costBreakdownWeekly,
      forecastDaily,
      regionRanking,
      forecastRegionRanking,
      regionOptions,
      currentRegion: { region1, region2: effRegion2 },
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("BigQuery 대시보드 데이터 조회 실패, mock 폴백:", error);
    return {
      ...mockTeamDashboardData,
      fetchedAt: new Date().toISOString(),
    };
  }
}
