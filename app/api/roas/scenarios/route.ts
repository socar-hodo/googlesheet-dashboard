import { NextRequest, NextResponse } from "next/server";
import { saveScenario, listScenarios } from "@/lib/roas";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async () => {
  const scenarios = await listScenarios();
  return NextResponse.json(
    scenarios.map((s) => ({
      id: s.id,
      name: s.name ?? "",
      created_at: s.created_at ?? "",
      zone_ids: (s.inputs as Record<string, unknown>)?.zone_ids ?? [],
      start_date: (s.inputs as Record<string, unknown>)?.start_date ?? "",
      end_date: (s.inputs as Record<string, unknown>)?.end_date ?? "",
    })),
  );
});

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json();
  const name = body.name;
  const inputs = body.inputs;
  const results = body.results;

  if (!name || !inputs || !results) {
    return NextResponse.json(
      { error: "name, inputs, results are required" },
      { status: 400 },
    );
  }

  const result = await saveScenario({ name, inputs, results });
  return NextResponse.json(result);
});
