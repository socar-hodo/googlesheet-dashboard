// components/dashboard/charts/utilization-trend-chart.tsx
// CHART-03: 가동률 추이 라인 차트 + 80% 임계선 ReferenceLine
"use client";

import {
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyRecord, WeeklyRecord } from '@/types/dashboard';
import { getChartColors } from './chart-colors';

interface UtilizationTrendChartProps {
  records: DailyRecord[] | WeeklyRecord[];
  tab: 'daily' | 'weekly';
}

export function UtilizationTrendChart({ records, tab }: UtilizationTrendChartProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === 'dark');

  // X축 레이블 변환 (RESEARCH.md Pattern 7)
  const chartData = records.map((r) => ({
    label:
      tab === 'daily'
        ? formatDailyLabel((r as DailyRecord).date)
        : formatWeeklyLabel((r as WeeklyRecord).week),
    utilizationRate: r.utilizationRate,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>가동률 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis
                dataKey="label"
                tick={{ fill: colors.axis, fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: colors.axis, fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                width={40}
              />
              <Tooltip
                formatter={(value) => [
                  `${Number(value).toFixed(1)}%`,
                  '가동률',
                ]}
                contentStyle={{
                  backgroundColor: colors.tooltip.bg,
                  border: `1px solid ${colors.tooltip.border}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              {/* CHART-03 핵심 요구사항: 가동률 80% 주황 점선 임계선 */}
              <ReferenceLine
                y={80}
                stroke={colors.referenceOrange}
                strokeDasharray="4 4"
                label={{
                  value: '기준 80%',
                  position: 'insideTopRight',
                  fill: colors.referenceOrange,
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="utilizationRate"
                stroke={colors.chart1}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: colors.chart1 }}
                name="가동률"
              />
            </LineChart>
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
