"use client";
// components/dashboard/charts/profit-trend-chart.tsx
// CHART-02: GPM 추이 — BarChart + Cell (양수 녹색, 음수 빨간색)

import {
  BarChart,
  Bar,
  Cell,
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

interface ProfitTrendChartProps {
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

export function ProfitTrendChart({ records, tab: _tab }: ProfitTrendChartProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === "dark");

  const chartData = records.map((r) => ({
    label:
      _tab === "daily"
        ? formatDailyLabel((r as DailyRecord).date)
        : formatWeeklyLabel((r as WeeklyRecord).week),
    gpm: r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>GPM 추이</CardTitle>
      </CardHeader>
      <CardContent>
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
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                width={45}
              />
              <Tooltip
                formatter={(value) => [
                  `${Number(value).toFixed(1)}%`,
                  "GPM",
                ]}
                contentStyle={{
                  backgroundColor: colors.tooltip.bg,
                  border: `1px solid ${colors.tooltip.border}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="gpm" name="GPM" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.gpm >= 0
                        ? colors.profitPositive
                        : colors.profitNegative
                    }
                  />
                ))}
              </Bar>
            </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
