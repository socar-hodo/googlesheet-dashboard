import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadFunnelSql } from "@/lib/funnel";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async () => {
  const sql = loadFunnelSql("regions.sql");
  const rows = await runQuery(sql);

  if (!rows) {
    return NextResponse.json(
      { error: "BigQuery not configured" },
      { status: 500 },
    );
  }

  const regions = rows.map((r) => String(r.region1 ?? "")).filter(Boolean);
  return NextResponse.json(regions);
});
