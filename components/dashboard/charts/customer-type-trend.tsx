'use client';

// components/dashboard/charts/customer-type-trend.tsx
// 유형별 이용건수 추이 — 왕복/부름/편도 누적 스택 바 차트

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
import type { CustomerTypeRow } from '@/types/dashboard';

interface CustomerTypeTrendProps {
  data: CustomerTypeRow[];
  tab: 'daily' | 'weekly';
}

/**
 * X축 레이블 포맷
 * - daily + date: "2026-03-01" → "3/1"
 * - weekly + week: "2월 3주차" → "2월 3주"
 */
function formatXLabel(row: CustomerTypeRow, tab: 'daily' | 'weekly'): string {
  if (tab === 'daily' && row.date) {
    // "2026-03-01" → "3/1" (앞 0 제거를 위해 parseInt 사용)
    const parts = row.date.split('-');
    if (parts.length === 3) {
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${month}/${day}`;
    }
    return row.date;
  }
  if (tab === 'weekly' && row.week) {
    // "2월 3주차" → "2월 3주"
    return row.week.replace('주차', '주');
  }
  return '';
}

export function CustomerTypeTrend({ data, tab }: CustomerTypeTrendProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === 'dark');

  // 빈 데이터 처리
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>유형별 이용건수 추이</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-sm text-muted-foreground">데이터 없음</p>
        </CardContent>
      </Card>
    );
  }

  // Recharts용 데이터 변환
  const chartData = data.map((row) => ({
    label: formatXLabel(row, tab),
    왕복: row.roundTripCount,
    부름: row.callCount,
    편도: row.oneWayCount,
  }));

  // 합계 툴팁 컴포넌트 (colors에 클로저 접근)
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
            {p.name}: {p.value}건
          </p>
        ))}
        <p
          style={{
            borderTop: `1px solid ${colors.tooltip.border}`,
            marginTop: 4,
            paddingTop: 4,
          }}
        >
          합계: {total}건
        </p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>유형별 이용건수 추이</CardTitle>
      </CardHeader>
      <CardContent>
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
              tickFormatter={(v) => `${v}건`}
              width={50}
              tick={{ fontSize: 12, fill: colors.axis }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={CustomTooltip} />
            <Legend />
            {/* stackId="a" — 누적 스택, radius는 최상단 편도 Bar에만 적용 */}
            <Bar dataKey="왕복" stackId="a" fill={colors.chart1} />
            <Bar dataKey="부름" stackId="a" fill={colors.chart2} />
            <Bar dataKey="편도" stackId="a" fill={colors.chart3} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
