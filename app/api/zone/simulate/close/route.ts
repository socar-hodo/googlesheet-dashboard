import { NextRequest, NextResponse } from "next/server";
import { getZones, getZonePerformance } from "@/lib/zone";
import { haversine, estimateDemandTransfer } from "@/lib/zone-geo";
import type { CloseSimParams } from "@/types/zone";

const BQ_ERROR_MSG = "데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";

/**
 * POST /api/zone/simulate/close
 *
 * Body: { zone_id }
 *
 * 폐쇄 시뮬레이션:
 * 1. 대상 존 실적 조회
 * 2. 대상 존 위경도 확인
 * 3. 반경 1km 내 인근 존 조회
 * 4. 인근 존 실적 (가까운 순 상위 10개)
 * 5. 수요 이전 추정
 */
export async function POST(req: NextRequest) {
  try {
    const body: CloseSimParams = await req.json();
    const { zone_id } = body;

    if (!zone_id) {
      return NextResponse.json(
        { error: "zone_id는 필수입니다." },
        { status: 400 },
      );
    }

    // 1. 대상 존 실적
    const targetPerfs = await getZonePerformance([zone_id]);
    if (targetPerfs.length === 0) {
      return NextResponse.json(
        { error: "존 데이터를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    const target = { ...targetPerfs[0] } as Record<string, unknown>;

    // 2. 대상 존 위경도
    const allZones = await getZones();
    const targetZone = allZones.find((z) => z.id === zone_id);
    if (!targetZone) {
      return NextResponse.json(
        { error: "존을 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    target.lat = targetZone.lat;
    target.lng = targetZone.lng;
    target.name = targetZone.name;

    // 3. 반경 1km 내 인근 존
    const nearby: Array<Record<string, unknown>> = [];
    for (const z of allZones) {
      if (z.id === zone_id) continue;
      const dist = haversine(targetZone.lat, targetZone.lng, z.lat, z.lng);
      if (dist <= 1000) {
        nearby.push({ ...z, distance_m: Math.round(dist) });
      }
    }

    // 4. 인근 존 실적 (가까운 순 정렬, 상위 10개)
    nearby.sort((a, b) => Number(a.distance_m) - Number(b.distance_m));
    const topNearby = nearby.slice(0, 10);

    if (topNearby.length > 0) {
      const nearbyIds = topNearby.map((z) => Number(z.id));
      const nearbyPerfs = await getZonePerformance(nearbyIds);
      const perfMap = new Map(nearbyPerfs.map((p) => [p.zone_id, p]));
      for (const z of topNearby) {
        const p = perfMap.get(Number(z.id));
        z.utilization = p?.utilization ?? 0;
        z.revenue_per_car = p?.revenue_per_car ?? 0;
      }
    }

    // 5. 수요 이전 추정
    const transfer = estimateDemandTransfer(
      {
        id: zone_id,
        lat: targetZone.lat,
        lng: targetZone.lng,
        utilization: Number(target.utilization) || 0,
        revenue_per_car: Number(target.revenue_per_car) || 0,
        car_count: Number(target.car_count) || 0,
      },
      topNearby.map((z) => ({
        id: Number(z.id),
        name: String(z.name),
        lat: Number(z.lat),
        lng: Number(z.lng),
        utilization: Number(z.utilization) || 0,
        revenue_per_car: Number(z.revenue_per_car) || 0,
        distance_m: Number(z.distance_m),
      })),
    );

    return NextResponse.json({
      target_zone: {
        zone_id,
        name: targetZone.name,
        region1: targetZone.region1,
        region2: targetZone.region2,
        revenue_per_car: Number(target.revenue_per_car) || 0,
        utilization: Number(target.utilization) || 0,
        car_count: Number(target.car_count) || 0,
      },
      demand_transfer: transfer,
    });
  } catch (err) {
    console.error("[zone/simulate/close]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
