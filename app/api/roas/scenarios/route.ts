import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { saveScenario, listScenarios } from "@/lib/roas";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const scenarios = await listScenarios();
    return NextResponse.json(
      scenarios.map((s) => ({
        id: s.id,
        name: s.name ?? "",
        created_at: s.created_at ?? "",
        zone_ids: (s.inputs as Record<string, unknown>)?.zone_ids ?? [],
        start_date: (s.inputs as Record<string, unknown>)?.start_date ?? "",
        end_date: (s.inputs as Record<string, unknown>)?.end_date ?? "",
      }))
    );
  } catch (err) {
    console.error("[roas/scenarios] list error", err);
    return NextResponse.json(
      { error: "시나리오 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const name = body.name;
  const inputs = body.inputs;
  const results = body.results;

  if (!name || !inputs || !results) {
    return NextResponse.json(
      { error: "name, inputs, results are required" },
      { status: 400 }
    );
  }

  try {
    const result = await saveScenario({ name, inputs, results });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[roas/scenarios] save error", err);
    return NextResponse.json(
      { error: "시나리오 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
