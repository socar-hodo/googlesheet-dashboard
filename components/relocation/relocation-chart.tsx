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

const TIER_COLOR: Record<RelocationRow["tier"], string> = {
  top:    "#22c55e",  // green-500
  mid:    "#94a3b8",  // slate-400
  bottom: "#ef4444",  // red-500
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
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
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
