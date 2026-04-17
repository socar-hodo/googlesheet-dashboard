"use client";
// components/dashboard/charts/revenue-trend-chart.tsx
// 매출 추이 Bar 차트

import { useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyRecord, WeeklyRecord } from "@/types/dashboard";
import { getChartColors } from "./chart-colors";
import { ChartDownloadButton } from "./chart-download-button";

interface RevenueTrendChartProps {
  records: DailyRecord[] | WeeklyRecord[];
  tab: "daily" | "weekly";
}

// Daily: "2026-02-01" → "2/1"
function formatDailyLabel(date: string): string {
  const parts = date.split("-");
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

// Weekly: "1주차" → "1주"
function formatWeeklyLabel(week: string): string {
  return week.replace("주차", "주");
}

export function RevenueTrendChart({ records, tab }: RevenueTrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === "dark");

  const chartData = records.map((r) => ({
    label:
      tab === "daily"
        ? formatDailyLabel((r as DailyRecord).date)
        : formatWeeklyLabel((r as WeeklyRecord).week),
    revenue: r.revenue,
  }));

  return (
    <Card className="group/chart">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>매출 추이</CardTitle>
        <ChartDownloadButton chartRef={chartRef} filename="매출추이" />
      </CardHeader>
      <CardContent>
        <div ref={chartRef} role="img" aria-label="매출 추이 차트">
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis
                dataKey="label"
                tick={{ fill: colors.axis, fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: colors.axis, fontSize: 11 }}
                tickFormatter={(v) =>
                  `${Math.round(v / 10000).toLocaleString()}만`
                }
                width={55}
              />
              <Tooltip
                formatter={(value) => [
                  `₩${Math.round(Number(value) / 10000).toLocaleString()}만`,
                  "매출",
                ]}
                labelFormatter={(label) => `${label}`}
                contentStyle={{
                  backgroundColor: colors.tooltip.bg,
                  border: `1px solid ${colors.tooltip.border}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              {chartData.length > 14 && (
                <Brush dataKey="label" height={20} stroke="var(--chart-1)" travellerWidth={8} />
              )}
              <Bar
                dataKey="revenue"
                fill={colors.chart1}
                name="매출"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
