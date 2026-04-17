'use client';

// KPI 카드 그리드 — TeamDashboardData에서 6개 KPI 카드 렌더링 (매출/대당매출/GPM/대당건수/가동률/대당시간)
import { TrendingUp, DollarSign, Car, Users, Activity, Clock } from 'lucide-react';
import type { TeamDashboardData } from '@/types/dashboard';
import {
  calcAchievementRate,
  calcDelta,
  formatKpiValue,
  formatDelta,
  getDeltaColorClass,
} from '@/lib/kpi-utils';
import { KpiCard } from './kpi-card';

interface KpiCardsProps {
  data: TeamDashboardData;         // 필터링된 데이터 (current/previous 계산용)
  fullData?: TeamDashboardData;    // 전체 이력 데이터 (sparkline 트렌드용)
  tab: 'daily' | 'weekly';
}

export function KpiCards({ data, fullData, tab }: KpiCardsProps) {
  if (tab === 'daily') {
    // 날짜 오름차순 정렬 후 최신/전일 추출 (필터링된 데이터 기준)
    const sorted = [...data.daily].sort((a, b) => a.date.localeCompare(b.date));
    const current = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    // 스파크라인용: 전체 이력에서 최근 7일, 없으면 필터 데이터로 폴백
    const sparklineSource = (fullData ?? data).daily;
    const sparklineSorted = [...sparklineSource].sort((a, b) => a.date.localeCompare(b.date));
    const DAILY_N = 7; // 최근 7일

    if (!current) {
      return <div><p className="text-muted-foreground">일별 데이터가 없습니다.</p><p className="mt-1 text-xs text-muted-foreground/70">기간을 변경하거나 데이터 소스를 확인하세요.</p></div>;
    }

    // 카드 정의 배열 (비즈니스 중요도 순) — 매출/대당매출/GPM/대당건수/가동률/대당시간
    const cards = [
      {
        title: '매출',
        value: formatKpiValue(current.revenue, '원'),
        delta: previous ? calcDelta(current.revenue, previous.revenue) : null,
        unit: '원' as const,
        icon: <TrendingUp className="h-4 w-4" />,
        sparklineData: sparklineSorted.map(d => d.revenue).slice(-DAILY_N),
      },
      {
        title: '대당 매출',
        value: formatKpiValue(current.revenuePerCar, '원/대'),
        delta: previous ? calcDelta(current.revenuePerCar, previous.revenuePerCar) : null,
        unit: '원/대' as const,
        icon: <Car className="h-4 w-4" />,
        sparklineData: sparklineSorted.map(d => d.revenuePerCar).slice(-DAILY_N),
      },
      {
        title: 'GPM',
        value: formatKpiValue(
          current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0,
          '%'
        ),
        delta: previous
          ? calcDelta(
              current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0,
              previous.revenue > 0 ? (previous.profit / previous.revenue) * 100 : 0
            )
          : null,
        unit: '%' as const,
        icon: <DollarSign className="h-4 w-4" />,
        sparklineData: sparklineSorted
          .map(d => d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0)
          .slice(-DAILY_N),
      },
      {
        title: '대당 이용건수',
        value: formatKpiValue(current.usageCountPerCar, '건/대'),
        delta: previous ? calcDelta(current.usageCountPerCar, previous.usageCountPerCar) : null,
        unit: '건/대' as const,
        icon: <Users className="h-4 w-4" />,
        sparklineData: sparklineSorted.map(d => d.usageCountPerCar).slice(-DAILY_N),
      },
      {
        title: '가동률',
        value: formatKpiValue(current.utilizationRate, '%'),
        delta: previous ? calcDelta(current.utilizationRate, previous.utilizationRate) : null,
        unit: '%' as const,
        icon: <Activity className="h-4 w-4" />,
        sparklineData: sparklineSorted.map(d => d.utilizationRate).slice(-DAILY_N),
      },
      {
        title: '대당 이용시간',
        value: formatKpiValue(current.usageHoursPerCar, '시간/대'),
        delta: previous ? calcDelta(current.usageHoursPerCar, previous.usageHoursPerCar) : null,
        unit: '시간/대' as const,
        icon: <Clock className="h-4 w-4" />,
        sparklineData: sparklineSorted.map(d => d.usageHoursPerCar).slice(-DAILY_N),
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

  // Weekly 탭 — 마지막 항목이 이번 주, 마지막-1 항목이 지난 주
  const current = data.weekly[data.weekly.length - 1];
  const previous = data.weekly[data.weekly.length - 2];
  // weeklySorted: 스파크라인 전용 — 전체 이력에서 최근 8주 (없으면 필터 데이터 폴백)
  const weeklySparklineSource = (fullData ?? data).weekly;
  const weeklySorted = [...weeklySparklineSource].sort((a, b) => a.week.localeCompare(b.week));
  const WEEKLY_N = 8; // 최근 8주

  if (!current) {
    return <div><p className="text-muted-foreground">주차별 데이터가 없습니다.</p><p className="mt-1 text-xs text-muted-foreground/70">기간을 변경하거나 데이터 소스를 확인하세요.</p></div>;
  }

  // 매출만 weeklyTarget 대비 달성률 표시, 나머지는 달성률 없음
  const cards = [
    {
      title: '매출',
      value: formatKpiValue(current.revenue, '원'),
      target: formatKpiValue(current.weeklyTarget, '원'),
      achievementRate: calcAchievementRate(current.revenue, current.weeklyTarget),
      delta: previous ? calcDelta(current.revenue, previous.revenue) : null,
      unit: '원' as const,
      icon: <TrendingUp className="h-4 w-4" />,
      sparklineData: weeklySorted.map(d => d.revenue).slice(-WEEKLY_N),
    },
    {
      title: '대당 매출',
      value: formatKpiValue(current.revenuePerCar, '원/대'),
      target: undefined as string | undefined,
      achievementRate: undefined as number | undefined,
      delta: previous ? calcDelta(current.revenuePerCar, previous.revenuePerCar) : null,
      unit: '원/대' as const,
      icon: <Car className="h-4 w-4" />,
      sparklineData: weeklySorted.map(d => d.revenuePerCar).slice(-WEEKLY_N),
    },
    {
      title: 'GPM',
      value: formatKpiValue(
        current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0,
        '%'
      ),
      target: undefined as string | undefined,
      achievementRate: undefined as number | undefined,
      delta: previous
        ? calcDelta(
            current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0,
            previous.revenue > 0 ? (previous.profit / previous.revenue) * 100 : 0
          )
        : null,
      unit: '%' as const,
      icon: <DollarSign className="h-4 w-4" />,
      sparklineData: weeklySorted
        .map(d => d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0)
        .slice(-WEEKLY_N),
    },
    {
      title: '대당 이용건수',
      value: formatKpiValue(current.usageCountPerCar, '건/대'),
      target: undefined as string | undefined,
      achievementRate: undefined as number | undefined,
      delta: previous ? calcDelta(current.usageCountPerCar, previous.usageCountPerCar) : null,
      unit: '건/대' as const,
      icon: <Users className="h-4 w-4" />,
      sparklineData: weeklySorted.map(d => d.usageCountPerCar).slice(-WEEKLY_N),
    },
    {
      title: '가동률',
      value: formatKpiValue(current.utilizationRate, '%'),
      target: undefined as string | undefined,
      achievementRate: undefined as number | undefined,
      delta: previous ? calcDelta(current.utilizationRate, previous.utilizationRate) : null,
      unit: '%' as const,
      icon: <Activity className="h-4 w-4" />,
      sparklineData: weeklySorted.map(d => d.utilizationRate).slice(-WEEKLY_N),
    },
    {
      title: '대당 이용시간',
      value: formatKpiValue(current.usageHoursPerCar, '시간/대'),
      target: undefined as string | undefined,
      achievementRate: undefined as number | undefined,
      delta: previous ? calcDelta(current.usageHoursPerCar, previous.usageHoursPerCar) : null,
      unit: '시간/대' as const,
      icon: <Clock className="h-4 w-4" />,
      sparklineData: weeklySorted.map(d => d.usageHoursPerCar).slice(-WEEKLY_N),
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <KpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          target={card.target}
          achievementRate={card.achievementRate}
          icon={card.icon}
          deltaText={card.delta ? formatDelta(card.delta.percent, card.delta.absolute, card.unit) : undefined}
          deltaColorClass={card.delta ? getDeltaColorClass(card.delta.percent) : undefined}
          sparklineData={card.sparklineData}
        />
      ))}
    </div>
  );
}
