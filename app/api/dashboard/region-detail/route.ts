import { NextRequest, NextResponse } from "next/server";
import { runParameterizedQuery } from "@/lib/bigquery";
import {
  loadDashboardSql,
  buildRegionRanking,
  sanitizeRegionName,
} from "@/lib/dashboard-bq";
import { replaceSqlParams } from "@/lib/funnel";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async (req: NextRequest) => {
  const region1Raw = req.nextUrl.searchParams.get("region1") ?? "";
  const region1 = sanitizeRegionName(region1Raw);
  if (!region1) {
    return NextResponse.json({ error: "region1 required" }, { status: 400 });
  }

  // 최근 30일 랭킹 — dashboard의 초기 SSR 랭킹과 동일한 기간
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date();
  start.setDate(start.getDate() - 30);

  const sql = replaceSqlParams(loadDashboardSql("region-ranking.sql"), {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    group_field: "region2",
    parent_filter: `AND region1 = '${region1}'`,
  });

  const rows = await runParameterizedQuery(sql);
  const ranking = rows ? buildRegionRanking(rows) : [];

  return NextResponse.json({ region1, ranking });
});
