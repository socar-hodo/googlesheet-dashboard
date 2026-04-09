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

  const clusterResults = await Promise.all(
    perfs.map(async (p) => {
      try {
        const ct = await getZoneClusterType(p.zone_id);
        const bench = ct ? await getClusterBenchmark(ct) : null;
        return { zone_id: p.zone_id, cluster_type: ct, benchmark: bench };
      } catch {
        return { zone_id: p.zone_id, cluster_type: null, benchmark: null };
      }
    })
  );

  const clusterMap = new Map(clusterResults.map((r) => [r.zone_id, r]));

  const results = perfs.map((p) => {
    const z = zoneMap.get(p.zone_id);
    const cr = clusterMap.get(p.zone_id);
    return {
      ...p,
      name: z?.name ?? "",
      region1: z?.region1 ?? "",
      region2: z?.region2 ?? "",
      lat: z?.lat ?? 0,
      lng: z?.lng ?? 0,
      cluster_type: cr?.cluster_type ?? null,
      cluster_benchmark: cr?.benchmark ?? null,
    };
  });

  return NextResponse.json({ zones: results });
});
