// 경남울산사업팀 매출 대시보드 — 개발/폴백용 mock 데이터
import type { DailyRecord, WeeklyRecord, TeamDashboardData, CustomerTypeRow, RevenueBreakdownRow, CostBreakdownRow, ForecastRow } from "@/types/dashboard";

type DailyMock = Omit<DailyRecord, "revenuePerCar" | "usageCountPerCar" | "usageHoursPerCar">;
type WeeklyMock = Omit<WeeklyRecord, "revenuePerCar" | "usageCountPerCar" | "usageHoursPerCar" | "isoWeek">;
const MOCK_CAR_COUNT = 200; // 대당 지표 fallback 계산용 가상 차량 수

// --- 일별 mock 데이터 (43개: 2026-01-26 ~ 2026-03-08) ---
// 2026-03 데이터 추가: 기본 period가 this-month(3월)이므로 현재 날짜 기준 데이터 필요
const _mockDailyBase: DailyMock[] = [
  // 1주차: 2026-01-26 ~ 2026-02-01
  { date: "2026-01-26", revenue: 9200000, profit: 1200000, usageHours: 42, usageCount: 28, utilizationRate: 72.5 },
  { date: "2026-01-27", revenue: 10500000, profit: 1800000, usageHours: 48, usageCount: 35, utilizationRate: 83.2 },
  { date: "2026-01-28", revenue: 8300000, profit: -200000, usageHours: 38, usageCount: 22, utilizationRate: 63.8 },
  { date: "2026-01-29", revenue: 11200000, profit: 1950000, usageHours: 51, usageCount: 41, utilizationRate: 87.4 },
  { date: "2026-01-30", revenue: 9800000, profit: 1400000, usageHours: 45, usageCount: 33, utilizationRate: 77.1 },
  { date: "2026-01-31", revenue: 8000000, profit: -500000, usageHours: 36, usageCount: 21, utilizationRate: 57.3 },
  { date: "2026-02-01", revenue: 10100000, profit: 1600000, usageHours: 47, usageCount: 38, utilizationRate: 81.0 },

  // 2주차: 2026-02-02 ~ 2026-02-08
  { date: "2026-02-02", revenue: 9500000, profit: 900000, usageHours: 43, usageCount: 29, utilizationRate: 74.2 },
  { date: "2026-02-03", revenue: 11800000, profit: 2000000, usageHours: 54, usageCount: 44, utilizationRate: 91.5 },
  { date: "2026-02-04", revenue: 8600000, profit: 300000, usageHours: 40, usageCount: 25, utilizationRate: 66.7 },
  { date: "2026-02-05", revenue: 10900000, profit: 1750000, usageHours: 50, usageCount: 40, utilizationRate: 85.0 },
  { date: "2026-02-06", revenue: 9100000, profit: 1100000, usageHours: 41, usageCount: 30, utilizationRate: 70.8 },
  { date: "2026-02-07", revenue: 8200000, profit: -300000, usageHours: 37, usageCount: 22, utilizationRate: 59.2 },
  { date: "2026-02-08", revenue: 10400000, profit: 1500000, usageHours: 47, usageCount: 36, utilizationRate: 80.3 },

  // 3주차: 2026-02-09 ~ 2026-02-15
  { date: "2026-02-09", revenue: 9700000, profit: 1300000, usageHours: 44, usageCount: 31, utilizationRate: 75.6 },
  { date: "2026-02-10", revenue: 11500000, profit: 1900000, usageHours: 53, usageCount: 43, utilizationRate: 89.3 },
  { date: "2026-02-11", revenue: 8100000, profit: -400000, usageHours: 36, usageCount: 20, utilizationRate: 55.8 },
  { date: "2026-02-12", revenue: 10700000, profit: 1800000, usageHours: 49, usageCount: 39, utilizationRate: 84.1 },
  { date: "2026-02-13", revenue: 9300000, profit: 1000000, usageHours: 42, usageCount: 28, utilizationRate: 71.4 },
  { date: "2026-02-14", revenue: 12000000, profit: 1980000, usageHours: 55, usageCount: 45, utilizationRate: 92.0 },
  { date: "2026-02-15", revenue: 8900000, profit: 700000, usageHours: 40, usageCount: 27, utilizationRate: 67.5 },

  // 4주차: 2026-02-16 ~ 2026-02-22
  { date: "2026-02-16", revenue: 10300000, profit: 1650000, usageHours: 47, usageCount: 37, utilizationRate: 79.2 },
  { date: "2026-02-17", revenue: 9000000, profit: 850000, usageHours: 41, usageCount: 26, utilizationRate: 68.3 },
  { date: "2026-02-18", revenue: 11600000, profit: 1920000, usageHours: 52, usageCount: 42, utilizationRate: 88.7 },
  { date: "2026-02-19", revenue: 8400000, profit: -100000, usageHours: 38, usageCount: 23, utilizationRate: 62.1 },
  { date: "2026-02-20", revenue: 10600000, profit: 1700000, usageHours: 48, usageCount: 38, utilizationRate: 82.5 },
  { date: "2026-02-21", revenue: 9400000, profit: 1050000, usageHours: 43, usageCount: 32, utilizationRate: 73.3 },
  { date: "2026-02-22", revenue: 10000000, profit: 1550000, usageHours: 46, usageCount: 35, utilizationRate: 78.9 },

  // 2026-03 (이번 달 기본 데이터: 2026-03-01 ~ 2026-03-08)
  { date: "2026-03-01", revenue: 10800000, profit: 1720000, usageHours: 49, usageCount: 36, utilizationRate: 80.5 },
  { date: "2026-03-02", revenue: 9600000, profit: 1100000, usageHours: 44, usageCount: 30, utilizationRate: 74.8 },
  { date: "2026-03-03", revenue: 11900000, profit: 2050000, usageHours: 55, usageCount: 46, utilizationRate: 93.2 },
  { date: "2026-03-04", revenue: 8700000, profit: 250000, usageHours: 40, usageCount: 24, utilizationRate: 65.4 },
  { date: "2026-03-05", revenue: 10200000, profit: 1580000, usageHours: 46, usageCount: 35, utilizationRate: 78.1 },
  { date: "2026-03-06", revenue: 9300000, profit: 980000, usageHours: 42, usageCount: 29, utilizationRate: 72.0 },
  { date: "2026-03-07", revenue: 11400000, profit: 1880000, usageHours: 52, usageCount: 41, utilizationRate: 87.6 },
  { date: "2026-03-08", revenue: 10100000, profit: 1620000, usageHours: 46, usageCount: 37, utilizationRate: 79.4 },
];

