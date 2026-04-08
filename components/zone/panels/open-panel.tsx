"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpenSimResult, ZoneMapHandle } from "@/types/zone";

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
interface OpenPanelProps {
  /** 현재 선택된 후보 좌표 */
  candidate: { lat: number; lng: number; addr: string } | null;
  /** 시뮬레이션 결과 */
  result: OpenSimResult | null;
  /** 로딩 중 여부 */
  loading: boolean;
  /** alpha 변경 시 재시뮬레이션 트리거 */
  onAlphaChange: (alpha: number) => void;
  /** 시나리오 저장 */
  onSave: () => void;
  /** Slack 발송 */
  onSlack: () => void;
  /** 맵 ref (오버레이 렌더링) */
  mapRef: React.RefObject<ZoneMapHandle | null>;
}

/**
 * 개설 모드 사이드 패널.
 *
 * 구성:
 * 1. 후보지 정보 (주소, 클러스터, 벤치마크)
 * 2. 예상 실적 (매출/일, 가동률)
 * 3. Alpha 슬라이더 (클러스터 vs 유사 존 가중치)
 * 4. 반경 내 유사 존 카드 목록
 * 5. 카니발리제이션 경고
 * 6. 시나리오 저장 / Slack 발송 버튼
 */
export function OpenPanel({
  candidate,
  result,
  loading,
  onAlphaChange,
  onSave,
  onSlack,
  mapRef,
}: OpenPanelProps) {
  const [alpha, setAlpha] = useState(0.5);

  // 결과가 바뀌면 alpha를 서버값으로 동기화
  useEffect(() => {
    if (result?.alpha != null) setAlpha(result.alpha);
  }, [result]);

  // ── 맵 오버레이 렌더링 ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !candidate) return;
    map.clearOverlays();

    // 후보 마커 (red)
    map.addMarker(candidate.lat, candidate.lng, { color: "red" });
    // 반경 원
    map.addCircle(candidate.lat, candidate.lng, 1000, {
      strokeColor: "#FF4444",
      fillColor: "#FF4444",
      fillOpacity: 0.08,
    });

    if (!result) return;

    // 유사 존 마커 (active=blue, inactive=gray)
    for (const z of result.nearby_zones) {
      if (z.lat == null || z.lng == null) continue;
      const active = z.revenue_per_car > 0;
      map.addMarker(z.lat, z.lng, {
        color: active ? "blue" : "gray",
        zoneId: z.id,
        title: z.name + (active ? "" : " (비운영)"),
      });
    }

    // 카니발리제이션 경고 오버레이
    const nearbyMap = new Map(result.nearby_zones.map((z) => [z.id, z]));
    for (const c of result.cannibalization) {
      const z = nearbyMap.get(c.zone_id);
      if (!z || z.lat == null || z.lng == null) continue;
      const bgColor = c.level === "danger" ? "#FEF2F2" : "#FFF3CD";
      const borderColor = c.level === "danger" ? "#E53E3E" : "#F59E0B";
      const textColor = c.level === "danger" ? "#991B1B" : "#7B341E";
      const html =
        `<div style="background:${bgColor};border:1px solid ${borderColor};` +
        `padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:${textColor};">` +
        `\u26A0 ${c.zone_name} ${c.distance_m}m</div>`;
      map.addOverlay(z.lat, z.lng, html);
    }
  }, [candidate, result, mapRef]);

  // ── Empty state ──────────────────────────────────────────
  if (!candidate) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        지도를 클릭하거나 주소를 검색하여 후보 지점을 선택하세요
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-6 w-32 rounded-xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!result) return null;

  const r = result;
  const hasBenchmark = r.cluster_benchmark && r.cluster_benchmark.zone_count > 0;

  return (
    <div className="space-y-4">
      {/* 후보지 정보 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">후보지 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatRow label="주소" value={candidate.addr || "선택된 위치"} />
          <StatRow label="클러스터" value={r.cluster_type ?? "-"} />
          <StatRow
            label="벤치마크 매출"
            value={hasBenchmark ? won(r.cluster_benchmark.avg_revenue_per_car) + "/일" : "-"}
          />
        </CardContent>
      </Card>

      {/* 예상 실적 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">예상 실적</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatRow label="예상 매출/일" value={won(r.estimated_revenue_per_car)} highlight />
          <StatRow label="예상 가동률" value={pct(r.estimated_utilization)} highlight />
          <Separator className="my-2" />
          <StatRow label="반경 내 평균 매출" value={won(r.nearby_avg_revenue) + "/일"} />
          <StatRow label="반경 내 평균 가동률" value={pct(r.nearby_avg_utilization)} />
        </CardContent>
      </Card>

      {/* Alpha 슬라이더 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">추정 가중치 (\u03B1)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              onMouseUp={() => onAlphaChange(alpha)}
              onTouchEnd={() => onAlphaChange(alpha)}
              className="flex-1 accent-foreground"
            />
            <span className="w-8 text-right font-semibold">{alpha.toFixed(1)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>\u2190 클러스터 벤치마크</span>
            <span>유사 존 평균 \u2192</span>
          </div>
        </CardContent>
      </Card>

      {/* 반경 내 유사 존 */}
      {r.nearby_zones.length > 0 && (
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">반경 내 유사 존</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {r.nearby_zones.map((z) => {
              const inactive = !z.revenue_per_car || z.revenue_per_car === 0;
              return (
                <div
                  key={z.id}
                  className={`rounded-xl border border-border/50 p-3 text-sm ${inactive ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {z.name}
                      {inactive && (
                        <span className="ml-1 text-[10px] text-destructive">(비운영)</span>
                      )}
                    </span>
                    <span className="text-xs text-blue-600">{z.distance_m}m</span>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                    <span>매출/일 {won(z.revenue_per_car)}</span>
                    <span>가동률 {pct(z.utilization)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 카니발리제이션 경고 */}
      {r.cannibalization.length > 0 && (
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">수요 잠식 위험</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {r.cannibalization.map((c) => (
              <div
                key={c.zone_id}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  c.level === "danger"
                    ? "border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                    : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                }`}
              >
                <strong>{c.zone_name}</strong> — {c.distance_m}m{" "}
                {c.level === "danger" ? "\u26A0\uFE0F 카니발리제이션 위험" : "주의"}
              </div>
            ))}
          </CardContent>
        </Card>
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
    </div>
  );
}

/* ── 통계 행 ─────────────────────────────────────────────────── */
function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold text-blue-700 dark:text-blue-300" : ""}>
        {value}
      </span>
    </div>
  );
}
