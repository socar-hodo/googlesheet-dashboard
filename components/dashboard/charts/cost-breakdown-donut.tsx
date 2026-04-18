'use client';

// components/dashboard/charts/cost-breakdown-donut.tsx
// 비용 분석 도넛 — 운반/연료/주차/검차/감가/수수료 6개 카테고리 합산 (COST-01)

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getChartColors } from './chart-colors';
import type { CostBreakdownRow } from '@/types/dashboard';

interface CostBreakdownDonutProps {
  data: CostBreakdownRow[];
}

function formatWonShort(won: number): string {
  if (won === 0) return '0원';
  const eok = won / 1_0000_0000;
  if (Math.abs(eok) >= 1) return `${eok.toFixed(1)}억원`;
  const man = won / 10_000;
  return `${Math.round(man).toLocaleString()}만원`;
}

export function CostBreakdownDonut({ data }: CostBreakdownDonutProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === 'dark');

  const totals = data.reduce(
    (acc, row) => ({
      transport: acc.transport + row.transportCost,
      fuel: acc.fuel + row.fuelCost,
      parking: acc.parking + row.parkingCost,
      inspection: acc.inspection + row.inspectionCost,
      depreciation: acc.depreciation + row.depreciationCost,
      commission: acc.commission + row.commissionCost,
    }),
    { transport: 0, fuel: 0, parking: 0, inspection: 0, depreciation: 0, commission: 0 },
  );

  const total =
    totals.transport +
    totals.fuel +
    totals.parking +
    totals.inspection +
    totals.depreciation +
    totals.commission;

  const pieData = [
    { name: '운반', value: totals.transport, color: colors.chart1 },
    { name: '연료', value: totals.fuel, color: colors.chart2 },
    { name: '주차', value: totals.parking, color: colors.chart3 },
    { name: '검차', value: totals.inspection, color: colors.chart4 },
    { name: '감가', value: totals.depreciation, color: colors.chart5 },
    { name: '수수료', value: totals.commission, color: colors.chart6 },
  ];

  if (data.length === 0 || total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>비용 구성</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-sm text-muted-foreground">데이터 없음</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>비용 구성</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label="비용 구성 도넛 차트">
          <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <PieChart>
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.axis}
                fontSize="14px"
                fontWeight="600"
              >
                총 {formatWonShort(total)}
              </text>
              <Pie
                data={pieData}
                dataKey="value"
                innerRadius="60%"
                outerRadius="80%"
                label={false}
                labelLine={false}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Legend />
              <Tooltip
                formatter={(value, name) => {
                  const numValue = Number(value);
                  const pct = total > 0 ? ((numValue / total) * 100).toFixed(1) : '0';
                  return [`${formatWonShort(numValue)} (${pct}%)`, name];
                }}
                contentStyle={{
                  backgroundColor: colors.tooltip.bg,
                  border: `1px solid ${colors.tooltip.border}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
