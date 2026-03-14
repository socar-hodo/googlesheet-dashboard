// components/dashboard/charts/usage-trend-chart.tsx
// CHART-04: 이용건수/이용시간 이중 YAxis Bar 차트
"use client";

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyRecord, WeeklyRecord } from '@/types/dashboard';
import { getChartColors } from './chart-colors';

interface UsageTrendChartProps {
  records: DailyRecord[] | WeeklyRecord[];
  tab: 'daily' | 'weekly';
}

export function UsageTrendChart({ records, tab }: UsageTrendChartProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === 'dark');

  // X축 레이블 변환 + 이중 YAxis 데이터 변환 (RESEARCH.md Pattern 7)
  const chartData = records.map((r) => ({
    label:
      tab === 'daily'
        ? formatDailyLabel((r as DailyRecord).date)
        : formatWeeklyLabel((r as WeeklyRecord).week),
    usageCount: r.usageCount,
    usageHours: r.usageHours,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>이용건수 / 이용시간</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis
                dataKey="label"
                tick={{ fill: colors.axis, fontSize: 11 }}
              />
              {/* 좌 Y축 — 이용건수 (yAxisId 필수, Pitfall 3 방지) */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fill: colors.axis, fontSize: 11 }}
                tickFormatter={(v) => `${v}건`}
                width={45}
              />
              {/* 우 Y축 — 이용시간 (yAxisId 필수, Pitfall 3 방지) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: colors.axis, fontSize: 11 }}
                tickFormatter={(v) => `${v}h`}
                width={40}
              />
              <Tooltip
                formatter={(value, name) => [
                  name === '이용건수' ? `${value}건` : `${value}h`,
                  name,
                ]}
                contentStyle={{
                  backgroundColor: colors.tooltip.bg,
                  border: `1px solid ${colors.tooltip.border}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              {/* yAxisId가 YAxis의 yAxisId prop과 반드시 일치해야 함 */}
              <Bar
                yAxisId="left"
                dataKey="usageCount"
                fill={colors.chart1}
                name="이용건수"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="usageHours"
                fill={colors.chart2}
                name="이용시간"
                radius={[2, 2, 0, 0]}
              />
            </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Daily: "2026-02-01" → "2/1"
function formatDailyLabel(date: string): string {
  const parts = date.split('-');
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

// Weekly: "1주차" → "1주"
function formatWeeklyLabel(week: string): string {
  return week.replace('주차', '주');
}
