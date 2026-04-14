"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelRankingRow } from "@/types/funnel";

interface RegionRankingProps {
  data: FunnelRankingRow[];
  onRegionClick?: (region: string) => void;
}

export function RegionRanking({ data, onRegionClick }: RegionRankingProps) {
  const maxCvr = Math.max(...data.map((r) => r.cvr), 0.01);
  const top10 = data.slice(0, 10);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">CVR 랭킹</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {top10.map((row, i) => (
          <button
            key={row.region}
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted/50"
            onClick={() => onRegionClick?.(row.region)}
          >
            <span
              className={`w-5 text-center text-xs font-bold ${
                i === 0
                  ? "text-yellow-500"
                  : i === 1
                    ? "text-gray-400"
                    : i === 2
                      ? "text-amber-700"
                      : "text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className="flex-1 truncate">{row.region}</span>
            <div className="w-20">
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{
                    width: `${Math.round((row.cvr / maxCvr) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <span className="w-12 text-right text-xs font-semibold text-blue-500">
              {(row.cvr * 100).toFixed(1)}%
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
