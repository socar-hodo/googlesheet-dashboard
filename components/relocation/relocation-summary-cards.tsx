"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { OptimizeMacroResponse } from "@/types/relocation";

interface Props {
  summary: OptimizeMacroResponse["summary"];
}

function fmtEok(n: number): string {
  const v = n / 1e8;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}억`;
}

function fmtManwon(n: number): string {
  const v = n / 10000;
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}억`;
  return `${Math.round(v).toLocaleString("ko-KR")}만원`;
}

export function RelocationSummaryCards({ summary }: Props) {
  const items = [
    { label: "실제 전송", value: `${summary.actual_transfer.toFixed(1)}대`, hint: "capacity 제약 후 최종 이동 대수" },
    { label: "연 예상이득", value: fmtEok(summary.delta_rev_yr), hint: "탁송비 제외 매출 증가 (log-linear)" },
    { label: "총 탁송비", value: fmtManwon(summary.total_cost_est), hint: "handler 실측 공식 기반" },
    { label: "순이득 (탁송비 반영)", value: fmtEok(summary.net_gain_yr), hint: "연 예상이득 - 총 탁송비", emphasize: true },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{it.label}</p>
            <p className={"mt-2 text-2xl font-bold tabular-nums " + (it.emphasize ? "text-foreground" : "text-foreground/90")}>{it.value}</p>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{it.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
