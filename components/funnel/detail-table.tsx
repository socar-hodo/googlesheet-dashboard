"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { utils, writeFile } from "xlsx";
import type { FunnelRankingRow } from "@/types/funnel";

type SortKey = "region" | "click_member_cnt" | "converted_member_cnt" | "cvr" | "wow_cvr";

interface DetailTableProps {
  data: FunnelRankingRow[];
  canDrillDown?: boolean;
  onRegionClick?: (region: string) => void;
}

export function DetailTable({
  data,
  canDrillDown = false,
  onRegionClick,
}: DetailTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("click_member_cnt");
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
      클릭유저: r.click_member_cnt,
      전환유저: r.converted_member_cnt,
      CVR: Math.round(r.cvr * 1000) / 10,
      "WoW(%p)": Math.round(r.wow_cvr * 1000) / 10,
      인당클릭:
        r.click_member_cnt > 0
          ? Math.round((r.zone_click_cnt / r.click_member_cnt) * 10) / 10
          : 0,
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "전환율");
    writeFile(wb, `funnel-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const COLS: { key: SortKey; label: string; align: string }[] = [
    { key: "region", label: "지역", align: "text-left" },
    { key: "click_member_cnt", label: "클릭유저", align: "text-right" },
    { key: "converted_member_cnt", label: "전환유저", align: "text-right" },
    { key: "cvr", label: "CVR", align: "text-right" },
    { key: "wow_cvr", label: "WoW", align: "text-right" },
  ];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">상세 데이터</CardTitle>
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
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                인당클릭
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const clicksPerUser =
                row.click_member_cnt > 0
                  ? (row.zone_click_cnt / row.click_member_cnt).toFixed(1)
                  : "0.0";
              return (
                <tr
                  key={row.region}
                  className={`border-b transition-colors last:border-0 ${
                    canDrillDown
                      ? "cursor-pointer hover:bg-muted/50"
                      : ""
                  }`}
                  onClick={() =>
                    canDrillDown && onRegionClick?.(row.region)
                  }
                >
                  <td className="px-3 py-2.5 font-medium">
                    {row.region}
                    {canDrillDown && (
                      <span className="ml-1 text-muted-foreground">→</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                    {row.click_member_cnt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                    {row.converted_member_cnt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-blue-500">
                    {(row.cvr * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.wow_cvr === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : row.wow_cvr > 0 ? (
                      <span className="text-emerald-500">
                        ▲ {(row.wow_cvr * 100).toFixed(1)}%p
                      </span>
                    ) : (
                      <span className="text-red-500">
                        ▼ {(Math.abs(row.wow_cvr) * 100).toFixed(1)}%p
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                    {clicksPerUser}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
