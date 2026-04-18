'use client';

// components/dashboard/charts/revenue-breakdown-donut.tsx
// 매출 세분화 도넛 — 대여/PF/주행/배달/기타 매출 합산 표시 (REV-01, REV-02)

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getChartColors } from './chart-colors';
import type { RevenueBreakdownRow } from '@/types/dashboard';

interface RevenueBreakdownDonutProps {
  data: RevenueBreakdownRow[];
}

function formatWonShort(won: number): string {
  if (won === 0) return '0원';
  const eok = won / 1_0000_0000;
  if (Math.abs(eok) >= 1) return `${eok.toFixed(1)}억원`;
  const man = won / 10_000;
  return `${Math.round(man).toLocaleString()}만원`;
}

export function RevenueBreakdownDonut({ data }: RevenueBreakdownDonutProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === 'dark');

  const totals = data.reduce(
    (acc, row) => ({
      rental: acc.rental + row.rentalRevenue,
      pf: acc.pf + row.pfRevenue,
      driving: acc.driving + row.drivingRevenue,
      call: acc.call + row.callRevenue,
      other: acc.other + row.otherRevenue,
    }),
    { rental: 0, pf: 0, driving: 0, call: 0, other: 0 },
  );

  const total = totals.rental + totals.pf + totals.driving + totals.call + totals.other;

  const pieData = [
    { name: '대여', value: totals.rental, color: colors.chart1 },
    { name: 'PF', value: totals.pf, color: colors.chart2 },
    { name: '주행', value: totals.driving, color: colors.chart3 },
    { name: '배달', value: totals.call, color: colors.chart4 },
    { name: '기타', value: totals.other, color: colors.chart5 },
  ];

  if (data.length === 0 || total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>매출 구성</CardTitle>
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
        <CardTitle>매출 구성</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label="매출 구성 도넛 차트">
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
