'use client';

// DashboardContent — 기간 필터 상태 + URL 기반 지역 선택을 소유
// 전체 데이터를 수신하여 선택된 기간·지역에 맞게 필터링 후 하위 컴포넌트에 전달
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';
import type { TeamDashboardData } from '@/types/dashboard';
import { aggregateKpi } from '@/lib/kpi-utils';
import {
  type PeriodKey,
  type DateRange,
  getDateRange,
  filterDailyByPeriod,
  filterWeeklyByPeriod,
  filterCustomerTypeWeekly,
  parseWeekMonth,
  DEFAULT_DAILY_PERIOD,
  DEFAULT_WEEKLY_PERIOD,
  DAILY_PERIODS,
} from '@/lib/period-utils';
import type { UsageMatrixRow } from '@/types/dashboard';
import { DashboardHeader } from './dashboard-header';
import { KpiCards } from './kpi-cards';
import { ChartsSection } from './charts/charts-section';
import { DataTable } from './data-table';
import { ForecastChart } from './charts/forecast-chart';
import { RegionRanking } from './region-ranking';
import { RegionDetailTable } from './region-detail-table';
import { ForecastDetailTable } from './forecast-detail-table';

interface DashboardContentProps {
  data: TeamDashboardData;
  tab: 'daily' | 'weekly' | 'forecast';
  initialPeriod?: string;
}