export const mockDailyRecords: DailyRecord[] = _mockDailyBase.map((r) => ({
  ...r,
  revenuePerCar: r.revenue / MOCK_CAR_COUNT,
  usageCountPerCar: r.usageCount / MOCK_CAR_COUNT,
  usageHoursPerCar: r.usageHours / MOCK_CAR_COUNT,
}));

// --- 주차별 mock 데이터 (8개: 1주차 ~ 8주차) ---
const _mockWeeklyBase: WeeklyMock[] = [
  { week: "1주차", revenue: 67000000, profit: 8500000, usageHours: 320, usageCount: 215, utilizationRate: 78.4 },
  { week: "2주차", revenue: 72000000, profit: 11000000, usageHours: 345, usageCount: 240, utilizationRate: 86.5 },
  { week: "3주차", revenue: 54000000, profit: -1500000, usageHours: 265, usageCount: 175, utilizationRate: 62.3 },
  { week: "4주차", revenue: 48000000, profit: -2000000, usageHours: 250, usageCount: 160, utilizationRate: 58.0 },
  { week: "5주차", revenue: 68000000, profit: 9200000, usageHours: 330, usageCount: 225, utilizationRate: 81.2 },
  { week: "6주차", revenue: 71000000, profit: 10500000, usageHours: 340, usageCount: 238, utilizationRate: 88.7 },
  { week: "7주차", revenue: 56000000, profit: 500000, usageHours: 275, usageCount: 182, utilizationRate: 64.1 },
  { week: "8주차", revenue: 69500000, profit: 10800000, usageHours: 335, usageCount: 230, utilizationRate: 91.0 },
];

export const mockWeeklyRecords: WeeklyRecord[] = _mockWeeklyBase.map((r, i) => ({
  ...r,
  isoWeek: i + 1,
  revenuePerCar: r.revenue / MOCK_CAR_COUNT,
  usageCountPerCar: r.usageCount / MOCK_CAR_COUNT,
  usageHoursPerCar: r.usageHours / MOCK_CAR_COUNT,
}));

// --- 통합 mock 데이터 ---
export const mockTeamDashboardData: TeamDashboardData = {
  daily: mockDailyRecords,
  weekly: mockWeeklyRecords,
  // Phase 10 — 고객 유형 샘플 데이터 (이번 달 + 지난 달 필터 테스트용)
  customerTypeDaily: [
    // 이번 달 (2026-03) — this-month 필터에서 노출
    { date: "2026-03-01", roundTripCount: 18, callCount: 12, oneWayCount: 6 },
    { date: "2026-03-02", roundTripCount: 15, callCount: 10, oneWayCount: 5 },
    { date: "2026-03-03", roundTripCount: 22, callCount: 16, oneWayCount: 8 },
    { date: "2026-03-04", roundTripCount: 12, callCount: 8, oneWayCount: 4 },
    { date: "2026-03-05", roundTripCount: 20, callCount: 14, oneWayCount: 7 },
    // 지난 달 (2026-02) — last-month 필터에서 노출
    { date: "2026-02-21", roundTripCount: 16, callCount: 11, oneWayCount: 5 },
    { date: "2026-02-22", roundTripCount: 19, callCount: 13, oneWayCount: 6 },
    { date: "2026-02-23", roundTripCount: 14, callCount: 9, oneWayCount: 4 },
  ] as CustomerTypeRow[],
  customerTypeWeekly: [
    // "N월 N주차" 형식 — parseWeekMonth가 월을 파싱 가능
    { week: "2월 1주차", roundTripCount: 108, callCount: 72, oneWayCount: 35 },
    { week: "2월 2주차", roundTripCount: 115, callCount: 80, oneWayCount: 45 },
    { week: "3월 1주차", roundTripCount: 98, callCount: 65, oneWayCount: 32 },
    { week: "3월 2주차", roundTripCount: 105, callCount: 70, oneWayCount: 38 },
  ] as CustomerTypeRow[],
  revenueBreakdownDaily: [] as RevenueBreakdownRow[],
  revenueBreakdownWeekly: [] as RevenueBreakdownRow[],
  costBreakdownDaily: [] as CostBreakdownRow[],
  costBreakdownWeekly: [] as CostBreakdownRow[],
  forecastDaily: [
    { date: "2026-03-01", forecastRevenue: 10200000 },
    { date: "2026-03-02", forecastRevenue: 9100000 },
    { date: "2026-03-03", forecastRevenue: 11500000 },
    { date: "2026-03-04", forecastRevenue: 8400000 },
    { date: "2026-03-05", forecastRevenue: 9800000 },
    { date: "2026-03-06", forecastRevenue: 8900000 },
    { date: "2026-03-07", forecastRevenue: 10900000 },
  ] as ForecastRow[],
  regionRanking: [],
  forecastRegionRanking: [],
  fetchedAt: "2026-03-08T00:00:00.000Z",
};
