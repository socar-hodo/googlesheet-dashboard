"use client";
// components/dashboard/charts/forecast-chart.tsx
// 지역별 3개 카드 — 각 카드: 목표(Bar) + 사전(Bar) + 달성률(Line 우측 Y축)

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ForecastRow } from "@/types/dashboard";
import { getChartColors, type ChartColorMode } from "./chart-colors";

interface ForecastChartProps {
  data: ForecastRow[];
}

function formatDateLabel(date: string): string {
  const parts = date.split("-");
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

interface RegionChartProps {
  title: string;
  chartData: { label: string; target: number; forecast: number; rate: number }[];
  colors: ChartColorMode;
  targetColor: string;  // 목표 bar — 모든 지역 공통 회색
  forecastColor: string; // 사전 bar — 지역별 고유 색
  lineColor: string;
}

function RegionChart({ title, chartData, colors, targetColor, forecastColor, lineColor }: RegionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260} minWidth={0}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 55, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis dataKey="label" tick={{ fill: colors.axis, fontSize: 11 }} />
            {/* 왼쪽 Y축 — 목표/사전 매출 (만원) */}
            <YAxis
              yAxisId="revenue"
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={(v) => `${Math.round(v / 10000).toLocaleString()}만`}
              width={55}
            />
            {/* 오른쪽 Y축 — 달성률 (%) */}
            <YAxis
              yAxisId="rate"
              orientation="right"
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 130]}
              width={45}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === "target") return [`₩${Math.round(Number(value) / 10000).toLocaleString()}만`, "목표"];
                if (name === "forecast") return [`₩${Math.round(Number(value) / 10000).toLocaleString()}만`, "사전"];
                return [`${Number(value).toFixed(1)}%`, "달성률"];
              }}
              contentStyle={{
                backgroundColor: colors.tooltip.bg,
                border: `1px solid ${colors.tooltip.border}`,
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend
              formatter={(value) => {
                if (value === "target") return "목표";
                if (value === "forecast") return "사전";
                return "달성률";
              }}
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Bar
              yAxisId="revenue"
              dataKey="target"
              fill={targetColor}
              radius={[2, 2, 0, 0]}
              name="target"
            />
            <Bar
              yAxisId="revenue"
              dataKey="forecast"
              fill={forecastColor}
              radius={[2, 2, 0, 0]}
              name="forecast"
            />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="rate"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ fill: lineColor, r: 3 }}
              name="rate"
            />
            <ReferenceLine
              yAxisId="rate"
              y={100}
              stroke={colors.referenceOrange}
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ForecastChart({ data }: ForecastChartProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === "dark");
  // 목표 bar: 모든 지역 공통 회색 — 사전 bar와 명확히 구분
  const targetColor = resolvedTheme === "dark" ? "#475569" : "#94a3b8";

  const labels = data.map((r) => formatDateLabel(r.date));

  const ulsanData = data.map((r, i) => ({
    label: labels[i],
    target: r.ulsanTarget,
    forecast: r.ulsanForecast,
    rate: r.ulsanAchievement,
  }));

  const gyeongnamData = data.map((r, i) => ({
    label: labels[i],
    target: r.gyeongnamTarget,
    forecast: r.gyeongnamForecast,
    rate: r.gyeongnamAchievement,
  }));

  const combinedData = data.map((r, i) => ({
    label: labels[i],
    target: r.combinedTarget,
    forecast: r.combinedForecast,
    rate: r.combinedAchievement,
  }));

  return (
    <div className="space-y-4">
      <RegionChart
        title="울산광역시"
        chartData={ulsanData}
        colors={colors}
        targetColor={targetColor}
        forecastColor={colors.chart1}
        lineColor={colors.chart2}
      />
      <RegionChart
        title="경상남도"
        chartData={gyeongnamData}
        colors={colors}
        targetColor={targetColor}
        forecastColor={colors.chart3}
        lineColor={colors.chart4}
      />
      <RegionChart
        title="전국"
        chartData={combinedData}
        colors={colors}
        targetColor={targetColor}
        forecastColor={colors.chart5}
        lineColor={colors.chart2}
      />
    </div>
  );
}
