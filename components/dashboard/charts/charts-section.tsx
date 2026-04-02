'use client';

// components/dashboard/charts/charts-section.tsx

import type { TeamDashboardData, DailyRecord, WeeklyRecord } from '@/types/dashboard';
import { ChartErrorBoundary } from './chart-error-boundary';
import { RevenueTrendChart } from './revenue-trend-chart';
import { ProfitTrendChart } from './profit-trend-chart';
import { UtilizationTrendChart } from './utilization-trend-chart';
import { UsageTrendChart } from './usage-trend-chart';
import { CustomerTypeSection } from './customer-type-section';

interface ChartsSectionProps {
  data: TeamDashboardData;
  tab: 'daily' | 'weekly';
}

// "2026. 2. 21" 또는 "2026-02-21" 모두 처리 → "2026-02-21" ISO 반환
function normalizeDate(date: string): string {
  if (date.includes('-')) return date;
  const parts = date.split('.').map(s => s.trim()).filter(s => s !== '');
  if (parts.length === 3)
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  return date;
}

export function ChartsSection({ data, tab }: ChartsSectionProps) {
  // Daily: ISO 날짜로 정규화 후 오름차순 정렬, 최근 30일 슬라이싱
  // Weekly: 전체 데이터 그대로
  const records: DailyRecord[] | WeeklyRecord[] = tab === 'daily'
    ? [...data.daily]
        .map(r => ({ ...r, date: normalizeDate(r.date) }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30)
    : data.weekly;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">추이 차트</h2>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartErrorBoundary title="매출 추이">
          <RevenueTrendChart records={records} tab={tab} />
        </ChartErrorBoundary>
        <ChartErrorBoundary title="GPM 추이">
          <ProfitTrendChart records={records} tab={tab} />
        </ChartErrorBoundary>
        <ChartErrorBoundary title="가동률 추이">
          <UtilizationTrendChart records={records} tab={tab} />
        </ChartErrorBoundary>
        <ChartErrorBoundary title="이용건수 / 이용시간">
          <UsageTrendChart records={records} tab={tab} />
        </ChartErrorBoundary>
      </div>
      <h2 className="text-lg font-semibold text-foreground">고객 유형 분석</h2>
      <CustomerTypeSection
        daily={data.customerTypeDaily}
        weekly={data.customerTypeWeekly}
        tab={tab}
      />
    </div>
  );
}
