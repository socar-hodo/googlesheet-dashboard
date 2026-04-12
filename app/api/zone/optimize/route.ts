import { NextRequest, NextResponse } from "next/server";
import { getRegionZoneStats } from "@/lib/zone";
import { haversine } from "@/lib/zone-geo";
import type { OptimizeParams, RegionZoneStat } from "@/types/zone";
import { withAuth } from "@/lib/api-utils";

/**
 * POST /api/zone/optimize
 *
 * Body: { region1, region2? }
 *
 * 지역 최적화:
 * 1. 지역 존 전체 통계 조회
 * 2. 현황 요약 (운영 존 기준)
 * 3. 폐쇄 후보: 가동률 20% 미만 + 반경 300m 내 대체 존
 * 4. 차량 재배치: 가동률 하위 → 상위
 * 5. 예상 효과
 */
export const POST = withAuth(async (req: NextRequest) => {
  const body: OptimizeParams = await req.json();
  const { region1, region2 } = body;

  if (!region1) {
    return NextResponse.json(
      { error: "region1은 필수입니다." },
      { status: 400 },
    );
  }

  const zoneStats = await getRegionZoneStats(region1, region2);
  if (zoneStats.length === 0) {
    return NextResponse.json({
      summary: {},
      suggestions: { close: [], open: [], rebalance: [] },
    });
  }

  // 운영 중인 존 (차량 1대 이상)과 비운영 존 분리
  const activeZones = zoneStats.filter((z) => z.car_count > 0);
  const inactiveZones = zoneStats.filter((z) => z.car_count === 0);
  const analysisZones = activeZones.length > 0 ? activeZones : zoneStats;

  // 현황 요약
  const totalZones = zoneStats.length;
  const activeCount = activeZones.length;
  const totalCars = activeZones.reduce((s, z) => s + z.car_count, 0);
  const avgUtil = activeZones.length > 0
    ? activeZones.reduce((s, z) => s + z.utilization, 0) / activeZones.length
    : 0;
  const avgRevPerCar = activeZones.length > 0
    ? activeZones.reduce((s, z) => s + z.revenue_per_car, 0) / activeZones.length
    : 0;

  // ── 폐쇄 권고: 가동률 하위 25% 또는 가동률 < 평균의 50% ──
  const sortedByUtil = [...activeZones].sort((a, b) => a.utilization - b.utilization);
  const utilThreshold = Math.max(avgUtil * 0.6, 0.15); // 평균의 60% 또는 15% 중 높은 값
  const closeCandidates = sortedByUtil
    .filter((z) => z.utilization < utilThreshold)
    .slice(0, 5)
    .map((z) => {
      // 1km 내 대체 존 확인
      const nearbyAlts = activeZones.filter(
        (oz) => oz.zone_id !== z.zone_id && oz.car_count > 0 &&
          haversine(z.lat, z.lng, oz.lat, oz.lng) < 1000,
      );
      return {
        ...z,
        reason: z.utilization < 0.15
          ? "가동률 15% 미만 — 수익성 부족"
          : `가동률 ${(z.utilization * 100).toFixed(1)}% — 지역 평균 대비 낮음`,
        nearby_alternatives: nearbyAlts.length,
        has_alternative: nearbyAlts.length > 0,
      };
    });

  // ── 재배치 권고: 하위 가동률 존 → 상위 가동률 존 ──
  const lowUtil = sortedByUtil.filter(
    (z) => z.utilization < avgUtil * 0.7 && z.car_count >= 2,
  );
  const highUtil = [...sortedByUtil]
    .reverse()
    .filter((z) => z.utilization > avgUtil);

  const rebalance: Array<{
    from_zone: { zone_id: number; name: string; utilization: number; car_count: number };
    to_zone: { zone_id: number; name: string; utilization: number; car_count: number };
    cars: number;
    reason: string;
  }> = [];
  for (const src of lowUtil.slice(0, 5)) {
    const nearest = highUtil
      .filter((d) => d.zone_id !== src.zone_id)
      .sort((a, b) => haversine(src.lat, src.lng, a.lat, a.lng) - haversine(src.lat, src.lng, b.lat, b.lng));
    if (nearest.length > 0) {
      const dst = nearest[0];
      rebalance.push({
        from_zone: { zone_id: src.zone_id, name: src.zone_name, utilization: src.utilization, car_count: src.car_count },
        to_zone: { zone_id: dst.zone_id, name: dst.zone_name, utilization: dst.utilization, car_count: dst.car_count },
        cars: 1,
        reason: `${src.zone_name} 가동률 ${(src.utilization * 100).toFixed(1)}% → ${dst.zone_name} ${(dst.utilization * 100).toFixed(1)}%`,
      });
    }
  }

  // ── 개설 후보: 비운영 존 중 위치적으로 기존 존과 멀리 떨어진 곳 ──
  const openCandidates = inactiveZones
    .filter((z) => z.lat && z.lng)
    .map((z) => {
      const nearestActive = activeZones.length > 0
        ? Math.min(...activeZones.map((a) => haversine(z.lat, z.lng, a.lat, a.lng)))
        : 99999;
      return { ...z, nearest_active_m: Math.round(nearestActive) };
    })
    .filter((z) => z.nearest_active_m > 500) // 500m 이상 떨어진 비운영 존
    .sort((a, b) => b.nearest_active_m - a.nearest_active_m)
    .slice(0, 5)
    .map((z) => ({
      zone_id: z.zone_id,
      zone_name: z.zone_name,
      lat: z.lat,
      lng: z.lng,
      area: z.zone_name || `${z.region2} 신규`,
      reason: `기존 운영 존에서 ${(z.nearest_active_m / 1000).toFixed(1)}km 떨어진 비운영 존`,
      nearest_active_m: z.nearest_active_m,
    }));

  // ── 예상 효과 ──
  const closeCarTotal = closeCandidates.reduce((s, z) => s + z.car_count, 0);
  const closeSavings = closeCarTotal * 9_500_000;
  const rebalanceGain = rebalance.length * 500_000;

  const closeIds = new Set(closeCandidates.map((z) => z.zone_id));
  const remaining = activeZones.filter((z) => !closeIds.has(z.zone_id));
  const newAvgUtil = remaining.length > 0
    ? remaining.reduce((s, z) => s + z.utilization, 0) / remaining.length
    : avgUtil;

  return NextResponse.json({
    summary: {
      total_zones: totalZones,
      active_zones: activeCount,
      inactive_zones: inactiveZones.length,
      total_cars: totalCars,
      avg_utilization: Math.round(avgUtil * 1000) / 1000,
      avg_revenue_per_car: Math.round(avgRevPerCar),
      avg_cars_per_zone: activeCount > 0 ? Math.round((totalCars / activeCount) * 10) / 10 : 0,
    },
    suggestions: {
      close: closeCandidates.slice(0, 5),
      open: openCandidates,
      rebalance: rebalance.slice(0, 5),
    },
    projected: {
      new_avg_utilization: Math.round(Math.min(newAvgUtil, 1) * 1000) / 1000,
      monthly_savings: closeSavings + rebalanceGain,
    },
    zones: zoneStats,
  });
});
