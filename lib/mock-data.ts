// 경남울산사업팀 매출 대시보드 — 개발/폴백용 mock 데이터
//
// 기준일(TODAY)은 모듈 로드 시점에 한 번 고정되어, 오늘 기준 상대 날짜로 전 영역이 생성된다.
// 값은 seed 기반 pseudo-random(deterministic)으로 생성하여 재시작/리로드 시에도 같은 결과.
import type {
  DailyRecord,
  WeeklyRecord,
  TeamDashboardData,
  CustomerTypeRow,
  UsageMatrixRow,
  RevenueBreakdownRow,
  CostBreakdownRow,
  ForecastRow,
} from "@/types/dashboard";

const MOCK_CAR_COUNT = 200;

// 기준일: 모듈 로드 시점 (SSR 프로세스에서 한 번만 고정)
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const YESTERDAY = new Date(TODAY);
YESTERDAY.setDate(YESTERDAY.getDate() - 1);

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// mulberry32-lite deterministic PRNG → 0..1
function prng(seed: number): number {
  let x = (seed * 1664525 + 1013904223) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822507) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 0xffffffff;
}

// --- 일별 mock (오늘 기준 45일 전 ~ 어제) ---
const DAILY_DAYS = 45;

function generateDailyMock(daysBack: number): DailyRecord {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - daysBack);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;

  const j1 = prng(daysBack * 31 + 7);
  const j2 = prng(daysBack * 53 + 11);

  const revBase = isWeekend ? 8_500_000 : 10_400_000;
  const revenue = Math.round(revBase + (j1 - 0.5) * 3_000_000);
  const profitRate = isWeekend ? 0.06 : 0.14;
  const profit = Math.round(revenue * (profitRate + (j2 - 0.5) * 0.1));
  const usageHours = Math.round(42 + (j1 - 0.3) * 18);
  const usageCount = Math.round(30 + (j2 - 0.3) * 16);
  const utilizationRate = Math.round((70 + (j1 - 0.3) * 22) * 10) / 10;

  return {
    date: toISODate(d),
    revenue,
    profit,
    usageHours,
    usageCount,
    utilizationRate,
    revenuePerCar: revenue / MOCK_CAR_COUNT,
    usageCountPerCar: usageCount / MOCK_CAR_COUNT,
    usageHoursPerCar: usageHours / MOCK_CAR_COUNT,
  };
}

export const mockDailyRecords: DailyRecord[] = Array.from(
  { length: DAILY_DAYS },
  (_, i) => generateDailyMock(DAILY_DAYS - i), // 오래된 → 최신 순
);

// --- 주차별 mock (최근 2개월의 각 1~4주차) ---
function generateWeeklyMock(): WeeklyRecord[] {
  const rows: WeeklyRecord[] = [];
  // 전월 1일, 이번달 1일 — 각 4주차
  const months: Array<{ year: number; month: number }> = [
    { year: TODAY.getFullYear(), month: TODAY.getMonth() - 1 },
    { year: TODAY.getFullYear(), month: TODAY.getMonth() },
  ];
  for (const { year, month } of months) {
    const normYear = month < 0 ? year - 1 : year;
    const normMonth = month < 0 ? 12 + month : month;
    const monthLabel = normMonth + 1; // 1-indexed
    for (let w = 1; w <= 4; w++) {
      const seed = normYear * 100 + monthLabel * 10 + w;
      const j1 = prng(seed * 13);
      const j2 = prng(seed * 29);
      const revenue = Math.round(65_000_000 + (j1 - 0.5) * 22_000_000);
      const profit = Math.round(revenue * (0.1 + (j2 - 0.5) * 0.15));
      const usageHours = Math.round(290 + (j1 - 0.5) * 100);
      const usageCount = Math.round(205 + (j2 - 0.5) * 80);
      const utilizationRate = Math.round((78 + (j1 - 0.5) * 28) * 10) / 10;
      rows.push({
        week: `${monthLabel}월 ${w}주차`,
        isoWeek: rows.length + 1,
        revenue,
        profit,
        usageHours,
        usageCount,
        utilizationRate,
        revenuePerCar: revenue / MOCK_CAR_COUNT,
        usageCountPerCar: usageCount / MOCK_CAR_COUNT,
        usageHoursPerCar: usageHours / MOCK_CAR_COUNT,
      });
    }
  }
  return rows;
}

export const mockWeeklyRecords: WeeklyRecord[] = generateWeeklyMock();

// --- 고객 유형 daily (오늘 기준 40일 전 ~ 어제) ---
function generateCustomerTypeDaily(): CustomerTypeRow[] {
  const rows: CustomerTypeRow[] = [];
  const days = 40;
  for (let i = days; i >= 1; i--) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - i);
    const j1 = prng(i * 19 + 3);
    const j2 = prng(i * 37 + 5);
    const j3 = prng(i * 59 + 7);
    rows.push({
      date: toISODate(d),
      roundTripCount: Math.round(14 + j1 * 10),
      callCount: Math.round(9 + j2 * 8),
      oneWayCount: Math.round(4 + j3 * 5),
    });
  }
  return rows;
}

