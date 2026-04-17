'use client';

// DashboardContent — 기간 필터 상태 소유 Client Component
// 전체 데이터를 수신하여 선택된 기간에 맞게 필터링 후 하위 컴포넌트에 전달
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { TeamDashboardData, RegionRankingRow, ForecastRow } from '@/types/dashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface DashboardContentProps {
  data: TeamDashboardData;
  tab: 'daily' | 'weekly' | 'forecast';
  initialPeriod?: string; // URL에서 읽은 raw string, 검증 전
}

/**
 * URL 파라미터로 받은 raw period 문자열을 검증하여 유효한 PeriodKey로 변환한다.
 * - Daily 탭: 4가지 기간 모두 허용 (this-week, last-week, this-month, last-month)
 * - Weekly 탭: 월 단위만 허용 (this-month, last-month)
 * - 유효하지 않은 값이면 탭 기본값 반환
 */
function parsePeriod(raw: string | undefined, tab: 'daily' | 'weekly' | 'forecast'): PeriodKey {
  if (!raw) {
    return tab === 'weekly' ? DEFAULT_WEEKLY_PERIOD : DEFAULT_DAILY_PERIOD;
  }

  // daily / forecast 탭: 4가지 기간 모두 허용
  if (tab !== 'weekly' && (DAILY_PERIODS as string[]).includes(raw)) {
    return raw as PeriodKey;
  }

  // Weekly 탭은 월 단위만 유효
  if (tab === 'weekly' && (raw === 'this-month' || raw === 'last-month')) {
    return raw as PeriodKey;
  }

  return tab === 'weekly' ? DEFAULT_WEEKLY_PERIOD : DEFAULT_DAILY_PERIOD;
}

