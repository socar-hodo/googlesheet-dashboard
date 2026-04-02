"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultsTabs } from "./results-tabs";
import { ScoreRationale } from "./score-rationale";
import { CSV_HEADERS, SEGMENTS, REGION1_LIST } from "@/types/allocation";
import type { AllocationMode, AllocationResult } from "@/types/allocation";

export function AllocationForm() {
  const [form, setForm] = useState({
    carModel: "",
    carSegment: SEGMENTS[0] as string,
    totalCars: "50",
    baseDate: "",
    mode: "region1" as AllocationMode,
    region1List: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AllocationResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function toggleRegion(region: string) {
    setForm((current) => {
      const list = current.region1List.includes(region)
        ? current.region1List.filter((r) => r !== region)
        : [...current.region1List, region];
      return { ...current, region1List: list };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Inline validation
    const errors: Record<string, string> = {};
    const totalNum = Number(form.totalCars);
    if (!totalNum || totalNum < 1 || totalNum > 10000) {
      errors.totalCars = "1~10,000 사이의 값을 입력해 주세요.";
    }
    if (!form.baseDate) {
      errors.baseDate = "기준일을 선택해 주세요.";
    }
    if (form.mode === "region2" && form.region1List.length === 0) {
      errors.region1List = "최소 1개 광역을 선택해 주세요.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/allocation/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        totalCars: Number(form.totalCars),
        region1List: form.mode === "region2" ? form.region1List : undefined,
      }),
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

    try {
      const csv = [
        CSV_HEADERS.join(","),
        ...result.rows.map((row) =>
          CSV_HEADERS.map((header) => {
            const value = row[header];
            return value === null || value === undefined ? "N/A" : String(value);
          }).join(","),
        ),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const suffix = form.mode === "region2" ? `_r2_${form.region1List.join("_")}` : "";
      anchor.download = `allocation${suffix}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("CSV 파일이 다운로드되었습니다.", {
        description: `${result.rows.length}개 행이 포함된 배분 결과`,
      });
    } catch {
      toast.error("CSV 다운로드에 실패했습니다.", {
        description: "잠시 후 다시 시도해 주세요.",
      });
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="h-fit max-h-[calc(100dvh-7rem)] overflow-y-auto border-border/60 bg-card/95 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.16)] xl:sticky xl:top-24">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">배분 파라미터</CardTitle>
          <p className="text-sm text-muted-foreground">
            실행에 필요한 차종과 기준 조건을 입력합니다.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {/* 모드 선택 */}
            <div className="space-y-2">
              <label id="alloc-mode-label" className="text-xs font-medium text-muted-foreground">배분 모드</label>
              <div className="flex overflow-hidden rounded-2xl border border-border/70" role="radiogroup" aria-labelledby="alloc-mode-label">
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.mode === "region1"}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                    form.mode === "region1"
                      ? "bg-foreground text-background"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setForm((current) => ({ ...current, mode: "region1", region1List: [] }))}
                >
                  1단계 전국
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.mode === "region2"}
                  className={`flex-1 border-l border-border/70 px-3 py-2.5 text-xs font-medium transition-colors ${
                    form.mode === "region2"
                      ? "bg-foreground text-background"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setForm((current) => ({ ...current, mode: "region2" }))}
                >
                  2단계 광역내
                </button>
              </div>
            </div>

            {/* 2단계: 광역 복수 선택 */}
            {form.mode === "region2" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label id="region-label" className="text-xs font-medium text-muted-foreground">
                    대상 광역 ({form.region1List.length}개 선택)
                  </label>
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setForm((current) => ({
                      ...current,
                      region1List: current.region1List.length === REGION1_LIST.length ? [] : [...REGION1_LIST],
                    }))}
                  >
                    {form.region1List.length === REGION1_LIST.length ? "전체 해제" : "전체 선택"}
                  </button>
                </div>
                {fieldErrors.region1List && (
                  <p className="text-xs text-destructive">{fieldErrors.region1List}</p>
                )}
                <div className="max-h-48 overflow-y-auto rounded-2xl border border-border/70 bg-background p-2 space-y-0.5" role="group" aria-labelledby="region-label">
                  {REGION1_LIST.map((r) => (
                    <label
                      key={r}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors ${
                        form.region1List.includes(r) ? "bg-foreground/10 font-medium" : "hover:bg-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded accent-foreground"
                        checked={form.region1List.includes(r)}
                        onChange={() => toggleRegion(r)}
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="alloc-car-model" className="text-xs font-medium text-muted-foreground">
                차종 모델명 <span className="text-muted-foreground/60">(선택)</span>
              </label>
              <input
                id="alloc-car-model"
                className="h-11 w-full rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10"
                placeholder="비워두면 세그먼트 기준만 사용"
                value={form.carModel}
                onChange={(e) => setForm((current) => ({ ...current, carModel: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="alloc-segment" className="text-xs font-medium text-muted-foreground">세그먼트</label>
              <select
                id="alloc-segment"
                className="h-11 w-full rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10"
                value={form.carSegment}
                onChange={(e) => setForm((current) => ({ ...current, carSegment: e.target.value }))}
              >
                {SEGMENTS.map((segment) => (
                  <option key={segment} value={segment}>
                    {segment}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-2">
                <label htmlFor="alloc-total-cars" className="text-xs font-medium text-muted-foreground">
                  {form.mode === "region2" ? "광역 쿼터 (대)" : "총 배분 대수"}
                </label>
                <input
                  id="alloc-total-cars"
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  className="h-11 w-full rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10"
                  value={form.totalCars}
                  onChange={(e) => {
                    setForm((current) => ({ ...current, totalCars: e.target.value }));
                    if (fieldErrors.totalCars) setFieldErrors((prev) => { const next = { ...prev }; delete next.totalCars; return next; });
                  }}
                  aria-invalid={!!fieldErrors.totalCars}
                  aria-describedby={fieldErrors.totalCars ? "err-total-cars" : undefined}
                  required
                />
                {fieldErrors.totalCars && (
                  <p id="err-total-cars" className="text-xs text-destructive">{fieldErrors.totalCars}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="alloc-base-date" className="text-xs font-medium text-muted-foreground">기준일</label>
                <input
                  id="alloc-base-date"
                  type="date"
                  className="h-11 w-full rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10"
                  value={form.baseDate}
                  onChange={(e) => {
                    setForm((current) => ({ ...current, baseDate: e.target.value }));
                    if (fieldErrors.baseDate) setFieldErrors((prev) => { const next = { ...prev }; delete next.baseDate; return next; });
                  }}
                  aria-invalid={!!fieldErrors.baseDate}
                  aria-describedby={fieldErrors.baseDate ? "err-base-date" : undefined}
                  required
                />
                {fieldErrors.baseDate && (
                  <p id="err-base-date" className="text-xs text-destructive">{fieldErrors.baseDate}</p>
                )}
              </div>
            </div>

            <Button type="submit" className="h-11 w-full rounded-2xl" disabled={loading} aria-busy={loading}>
              {loading ? "배분 실행 중..." : "배분 실행"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-5">
        {error && (
          <div role="alert" aria-live="assertive" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <Card className="border-border/60 bg-card/95 shadow-[0_20px_50px_-40px_rgba(20,26,36,0.16)]">
            <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
              BigQuery에서 배분 결과를 계산하고 있습니다. 보통 10~30초 정도 걸립니다.
            </CardContent>
          </Card>
        )}

        {!loading && !result && !error && (
          <Card className="border-border/60 bg-card/95 shadow-[0_20px_50px_-40px_rgba(20,26,36,0.16)]">
            <CardContent className="space-y-3 px-6 py-10">
              <p className="text-base font-semibold text-foreground">배분 결과가 여기에 표시됩니다.</p>
              <p className="text-sm leading-6 text-muted-foreground">
                왼쪽 파라미터를 입력한 뒤 실행하면 권역별 점수, 배분 대수, 점수 산식 요약을 한 번에 확인할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        )}

        {result && !loading && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                  {result.mode === "region2"
                    ? `${form.region1List.join(", ")} 내 시/군/구 배분 결과`
                    : "배분 결과"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  권역별 최종 점수와 배분 수량을 탭으로 나눠 확인할 수 있습니다.
                </p>
              </div>
              <Button variant="outline" className="rounded-2xl" onClick={handleDownload}>
                CSV 다운로드
              </Button>
            </div>

            <ResultsTabs
              rows={result.rows}
              totalAllocated={result.totalAllocated}
              region1Count={result.region1Count}
              region2Count={result.region2Count}
              spearman={result.spearman}
              mode={result.mode}
            />

            <ScoreRationale rows={result.rows} spearman={result.spearman} />
          </div>
        )}
      </div>
    </div>
  );
}
