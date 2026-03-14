'use client';

// components/dashboard/charts/charts-section.tsx

import type { TeamDashboardData, DailyRecord, WeeklyRecord } from '@/types/dashboard';
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
      <RevenueTrendChart records={records} tab={tab} />
      <ProfitTrendChart records={records} tab={tab} />
      <UtilizationTrendChart records={records} tab={tab} />
      <UsageTrendChart records={records} tab={tab} />
      <CustomerTypeSection
        daily={data.customerTypeDaily}
        weekly={data.customerTypeWeekly}
        tab={tab}
      />
    </div>
  );
}
