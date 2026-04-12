"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OptimizeResult, ZoneMapHandle } from "@/types/zone";

/* ── Formatting helpers ──────────────────────────────────────── */
function fmt(n: number | null | undefined): string {
  return n != null ? Math.round(n).toLocaleString("ko-KR") : "0";
}
function pct(n: number | null | undefined): string {
  return n != null ? (n * 100).toFixed(1) + "%" : "0%";
}
function won(n: number | null | undefined): string {
  return "\u20A9" + fmt(n);
}

/* ── Props ───────────────────────────────────────────────────── */
interface OptimizePanelProps {
  result: OptimizeResult | null;
  loading: boolean;
  /** 지역 선택 후 분석 실행 트리거 */
  onRun: (region1: string, region2?: string) => void;
  onSave: () => void;
  onSlack: () => void;
  mapRef: React.RefObject<ZoneMapHandle | null>;
}

/**
 * 최적화 모드 사이드 패널.
 *
 * 구성:
 * 1. 시/도 + 시/군/구 드롭다운 → 분석 실행
 * 2. 분석 요약 (운영 존, 배치 차량, 평균 가동률)
 * 3. 최적화 제안 (폐쇄 권고, 개설 권고, 재배치 권고)
 * 4. 예상 개선 효과
 * 5. 시나리오 저장 / Slack 발송 버튼
 */
