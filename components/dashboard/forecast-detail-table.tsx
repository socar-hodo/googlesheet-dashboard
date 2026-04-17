"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { utils, writeFile } from "xlsx";
import type { RegionRankingRow } from "@/types/dashboard";

type SortKey = "region" | "revenue" | "share";

interface Props {
  data: RegionRankingRow[];
  canDrillDown?: boolean;
  onRegionClick?: (region: string) => void;
}

export function ForecastDetailTable({ data, canDrillDown = false, onRegionClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);

  const total = data.reduce((sum, r) => sum + r.revenue, 0);
  const enriched = data.map((r) => ({
    ...r,
    share: total > 0 ? r.revenue / total : 0,
  }));

  const sorted = [...enriched].sort((a, b) => {
    const av = sortKey === "region" ? a.region : sortKey === "revenue" ? a.revenue : a.share;
    const bv = sortKey === "region" ? b.region : sortKey === "revenue" ? b.revenue : b.share;
    if (typeof av === "string" && typeof bv === "string")
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortAsc ? (
      <ChevronUp className="inline h-3 w-3" />
    ) : (
      <ChevronDown className="inline h-3 w-3" />
    );
  }

  function handleExport() {
    if (data.length === 0) return;
    const rows = enriched.map((r) => ({
      지역: r.region,
      사전매출: Math.round(r.revenue),
      "비중(%)": Math.round(r.share * 1000) / 10,
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "사전매출랭킹");
    writeFile(wb, `forecast-ranking-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">지역 상세 (사전 매출)</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={handleExport}
        >
          <Download className="h-3 w-3" /> Excel
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {data.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">데이터 없음</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th
                  className="cursor-pointer px-3 py-2 text-left font-medium"
                  onClick={() => toggleSort("region")}
                >
                  지역 <SortIcon col="region" />
                </th>
                <th
                  className="cursor-pointer px-3 py-2 text-right font-medium"
                  onClick={() => toggleSort("revenue")}
                >
                  사전 매출 <SortIcon col="revenue" />
                </th>
                <th
                  className="cursor-pointer px-3 py-2 text-right font-medium"
                  onClick={() => toggleSort("share")}
                >
                  비중 <SortIcon col="share" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr
                  key={`${row.region}-${idx}`}
                  className={`border-b transition-colors last:border-0 ${
                    canDrillDown ? "cursor-pointer hover:bg-muted/50" : ""
                  }`}
                  onClick={() => canDrillDown && onRegionClick?.(row.region)}
                >
                  <td className="px-3 py-2.5 font-medium">
                    {row.region}
                    {canDrillDown && (
                      <span className="ml-1 text-muted-foreground">→</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-blue-500">
                    {Math.round(row.revenue / 10000).toLocaleString()}만
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                    {(row.share * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
