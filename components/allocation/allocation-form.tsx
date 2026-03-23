"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultsTabs } from "./results-tabs";
import { ScoreRationale } from "./score-rationale";
import { SEGMENTS, CSV_HEADERS } from "@/types/allocation";
import type { AllocationResult } from "@/types/allocation";

export function AllocationForm() {
  const [form, setForm] = useState({
    carModel:   "",
    carSegment: SEGMENTS[0] as string,
    totalCars:  "50",
    baseDate:   "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<AllocationResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/allocation/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, totalCars: Number(form.totalCars) }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.errors?.join(" / ") ?? "알 수 없는 오류가 발생했습니다.");
      return;
    }
    setResult(data);
  }

  function handleDownload() {
    if (!result) return;
    const csv = [
      CSV_HEADERS.join(","),
      ...result.rows.map((r) =>
        CSV_HEADERS.map((h) => {
          const v = r[h];
          return v === null || v === undefined ? "" : String(v);
        }).join(",")
      ),
    ].join("\n");

    const bom  = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "allocation.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-6">
      {/* 좌측: 입력 폼 */}
      <div className="w-72 shrink-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">배분 파라미터</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">차종 모델명</label>
                <input
                  className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="예: 아반떼"
                  value={form.carModel}
                  onChange={(e) => setForm((f) => ({ ...f, carModel: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">세그먼트</label>
                <select
                  className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.carSegment}
                  onChange={(e) => setForm((f) => ({ ...f, carSegment: e.target.value }))}
                >
                  {SEGMENTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">총 배분 물량</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.totalCars}
                  onChange={(e) => setForm((f) => ({ ...f, totalCars: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">기준 날짜</label>
                <input
                  type="date"
                  className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.baseDate}
                  onChange={(e) => setForm((f) => ({ ...f, baseDate: e.target.value }))}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "실행 중…" : "배분 실행"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 우측: 결과 */}
      <div className="flex-1 min-w-0">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300 mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-md border bg-muted/50 p-8 text-center text-sm text-muted-foreground">
            BigQuery 실행 중입니다… (약 10~30초 소요)
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">배분 결과</h2>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                CSV 다운로드
              </Button>
            </div>

            <ResultsTabs
              rows={result.rows}
              totalAllocated={result.totalAllocated}
              region1Count={result.region1Count}
              region2Count={result.region2Count}
              spearman={result.spearman}
            />

            <ScoreRationale rows={result.rows} spearman={result.spearman} />
          </div>
        )}
      </div>
    </div>
  );
}
