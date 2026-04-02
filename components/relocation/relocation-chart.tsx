"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { RelocationRow } from "@/types/relocation";

interface Props {
  rows: RelocationRow[];
}

// These colors work in both light and dark mode — muted enough for dark backgrounds
const TIER_COLOR: Record<RelocationRow["tier"], string> = {
  top:    "hsl(142, 71%, 45%)",   // green — visible in both modes
  mid:    "hsl(215, 16%, 57%)",   // slate — neutral mid-tone
  bottom: "hsl(0, 84%, 60%)",     // red — visible in both modes
};

export function RelocationChart({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const data   = sorted.map((r) => ({
    name:  r.region2,
    score: parseFloat(r.score.toFixed(3)),
    tier:  r.tier,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 0 }} aria-label="권역별 종합 점수 분포 차트">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          interval={0}
        />
        <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number | undefined) => v?.toFixed(3) ?? "N/A"} />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={TIER_COLOR[d.tier]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
