import { NextRequest, NextResponse } from "next/server";
import { validateParams, runAllocation, runAllocationR2 } from "@/lib/allocation";
import type { AllocationParams } from "@/types/allocation";

export async function POST(req: NextRequest) {
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

  try {
    const result = params.mode === "region2"
      ? await runAllocationR2(params)
      : await runAllocation(params);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[allocation/run]", err);
    let message = "BQ 실행 중 오류가 발생했습니다. 서버 로그를 확인해주세요.";
    if (err instanceof Error) {
      if (err.message.includes("ENOENT")) {
        message = "SQL 파일을 찾을 수 없습니다.";
      } else if (err.message.includes("GOOGLE_APPLICATION_CREDENTIALS")) {
        message = "BigQuery 인증이 설정되지 않았습니다 (GOOGLE_APPLICATION_CREDENTIALS_B64).";
      }
    }
    return NextResponse.json({ errors: [message] }, { status: 500 });
  }
}
