import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getRegionZoneStats } from "@/lib/zone";
import { haversine } from "@/lib/zone-geo";
import type { OptimizeParams, RegionZoneStat } from "@/types/zone";

const BQ_ERROR_MSG = "데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";

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
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
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

    // 운영 중인 존만 (차량 1대 이상)
    let activeZones = zoneStats.filter((z) => z.car_count > 0);
    if (activeZones.length === 0) activeZones = zoneStats;

    // 현황 요약
    const totalZones = activeZones.length;
    const totalCars = activeZones.reduce((s, z) => s + z.car_count, 0);
    const avgUtil = totalZones > 0
      ? activeZones.reduce((s, z) => s + z.utilization, 0) / totalZones
      : 0;
    const avgCarsPerZone = totalZones > 0 ? totalCars / totalZones : 0;

    // 폐쇄 후보: 가동률 20% 미만 + 반경 300m 내 대체 존
    const closeCandidates: RegionZoneStat[] = [];
    for (const z of activeZones) {
      if (z.utilization < 0.2) {
        const hasAlternative = activeZones.some(
          (oz) =>
            oz.zone_id !== z.zone_id &&
            oz.car_count > 0 &&
            haversine(z.lat, z.lng, oz.lat, oz.lng) < 300,
        );
        if (hasAlternative) {
          closeCandidates.push(z);
        }
      }
    }

    // 차량 재배치: 가동률 하위 → 상위 (상대적 기준)
    const sortedByUtil = [...activeZones].sort(
      (a, b) => a.utilization - b.utilization,
    );
    const lowUtil = sortedByUtil.filter(
      (z) => z.utilization < avgUtil * 0.5 && z.car_count > 2,
    );
    const highUtil = [...sortedByUtil]
      .reverse()
      .filter((z) => z.utilization > avgUtil * 1.5);

    const rebalance: Array<{
      from_zone: { zone_id: number; name: string; utilization: number };
      to_zone: { zone_id: number; name: string; utilization: number };
      cars: number;
    }> = [];
    for (const src of lowUtil.slice(0, 3)) {
      for (const dst of highUtil.slice(0, 3)) {
        if (src.zone_id !== dst.zone_id) {
          rebalance.push({
            from_zone: {
              zone_id: src.zone_id,
              name: src.zone_name,
              utilization: src.utilization,
            },
            to_zone: {
              zone_id: dst.zone_id,
              name: dst.zone_name,
              utilization: dst.utilization,
            },
            cars: 1,
          });
        }
      }
    }

    // 예상 효과
    const closeCarTotal = closeCandidates.reduce(
      (s, z) => s + z.car_count,
      0,
    );
    const closeSavings = closeCarTotal * 9_500_000;
    const rebalanceGain = rebalance.length * 500_000;

    // 폐쇄 존 제거 후 나머지 존의 평균 가동률 재계산
    const closeIds = new Set(closeCandidates.map((z) => z.zone_id));
    const remaining = activeZones.filter((z) => !closeIds.has(z.zone_id));
    const newAvgUtil = remaining.length > 0
      ? remaining.reduce((s, z) => s + z.utilization, 0) / remaining.length
      : avgUtil;

    return NextResponse.json({
      summary: {
        total_zones: totalZones,
        total_cars: totalCars,
        avg_utilization: Math.round(avgUtil * 1000) / 1000,
        avg_cars_per_zone: Math.round(avgCarsPerZone * 10) / 10,
      },
      suggestions: {
        close: closeCandidates.slice(0, 5),
        open: [], // 개설 추천은 v2에서 예약 데이터 분석 후 추가
        rebalance: rebalance.slice(0, 5),
      },
      projected: {
        new_avg_utilization: Math.round(Math.min(newAvgUtil, 1) * 1000) / 1000,
        monthly_savings: closeSavings + rebalanceGain,
      },
      zones: zoneStats,
    });
  } catch (err) {
    console.error("[zone/optimize]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
