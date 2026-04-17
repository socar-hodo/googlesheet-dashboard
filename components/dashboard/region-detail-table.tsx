"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { utils, writeFile } from "xlsx";
import type { RegionRankingRow } from "@/types/dashboard";

type SortKey = keyof RegionRankingRow;

interface Props {
  data: RegionRankingRow[];
  canDrillDown?: boolean;
  onRegionClick?: (region: string) => void;
}

export function RegionDetailTable({ data, canDrillDown = false, onRegionClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
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
    const rows = data.map((r) => ({
      지역: r.region,
      매출: Math.round(r.revenue),
      손익: Math.round(r.profit),
      "GPM(%)": Math.round(r.gpm * 1000) / 10,
      이용건수: r.usageCount,
      "가동률(%)": Math.round(r.utilizationRate * 10) / 10,
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "지역랭킹");
    writeFile(wb, `region-ranking-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const COLS: { key: SortKey; label: string; align: string }[] = [
    { key: "region", label: "지역", align: "text-left" },
    { key: "revenue", label: "매출", align: "text-right" },
    { key: "profit", label: "손익", align: "text-right" },
    { key: "gpm", label: "GPM", align: "text-right" },
    { key: "usageCount", label: "이용건수", align: "text-right" },
    { key: "utilizationRate", label: "가동률", align: "text-right" },
  ];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">지역 상세</CardTitle>
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
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    className={`cursor-pointer px-3 py-2 font-medium ${col.align}`}
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.label} <SortIcon col={col.key} />
                  </th>
                ))}
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
                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                    {Math.round(row.revenue / 10000).toLocaleString()}만
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right ${row.profit < 0 ? "text-red-500" : "text-muted-foreground"}`}
                  >
                    {Math.round(row.profit / 10000).toLocaleString()}만
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-blue-500">
                    {(row.gpm * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                    {row.usageCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                    {row.utilizationRate.toFixed(1)}%
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
