import { NextRequest, NextResponse } from "next/server";
import { validateParams, runRelocation } from "@/lib/relocation";
import { withAuth } from "@/lib/api-utils";
import type { RelocationParams } from "@/types/relocation";

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json();
  const params: RelocationParams = {
    region1:    body.region1    ?? "전체",
    pastDays:   Number(body.pastDays   ?? 14) as RelocationParams["pastDays"],   // 허용값 검증은 validateParams()에서
    futureDays: Number(body.futureDays ?? 7)  as RelocationParams["futureDays"], // 허용값 검증은 validateParams()에서
    weights: {
      utilization:    Number(body.weights?.utilization    ?? 0.4),
      revenue:        Number(body.weights?.revenue        ?? 0.4),
      prereservation: Number(body.weights?.prereservation ?? 0.2),
    },
  };

  const errors = validateParams(params);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const result = await runRelocation(params);
  return NextResponse.json(result);
});
