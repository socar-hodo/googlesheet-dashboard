import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadRoasSql, replaceSqlParams, toStrInClause } from "@/lib/roas";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const region1 = sp.get("region1");
  // 프론트엔드에서 "A,B,C" 형태로 보내므로 split 처리
  const region2Raw = sp.get("region2") || "";
  const region2 = region2Raw.split(",").map(s => s.trim()).filter(Boolean);

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
