import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadFunnelSql, replaceSqlParams, buildFunnelResponse } from "@/lib/funnel";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const weeks = Math.max(1, Math.min(52, Number(sp.get("weeks")) || 12));

  const raw = loadFunnelSql("weekly-by-region1.sql");
  const sql = replaceSqlParams(raw, { weeks: String(weeks) });
  const rows = await runQuery(sql);

  if (!rows) {
    return NextResponse.json(
      { error: "BigQuery not configured" },
      { status: 500 },
    );
  }

  return NextResponse.json(buildFunnelResponse(rows, "region1"));
});
