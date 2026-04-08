import { NextRequest, NextResponse } from "next/server";
import {
  getZones,
  getZonePerformance,
  getZoneClusterType,
  getClusterBenchmark,
} from "@/lib/zone";
import { haversine, checkCannibalization } from "@/lib/zone-geo";
import type { OpenSimParams } from "@/types/zone";
import { withAuth } from "@/lib/api-utils";

/**
 * POST /api/zone/simulate/open
 *
 * Body: { lat, lng, radius_m?, alpha? }
 *
 * 개설 시뮬레이션:
 * 1. 반경 내 존 조회
 * 2. 유사 존 실적 조회
 * 3. 유사 존 평균 계산 (실적 있는 존 기준)
 * 4. 클러스터 벤치마크 (가장 가까운 존의 클러스터 기준)
 * 5. 하이브리드 추정 (alpha 가중치)
 * 6. 카니발리제이션 체크
 */
export const POST = withAuth(async (req: NextRequest) => {
  const body: OpenSimParams = await req.json();
  const { lat, lng, radius_m = 1000, alpha = 0.5 } = body;

  if (lat == null || lng == null) {
    return NextResponse.json(
      { error: "lat, lng는 필수입니다." },
      { status: 400 },
    );
  }

  // 1. 반경 내 존 조회
  const allZones = await getZones();
  const nearby: Array<Record<string, unknown>> = [];

  for (const z of allZones) {
    const dist = haversine(lat, lng, z.lat, z.lng);
    if (dist <= radius_m) {
      nearby.push({ ...z, distance_m: Math.round(dist) });
    }
  }

  // 2. 유사 존 실적 조회
  if (nearby.length > 0) {
    const zoneIds = nearby.map((z) => Number(z.id));
    const perfs = await getZonePerformance(zoneIds);
    const perfMap = new Map(perfs.map((p) => [p.zone_id, p]));
    for (const z of nearby) {
      const p = perfMap.get(Number(z.id));
      z.revenue_per_car = p?.revenue_per_car ?? 0;
      z.utilization = p?.utilization ?? 0;
    }
  }

  // 2b. 실적 있는 존만 유사 존으로 사용, 가까운 순 정렬
  nearby.sort((a, b) => Number(a.distance_m) - Number(b.distance_m));
  const activeNearby = nearby.filter((z) => Number(z.revenue_per_car) > 0);

  // 3. 유사 존 평균 (실적 있는 존 기준)
  let avgRev = 0;
  let avgUtil = 0;
  if (activeNearby.length > 0) {
    avgRev =
      activeNearby.reduce((s, z) => s + Number(z.revenue_per_car), 0) /
      activeNearby.length;
    avgUtil =
      activeNearby.reduce((s, z) => s + Number(z.utilization), 0) /
      activeNearby.length;
  }

  // 4. 클러스터 벤치마크 (가장 가까운 존의 클러스터 기준)
  let clusterType: string | null = null;
  let clusterBench = { avg_revenue_per_car: 0, avg_utilization: 0, zone_count: 0 };
  if (nearby.length > 0) {
    const nearest = nearby.reduce((a, b) =>
      Number(a.distance_m) < Number(b.distance_m) ? a : b,
    );
    try {
      clusterType = await getZoneClusterType(Number(nearest.id));
      if (clusterType) {
        clusterBench = await getClusterBenchmark(clusterType);
      }
    } catch {
      // 클러스터 조회 실패 — 유사 존 평균만 사용
      console.warn("클러스터 조회 실패 — 유사 존 평균만 사용");
    }
  }

  // 5. 하이브리드 추정 (클러스터 데이터 없으면 유사 존 평균만 사용)
  let estRev: number;
  let estUtil: number;
  if (clusterBench.zone_count === 0) {
    estRev = avgRev;
    estUtil = avgUtil;
  } else {
    estRev = alpha * avgRev + (1 - alpha) * clusterBench.avg_revenue_per_car;
    estUtil = alpha * avgUtil + (1 - alpha) * clusterBench.avg_utilization;
  }

  // 6. 카니발리제이션 체크
  const cannibal = checkCannibalization(lat, lng, allZones);

  return NextResponse.json({
    estimated_revenue_per_car: Math.round(estRev),
    estimated_utilization: Math.round(estUtil * 1000) / 1000,
    cluster_type: clusterType,
    cluster_benchmark: clusterBench,
    nearby_avg_revenue: Math.round(avgRev),
    nearby_avg_utilization: Math.round(avgUtil * 1000) / 1000,
    nearby_zones: nearby.slice(0, 10),
    cannibalization: cannibal,
    alpha,
  });
});
