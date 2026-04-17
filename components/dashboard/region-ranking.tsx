"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegionRankingRow } from "@/types/dashboard";

interface RegionRankingProps {
  data: RegionRankingRow[];
  canDrillDown?: boolean;
  onRegionClick?: (region: string) => void;
}

export function RegionRanking({ data, canDrillDown = true, onRegionClick }: RegionRankingProps) {
  const [expanded, setExpanded] = useState(false);
  const maxRevenue = Math.max(...data.map((r) => r.revenue), 1);
  const visible = expanded ? data : data.slice(0, 10);
  const hasMore = data.length > 10;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">매출 랭킹</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">데이터 없음</p>
        )}
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
                      width: `${Math.round((row.revenue / maxRevenue) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <span className="w-16 text-right text-xs font-semibold text-blue-500">
                {Math.round(row.revenue / 10000).toLocaleString()}만
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
