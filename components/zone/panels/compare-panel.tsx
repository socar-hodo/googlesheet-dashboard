"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompareResult, ZoneInfo, ZoneMapHandle } from "@/types/zone";

/* ── Zone colors (최대 5개) ──────────────────────────────────── */
const ZONE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

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
interface ComparePanelProps {
  selectedZoneIds: number[];
  allZones: ZoneInfo[];
  result: CompareResult | null;
  loading: boolean;
  onRemoveZone: (zoneId: number) => void;
  onSlack: () => void;
  mapRef: React.RefObject<ZoneMapHandle | null>;
}

/**
 * 비교 모드 사이드 패널.
 *
 * 구성:
 * 1. 선택된 존 칩 (클릭으로 제거)
 * 2. 매출/일 수평 바
 * 3. 가동률 수평 바
 * 4. 총 이용건수 수평 바
 * 5. 클러스터 벤치마크 (있는 경우)
 * 6. Slack 발송 버튼
 */
export function ComparePanel({
  selectedZoneIds,
  allZones,
  result,
  loading,
  onRemoveZone,
  onSlack,
  mapRef,
}: ComparePanelProps) {
  // ── 맵 오버레이 렌더링 ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.clearOverlays();

    // 미선택 존 (blue)
    for (const z of allZones) {
      if (z.lat == null || z.lng == null) continue;
      if (selectedZoneIds.includes(z.id)) continue;
      map.addMarker(z.lat, z.lng, { color: "blue", zoneId: z.id });
    }

    // 선택된 존 (색상 구분) — result에서 좌표 사용
    if (result?.zones) {
      result.zones.forEach((z) => {
        if (z.lat != null && z.lng != null) {
          // NOTE: Kakao SDK 커스텀 색상은 제한적이므로 기본 blue 사용 후 오버레이로 구분
          map.addMarker(z.lat, z.lng, { color: "blue", zoneId: z.zone_id });
        }
      });
    }
  }, [selectedZoneIds, allZones, result, mapRef]);

  // ── 선택된 존 칩 ────────────────────────────────────────
  const chips = selectedZoneIds.map((id, i) => {
    const z = allZones.find((z) => z.id === id);
    const name = z ? z.name : `존 ${id}`;
    const color = ZONE_COLORS[i % ZONE_COLORS.length];
    return (
      <button
        key={id}
        onClick={() => onRemoveZone(id)}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors hover:opacity-80"
        style={{
          backgroundColor: color + "22",
          border: `1px solid ${color}`,
          color,
        }}
      >
        {name} &times;
      </button>
    );
  });

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">존 간 비교</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.length > 0 ? chips : (
            <span className="text-xs text-muted-foreground">선택된 존이 없습니다</span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          지도에서 비교할 존을 클릭하세요 (2~5개)
        </p>
      </div>

      {/* 2개 미만 */}
      {selectedZoneIds.length < 2 && !loading && (
        <div className="text-sm text-muted-foreground">
          존을 2개 이상 선택하면 비교 분석이 시작됩니다.
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}

      {/* 결과 */}
      {!loading && result?.zones && result.zones.length >= 2 && (
        <>
          {/* 매출/일 */}
          <Card className="border-border/60 bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">매출/일</CardTitle>
            </CardHeader>
            <CardContent>
              <HorizontalBarGroup zones={result.zones as unknown as ZoneRow[]} dataKey="revenue_per_car" formatFn={won} />
            </CardContent>
          </Card>

          {/* 가동률 */}
          <Card className="border-border/60 bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">가동률</CardTitle>
            </CardHeader>
            <CardContent>
              <HorizontalBarGroup zones={result.zones as unknown as ZoneRow[]} dataKey="utilization" formatFn={pct} maxVal={1} />
            </CardContent>
          </Card>

          {/* 총 이용건수 */}
          <Card className="border-border/60 bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">총 이용건수</CardTitle>
            </CardHeader>
            <CardContent>
              <HorizontalBarGroup
                zones={result.zones as unknown as ZoneRow[]}
                dataKey="total_nuse"
                formatFn={(n) => fmt(n) + "건"}
              />
            </CardContent>
          </Card>

          {/* 클러스터 벤치마크 */}
          {result.zones.some((z) => z.cluster_benchmark != null) && (
            <Card className="border-border/60 bg-card/95">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">클러스터 벤치마크</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {result.zones
                  .filter((z) => z.cluster_benchmark != null)
                  .map((z, i) => {
                    const color = ZONE_COLORS[i % ZONE_COLORS.length];
                    const bench = z.cluster_benchmark as Record<string, unknown> | null;
                    return (
                      <div key={z.zone_id} className="flex items-center justify-between">
                        <span style={{ color }} className="font-medium">
                          {z.name}
                        </span>
                        <span className="text-xs">
                          {z.cluster_type ?? "-"} /{" "}
                          {bench ? won(Number(bench.avg_revenue_per_car ?? 0)) + "/일" : "-"}
                        </span>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}

          {/* Slack 버튼 */}
          <button
            className="w-full rounded-2xl border border-border/70 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            onClick={onSlack}
          >
            Slack 발송
          </button>
        </>
      )}
    </div>
  );
}

/* ── 수평 바 그룹 ────────────────────────────────────────────── */
type ZoneRow = { zone_id: number; name: string; [key: string]: unknown };

interface HorizontalBarGroupProps {
  zones: ZoneRow[];
  dataKey: string;
  formatFn: (val: number) => string;
  maxVal?: number;
}

function HorizontalBarGroup({ zones, dataKey, formatFn, maxVal }: HorizontalBarGroupProps) {
  const max = maxVal ?? Math.max(...zones.map((z) => Number(z[dataKey]) || 0), 1);

  return (
    <div className="space-y-2">
      {zones.map((z, i) => {
        const val = Number(z[dataKey]) || 0;
        const widthPct = Math.round((val / max) * 100);
        const color = ZONE_COLORS[i % ZONE_COLORS.length];
        return (
          <div key={z.zone_id}>
            <div className="flex justify-between text-xs">
              <span style={{ color }} className="font-semibold">
                {z.name || `존 ${z.zone_id}`}
              </span>
              <span>{formatFn(val)}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-muted">
              <div
                className="h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
