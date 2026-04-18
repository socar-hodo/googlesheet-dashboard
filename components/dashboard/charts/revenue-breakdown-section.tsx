'use client';

// components/dashboard/charts/revenue-breakdown-section.tsx
// 매출 세분화 섹션 — 도넛(1/3) + 유형별 추이(2/3) 그리드 래퍼

import type { RevenueBreakdownRow } from '@/types/dashboard';
import { RevenueBreakdownDonut } from './revenue-breakdown-donut';
import { RevenueBreakdownTrend } from './revenue-breakdown-trend';

interface RevenueBreakdownSectionProps {
  daily: RevenueBreakdownRow[];
  weekly: RevenueBreakdownRow[];
  tab: 'daily' | 'weekly';
}

export function RevenueBreakdownSection({ daily, weekly, tab }: RevenueBreakdownSectionProps) {
  const data = tab === 'daily' ? daily : weekly;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr]">
      <RevenueBreakdownDonut data={data} />
      <RevenueBreakdownTrend data={data} tab={tab} />
    </div>
  );
}
