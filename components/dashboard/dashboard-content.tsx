'use client';

// DashboardContent — 기간 필터 상태 + URL 기반 지역 선택을 소유
// 전체 데이터를 수신하여 선택된 기간·지역에 맞게 필터링 후 하위 컴포넌트에 전달
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';
import type { TeamDashboardData } from '@/types/dashboard';
import { toast } from 'sonner';
import { exportToCsv, exportToXlsx } from '@/lib/export-utils';
import {
  type PeriodKey,
  type DateRange,
  getDateRange,
  filterDailyByPeriod,
  filterWeeklyByPeriod,
  filterCustomerTypeWeekly,
  DEFAULT_DAILY_PERIOD,
  DEFAULT_WEEKLY_PERIOD,
  DAILY_PERIODS,
} from '@/lib/period-utils';
import { DashboardHeader } from './dashboard-header';
import { KpiCards } from './kpi-cards';
import { ChartsSection } from './charts/charts-section';
import { DataTable } from './data-table';
import { ForecastChart } from './charts/forecast-chart';
import { RegionRanking } from './region-ranking';
import { RegionDetailTable } from './region-detail-table';
import { ForecastDetailTable } from './forecast-detail-table';
import { RegionSelector } from './region-selector';

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
      return { ...data, daily: filtered, customerTypeDaily: filteredCustomerTypeDaily };
    } else {
      const weeklyPeriod = (period === 'last-month' ? 'last-month' : 'this-month') as
        | 'this-month'
        | 'last-month';
      const filtered = filterWeeklyByPeriod(data.weekly, weeklyPeriod);
      const filteredCustomerTypeWeekly = filterCustomerTypeWeekly(data.customerTypeWeekly, weeklyPeriod);
      return { ...data, weekly: filtered, customerTypeWeekly: filteredCustomerTypeWeekly };
    }
  }, [data, tab, period, customRange]);

  const handleExportCsv = useCallback(() => {
    if (tab === 'forecast') return;
    const records = tab === 'daily' ? filteredData.daily : filteredData.weekly;
    try {
      exportToCsv(records, tab);
      toast.success('CSV 파일이 다운로드되었습니다.');
    } catch {
      toast.error('CSV 내보내기에 실패했습니다.');
    }
  }, [filteredData, tab]);

  const handleExportXlsx = useCallback(() => {
    if (tab === 'forecast') return;
    const records = tab === 'daily' ? filteredData.daily : filteredData.weekly;
    try {
      exportToXlsx(records, tab);
      toast.success('Excel 파일이 다운로드되었습니다.');
    } catch {
      toast.error('Excel 내보내기에 실패했습니다.');
    }
  }, [filteredData, tab]);

  const regionLabel = currentRegion1
    ? currentRegion2
      ? `${currentRegion1} · ${currentRegion2}`
      : currentRegion1
    : '전국';
  const forecastChartTitle = regionLabel;

  return (
    <div className="space-y-6">
      {/* 지역 선택 + 헤더 */}
      <div className="flex flex-wrap items-center gap-3">
        <RegionSelector
          regionOptions={data.regionOptions}
          current={data.currentRegion}
        />
        <div className="flex-1">
          <DashboardHeader
            tab={tab}
            period={period}
            onPeriodChange={handlePeriodChange}
            onExportCsv={handleExportCsv}
            onExportXlsx={handleExportXlsx}
            onCustomRange={handleCustomRange}
            customRange={customRange}
          />
        </div>
      </div>

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
            <KpiCards data={filteredData} fullData={data} tab={tab} />
          </section>

          <ChartsSection data={filteredData} tab={tab} />

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
