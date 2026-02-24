// components/dashboard/charts/charts-section.tsx
// Server Component — "use client" 없음

import type { TeamDashboardData, DailyRecord, WeeklyRecord } from '@/types/dashboard';
import { RevenueTrendChart } from './revenue-trend-chart';
import { ProfitTrendChart } from './profit-trend-chart';
import { UtilizationTrendChart } from './utilization-trend-chart';
import { UsageTrendChart } from './usage-trend-chart';

interface ChartsSectionProps {
  data: TeamDashboardData;
  tab: 'daily' | 'weekly';
}

export function ChartsSection({ data, tab }: ChartsSectionProps) {
  // Daily: 날짜 오름차순 정렬 후 최근 30일 슬라이싱 (CONTEXT.md 결정)
  // Weekly: 전체 데이터 그대로
  const records: DailyRecord[] | WeeklyRecord[] = tab === 'daily'
    ? [...data.daily].sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
    : data.weekly;

  return (
    <div className="space-y-6">
      <RevenueTrendChart records={records} tab={tab} />
      <ProfitTrendChart records={records} tab={tab} />
      <UtilizationTrendChart records={records} tab={tab} />
      <UsageTrendChart records={records} tab={tab} />
    </div>
  );
}
