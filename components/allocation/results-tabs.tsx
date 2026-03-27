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
  const labels: Record<string, string> = {
    model: "모델 기준",
    segment: "세그먼트 기준",
    fallback: "보완 기준",
  };

  const styles: Record<string, string> = {
    model: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-200",
    segment: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
    fallback: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[refType] ?? ""}`}>
      {labels[refType] ?? refType}
    </span>
  );
}

function YoyCell({ value }: { value: number | null }) {
  if (value === null) {
    return <td className="px-3 py-3 text-right text-xs text-muted-foreground">N/A</td>;
  }

  return (
    <td
      className={`px-3 py-3 text-right text-xs font-medium ${
        value >= 1.0 ? "text-green-600 dark:text-green-300" : "text-red-500 dark:text-red-300"
      }`}
    >
      {value.toFixed(3)}
    </td>
  );
}

export function ResultsTabs({
  rows,
  totalAllocated,
  region1Count,
  region2Count,
  spearman,
}: ResultsTabsProps) {
  const region1Data = useMemo(() => {
    const grouped = new Map<
      string,
      {
        scoreSum: number;
        revSum: number;
        utilSum: number;
        cars: number;
        count: number;
        refTypes: Record<string, number>;
      }
    >();

    for (const row of rows) {
      const current = grouped.get(row.region1) ?? {
        scoreSum: 0,
        revSum: 0,
        utilSum: 0,
        cars: 0,
        count: 0,
        refTypes: {},
      };

      current.scoreSum += row.final_score;
      current.revSum += row.rev_yoy ?? 0;
      current.utilSum += row.util_yoy ?? 0;
      current.cars += row.allocated_cars;
      current.count += 1;
      current.refTypes[row.ref_type] = (current.refTypes[row.ref_type] ?? 0) + 1;
      grouped.set(row.region1, current);
    }

    return Array.from(grouped.entries())
      .map(([region1, value]) => ({
        region1,
        avgScore: value.scoreSum / value.count,
        avgRev: value.revSum / value.count,
        avgUtil: value.utilSum / value.count,
        totalCars: value.cars,
        topRef: Object.entries(value.refTypes).sort((left, right) => right[1] - left[1])[0][0],
      }))
      .sort((left, right) => right.avgScore - left.avgScore);
  }, [rows]);

  const region2Data = useMemo(() => [...rows].sort((left, right) => right.final_score - left.final_score), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStat label="총 배분" value={`${totalAllocated}대`} />
        <SummaryStat label="권역 수" value={`${region1Count}개`} />
        <SummaryStat label="세부 존 수" value={`${region2Count}개`} />
        <SummaryStat label="Spearman" value={spearman !== null ? String(spearman) : "N/A"} />
      </div>

      <Tabs defaultValue="region1" className="space-y-4">
        <TabsList className="h-auto rounded-2xl border border-border/60 bg-background/70 p-1">
          <TabsTrigger value="region1" className="rounded-xl px-4 py-2">
            권역 집계
          </TabsTrigger>
          <TabsTrigger value="region2" className="rounded-xl px-4 py-2">
            세부 존 상세
          </TabsTrigger>
        </TabsList>

        <TabsContent value="region1">
          <div className="overflow-x-auto rounded-[1.5rem] border border-border/60 bg-card/95">
            <table className="w-full text-sm">
              <thead className="bg-muted/55 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left">권역</th>
                  <th className="px-3 py-3 text-left">주요 기준</th>
                  <th className="px-3 py-3 text-right">평균 점수</th>
                  <th className="px-3 py-3 text-right">매출 YoY</th>
                  <th className="px-3 py-3 text-right">가동률 YoY</th>
                  <th className="px-3 py-3 text-right">배분 대수</th>
                </tr>
              </thead>
              <tbody>
                {region1Data.map((item) => (
                  <tr key={item.region1} className="border-t border-border/60 hover:bg-muted/25">
                    <td className="px-3 py-3 font-medium text-foreground">{item.region1}</td>
                    <td className="px-3 py-3">
                      <RefBadge refType={item.topRef} />
                    </td>
                    <td className="px-3 py-3 text-right">{item.avgScore.toFixed(3)}</td>
                    <YoyCell value={item.avgRev} />
                    <YoyCell value={item.avgUtil} />
                    <td className="px-3 py-3 text-right font-semibold">{item.totalCars}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="region2">
          <div className="overflow-x-auto rounded-[1.5rem] border border-border/60 bg-card/95">
            <table className="w-full text-sm">
              <thead className="bg-muted/55 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left">권역</th>
                  <th className="px-3 py-3 text-left">세부 존</th>
                  <th className="px-3 py-3 text-left">참조 기준</th>
                  <th className="px-3 py-3 text-right">최종 점수</th>
                  <th className="px-3 py-3 text-right">매출 YoY</th>
                  <th className="px-3 py-3 text-right">가동률 YoY</th>
                  <th className="px-3 py-3 text-right">배분 대수</th>
                </tr>
              </thead>
              <tbody>
                {region2Data.map((row, index) => (
                  <tr key={`${row.region1}-${row.region2}-${index}`} className="border-t border-border/60 hover:bg-muted/25">
                    <td className="px-3 py-3">{row.region1}</td>
                    <td className="px-3 py-3 font-medium text-foreground">{row.region2}</td>
                    <td className="px-3 py-3">
                      <RefBadge refType={row.ref_type} />
                    </td>
                    <td className="px-3 py-3 text-right">{row.final_score.toFixed(3)}</td>
                    <YoyCell value={row.rev_yoy} />
                    <YoyCell value={row.util_yoy} />
                    <td className="px-3 py-3 text-right font-semibold">{row.allocated_cars}</td>
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

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-border/60 bg-background/70 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">{value}</p>
    </div>
  );
}
