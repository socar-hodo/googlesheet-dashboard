import { NextRequest, NextResponse } from "next/server";
import {
  getZones,
  getZonePerformance,
  getZoneClusterType,
  getClusterBenchmark,
} from "@/lib/zone";
import type { CompareParams, ClusterBenchmark } from "@/types/zone";
import { withAuth } from "@/lib/api-utils";

/**
 * POST /api/zone/compare
 *
 * Body: { zone_ids: number[] }  (2~5개)
 *
 * 존 비교: 각 존의 실적 + 클러스터 벤치마크를 조회하여 side-by-side 비교.
 */
export const POST = withAuth(async (req: NextRequest) => {
  const body: CompareParams = await req.json();
  const { zone_ids } = body;

  if (!zone_ids || zone_ids.length < 2) {
    return NextResponse.json(
      { error: "비교할 존을 2개 이상 선택해주세요." },
      { status: 400 },
    );
  }
  if (zone_ids.length > 5) {
    return NextResponse.json(
      { error: "최대 5개까지 비교할 수 있습니다." },
      { status: 400 },
    );
  }

  const perfs = await getZonePerformance(zone_ids);
  const allZones = await getZones();
  const zoneMap = new Map(allZones.map((z) => [z.id, z]));

  const results = [];
  for (const p of perfs) {
    const z = zoneMap.get(p.zone_id);
    let clusterType: string | null = null;
    let bench: ClusterBenchmark | null = null;
    try {
      clusterType = await getZoneClusterType(p.zone_id);
      if (clusterType) {
        bench = await getClusterBenchmark(clusterType);
      }
    } catch {
      console.warn(`클러스터 조회 실패: zone_id=${p.zone_id}`);
    }
    results.push({
      ...p,
      name: z?.name ?? "",
      region1: z?.region1 ?? "",
      region2: z?.region2 ?? "",
      lat: z?.lat ?? 0,
      lng: z?.lng ?? 0,
      cluster_type: clusterType,
      cluster_benchmark: bench,
    });
  }

  return NextResponse.json({ zones: results });
});
