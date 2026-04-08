import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadRoasSql } from "@/lib/roas";
import { withAuth } from "@/lib/api-utils";

// ── regions 캐시 (1시간 TTL) ──────────────────────────────────
let _regionsCache: string[] | null = null;
let _regionsCacheTs = 0;
const CACHE_TTL = 3600_000; // 1 hour

export const GET = withAuth(async () => {
  if (_regionsCache && Date.now() - _regionsCacheTs < CACHE_TTL) {
    return NextResponse.json(_regionsCache);
  }

  const sql = loadRoasSql("regions.sql");
  const rows = await runQuery(sql);
  if (!rows) {
    return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
  }
  const regions = rows.map((r) => String(r.region1 ?? ""));
  _regionsCache = regions;
  _regionsCacheTs = Date.now();
  return NextResponse.json(regions);
});
