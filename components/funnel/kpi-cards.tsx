"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { FunnelSummary } from "@/types/funnel";

function WowBadge({ value, isPercent }: { value: number; isPercent?: boolean }) {
  if (value === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        — {isPercent ? "0.0%p" : "0.0%"}
      </span>
    );
  }
  const positive = value > 0;
  const display = isPercent
    ? `${positive ? "+" : ""}${(value * 100).toFixed(1)}%p`
    : `${positive ? "+" : ""}${(value * 100).toFixed(1)}%`;
  return (
    <span className={positive ? "text-xs text-emerald-500" : "text-xs text-red-500"}>
      {positive ? "▲" : "▼"} {display}
    </span>
  );
}

const CARDS: {
  key: keyof FunnelSummary;
  label: string;
  wowKey: keyof FunnelSummary;
  format: (v: number) => string;
  isPercentWow?: boolean;
}[] = [
  {
    key: "total_click_members",
    label: "존클릭 유저",
    wowKey: "wow_click_members",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "total_converted_members",
    label: "전환 유저",
    wowKey: "wow_converted_members",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "cvr",
    label: "전환율 (CVR)",
    wowKey: "wow_cvr",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    isPercentWow: true,
  },
  {
    key: "clicks_per_user",
    label: "인당 클릭",
    wowKey: "clicks_per_user",
    format: (v) => v.toFixed(1),
  },
];

interface KpiCardsProps {
  summary: FunnelSummary;
}

export function KpiCards({ summary }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {CARDS.map((card) => (
        <Card key={card.key} className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {card.key === "cvr" ? (
                <span className="text-blue-500">
                  {card.format(summary[card.key] as number)}
                </span>
              ) : (
                card.format(summary[card.key] as number)
              )}
            </p>
            {card.key !== "clicks_per_user" && (
              <div className="mt-1 flex items-center gap-1">
                <WowBadge
                  value={summary[card.wowKey] as number}
                  isPercent={card.isPercentWow}
                />
                <span className="text-[10px] text-muted-foreground/60">
                  vs 전주
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