// --- 고객 유형 weekly (최근 2개월 각 1~4주차) ---
function generateCustomerTypeWeekly(): CustomerTypeRow[] {
  const rows: CustomerTypeRow[] = [];
  const months: Array<{ year: number; month: number }> = [
    { year: TODAY.getFullYear(), month: TODAY.getMonth() - 1 },
    { year: TODAY.getFullYear(), month: TODAY.getMonth() },
  ];
  for (const { year, month } of months) {
    const normYear = month < 0 ? year - 1 : year;
    const normMonth = month < 0 ? 12 + month : month;
    const monthLabel = normMonth + 1;
    for (let w = 1; w <= 4; w++) {
      const seed = normYear * 100 + monthLabel * 10 + w;
      rows.push({
        week: `${monthLabel}월 ${w}주차`,
        roundTripCount: Math.round(100 + prng(seed * 3) * 30),
        callCount: Math.round(65 + prng(seed * 7) * 22),
        oneWayCount: Math.round(32 + prng(seed * 11) * 18),
      });
    }
  }
  return rows;
}

// --- 연령×이용시간 매트릭스 (오늘 기준 90일 전 ~ 어제) ---
function generateUsageMatrix(): UsageMatrixRow[] {
  const ages = ["01_21-22", "02_23-26", "03_27-30", "04_31-40", "05_41+"] as const;
  const durations = [
    "under4h",
    "from4to8h",
    "from8to12h",
    "from12to24h",
    "from24to48h",
    "over48h",
  ] as const;
  const ageWeights: Record<(typeof ages)[number], number> = {
    "01_21-22": 0.8,
    "02_23-26": 1.2,
    "03_27-30": 1.0,
    "04_31-40": 1.1,
    "05_41+": 0.9,
  };
  const durBase: Record<(typeof durations)[number], number> = {
    under4h: 6,
    from4to8h: 4,
    from8to12h: 2,
    from12to24h: 2,
    from24to48h: 1,
    over48h: 1,
  };
  const revPerUseBase = 38000;
  const revMul: Record<(typeof durations)[number], number> = {
    under4h: 1.0,
    from4to8h: 2.2,
    from8to12h: 3.0,
    from12to24h: 4.8,
    from24to48h: 8.0,
    over48h: 14.0,
  };

  const rows: UsageMatrixRow[] = [];
  const MATRIX_DAYS = 90;
  for (let i = MATRIX_DAYS; i >= 1; i--) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const dayType: "weekday" | "weekend" = dow === 0 || dow === 6 ? "weekend" : "weekday";
    const dayMul = dayType === "weekend" ? 0.7 : 1.0;
    const iso = toISODate(d);
    for (const age of ages) {
      for (const dur of durations) {
        const jitter = 0.8 + prng(i * 1000 + age.charCodeAt(0) * 31 + dur.charCodeAt(0)) * 0.4;
        const nuse = Math.max(0, Math.round(durBase[dur] * ageWeights[age] * dayMul * jitter));
        if (nuse === 0) continue;
        const revenue = Math.round(nuse * revPerUseBase * revMul[dur]);
        rows.push({ date: iso, ageGroup: age, durationGroup: dur, dayType, nuse, revenue });
      }
    }
  }
  return rows;
}

// --- 예측 매출 (오늘 기준 -7일 ~ +14일) ---
function generateForecastDaily(): ForecastRow[] {
  const rows: ForecastRow[] = [];
  for (let i = -7; i <= 14; i++) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const base = isWeekend ? 8_800_000 : 10_200_000;
    const j = prng((i + 100) * 41);
    rows.push({
      date: toISODate(d),
      forecastRevenue: Math.round(base + (j - 0.5) * 2_500_000),
    });
  }
  return rows;
}

// --- 통합 mock 데이터 ---
export const mockTeamDashboardData: TeamDashboardData = {
  daily: mockDailyRecords,
  weekly: mockWeeklyRecords,
  customerTypeDaily: generateCustomerTypeDaily(),
  customerTypeWeekly: generateCustomerTypeWeekly(),
  usageMatrix: generateUsageMatrix(),
  revenueBreakdownDaily: [] as RevenueBreakdownRow[],
  revenueBreakdownWeekly: [] as RevenueBreakdownRow[],
  costBreakdownDaily: [] as CostBreakdownRow[],
  costBreakdownWeekly: [] as CostBreakdownRow[],
  forecastDaily: generateForecastDaily(),
  regionRanking: [],
  forecastRegionRanking: [],
  regionOptions: [],
  currentRegion: {},
  fetchedAt: YESTERDAY.toISOString(),
};
