'use client';

// components/dashboard/charts/cost-breakdown-trend.tsx
// 비용 분석 추이 — 운반/연료/주차/검차/감가/수수료 누적 스택 바 (COST-01, COST-03)

import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getChartColors } from './chart-colors';
import type { CostBreakdownRow } from '@/types/dashboard';

interface CostBreakdownTrendProps {
  data: CostBreakdownRow[];
  tab: 'daily' | 'weekly';
}

function formatWonShort(won: number): string {
  if (won === 0) return '0원';
  const eok = won / 1_0000_0000;
  if (Math.abs(eok) >= 1) return `${eok.toFixed(1)}억원`;
  const man = won / 10_000;
  return `${Math.round(man).toLocaleString()}만원`;
}

/**
 * X축 레이블 포맷
 * - daily: "2026-03-01" → "3/1"
 * - weekly: "2월 3주차" → "2월 3주"
 */
function formatXLabel(dateField: string, tab: 'daily' | 'weekly'): string {
  if (tab === 'daily') {
    const parts = dateField.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
    }
    return dateField;
  }
  return dateField.replace('주차', '주');
}

export function CostBreakdownTrend({ data, tab }: CostBreakdownTrendProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === 'dark');

  const totalCost = data.reduce(
    (sum, row) =>
      sum +
      row.transportCost +
      row.fuelCost +
      row.parkingCost +
      row.inspectionCost +
      row.depreciationCost +
      row.commissionCost,
    0,
  );
  if (data.length === 0 || totalCost === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>비용 유형별 추이</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-sm text-muted-foreground">데이터 없음</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((row) => ({
    label: formatXLabel(row.date, tab),
    운반: row.transportCost,
    연료: row.fuelCost,
    주차: row.parkingCost,
    검차: row.inspectionCost,
    감가: row.depreciationCost,
    수수료: row.commissionCost,
  }));

  const CustomTooltip = ({ active, payload, label }: TooltipContentProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((sum: number, p: { value?: number }) => sum + (p.value ?? 0), 0);
    return (
      <div
        style={{
          backgroundColor: colors.tooltip.bg,
          border: `1px solid ${colors.tooltip.border}`,
          borderRadius: '8px',
          padding: '8px',
          fontSize: '12px',
        }}
      >
        <p style={{ marginBottom: 4 }}>{label}</p>
        {payload.map((p: { dataKey?: string | number; name?: string; value?: number; fill?: string }) => (
          <p key={String(p.dataKey)} style={{ color: p.fill }}>
            {p.name}: {formatWonShort(p.value ?? 0)}
          </p>
        ))}
        <p
          style={{
            borderTop: `1px solid ${colors.tooltip.border}`,
            marginTop: 4,
            paddingTop: 4,
          }}
        >
          합계: {formatWonShort(total)}
        </p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>비용 유형별 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label="비용 유형별 추이 차트">
          <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: colors.axis }}
                axisLine={{ stroke: colors.grid }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${Math.round((v ?? 0) / 10_000).toLocaleString()}만`}
                width={60}
                tick={{ fontSize: 12, fill: colors.axis }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={CustomTooltip} />
              <Legend />
              <Bar dataKey="운반" stackId="a" fill={colors.chart1} />
              <Bar dataKey="연료" stackId="a" fill={colors.chart2} />
              <Bar dataKey="주차" stackId="a" fill={colors.chart3} />
              <Bar dataKey="검차" stackId="a" fill={colors.chart4} />
              <Bar dataKey="감가" stackId="a" fill={colors.chart5} />
              <Bar dataKey="수수료" stackId="a" fill={colors.chart6} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
