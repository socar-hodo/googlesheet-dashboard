"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChartColors } from "@/components/dashboard/charts/chart-colors";
import type { FunnelTrendRow } from "@/types/funnel";

interface CvrTrendChartProps {
  data: FunnelTrendRow[];
}

// "2026-W15" → "W15", but show year prefix at year boundaries
function formatWeekLabel(yearWeek: string, data: FunnelTrendRow[]): string {
  const [year, week] = yearWeek.split("-");
  const years = new Set(data.map((r) => r.year_week.split("-")[0]));
  if (years.size > 1) return `${year?.slice(2)}-${week}`;
  return week ?? yearWeek;
}

export function CvrTrendChart({ data }: CvrTrendChartProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === "dark");

  const chartData = data.map((r) => ({
    label: formatWeekLabel(r.year_week, data),
    click_member_cnt: r.click_member_cnt,
    converted_member_cnt: r.converted_member_cnt,
    cvr: Math.round(r.cvr * 1000) / 10,
  }));

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">주간 CVR 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300} minWidth={0}>
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
              yAxisId="left"
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={(v) => v.toLocaleString()}
              width={60}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              width={45}
              domain={[0, "auto"]}
            />
            <Tooltip
              formatter={(value, name) => {
                const v = Number(value);
                if (name === "cvr") return [`${v.toFixed(1)}%`, "CVR"];
                if (name === "click_member_cnt")
                  return [v.toLocaleString(), "클릭유저"];
                return [v.toLocaleString(), "전환유저"];
              }}
              contentStyle={{
                backgroundColor: colors.tooltip.bg,
                border: `1px solid ${colors.tooltip.border}`,
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend
              formatter={(value: string) => {
                if (value === "click_member_cnt") return "클릭유저";
                if (value === "converted_member_cnt") return "전환유저";
                return "CVR (%)";
              }}
              wrapperStyle={{ fontSize: "11px" }}
            />
            <Bar
              yAxisId="left"
              dataKey="click_member_cnt"
              fill="#34d399"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
              name="click_member_cnt"
            />
            <Bar
              yAxisId="left"
              dataKey="converted_member_cnt"
              fill="#a78bfa"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
              name="converted_member_cnt"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cvr"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={{ fill: "#60a5fa", r: 3 }}
              name="cvr"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
