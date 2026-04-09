"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  /** 지역 필터링된 존 목록 (마커 표시용) */
  regionZones: ZoneInfo[];
  /** 현재 선택된 region1 */
  selectedRegion1: string;
  /** 현재 선택된 region2 */
  selectedRegion2: string;
  /** 지역 선택 콜백 */
  onRegionSelect: (region1: string, region2: string) => void;
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
 * 0. 지역 선택 드롭다운 (region1 / region2)
 * 1. 대상 존 정보 (이름, 지역, 매출, 가동률, 차량수)
 * 2. 수요 이전 예측 (인근 존별 흡수율, 가동률 변화)
 * 3. 영향 요약 (흡수율, 이탈율, 비용절감, 순효과)
 * 4. 시나리오 저장 / Slack 발송 버튼
 */
export function ClosePanel({
  selectedZoneId,
  regionZones,
  selectedRegion1,
  selectedRegion2,
  onRegionSelect,
  result,
  loading,
  onSave,
  onSlack,
  mapRef,
}: ClosePanelProps) {
  // ── 지역 목록 상태 ──────────────────────────────────────
  const [regions, setRegions] = useState<string[]>([]);
  const [subRegions, setSubRegions] = useState<string[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [subRegionsLoading, setSubRegionsLoading] = useState(false);

  // region1 목록 초기 로드
  useEffect(() => {
    setRegionsLoading(true);
    fetch("/api/zone/zones?list=regions")
      .then((r) => r.json())
      .then((data) => setRegions(Array.isArray(data) ? data : []))
      .catch(() => setRegions([]))
      .finally(() => setRegionsLoading(false));
  }, []);

  // region2 목록: region1 선택 시 로드
  useEffect(() => {
    if (!selectedRegion1) {
      setSubRegions([]);
      return;
    }
    setSubRegionsLoading(true);
    fetch(`/api/zone/zones?list=subregions&region1=${encodeURIComponent(selectedRegion1)}`)
      .then((r) => r.json())
      .then((data) => setSubRegions(Array.isArray(data) ? data : []))
      .catch(() => setSubRegions([]))
      .finally(() => setSubRegionsLoading(false));
  }, [selectedRegion1]);

  // ── 맵 오버레이 렌더링 ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.clearOverlays();

    if (!result) {
      // 지역 필터 존 마커 표시
      for (const z of regionZones) {
        if (z.lat != null && z.lng != null) {
          map.addMarker(z.lat, z.lng, { color: "blue", zoneId: z.id });
        }
      }
      return;
    }

    // 대상 존: red 마커
    const target = regionZones.find((z) => z.id === selectedZoneId);
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
  }, [selectedZoneId, regionZones, result, mapRef]);

  // ── 지역 선택 핸들러 ──────────────────────────────────
  const handleRegion1Change = (value: string) => {
    onRegionSelect(value, "");
  };

  const handleRegion2Change = (value: string) => {
    onRegionSelect(selectedRegion1, value === "__all__" ? "" : value);
  };

  return (
    <div className="space-y-4">
      {/* 지역 선택 드롭다운 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">지역 선택</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Select
            value={selectedRegion1 || ""}
            onValueChange={handleRegion1Change}
            disabled={regionsLoading}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={regionsLoading ? "로딩 중..." : "시/도 선택"} />
            </SelectTrigger>
            <SelectContent>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedRegion1 && (
            <Select
              value={selectedRegion2 || "__all__"}
              onValueChange={handleRegion2Change}
              disabled={subRegionsLoading}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder={subRegionsLoading ? "로딩 중..." : "시/군/구 선택"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">전체</SelectItem>
                {subRegions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedRegion1 && (
            <p className="text-[11px] text-muted-foreground">
              {regionZones.length > 0
                ? `${regionZones.length}개 존이 지도에 표시됩니다. 존을 클릭하여 폐쇄 분석을 시작하세요.`
                : "존을 불러오는 중..."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 지역 미선택 안내 */}
      {!selectedRegion1 && (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          시/도를 먼저 선택하세요
        </div>
      )}

      {/* 존 미선택 안내 */}
      {selectedRegion1 && !selectedZoneId && !loading && (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          지도에서 존을 클릭하여 폐쇄 영향도를 분석하세요
        </div>
      )}

      {loading && (
        <div className="space-y-4 p-1">
          <Skeleton className="h-6 w-40 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {!loading && result && (() => {
        const tz = result.target_zone;
        const dt = result.demand_transfer;
        const net = dt.net_effect_monthly;

        return (
          <>
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
          </>
        );
      })()}
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
