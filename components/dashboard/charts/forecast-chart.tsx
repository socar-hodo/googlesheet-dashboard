"use client";
// components/dashboard/charts/forecast-chart.tsx
// 지역별 사전 매출 Bar 차트 — 과거 actual + 미래 expected 혼합

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ForecastRow } from "@/types/dashboard";
import { getChartColors } from "./chart-colors";

interface ForecastChartProps {
  data: ForecastRow[];
  title?: string;
}

function formatDateLabel(date: string): string {
  const parts = date.split("-");
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

export function ForecastChart({ data, title = "전국" }: ForecastChartProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === "dark");

  const chartData = data.map((r) => ({
    label: formatDateLabel(r.date),
    forecast: r.forecastRevenue,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300} minWidth={0}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis dataKey="label" tick={{ fill: colors.axis, fontSize: 11 }} />
            <YAxis
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={(v) => `${Math.round(v / 10000).toLocaleString()}만`}
              width={65}
            />
            <Tooltip
              formatter={(value) => [
                `₩${Math.round(Number(value) / 10000).toLocaleString()}만`,
                "사전 매출",
              ]}
              contentStyle={{
                backgroundColor: colors.tooltip.bg,
                border: `1px solid ${colors.tooltip.border}`,
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar
              dataKey="forecast"
              fill={colors.chart1}
              radius={[2, 2, 0, 0]}
              name="사전 매출"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
