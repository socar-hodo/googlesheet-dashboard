import { NextRequest, NextResponse } from "next/server";
import { runParameterizedQuery } from "@/lib/bigquery";
import { loadFunnelSql, replaceSqlParams, buildFunnelResponse } from "@/lib/funnel";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const region1 = sp.get("region1") ?? "";
  const weeks = Math.max(1, Math.min(52, Number(sp.get("weeks")) || 12));

  if (!region1) {
    return NextResponse.json(
      { error: "region1 parameter is required" },
      { status: 400 },
    );
  }

  const raw = loadFunnelSql("weekly-by-region2.sql");
  const sql = replaceSqlParams(raw, { weeks: String(weeks) });
  const rows = await runParameterizedQuery(sql, [
    { name: "region1", type: "STRING", value: region1 },
  ]);

  if (!rows) {
    return NextResponse.json(
      { error: "BigQuery not configured" },
      { status: 500 },
    );
  }

  return NextResponse.json(buildFunnelResponse(rows, "region"));
});
