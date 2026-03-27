"use client";

import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AllocationRow } from "@/types/allocation";

interface ResultsTabsProps {
  rows: AllocationRow[];
  totalAllocated: number;
  region1Count: number;
  region2Count: number;
  spearman: number | null;
}

function RefBadge({ refType }: { refType: string }) {
  const styles: Record<string, string> = {
    model:    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    segment:  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    fallback: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${styles[refType] ?? ""}`}>
      {refType}
    </span>
  );
}

function YoyCell({ value }: { value: number | null }) {
  if (value === null) {
    return <td className="px-3 py-2 text-right text-xs text-muted-foreground">—</td>;
  }
  return (
    <td className={`px-3 py-2 text-right text-xs font-medium ${value >= 1.0 ? "text-green-600" : "text-red-500"}`}>
      {value.toFixed(3)}
    </td>
  );
}

export function ResultsTabs({ rows, totalAllocated, region1Count, region2Count, spearman }: ResultsTabsProps) {
  // 시/도별 집계 (avg_score 내림차순)
  const region1Data = useMemo(() => {
    const map = new Map<string, {
      scoreSum: number; revSum: number; utilSum: number;
      cars: number; count: number; refTypes: Record<string, number>;
    }>();
    for (const r of rows) {
      const g = map.get(r.region1) ?? { scoreSum: 0, revSum: 0, utilSum: 0, cars: 0, count: 0, refTypes: {} };
      g.scoreSum += r.final_score;
      g.revSum   += r.rev_yoy ?? 0;
      g.utilSum  += r.util_yoy ?? 0;
      g.cars     += r.allocated_cars;
      g.count    += 1;
      g.refTypes[r.ref_type] = (g.refTypes[r.ref_type] ?? 0) + 1;
      map.set(r.region1, g);
    }
    return Array.from(map.entries())
      .map(([region1, g]) => ({
        region1,
        avgScore:  g.scoreSum / g.count,
        avgRev:    g.revSum / g.count,
        avgUtil:   g.utilSum / g.count,
        totalCars: g.cars,
        topRef:    Object.entries(g.refTypes).sort((a, b) => b[1] - a[1])[0][0],
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [rows]);

  // 시/군/구별 (final_score 내림차순)
  const region2Data = useMemo(
    () => [...rows].sort((a, b) => b.final_score - a.final_score),
    [rows]
  );

  return (
    <div className="space-y-3">
      {/* 요약 */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>총 배분: <strong className="text-foreground">{totalAllocated}대</strong></span>
        <span>시/도: <strong className="text-foreground">{region1Count}개</strong></span>
        <span>시/군/구: <strong className="text-foreground">{region2Count}개</strong></span>
        {spearman !== null && (
          <span>스피어만(α 안정성): <strong className="text-foreground">{spearman}</strong></span>
        )}
      </div>

      <Tabs defaultValue="region1">
        <TabsList>
          <TabsTrigger value="region1">시/도별</TabsTrigger>
          <TabsTrigger value="region2">시/군/구별</TabsTrigger>
        </TabsList>

        {/* 시/도별 탭 */}
        <TabsContent value="region1">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">시/도</th>
                  <th className="px-3 py-2 text-left">참조기준</th>
                  <th className="px-3 py-2 text-right">평균점수</th>
                  <th className="px-3 py-2 text-right">수익YoY</th>
                  <th className="px-3 py-2 text-right">가동YoY</th>
                  <th className="px-3 py-2 text-right">배분대수</th>
                </tr>
              </thead>
              <tbody>
                {region1Data.map((d) => (
                  <tr key={d.region1} className="border-t hover:bg-muted/50">
                    <td className="px-3 py-2 font-medium">{d.region1}</td>
                    <td className="px-3 py-2"><RefBadge refType={d.topRef} /></td>
                    <td className="px-3 py-2 text-right">{d.avgScore.toFixed(3)}</td>
                    <YoyCell value={d.avgRev} />
                    <YoyCell value={d.avgUtil} />
                    <td className="px-3 py-2 text-right font-bold">{d.totalCars}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 시/군/구별 탭 */}
        <TabsContent value="region2">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">시/도</th>
                  <th className="px-3 py-2 text-left">시/군/구</th>
                  <th className="px-3 py-2 text-left">참조기준</th>
                  <th className="px-3 py-2 text-right">최종점수</th>
                  <th className="px-3 py-2 text-right">수익YoY</th>
                  <th className="px-3 py-2 text-right">가동YoY</th>
                  <th className="px-3 py-2 text-right">배분대수</th>
                </tr>
              </thead>
              <tbody>
                {region2Data.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/50">
                    <td className="px-3 py-2">{r.region1}</td>
                    <td className="px-3 py-2 font-medium">{r.region2}</td>
                    <td className="px-3 py-2"><RefBadge refType={r.ref_type} /></td>
                    <td className="px-3 py-2 text-right">{r.final_score.toFixed(3)}</td>
                    <YoyCell value={r.rev_yoy} />
                    <YoyCell value={r.util_yoy} />
                    <td className="px-3 py-2 text-right font-bold">{r.allocated_cars}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
