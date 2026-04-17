'use client';

// KPI 카드 그리드 — 선택 기간 전체 집계 기준 6개 카드
// 매출/손익은 SUM, GPM/대당값/가동률은 AVG (rate-like 특성)
// 델타: 같은 길이 직전 기간과 비교
import { TrendingUp, DollarSign, Car, Users, Activity, Clock } from 'lucide-react';
import type { KpiAggregate } from '@/lib/kpi-utils';
import {
  calcDelta,
  formatKpiValue,
  formatDelta,
  getDeltaColorClass,
} from '@/lib/kpi-utils';
import { KpiCard } from './kpi-card';

interface KpiCardsProps {
  current: KpiAggregate;
  previous: KpiAggregate | null;
  sparklines: {
    revenue: number[];
    revenuePerCar: number[];
    gpm: number[];
    usageCountPerCar: number[];
    utilizationRate: number[];
    usageHoursPerCar: number[];
  };
  hasData: boolean;
}

export function KpiCards({ current, previous, sparklines, hasData }: KpiCardsProps) {
  if (!hasData) {
    return (
      <div>
        <p className="text-muted-foreground">선택한 기간에 데이터가 없습니다.</p>
        <p className="mt-1 text-xs text-muted-foreground/70">기간을 변경하거나 데이터 소스를 확인하세요.</p>
      </div>
    );
  }

  const cards = [
    {
      title: '매출',
      value: formatKpiValue(current.revenue, '원'),
      delta: previous ? calcDelta(current.revenue, previous.revenue) : null,
      unit: '원' as const,
      icon: <TrendingUp className="h-4 w-4" />,
      sparklineData: sparklines.revenue,
    },
    {
      title: '대당 매출',
      value: formatKpiValue(current.revenuePerCar, '원/대'),
      delta: previous ? calcDelta(current.revenuePerCar, previous.revenuePerCar) : null,
      unit: '원/대' as const,
      icon: <Car className="h-4 w-4" />,
      sparklineData: sparklines.revenuePerCar,
    },
    {
      title: 'GPM',
      value: formatKpiValue(current.gpm, '%'),
      delta: previous ? calcDelta(current.gpm, previous.gpm) : null,
      unit: '%' as const,
      icon: <DollarSign className="h-4 w-4" />,
      sparklineData: sparklines.gpm,
    },
    {
      title: '대당 이용건수',
      value: formatKpiValue(current.usageCountPerCar, '건/대'),
      delta: previous ? calcDelta(current.usageCountPerCar, previous.usageCountPerCar) : null,
      unit: '건/대' as const,
      icon: <Users className="h-4 w-4" />,
      sparklineData: sparklines.usageCountPerCar,
    },
    {
      title: '가동률',
      value: formatKpiValue(current.utilizationRate, '%'),
      delta: previous ? calcDelta(current.utilizationRate, previous.utilizationRate) : null,
      unit: '%' as const,
      icon: <Activity className="h-4 w-4" />,
      sparklineData: sparklines.utilizationRate,
    },
    {
      title: '대당 이용시간',
      value: formatKpiValue(current.usageHoursPerCar, '시간/대'),
      delta: previous ? calcDelta(current.usageHoursPerCar, previous.usageHoursPerCar) : null,
      unit: '시간/대' as const,
      icon: <Clock className="h-4 w-4" />,
      sparklineData: sparklines.usageHoursPerCar,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <KpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          icon={card.icon}
          deltaText={card.delta ? formatDelta(card.delta.percent, card.delta.absolute, card.unit) : undefined}
          deltaColorClass={card.delta ? getDeltaColorClass(card.delta.percent) : undefined}
          sparklineData={card.sparklineData}
        />
      ))}
    </div>
  );
}
