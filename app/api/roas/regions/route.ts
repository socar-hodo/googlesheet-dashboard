import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadRoasSql, BQ_ERROR_MSG } from "@/lib/roas";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const sql = loadRoasSql("regions.sql");
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }
    return NextResponse.json(rows.map((r) => String(r.region1 ?? "")));
  } catch (err) {
    console.error("[roas/regions]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
