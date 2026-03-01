'use client';

// DashboardContent — 기간 필터 상태 소유 Client Component
// 전체 데이터를 수신하여 선택된 기간에 맞게 필터링 후 하위 컴포넌트에 전달
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';
import type { TeamDashboardData } from '@/types/dashboard';
import { exportToCsv, exportToXlsx } from '@/lib/export-utils';
import {
  type PeriodKey,
  getDateRange,
  filterDailyByPeriod,
  filterWeeklyByPeriod,
  DEFAULT_DAILY_PERIOD,
  DEFAULT_WEEKLY_PERIOD,
  DAILY_PERIODS,
} from '@/lib/period-utils';
import { DashboardHeader } from './dashboard-header';
import { KpiCards } from './kpi-cards';
import { ChartsSection } from './charts/charts-section';
import { DataTable } from './data-table';

interface DashboardContentProps {
  data: TeamDashboardData;
  tab: 'daily' | 'weekly';
  initialPeriod?: string; // URL에서 읽은 raw string, 검증 전
}

/**
 * URL 파라미터로 받은 raw period 문자열을 검증하여 유효한 PeriodKey로 변환한다.
 * - Daily 탭: 4가지 기간 모두 허용 (this-week, last-week, this-month, last-month)
 * - Weekly 탭: 월 단위만 허용 (this-month, last-month)
 * - 유효하지 않은 값이면 탭 기본값 반환
 */
function parsePeriod(raw: string | undefined, tab: 'daily' | 'weekly'): PeriodKey {
  if (!raw) {
    return tab === 'daily' ? DEFAULT_DAILY_PERIOD : DEFAULT_WEEKLY_PERIOD;
  }

  if (tab === 'daily' && (DAILY_PERIODS as string[]).includes(raw)) {
    return raw as PeriodKey;
  }

  // Weekly 탭은 월 단위만 유효
  if (tab === 'weekly' && (raw === 'this-month' || raw === 'last-month')) {
    return raw as PeriodKey;
  }

  return tab === 'daily' ? DEFAULT_DAILY_PERIOD : DEFAULT_WEEKLY_PERIOD;
}

/** 기간 필터 상태를 소유하고 전체 대시보드를 렌더링하는 Client Component */
export function DashboardContent({ data, tab, initialPeriod }: DashboardContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // 기간 상태 — URL 파라미터를 검증하여 초기값 설정
  const [period, setPeriodState] = useState<PeriodKey>(() => parsePeriod(initialPeriod, tab));

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

  /** 선택된 기간에 맞게 데이터를 필터링한다 */
  const filteredData = useMemo<TeamDashboardData>(() => {
    if (tab === 'daily') {
      const range = getDateRange(period);
      const filtered = filterDailyByPeriod(data.daily, range);
      return { ...data, daily: filtered };
    } else {
      // Weekly 탭: this-month 또는 last-month만 유효 (parsePeriod에서 보장됨)
      const weeklyPeriod = (period === 'last-month' ? 'last-month' : 'this-month') as
        | 'this-month'
        | 'last-month';
      const filtered = filterWeeklyByPeriod(data.weekly, weeklyPeriod);
      return { ...data, weekly: filtered };
    }
  }, [data, tab, period]);

  /** CSV 내보내기 핸들러 — 현재 필터링된 데이터를 .csv로 다운로드 */
  const handleExportCsv = useCallback(() => {
    const records = tab === 'daily' ? filteredData.daily : filteredData.weekly;
    exportToCsv(records, tab);
  }, [filteredData, tab]);

  /** Excel 내보내기 핸들러 — 현재 필터링된 데이터를 .xlsx로 다운로드 */
  const handleExportXlsx = useCallback(() => {
    const records = tab === 'daily' ? filteredData.daily : filteredData.weekly;
    exportToXlsx(records, tab);
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
      />

      {/* KPI 카드 — 필터링된 데이터(current/previous)와 전체 이력(sparkline) 기반 */}
      <KpiCards data={filteredData} fullData={data} tab={tab} />

      {/* 차트 4종 — 필터링된 데이터 기반 */}
      <ChartsSection data={filteredData} tab={tab} />

      {/* 데이터 테이블 — 필터링된 데이터 기반 */}
      <DataTable data={filteredData} tab={tab} />
    </div>
  );
}
