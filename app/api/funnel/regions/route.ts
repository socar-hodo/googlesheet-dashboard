import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadFunnelSql } from "@/lib/funnel";
import { withAuth } from "@/lib/api-utils";

// 1시간 캐시 — region1 목록은 거의 변하지 않음
let _cache: { data: string[]; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

export const GET = withAuth(async () => {
  if (_cache && Date.now() - _cache.ts < TTL) {
    return NextResponse.json(_cache.data);
  }

  const sql = loadFunnelSql("regions.sql");
  const rows = await runQuery(sql);

  if (!rows) {
    return NextResponse.json(
      { error: "BigQuery not configured" },
      { status: 500 },
    );
  }

  const regions = rows.map((r) => String(r.region1 ?? "")).filter(Boolean);
  _cache = { data: regions, ts: Date.now() };
  return NextResponse.json(regions);
});
