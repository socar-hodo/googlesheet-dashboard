"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RegionDelta } from "@/types/relocation";

interface Props {
  increase: RegionDelta[];
  decrease: RegionDelta[];
}

function fmtEok(n: number): string {
  const v = n / 1e8;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}억`;
}

function RegionCard({ r, direction }: { r: RegionDelta; direction: "+" | "-" }) {
  const deltaStr = r.delta_cars > 0 ? `+${r.delta_cars.toFixed(1)}대` : `${r.delta_cars.toFixed(1)}대`;
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium leading-tight">{r.region1}</p>
          <p className="text-base font-semibold">{r.region2}</p>
        </div>
        <Badge variant="outline" className="text-[10px]">α={r.alpha.toFixed(2)}</Badge>
      </div>
      <div className="flex items-baseline gap-3 text-sm">
        <span className="text-muted-foreground">{r.cluster}</span>
        <span className="text-muted-foreground">현재 {r.current_cars}대</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className={`text-lg font-bold tabular-nums ${direction === "+" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {deltaStr}
        </span>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">{fmtEok(r.delta_rev_yr)}/yr</span>
      </div>
    </div>
  );
}

export function RelocationTopRegions({ increase, decrease }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">증설 Top {increase.length}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {increase.length === 0 ? <p className="text-sm text-muted-foreground col-span-full">증설 대상 없음</p> :
            increase.map((r) => <RegionCard key={`${r.region1}-${r.region2}`} r={r} direction="+" />)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">감축 Top {decrease.length}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {decrease.length === 0 ? <p className="text-sm text-muted-foreground col-span-full">감축 대상 없음</p> :
            decrease.map((r) => <RegionCard key={`${r.region1}-${r.region2}`} r={r} direction="-" />)}
        </CardContent>
      </Card>
    </div>
  );
}