function parsePeriod(raw: string | undefined, tab: 'daily' | 'weekly' | 'forecast'): PeriodKey {
  if (!raw) {
    return tab === 'weekly' ? DEFAULT_WEEKLY_PERIOD : DEFAULT_DAILY_PERIOD;
  }
  if (tab !== 'weekly' && (DAILY_PERIODS as string[]).includes(raw)) {
    return raw as PeriodKey;
  }
  if (tab === 'weekly' && (raw === 'this-month' || raw === 'last-month')) {
    return raw as PeriodKey;
  }
  return tab === 'weekly' ? DEFAULT_WEEKLY_PERIOD : DEFAULT_DAILY_PERIOD;
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DashboardContent({ data, tab, initialPeriod }: DashboardContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [period, setPeriodState] = useState<PeriodKey>(() => parsePeriod(initialPeriod, tab));
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { region1: currentRegion1, region2: currentRegion2 } = data.currentRegion;
  const canDrillToRegion2 = !!currentRegion1 && !currentRegion2;

  const handlePeriodChange = useCallback(
    (newPeriod: PeriodKey) => {
      setPeriodState(newPeriod);
      const params = new URLSearchParams(searchParams.toString());
      params.set('period', newPeriod);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, pathname],
  );

  const handleCustomRange = useCallback(
    (range: DateRange) => {
      setCustomRange(range);
      setPeriodState('custom');
      const params = new URLSearchParams(searchParams.toString());
      params.set('period', 'custom');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, pathname],
  );

  /** 랭킹 카드 클릭 — 드롭다운과 동일하게 URL 업데이트 (region1 미선택 시 region1 지정, 있으면 region2 지정) */
  const handleRegionClick = useCallback(
    (region: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (currentRegion1) {
        params.set('region2', region);
      } else {
        params.set('region1', region);
        params.delete('region2');
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, pathname, currentRegion1],
  );

  const filteredData = useMemo<TeamDashboardData>(() => {
    if (tab === 'forecast') {
      const range = getDateRange(period, undefined, customRange);
      const today = new Date();
      let forecastEnd = range.end;
      if (period === 'this-week') {
        const sunday = new Date(today);
        sunday.setDate(today.getDate() + (7 - (today.getDay() || 7)));
        forecastEnd = toLocalDateStr(sunday);
      } else if (period === 'this-month') {
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        forecastEnd = toLocalDateStr(lastDay);
      }
      const filteredForecastDaily = data.forecastDaily.filter(
        (r) => r.date >= range.start && r.date <= forecastEnd,
      );
      return { ...data, forecastDaily: filteredForecastDaily };
    }
    if (tab === 'daily') {
      const range = getDateRange(period, undefined, customRange);
      const filtered = filterDailyByPeriod(data.daily, range);
      const filteredCustomerTypeDaily = data.customerTypeDaily.filter(
        (r) => r.date !== undefined && r.date >= range.start && r.date <= range.end,
      );
      const filteredRevenueBreakdownDaily = data.revenueBreakdownDaily.filter(
        (r) => r.date >= range.start && r.date <= range.end,
      );
      return {
        ...data,
        daily: filtered,
        customerTypeDaily: filteredCustomerTypeDaily,
        revenueBreakdownDaily: filteredRevenueBreakdownDaily,
      };
    } else {
      const weeklyPeriod = (period === 'last-month' ? 'last-month' : 'this-month') as
        | 'this-month'
        | 'last-month';
      const filtered = filterWeeklyByPeriod(data.weekly, weeklyPeriod);
      const filteredCustomerTypeWeekly = filterCustomerTypeWeekly(data.customerTypeWeekly, weeklyPeriod);
      // revenueBreakdownWeekly: week_label("2월 3주차")이 date 필드에 저장됨 → 월 파싱으로 필터
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const targetMonth = weeklyPeriod === 'this-month' ? currentMonth : lastMonth;
      const hasUnparseable = data.revenueBreakdownWeekly.some((r) => parseWeekMonth(r.date) === null);
      const filteredRevenueBreakdownWeekly = hasUnparseable
        ? data.revenueBreakdownWeekly
        : data.revenueBreakdownWeekly.filter((r) => parseWeekMonth(r.date) === targetMonth);
      return {
        ...data,
        weekly: filtered,
        customerTypeWeekly: filteredCustomerTypeWeekly,
        revenueBreakdownWeekly: filteredRevenueBreakdownWeekly,
      };
    }
  }, [data, tab, period, customRange]);

  /** 연령×이용시간 매트릭스 — 현재/직전 기간 데이터 분리.
   *  Daily: 선택 기간 + 직전 동일 길이 기간.
   *  Weekly(this-month/last-month): 월 1일~말일(현재는 오늘까지) + 직전 같은 길이 윈도우. */
  const usageMatrixPeriods = useMemo<{
    current: UsageMatrixRow[];
    previous: UsageMatrixRow[];
    currentRange?: DateRange;
    previousRange?: DateRange;
  }>(() => {
    if (tab === 'forecast') return { current: [], previous: [] };
    // 두 탭 모두 date 범위 기준 필터 — weekly는 월 1일부터 말일(또는 오늘)까지로 해석
    let rangeStart: string;
    let rangeEnd: string;
    if (tab === 'daily') {
      const range = getDateRange(period, undefined, customRange);
      rangeStart = range.start;
      rangeEnd = range.end;
    } else {
      // weekly: this-month or last-month의 월 범위로 변환
      const today = new Date();
      const weeklyPeriod = period === 'last-month' ? 'last-month' : 'this-month';
      const y = today.getFullYear();
      const m = today.getMonth(); // 0-indexed
      if (weeklyPeriod === 'this-month') {
        rangeStart = toLocalDateStr(new Date(y, m, 1));
        rangeEnd = toLocalDateStr(today);
      } else {
        rangeStart = toLocalDateStr(new Date(y, m - 1, 1));
        rangeEnd = toLocalDateStr(new Date(y, m, 0)); // 전월 말일
      }
    }
    const startDate = new Date(rangeStart + 'T00:00:00');
    const endDate = new Date(rangeEnd + 'T00:00:00');
    const lengthDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (lengthDays - 1));
    const prevStartStr = toLocalDateStr(prevStart);
    const prevEndStr = toLocalDateStr(prevEnd);
    const current = data.usageMatrix.filter((r) => r.date >= rangeStart && r.date <= rangeEnd);
    const previous = data.usageMatrix.filter((r) => r.date >= prevStartStr && r.date <= prevEndStr);
    return {
      current,
      previous,
      currentRange: { start: rangeStart, end: rangeEnd },
      previousRange: { start: prevStartStr, end: prevEndStr },
    };
  }, [tab, data, period, customRange]);

  const regionLabel = currentRegion1
    ? currentRegion2
      ? `${currentRegion1} · ${currentRegion2}`
      : currentRegion1
    : '전국';
  const forecastChartTitle = regionLabel;

  /** KPI 집계 — 현재 기간 SUM/AVG + 직전 동일 길이 기간 비교 */
  const kpi = useMemo(() => {
    if (tab === 'forecast') return null;
    if (tab === 'daily') {
      const range = getDateRange(period, undefined, customRange);
      const currentRecords = filterDailyByPeriod(data.daily, range);
      // 직전 같은 길이 기간 계산
      const startDate = new Date(range.start + 'T00:00:00');
      const endDate = new Date(range.end + 'T00:00:00');
      const lengthDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
      const prevEnd = new Date(startDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - (lengthDays - 1));
      const prevRange = {
        start: toLocalDateStr(prevStart),
        end: toLocalDateStr(prevEnd),
      };
      const previousRecords = filterDailyByPeriod(data.daily, prevRange);

      const sparklineN = 14;
      const sparkSrc = [...data.daily].sort((a, b) => a.date.localeCompare(b.date)).slice(-sparklineN);

      return {
        current: aggregateKpi(currentRecords),
        previous: previousRecords.length > 0 ? aggregateKpi(previousRecords) : null,
        sparklines: {
          revenue: sparkSrc.map((d) => d.revenue),
          revenuePerCar: sparkSrc.map((d) => d.revenuePerCar),
          gpm: sparkSrc.map((d) => (d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0)),
          usageCountPerCar: sparkSrc.map((d) => d.usageCountPerCar),
          utilizationRate: sparkSrc.map((d) => d.utilizationRate),
          usageHoursPerCar: sparkSrc.map((d) => d.usageHoursPerCar),
        },
        hasData: currentRecords.length > 0,
      };
    }
    // weekly
    const weeklyPeriod = (period === 'last-month' ? 'last-month' : 'this-month') as
      | 'this-month'
      | 'last-month';
    const currentRecords = filterWeeklyByPeriod(data.weekly, weeklyPeriod);
    // 직전 같은 개수 주차
    const currentFirstIdx = currentRecords.length > 0
      ? data.weekly.findIndex((w) => w.week === currentRecords[0].week && w.isoWeek === currentRecords[0].isoWeek)
      : -1;
    const previousRecords = currentFirstIdx > 0
      ? data.weekly.slice(Math.max(0, currentFirstIdx - currentRecords.length), currentFirstIdx)
      : [];

    const sparkSrc = [...data.weekly].sort((a, b) => a.isoWeek - b.isoWeek).slice(-8);

    return {
      current: aggregateKpi(currentRecords),
      previous: previousRecords.length > 0 ? aggregateKpi(previousRecords) : null,
      sparklines: {
        revenue: sparkSrc.map((w) => w.revenue),
        revenuePerCar: sparkSrc.map((w) => w.revenuePerCar),
        gpm: sparkSrc.map((w) => (w.revenue > 0 ? (w.profit / w.revenue) * 100 : 0)),
        usageCountPerCar: sparkSrc.map((w) => w.usageCountPerCar),
        utilizationRate: sparkSrc.map((w) => w.utilizationRate),
        usageHoursPerCar: sparkSrc.map((w) => w.usageHoursPerCar),
      },
      hasData: currentRecords.length > 0,
    };
  }, [tab, data, period, customRange]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        tab={tab}
        period={period}
        onPeriodChange={handlePeriodChange}
        onCustomRange={handleCustomRange}
        customRange={customRange}
        regionOptions={data.regionOptions}
        currentRegion={data.currentRegion}
      />

      {/* 예측 탭: ForecastChart + 지역 랭킹 */}
      {tab === 'forecast' ? (
        <>
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">매출 예측 · {regionLabel}</h2>
            {filteredData.forecastDaily.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/80 py-16 backdrop-blur">
                <p className="text-sm text-muted-foreground">선택한 기간에 예측 데이터가 없습니다.</p>
              </div>
            ) : (
              <ForecastChart data={filteredData.forecastDaily} title={forecastChartTitle} />
            )}
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-foreground">
              지역 분석 {currentRegion1 ? `(${currentRegion1} 하위)` : '(전국 region1)'}
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <RegionRanking
                data={data.forecastRegionRanking}
                canDrillDown={canDrillToRegion2 || !currentRegion1}
                onRegionClick={handleRegionClick}
              />
              <div className="md:col-span-2">
                <ForecastDetailTable
                  data={data.forecastRegionRanking}
                  canDrillDown={canDrillToRegion2 || !currentRegion1}
                  onRegionClick={handleRegionClick}
                />
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">핵심 지표 · {regionLabel}</h2>
            {kpi && (
              <KpiCards
                current={kpi.current}
                previous={kpi.previous}
                sparklines={kpi.sparklines}
                hasData={kpi.hasData}
              />
            )}
          </section>

          <ChartsSection
            data={filteredData}
            tab={tab}
            usageMatrixCurrent={usageMatrixPeriods.current}
            usageMatrixPrevious={usageMatrixPeriods.previous}
            usageMatrixCurrentRange={usageMatrixPeriods.currentRange}
            usageMatrixPreviousRange={usageMatrixPeriods.previousRange}
          />

          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              지역 분석 {currentRegion1 ? `(${currentRegion1} 하위)` : '(전국 region1)'}
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <RegionRanking
                data={data.regionRanking}
                canDrillDown={canDrillToRegion2 || !currentRegion1}
                onRegionClick={handleRegionClick}
              />
              <div className="md:col-span-2">
                <RegionDetailTable
                  data={data.regionRanking}
                  canDrillDown={canDrillToRegion2 || !currentRegion1}
                  onRegionClick={handleRegionClick}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">상세 데이터</h2>
            <DataTable data={filteredData} tab={tab} />
          </section>
        </>
      )}
    </div>
  );
}
