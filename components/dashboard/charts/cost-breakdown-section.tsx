'use client';

// components/dashboard/charts/cost-breakdown-section.tsx
// 비용 분석 섹션 — 도넛(1/3) + 유형별 추이(2/3) 그리드 래퍼

import type { CostBreakdownRow } from '@/types/dashboard';
import { CostBreakdownDonut } from './cost-breakdown-donut';
import { CostBreakdownTrend } from './cost-breakdown-trend';

interface CostBreakdownSectionProps {
  daily: CostBreakdownRow[];
  weekly: CostBreakdownRow[];
  tab: 'daily' | 'weekly';
}

export function CostBreakdownSection({ daily, weekly, tab }: CostBreakdownSectionProps) {
  const data = tab === 'daily' ? daily : weekly;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr]">
      <CostBreakdownDonut data={data} />
      <CostBreakdownTrend data={data} tab={tab} />
    </div>
  );
}