export function OptimizePanel({
  result,
  loading,
  onRun,
  onSave,
  onSlack,
  mapRef,
}: OptimizePanelProps) {
  const [regions, setRegions] = useState<string[]>([]);
  const [subRegions, setSubRegions] = useState<string[]>([]);
  const [region1, setRegion1] = useState("");
  const [region2, setRegion2] = useState("");

  // ── 시/도 목록 로드 ──────────────────────────────────────
  useEffect(() => {
    fetch("/api/zone/zones?list=regions")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => { if (Array.isArray(data)) setRegions(data); })
      .catch(() => setRegions([]));
  }, []);

  // ── 시/군/구 목록 로드 ───────────────────────────────────
  useEffect(() => {
    if (!region1) {
      setSubRegions([]);
      return;
    }
    fetch(`/api/zone/zones?list=subregions&region1=${encodeURIComponent(region1)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => { if (Array.isArray(data)) setSubRegions(data); })
      .catch(() => setSubRegions([]));
  }, [region1]);

  // ── 맵 오버레이 렌더링 ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !result) return;
    map.clearOverlays();

    const closeIds = new Set(result.suggestions.close.map((s) => s.zone_id));
    const rebalanceZoneIds = new Set([
      ...result.suggestions.rebalance.map((r) => r.from_zone.zone_id),
      ...result.suggestions.rebalance.map((r) => r.to_zone.zone_id),
    ]);

    for (const z of result.zones) {
      if (z.lat == null || z.lng == null) continue;
      let color: "red" | "blue" | "yellow" | "green" = "blue";
      if (closeIds.has(z.zone_id)) color = "red";
      else if (rebalanceZoneIds.has(z.zone_id)) color = "yellow";
      map.addMarker(z.lat, z.lng, { color, zoneId: z.zone_id });
    }

    for (const rec of result.suggestions.open) {
      if (rec.lat != null && rec.lng != null) {
        map.addMarker(rec.lat, rec.lng, { color: "green" });
      }
    }
  }, [result, mapRef]);

  const handleRun = useCallback(() => {
    if (!region1) return;
    onRun(region1, region2 || undefined);
  }, [region1, region2, onRun]);

  return (
    <div className="space-y-4">
      {/* 지역 선택 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-emerald-600 dark:text-emerald-400">
            존 네트워크 최적화
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">시/도</label>
            <select
              className="h-10 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10"
              value={region1}
              onChange={(e) => {
                setRegion1(e.target.value);
                setRegion2("");
              }}
            >
              <option value="">-- 선택하세요 --</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">시/군/구</label>
            <select
              className="h-10 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10"
              value={region2}
              onChange={(e) => setRegion2(e.target.value)}
              disabled={subRegions.length === 0}
            >
              <option value="">-- 전체 --</option>
              {subRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button
            className="h-10 w-full rounded-2xl bg-foreground text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            disabled={!region1 || loading}
            onClick={handleRun}
          >
            {loading ? "분석 중..." : "분석 실행"}
          </button>
        </CardContent>
      </Card>

      {/* 로딩 */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      )}

      {/* 결과 */}
      {!loading && result && (
        <>
          {/* 분석 요약 */}
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard label="운영 존" value={`${result.summary.active_zones ?? result.summary.total_zones}개`} highlight />
            <SummaryCard label="비운영 존" value={`${result.summary.inactive_zones ?? 0}개`} />
            <SummaryCard label="배치 차량" value={`${result.summary.total_cars}대`} />
            <SummaryCard label="평균 가동률" value={pct(result.summary.avg_utilization)} highlight />
            <SummaryCard label="대당 매출" value={won(result.summary.avg_revenue_per_car)} />
            <SummaryCard label="존당 차량" value={`${(result.summary.avg_cars_per_zone ?? 0).toFixed(1)}대`} />
          </div>

          {/* 최적화 제안 */}
          {(result.suggestions.close.length > 0 ||
            result.suggestions.open.length > 0 ||
            result.suggestions.rebalance.length > 0) && (
            <Card className="border-border/60 bg-card/95">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">최적화 제안</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* 폐쇄 권고 */}
                {result.suggestions.close.length > 0 && (
                  <div className="mb-1 text-[11px] font-semibold text-red-600 dark:text-red-400">폐쇄 권고 ({result.suggestions.close.length}건)</div>
                )}
                {result.suggestions.close.map((s) => (
                  <div
                    key={s.zone_id}
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-800 dark:text-red-200">
                        {s.zone_name || `존 ${s.zone_id}`}
                      </span>
                      <span className="text-[10px] text-red-600 dark:text-red-300">
                        차량 {s.car_count}대
                      </span>
                    </div>
                    <div className="mt-1 text-red-700 dark:text-red-300">
                      가동률 {pct(s.utilization)} {s.has_alternative ? "· 대체 존 있음" : ""}
                    </div>
                    {s.reason && <div className="mt-0.5 text-[10px] text-red-600/80 dark:text-red-400/80">{s.reason}</div>}
                  </div>
                ))}

                {/* 개설 후보 */}
                {result.suggestions.open.length > 0 && (
                  <div className="mb-1 mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">개설 후보 ({result.suggestions.open.length}건)</div>
                )}
                {result.suggestions.open.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/40"
                  >
                    <div className="font-semibold text-emerald-800 dark:text-emerald-200">
                      {s.area || s.zone_name || "신규 후보지"}
                    </div>
                    {s.reason && (
                      <div className="mt-1 text-emerald-700 dark:text-emerald-300">{s.reason}</div>
                    )}
                  </div>
                ))}

                {/* 재배치 권고 */}
                {result.suggestions.rebalance.length > 0 && (
                  <div className="mb-1 mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400">재배치 대상 ({result.suggestions.rebalance.length}건)</div>
                )}
                {result.suggestions.rebalance.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/40"
                  >
                    <div className="font-semibold text-amber-800 dark:text-amber-200">
                      {s.from_zone.name} → {s.to_zone.name} ({s.cars}대 이동)
                    </div>
                    <div className="mt-1 text-amber-700 dark:text-amber-300">
                      {pct(s.from_zone.utilization)} → {pct(s.to_zone.utilization)}
                    </div>
                    {s.reason && (
                      <div className="mt-0.5 text-[10px] text-amber-600/80 dark:text-amber-400/80">{s.reason}</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 예상 개선 효과 */}
          {(result.projected.new_avg_utilization != null || result.projected.monthly_savings != null) && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="mb-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                예상 개선 효과
              </p>
              {result.projected.new_avg_utilization != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700 dark:text-emerald-300">개선 후 평균 가동률</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">
                    {pct(result.projected.new_avg_utilization)}
                  </span>
                </div>
              )}
              {result.projected.monthly_savings != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700 dark:text-emerald-300">월 절감 예상</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">
                    {won(result.projected.monthly_savings)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              onClick={onSave}
            >
              시나리오 저장
            </button>
            <button
              className="flex-1 rounded-2xl border border-border/70 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              onClick={onSlack}
            >
              Slack 발송
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── 요약 카드 ───────────────────────────────────────────────── */
function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${highlight ? "border-primary/20 bg-primary/5" : "border-border/60 bg-muted/30"}`}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
