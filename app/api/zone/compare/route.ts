import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getZones,
  getZonePerformance,
  getZoneClusterType,
  getClusterBenchmark,
} from "@/lib/zone";
import type { CompareParams, ClusterBenchmark } from "@/types/zone";

const BQ_ERROR_MSG = "데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";

/**
 * POST /api/zone/compare
 *
 * Body: { zone_ids: number[] }  (2~5개)
 *
 * 존 비교: 각 존의 실적 + 클러스터 벤치마크를 조회하여 side-by-side 비교.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
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
  } catch (err) {
    console.error("[zone/compare]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
