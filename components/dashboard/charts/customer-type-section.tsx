'use client';

// components/dashboard/charts/customer-type-section.tsx
// 고객 유형 분석 섹션 — 도넛(1/3) + 추이(2/3) 그리드 래퍼

import type { CustomerTypeRow } from '@/types/dashboard';
import { CustomerTypeDonut } from './customer-type-donut';
import { CustomerTypeTrend } from './customer-type-trend';

interface CustomerTypeSectionProps {
  daily: CustomerTypeRow[];
  weekly: CustomerTypeRow[];
  tab: 'daily' | 'weekly';
}

export function CustomerTypeSection({ daily, weekly, tab }: CustomerTypeSectionProps) {
  const data = tab === 'daily' ? daily : weekly;
  return (
    // 모바일: 단일 컬럼 / md 이상: 도넛 1/3 + 추이 2/3
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr]">
      <CustomerTypeDonut data={data} />
      <CustomerTypeTrend data={data} tab={tab} />
    </div>
  );
}
