"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { CloseSimResult, ZoneInfo, ZoneMapHandle } from "@/types/zone";

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
interface ClosePanelProps {
  /** 현재 선택된 존 ID */
  selectedZoneId: number | null;
  /** 전체 존 목록 (마커 표시용) */
  allZones: ZoneInfo[];
  /** 폐쇄 시뮬레이션 결과 */
  result: CloseSimResult | null;
  /** 로딩 중 여부 */
  loading: boolean;
  /** 시나리오 저장 */
  onSave: () => void;
  /** Slack 발송 */
  onSlack: () => void;
  /** 맵 ref */
  mapRef: React.RefObject<ZoneMapHandle | null>;
}

/**
 * 폐쇄 모드 사이드 패널.
 *
 * 구성:
 * 1. 대상 존 정보 (이름, 지역, 매출, 가동률, 차량수)
 * 2. 수요 이전 예측 (인근 존별 흡수율, 가동률 변화)
 * 3. 영향 요약 (흡수율, 이탈율, 비용절감, 순효과)
 * 4. 시나리오 저장 / Slack 발송 버튼
 */
export function ClosePanel({
  selectedZoneId,
  allZones,
  result,
  loading,
  onSave,
  onSlack,
  mapRef,
}: ClosePanelProps) {
  // ── 맵 오버레이 렌더링 ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.clearOverlays();

    if (!result) {
      // 폐쇄 모드 진입 시 전체 존 마커 표시
      for (const z of allZones) {
        if (z.lat != null && z.lng != null) {
          map.addMarker(z.lat, z.lng, { color: "blue", zoneId: z.id });
        }
      }
      return;
    }

    // 대상 존: red 마커
    const target = allZones.find((z) => z.id === selectedZoneId);
    if (target?.lat != null) {
      map.addMarker(target.lat, target.lng, { color: "red", zoneId: selectedZoneId! });
    }

    // 수요 이전 존: blue 마커 + 흡수율 오버레이
    for (const t of result.demand_transfer.transfers) {
      if (t.lat != null && t.lng != null) {
        map.addMarker(t.lat, t.lng, { color: "blue", zoneId: t.zone_id });
        const html =
          `<div style="background:#C6F6D5;border:1px solid #48BB78;` +
          `padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#22543D;">` +
          `+${pct(t.absorption_pct)}</div>`;
        map.addOverlay(t.lat, t.lng, html);
      }
    }
  }, [selectedZoneId, allZones, result, mapRef]);

  // ── Empty state ──────────────────────────────────────────
  if (!selectedZoneId) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        지도에서 존을 클릭하여 폐쇄 영향도를 분석하세요
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-6 w-40 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  if (!result) return null;

  const tz = result.target_zone;
  const dt = result.demand_transfer;
  const net = dt.net_effect_monthly;

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-destructive">폐쇄 영향도 분석</p>

      {/* 대상 존 정보 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">대상 존 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatRow label="존 이름" value={tz.name || "-"} />
          <StatRow label="지역" value={[tz.region1, tz.region2].filter(Boolean).join(" ")} />
          <StatRow label="매출/일" value={won(tz.revenue_per_car)} />
          <StatRow label="가동률" value={pct(tz.utilization)} />
          <StatRow label="배치 차량" value={`${tz.car_count || 0}대`} />
        </CardContent>
      </Card>

      {/* 수요 이전 예측 */}
      {dt.transfers.length > 0 && (
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">수요 이전 예측</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dt.transfers.map((t) => (
              <div key={t.zone_id} className="rounded-xl border border-border/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.zone_name || `존 ${t.zone_id}`}</span>
                  <span className="text-xs font-semibold text-emerald-600">
                    +{pct(t.absorption_pct)} 흡수
                  </span>
                </div>
                {t.current_utilization != null && t.new_utilization != null && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    가동률 변화: {pct(t.current_utilization)} → {pct(t.new_utilization)}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 영향 요약 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">영향 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatRow label="수요 흡수율" value={pct(dt.total_absorption_pct)} />
          <StatRow label="이탈율" value={pct(dt.churn_pct)} destructive />
          <StatRow label="비용 절감/월" value={won(dt.cost_saved_monthly)} success />
          <StatRow label="이탈 손실/월" value={won(dt.churn_loss_monthly)} destructive />
          <Separator className="my-2" />
          <div
            className={`rounded-lg px-3 py-2.5 text-center text-sm font-semibold ${
              net != null && net >= 0
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            }`}
          >
            순 효과 (월): {net != null && net >= 0 ? "+" : ""}{won(net)}
          </div>
        </CardContent>
      </Card>

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
  destructive,
  success,
}: {
  label: string;
  value: string;
  destructive?: boolean;
  success?: boolean;
}) {
  const cls = destructive
    ? "text-destructive"
    : success
      ? "text-emerald-600 dark:text-emerald-300"
      : "";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}
