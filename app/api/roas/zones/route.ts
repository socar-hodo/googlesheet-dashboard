import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadRoasSql, replaceSqlParams, toStrInClause } from "@/lib/roas";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const region1 = sp.get("region1");
  const region2 = sp.getAll("region2");

  if (!region1 || region2.length === 0) {
    return NextResponse.json(
      { error: "region1 and region2 are required" },
      { status: 400 },
    );
  }

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
    })),
  );
});
