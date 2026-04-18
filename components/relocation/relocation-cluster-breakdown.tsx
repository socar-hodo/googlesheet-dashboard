"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  byCluster: Record<string, number>;
}

const CLUSTER_LABELS: Record<string, string> = {
  metro_core: "메트로 중심",
  metro_periphery: "메트로 외곽",
  tourism: "관광",
  regional: "지방 거점",
  unknown: "미분류",
};

function fmtEok(n: number): string {
  const v = n / 1e8;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}억`;
}

function colorFor(delta: number): "default" | "secondary" | "destructive" {
  if (delta > 0) return "default";
  if (delta < 0) return "destructive";
  return "secondary";
}

export function RelocationClusterBreakdown({ byCluster }: Props) {
  const entries = Object.entries(byCluster).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">클러스터별 영향</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => (
          <Badge key={key} variant={colorFor(value)} className="text-sm py-1 px-3">
            {CLUSTER_LABELS[key] ?? key}: <span className="ml-1 tabular-nums">{fmtEok(value)}</span>
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}
