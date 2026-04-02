'use client';

// components/dashboard/charts/customer-type-donut.tsx
// 고객 유형 분포 도넛 차트 — 왕복/부름/편도 건수 합산 표시

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getChartColors } from './chart-colors';
import type { CustomerTypeRow } from '@/types/dashboard';

interface CustomerTypeDonutProps {
  data: CustomerTypeRow[];
}

export function CustomerTypeDonut({ data }: CustomerTypeDonutProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === 'dark');

  // 전체 CustomerTypeRow를 합산하여 단일 총계 pieData 생성
  const totals = data.reduce(
    (acc, row) => ({
      roundTrip: acc.roundTrip + row.roundTripCount,
      call: acc.call + row.callCount,
      oneWay: acc.oneWay + row.oneWayCount,
    }),
    { roundTrip: 0, call: 0, oneWay: 0 },
  );

  const total = totals.roundTrip + totals.call + totals.oneWay;

  const pieData = [
    { name: '왕복', value: totals.roundTrip, color: colors.chart1 },
    { name: '부름', value: totals.call, color: colors.chart2 },
    { name: '편도', value: totals.oneWay, color: colors.chart3 },
  ];

  // 빈 데이터 처리
  if (data.length === 0 || total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>고객 유형 분포</CardTitle>
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
        <CardTitle>고객 유형 분포</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label="고객 유형 분포 도넛 차트">
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          <PieChart>
            {/* 중앙 총건수 텍스트 — PieChart 직계 자식 SVG text (픽셀 좌표 금지) */}
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={colors.axis}
              fontSize="14px"
              fontWeight="600"
            >
              총 {total}건
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
                const pct = total > 0 ? Math.round((numValue / total) * 100) : 0;
                return [`${numValue}건 (${pct}%)`, name];
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
