"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RelocationSummaryCards } from "./relocation-summary-cards";
import { RelocationClusterBreakdown } from "./relocation-cluster-breakdown";
import { RelocationTopRegions } from "./relocation-top-regions";
import { RelocationMoveOrdersTable } from "./relocation-move-orders-table";
import {
  RELOCATION_DEFAULTS,
  type OptimizeMacroResponse,
} from "@/types/relocation";

export function RelocationForm() {
  const [params, setParams] = useState({
    total_transfer: String(RELOCATION_DEFAULTS.total_transfer),
    max_pct_per_region: String(RELOCATION_DEFAULTS.max_pct_per_region),
    min_cars_per_region: String(RELOCATION_DEFAULTS.min_cars_per_region),
    top_n: String(RELOCATION_DEFAULTS.top_n),
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeMacroResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/relocation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "macro",
          total_transfer: Number(params.total_transfer),
          max_pct_per_region: Number(params.max_pct_per_region),
          min_cars_per_region: Number(params.min_cars_per_region),
          top_n: Number(params.top_n),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "요청 실패");
        setLoading(false);
        return;
      }
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`네트워크 오류: ${msg.slice(0, 100)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      {/* 좌측 필터 패널 */}
      <Card className="self-start">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">시뮬레이션 조건</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="total_transfer" className="text-sm font-medium">
                총 이동 대수
              </label>
              <Input
                id="total_transfer"
                type="number"
                min={0}
                max={10000}
                value={params.total_transfer}
                onChange={(e) =>
                  setParams({ ...params, total_transfer: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="max_pct" className="text-sm font-medium">
                지역당 상한 (0~1)
              </label>
              <Input
                id="max_pct"
                type="number"
                step="0.01"
                min={0.01}
                max={1}
                value={params.max_pct_per_region}
                onChange={(e) =>
                  setParams({ ...params, max_pct_per_region: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="min_cars" className="text-sm font-medium">
                지역당 최소 유지
              </label>
              <Input
                id="min_cars"
                type="number"
                min={0}
                value={params.min_cars_per_region}
                onChange={(e) =>
                  setParams({ ...params, min_cars_per_region: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="top_n" className="text-sm font-medium">
                Top N 지역
              </label>
              <Input
                id="top_n"
                type="number"
                min={1}
                max={200}
                value={params.top_n}
                onChange={(e) => setParams({ ...params, top_n: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "실행 중..." : "시뮬레이션 실행"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 우측 결과 영역 */}
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        ) : result ? (
          <>
            <RelocationSummaryCards summary={result.summary} />
            <RelocationClusterBreakdown byCluster={result.summary.by_cluster} />
            <RelocationTopRegions
              increase={result.suggestions.increase}
              decrease={result.suggestions.decrease}
            />
            <RelocationMoveOrdersTable moveOrders={result.move_orders} />
          </>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                좌측 파라미터를 확인하고 <b>시뮬레이션 실행</b>을 누르세요.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                기본 파라미터 (500대 / 지역당 20% / 최소 5대 / Top 30) 로 +74억/yr 순이득을 재현합니다.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
