import { NextRequest, NextResponse } from "next/server";
import { getRegions, getSubRegions, getZones } from "@/lib/zone";
import { withAuth } from "@/lib/api-utils";

/**
 * GET /api/zone/zones
 *
 * Query params:
 *   ?list=regions           → region1 목록
 *   ?list=subregions&region1=경상남도  → region2 목록
 *   (없으면)                 → 전체 존 목록 (region1, region2 필터 가능)
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const list = searchParams.get("list");
  const region1 = searchParams.get("region1") || undefined;
  const region2 = searchParams.get("region2") || undefined;

  if (list === "regions") {
    const regions = await getRegions();
    return NextResponse.json(regions);
  }

  if (list === "subregions") {
    if (!region1) {
      return NextResponse.json(
        { error: "region1 파라미터가 필요합니다." },
        { status: 400 },
      );
    }
    const subRegions = await getSubRegions(region1);
    return NextResponse.json(subRegions);
  }

  // 존 목록 (필터 가능)
  const zones = await getZones(region1, region2);
  return NextResponse.json(zones);
});
