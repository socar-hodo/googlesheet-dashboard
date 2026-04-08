import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadRoasSql, replaceSqlParams, toStrInClause, BQ_ERROR_MSG } from "@/lib/roas";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const region1 = sp.get("region1");
  const region2 = sp.getAll("region2");

  if (!region1 || region2.length === 0) {
    return NextResponse.json(
      { error: "region1 and region2 are required" },
      { status: 400 }
    );
  }

  try {
    const raw = loadRoasSql("zones.sql");
    const sql = replaceSqlParams(raw, {
      region1: `'${region1.replace(/'/g, "''")}'`,
      region2_list: toStrInClause(region2),
    });
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }
    return NextResponse.json(
      rows.map((r) => ({
        id: Number(r.id ?? 0),
        name: String(r.name ?? ""),
        address: String(r.address ?? ""),
      }))
    );
  } catch (err) {
    console.error("[roas/zones]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
