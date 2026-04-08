import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadRoasSql, replaceSqlParams, BQ_ERROR_MSG } from "@/lib/roas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ region1: string }> }
) {
  const { region1 } = await params;

  try {
    const raw = loadRoasSql("sub-regions.sql");
    const sql = replaceSqlParams(raw, {
      region1: `'${region1.replace(/'/g, "\\'")}'`,
    });
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }
    return NextResponse.json(rows.map((r) => String(r.region2 ?? "")));
  } catch (err) {
    console.error("[roas/regions/region1]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
