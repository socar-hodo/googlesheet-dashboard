// components/dashboard/charts/usage-trend-chart.tsx
// 대당 이용건수/대당 이용시간 이중 YAxis Bar 차트 (opr_day 기준)
"use client";

import { useRef } from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyRecord, WeeklyRecord } from '@/types/dashboard';
import { getChartColors } from './chart-colors';
import { ChartDownloadButton } from './chart-download-button';

interface UsageTrendChartProps {
  records: DailyRecord[] | WeeklyRecord[];
  tab: 'daily' | 'weekly';
}

export function UsageTrendChart({ records, tab }: UsageTrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === 'dark');

  // X축 레이블 변환 + 이중 YAxis 데이터 변환
  const chartData = records.map((r) => ({
    label:
      tab === 'daily'
        ? formatDailyLabel((r as DailyRecord).date)
        : formatWeeklyLabel((r as WeeklyRecord).week),
    usageCountPerCar: r.usageCountPerCar,
    usageHoursPerCar: r.usageHoursPerCar,
  }));

  return (
    <Card className="group/chart">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>대당 이용건수 / 대당 이용시간</CardTitle>
        <ChartDownloadButton chartRef={chartRef} filename="대당_이용건수_이용시간" />
      </CardHeader>
      <CardContent>
        <div ref={chartRef} role="img" aria-label="대당 이용건수 및 대당 이용시간 차트">
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
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fill: colors.axis, fontSize: 11 }}
                tickFormatter={(v) => `${v}건`}
                width={45}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: colors.axis, fontSize: 11 }}
                tickFormatter={(v) => `${v}h`}
                width={40}
              />
              <Tooltip
                formatter={(value, name) => [
                  name === '대당 이용건수'
                    ? `${Number(value).toFixed(1)}건`
                    : `${Number(value).toFixed(1)}시간`,
                  name,
                ]}
                labelFormatter={(label) => `${label}`}
                contentStyle={{
                  backgroundColor: colors.tooltip.bg,
                  border: `1px solid ${colors.tooltip.border}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              {chartData.length > 14 && (
                <Brush dataKey="label" height={20} stroke="var(--chart-1)" travellerWidth={8} />
              )}
              <Bar
                yAxisId="left"
                dataKey="usageCountPerCar"
                fill={colors.chart1}
                name="대당 이용건수"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="usageHoursPerCar"
                fill={colors.chart2}
                name="대당 이용시간"
                radius={[2, 2, 0, 0]}
              />
            </ComposedChart>
        </ResponsiveContainer>
        </div>
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
