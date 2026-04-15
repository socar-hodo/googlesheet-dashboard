"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelRankingRow } from "@/types/funnel";

interface RegionRankingProps {
  data: FunnelRankingRow[];
  canDrillDown?: boolean;
  onRegionClick?: (region: string) => void;
}

export function RegionRanking({ data, canDrillDown = true, onRegionClick }: RegionRankingProps) {
  const [expanded, setExpanded] = useState(false);
  const maxCvr = Math.max(...data.map((r) => r.cvr), 0.01);
  const visible = expanded ? data : data.slice(0, 10);
  const hasMore = data.length > 10;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">CVR 랭킹</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {visible.map((row, i) => {
          const Tag = canDrillDown ? "button" : "div";
          return (
            <Tag
              key={`${row.region}-${i}`}
              type={canDrillDown ? "button" : undefined}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${canDrillDown ? "cursor-pointer hover:bg-muted/50" : ""}`}
              onClick={canDrillDown ? () => onRegionClick?.(row.region) : undefined}
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
            </Tag>
          );
        })}
        {hasMore && (
          <button
            type="button"
            className="w-full py-2 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "접기" : `더보기 (${data.length - 10}개)`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
