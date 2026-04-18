"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CsvDownloadButton } from "./csv-download-button";
import { MOVE_ORDER_CSV_HEADERS, type MoveOrder } from "@/types/relocation";

interface Props { moveOrders: MoveOrder[]; }
type SortKey = "order_id" | "cars" | "distance_km" | "cost_est" | "gain_per_year";
type SortDir = "asc" | "desc";

function fmtEok(n: number): string {
  const v = n / 1e8;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}억`;
}
function fmtMan(n: number): string {
  const v = n / 10000;
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}억`;
  return `${Math.round(v).toLocaleString("ko-KR")}만원`;
}

export function RelocationMoveOrdersTable({ moveOrders }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("gain_per_year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const cp = [...moveOrders];
    cp.sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return cp;
  }, [moveOrders, sortKey, sortDir]);

  const totals = useMemo(() => {
    const cars = moveOrders.reduce((s, o) => s + o.cars, 0);
    const cost = moveOrders.reduce((s, o) => s + o.cost_est, 0);
    const gain = moveOrders.reduce((s, o) => s + o.gain_per_year, 0);
    const dist = moveOrders.length > 0 ? moveOrders.reduce((s, o) => s + o.distance_km, 0) / moveOrders.length : 0;
    return { cars, cost, gain, dist };
  }, [moveOrders]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "order_id" ? "asc" : "desc"); }
  }

  function renderSortHead(label: string, k: SortKey) {
    const icon = sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "";
    return (
      <TableHead onClick={() => toggleSort(k)} className="cursor-pointer select-none hover:text-foreground">
        {label}{icon}
      </TableHead>
    );
  }

  if (moveOrders.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">이동 명령</CardTitle></CardHeader>
        <CardContent>
          <p className="rounded-lg border border-border/60 bg-muted/50 px-4 py-6 text-sm text-muted-foreground">
            생성 가능한 이동 명령 없음 (운영 zone 부족 또는 capacity 소진).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">이동 명령 (zone 단위, {moveOrders.length}건)</CardTitle>
        <CsvDownloadButton
          data={moveOrders}
          headers={MOVE_ORDER_CSV_HEADERS}
          filename={`배치명령_${new Date().toISOString().slice(0, 10)}.csv`}
          rowMapper={(o) => [
            o.order_id, o.src_zone.zone_id, o.src_zone.zone_name, o.src_zone.region1, o.src_zone.region2,
            o.dst_zone.zone_id, o.dst_zone.zone_name, o.dst_zone.region1, o.dst_zone.region2,
            o.cars, o.distance_km, o.cost_est, o.gain_per_year,
          ]}
        />
      </CardHeader>
      <CardContent>
        <div className="max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                {renderSortHead("순위", "order_id")}
                <TableHead>출발 존</TableHead>
                <TableHead>도착 존</TableHead>
                {renderSortHead("대수", "cars")}
                {renderSortHead("거리", "distance_km")}
                {renderSortHead("탁송비", "cost_est")}
                {renderSortHead("연 이득", "gain_per_year")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((o) => (
                <TableRow key={o.order_id}>
                  <TableCell className="tabular-nums">{o.order_id}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.src_zone.zone_name}</div>
                    <div className="text-xs text-muted-foreground">{o.src_zone.region1} · {o.src_zone.region2}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{o.dst_zone.zone_name}</div>
                    <div className="text-xs text-muted-foreground">{o.dst_zone.region1} · {o.dst_zone.region2}</div>
                  </TableCell>
                  <TableCell className="tabular-nums">{o.cars}</TableCell>
                  <TableCell className="tabular-nums">{o.distance_km.toFixed(1)}km</TableCell>
                  <TableCell className="tabular-nums">{fmtMan(o.cost_est)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{fmtEok(o.gain_per_year)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">합계 ({moveOrders.length}건)</TableCell>
                <TableCell className="font-semibold tabular-nums">{totals.cars}</TableCell>
                <TableCell className="font-semibold tabular-nums">{totals.dist.toFixed(1)}km (평균)</TableCell>
                <TableCell className="font-semibold tabular-nums">{fmtMan(totals.cost)}</TableCell>
                <TableCell className="font-semibold tabular-nums">{fmtEok(totals.gain)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
