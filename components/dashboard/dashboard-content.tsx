'use client';

// DashboardContent — 기간 필터 상태 소유 Client Component
// 전체 데이터를 수신하여 선택된 기간에 맞게 필터링 후 하위 컴포넌트에 전달
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

      {/* 예측 탭: ForecastChart만 렌더링 */}
      {tab === 'forecast' ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">매출 예측</h2>
          {filteredData.forecastDaily.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/80 py-16 backdrop-blur">
              <p className="text-sm text-muted-foreground">선택한 기간에 예측 데이터가 없습니다.</p>
            </div>
          ) : (
            <ForecastChart data={filteredData.forecastDaily} />
          )}
        </section>
      ) : (
        <>
          {/* KPI 카드 — 필터링된 데이터(current/previous)와 전체 이력(sparkline) 기반 */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">핵심 지표</h2>
            <KpiCards data={filteredData} fullData={data} tab={tab} />
          </section>

          {/* 차트 4종 — 필터링된 데이터 기반 */}
          <ChartsSection data={filteredData} tab={tab} />

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
