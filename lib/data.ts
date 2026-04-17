// 경남울산사업팀 매출 대시보드 — BigQuery 직접 연동 데이터 레이어
//
// Google Sheets 의존성을 제거하고 모든 데이터를 BigQuery에서 조회한다.
// 필터 조건:
//   - region1 IN ('경상남도', '울산광역시')    — 부울경사업팀(경남+울산) 스코프
//   - car_sharing_type IN ('socar', 'zplus')  — 카셰어링 차량만
//   - car_state IN ('운영', '수리')           — 실제 운영 차량만
//
// 예외:
//   - weeklyTarget / forecastDaily는 BQ에 목표 데이터 소스가 없어 빈값 처리
//     추후 목표 관리용 테이블 또는 API가 생기면 해당 로더를 추가한다.
import type { TeamDashboardData } from "@/types/dashboard";
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
} from "./dashboard-bq";
import {
  loadCustomerTypeSql,
  buildDailyResponse as buildCustomerTypeDaily,
  buildWeeklyResponse as buildCustomerTypeWeekly,
} from "./customer-type";
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

/**
 * 팀 대시보드 전체 데이터를 BigQuery에서 가져온다.
 *
 * - BQ 환경변수 미설정 → mockTeamDashboardData 즉시 반환 (로컬 미인증 환경)
 * - 5개 쿼리 병렬 실행: daily-metrics, weekly-metrics, customer-type daily/weekly
 *   + daily/weekly 메트릭 쿼리에 매출·비용 세분화가 함께 포함되어 있음
 */
export async function getTeamDashboardData(): Promise<TeamDashboardData> {
  if (!isBigQueryConfigured()) {
    return mockTeamDashboardData;
  }

  const { start, end } = defaultRange();
  const params = { start_date: start, end_date: end };
  const fcRange = forecastRange();
  const fcParams = { start_date: fcRange.start, end_date: fcRange.end };

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

    const [
      dailyRows,
      weeklyRows,
      forecastRows,
      customerDailyRows,
      customerWeeklyRows,
    ] = await Promise.all([
      runParameterizedQuery(dailyMetricsSql),
      runParameterizedQuery(weeklyMetricsSql),
      runParameterizedQuery(forecastSql),
      runParameterizedQuery(customerDailySql),
      runParameterizedQuery(customerWeeklySql),
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

    // 예측 탭: 사전(forecast)은 실적/예상 혼합, target/achievement은 BQ 소스 없음 → 0 스텁
    const forecastDaily = forecastRows
      ? buildForecastRows(forecastRows)
      : [];

    return {
      daily,
      weekly,
      customerTypeDaily,
      customerTypeWeekly,
      revenueBreakdownDaily,
      revenueBreakdownWeekly,
      costBreakdownDaily,
      costBreakdownWeekly,
      forecastDaily,
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
