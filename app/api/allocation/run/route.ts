import { NextRequest, NextResponse } from "next/server";
import { validateParams, runAllocation, runAllocationR2 } from "@/lib/allocation";
import { withAuth } from "@/lib/api-utils";
import type { AllocationParams } from "@/types/allocation";

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json();
  const params: AllocationParams = {
    carModel:   body.carModel   ?? "",
    carSegment: body.carSegment ?? "",
    totalCars:  Number(body.totalCars ?? 0),
    baseDate:   body.baseDate   ?? "",
    mode:       body.mode       ?? "region1",
    region1List: Array.isArray(body.region1List) ? body.region1List : [],
  };

  const errors = validateParams(params);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const result = params.mode === "region2"
    ? await runAllocationR2(params)
    : await runAllocation(params);
  return NextResponse.json(result);
});