/** Date 객체를 로컬 시간 기준 YYYY-MM-DD 문자열로 변환 (UTC 변환 방지) */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 기간 필터 상태를 소유하고 전체 대시보드를 렌더링하는 Client Component */
export function DashboardContent({ data, tab, initialPeriod }: DashboardContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // 기간 상태 — URL 파라미터를 검증하여 초기값 설정
  const [period, setPeriodState] = useState<PeriodKey>(() => parsePeriod(initialPeriod, tab));
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  // 지역 드릴다운 — 전국(null) ↔ 선택된 region1 (region2 랭킹 표시)
  const [drillRegion, setDrillRegion] = useState<string | null>(null);
  const [regionDetailRanking, setRegionDetailRanking] = useState<RegionRankingRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // 예측 탭 드릴다운 — 별도 state (사전 매출 랭킹과 region-specific forecast 차트)
  const [forecastDrillRegion, setForecastDrillRegion] = useState<string | null>(null);
  const [forecastDetailRanking, setForecastDetailRanking] = useState<RegionRankingRow[]>([]);
  const [forecastDrillData, setForecastDrillData] = useState<ForecastRow[]>([]);
  const [forecastDrillLoading, setForecastDrillLoading] = useState(false);

  useEffect(() => {
    if (!drillRegion) {
      setRegionDetailRanking([]);
      return;
    }
    const controller = new AbortController();
    setDrillLoading(true);
    fetch(`/api/dashboard/region-detail?region1=${encodeURIComponent(drillRegion)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((result: { ranking: RegionRankingRow[] }) => {
        if (!controller.signal.aborted) setRegionDetailRanking(result.ranking);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.warn('[region-detail] fetch failed:', err);
          toast.error('지역 상세 조회 실패');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDrillLoading(false);
      });
    return () => controller.abort();
  }, [drillRegion]);

  const handleRegionClick = useCallback((region: string) => {
    setDrillRegion((prev) => (prev ? prev : region)); // region2 단계에서는 더 drill 불가
  }, []);

  const handleBackToNational = useCallback(() => {
    setDrillRegion(null);
  }, []);

  // 예측 탭 drill fetch
  useEffect(() => {
    if (!forecastDrillRegion) {
      setForecastDetailRanking([]);
      setForecastDrillData([]);
      return;
    }
    const controller = new AbortController();
    setForecastDrillLoading(true);
    fetch(`/api/dashboard/forecast-detail?region1=${encodeURIComponent(forecastDrillRegion)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((result: { forecast: ForecastRow[]; ranking: RegionRankingRow[] }) => {
        if (!controller.signal.aborted) {
          setForecastDrillData(result.forecast);
          setForecastDetailRanking(result.ranking);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.warn('[forecast-detail] fetch failed:', err);
          toast.error('지역 사전 매출 조회 실패');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setForecastDrillLoading(false);
      });
    return () => controller.abort();
  }, [forecastDrillRegion]);

  const handleForecastRegionClick = useCallback((region: string) => {
    setForecastDrillRegion((prev) => (prev ? prev : region));
  }, []);

  const handleForecastBackToNational = useCallback(() => {
    setForecastDrillRegion(null);
  }, []);

  /** 기간 변경 핸들러 — 상태 업데이트와 URL 동기화를 함께 처리 */
  const handlePeriodChange = useCallback(
    (newPeriod: PeriodKey) => {
      setPeriodState(newPeriod);
      const params = new URLSearchParams(searchParams.toString());
      params.set('period', newPeriod);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, pathname],
  );

  /** 커스텀 날짜 범위 변경 핸들러 */
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

  /** 선택된 기간에 맞게 데이터를 필터링한다 */
  const filteredData = useMemo<TeamDashboardData>(() => {
    if (tab === 'forecast') {
      const range = getDateRange(period, undefined, customRange);
      // 예측 탭: 미래 데이터도 포함해야 하므로 end를 전체 기간 말일까지 확장
      // this-week → 이번 주 일요일 / this-month → 이번 달 말일
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
      // 고객 유형 일별 데이터도 동일한 날짜 범위로 필터링
      const filteredCustomerTypeDaily = data.customerTypeDaily.filter(
        (r) => r.date !== undefined && r.date >= range.start && r.date <= range.end,
      );
      return { ...data, daily: filtered, customerTypeDaily: filteredCustomerTypeDaily };
    } else {
      // Weekly 탭: this-month 또는 last-month만 유효 (parsePeriod에서 보장됨)
      const weeklyPeriod = (period === 'last-month' ? 'last-month' : 'this-month') as
        | 'this-month'
        | 'last-month';
      const filtered = filterWeeklyByPeriod(data.weekly, weeklyPeriod);
      // 고객 유형 주차별 데이터도 동일한 월 기준으로 필터링
      const filteredCustomerTypeWeekly = filterCustomerTypeWeekly(data.customerTypeWeekly, weeklyPeriod);
      return { ...data, weekly: filtered, customerTypeWeekly: filteredCustomerTypeWeekly };
    }
  }, [data, tab, period, customRange]);

  /** CSV 내보내기 핸들러 — 현재 필터링된 데이터를 .csv로 다운로드 */
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

  /** Excel 내보내기 핸들러 — 현재 필터링된 데이터를 .xlsx로 다운로드 */
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

  return (
    <div className="space-y-6">
      {/* 헤더: 탭 전환 + 기간 필터 + 내보내기 버튼 */}
      <DashboardHeader
        tab={tab}
        period={period}
        onPeriodChange={handlePeriodChange}
        onExportCsv={handleExportCsv}
        onExportXlsx={handleExportXlsx}
        onCustomRange={handleCustomRange}
        customRange={customRange}
      />

      {/* 예측 탭: ForecastChart + 지역 드릴다운 랭킹 */}
      {tab === 'forecast' ? (
        <>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">매출 예측</h2>
                <Badge variant="secondary" className="text-xs">
                  {forecastDrillRegion ?? '전국'}
                </Badge>
                {forecastDrillLoading && (
                  <span className="text-xs text-muted-foreground animate-pulse">로딩중...</span>
                )}
              </div>
              {forecastDrillRegion && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={handleForecastBackToNational}
                >
                  <ArrowLeft className="h-4 w-4" /> 전국
                </Button>
              )}
            </div>
            {(() => {
              const chartData = forecastDrillRegion ? forecastDrillData : filteredData.forecastDaily;
              // 기간 필터 적용 — drill 데이터에도 동일 범위로 필터링
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
              const filtered = chartData.filter((r) => r.date >= range.start && r.date <= forecastEnd);
              return filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/80 py-16 backdrop-blur">
                  <p className="text-sm text-muted-foreground">선택한 기간에 예측 데이터가 없습니다.</p>
                </div>
              ) : (
                <ForecastChart data={filtered} title={forecastDrillRegion ?? '전국'} />
              );
            })()}
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-foreground">지역 분석</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <RegionRanking
                data={forecastDrillRegion ? forecastDetailRanking : data.forecastRegionRanking}
                canDrillDown={!forecastDrillRegion}
                onRegionClick={handleForecastRegionClick}
              />
              <div className="md:col-span-2">
                <ForecastDetailTable
                  data={forecastDrillRegion ? forecastDetailRanking : data.forecastRegionRanking}
                  canDrillDown={!forecastDrillRegion}
                  onRegionClick={handleForecastRegionClick}
                />
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          {/* KPI 카드 — 필터링된 데이터(current/previous)와 전체 이력(sparkline) 기반 */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">핵심 지표</h2>
            <KpiCards data={filteredData} fullData={data} tab={tab} />
          </section>

          {/* 차트 4종 — 필터링된 데이터 기반 */}
          <ChartsSection data={filteredData} tab={tab} />

          {/* 지역 분석 — 전국 region1 랭킹 또는 region1 drill → region2 랭킹 */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">지역 분석</h2>
                <Badge variant="secondary" className="text-xs">
                  {drillRegion ?? '전국'}
                </Badge>
                {drillLoading && (
                  <span className="text-xs text-muted-foreground animate-pulse">로딩중...</span>
                )}
              </div>
              {drillRegion && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={handleBackToNational}
                >
                  <ArrowLeft className="h-4 w-4" /> 전국
                </Button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <RegionRanking
                data={drillRegion ? regionDetailRanking : data.regionRanking}
                canDrillDown={!drillRegion}
                onRegionClick={handleRegionClick}
              />
              <div className="md:col-span-2">
                <RegionDetailTable
                  data={drillRegion ? regionDetailRanking : data.regionRanking}
                  canDrillDown={!drillRegion}
                  onRegionClick={handleRegionClick}
                />
              </div>
            </div>
          </section>

          {/* 데이터 테이블 — 필터링된 데이터 기반 */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">상세 데이터</h2>
            <DataTable data={filteredData} tab={tab} />
          </section>
        </>
      )}
    </div>
  );
}
