"use client";
// components/dashboard/charts/revenue-trend-chart.tsx
// CHART-01: 매출 추이 — ComposedChart (Bar + 조건부 Line)

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyRecord, WeeklyRecord } from "@/types/dashboard";
import { getChartColors } from "./chart-colors";

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
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === "dark");

  const chartData = records.map((r) => ({
    label:
      tab === "daily"
        ? formatDailyLabel((r as DailyRecord).date)
        : formatWeeklyLabel((r as WeeklyRecord).week),
    revenue: r.revenue,
    target:
      tab === "weekly" ? (r as WeeklyRecord).weeklyTarget : undefined,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>매출 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <ComposedChart
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
                formatter={(value, name) => [
                  `₩${Math.round(Number(value) / 10000).toLocaleString()}만`,
                  name === "revenue" ? "실적" : "목표",
                ]}
                contentStyle={{
                  backgroundColor: colors.tooltip.bg,
                  border: `1px solid ${colors.tooltip.border}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="revenue"
                fill={colors.chart1}
                name="revenue"
                radius={[2, 2, 0, 0]}
              />
              {tab === "weekly" && (
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke={colors.chart2}
                  strokeWidth={2}
                  dot={{ fill: colors.chart2, r: 3 }}
                  name="target"
                />
              )}
            </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
