import { NextRequest, NextResponse } from "next/server";
import { validateParams, runRelocation } from "@/lib/relocation";
import type { RelocationParams } from "@/types/relocation";

export async function POST(req: NextRequest) {
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

  try {
    const result = await runRelocation(params);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[relocation/run]", err);
    let message = "BQ 실행 중 오류가 발생했습니다. 서버 로그를 확인해주세요.";
    if (err instanceof Error) {
      if (err.message.includes("ENOENT")) {
        message = "SQL 파일을 찾을 수 없습니다 (sql/relocation.sql).";
      } else if (err.message.includes("GOOGLE_APPLICATION_CREDENTIALS")) {
        message = "BigQuery 인증이 설정되지 않았습니다 (GOOGLE_APPLICATION_CREDENTIALS_B64).";
      }
    }
    return NextResponse.json({ errors: [message] }, { status: 500 });
  }
}
