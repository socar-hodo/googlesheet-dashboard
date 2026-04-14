import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { loadFunnelSql, replaceSqlParams, safeInt, safeFloat } from "@/lib/funnel";
import { withAuth } from "@/lib/api-utils";

interface RawRow {
  year_week: string;
  iso_week_start: { value: string };
  region: string;
  zone_click_cnt: number;
  click_member_cnt: number;
  converted_member_cnt: number;
  cvr: number | null;
  prev_cvr: number | null;
}

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const region1 = sp.get("region1") ?? "";
  const weeks = Math.max(1, Math.min(52, Number(sp.get("weeks")) || 12));

  if (!region1) {
    return NextResponse.json(
      { error: "region1 parameter is required" },
      { status: 400 },
    );
  }

  const raw = loadFunnelSql("weekly-by-region2.sql");
  const sql = replaceSqlParams(raw, {
    weeks: String(weeks),
    region1: `'${region1.replace(/'/g, "''")}'`,
  });
  const rows = (await runQuery(sql)) as RawRow[] | null;

  if (!rows) {
    return NextResponse.json(
      { error: "BigQuery not configured" },
      { status: 500 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({
      summary: {
        total_click_members: 0,
        total_converted_members: 0,
        cvr: 0,
        clicks_per_user: 0,
        wow_click_members: 0,
        wow_converted_members: 0,
        wow_cvr: 0,
      },
      trend: [],
      ranking: [],
    });
  }

  const allWeeks = [...new Set(rows.map((r) => r.year_week))].sort();
  const displayWeeks = new Set(allWeeks.slice(1));
  const latestWeek = allWeeks[allWeeks.length - 1];
  const prevWeek = allWeeks.length >= 2 ? allWeeks[allWeeks.length - 2] : null;

  const trendMap = new Map<string, { click: number; converted: number; zone_click: number }>();
  for (const r of rows) {
    if (!displayWeeks.has(r.year_week)) continue;
    const acc = trendMap.get(r.year_week) ?? { click: 0, converted: 0, zone_click: 0 };
    acc.click += safeInt(r.click_member_cnt);
    acc.converted += safeInt(r.converted_member_cnt);
    acc.zone_click += safeInt(r.zone_click_cnt);
    trendMap.set(r.year_week, acc);
  }
  const trend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({
      year_week: week,
      click_member_cnt: v.click,
      converted_member_cnt: v.converted,
      cvr: v.click > 0 ? Math.round((v.converted / v.click) * 10000) / 10000 : 0,
    }));

  const latestRows = rows.filter((r) => r.year_week === latestWeek);
  const ranking = latestRows
    .map((r) => ({
      region: String(r.region),
      click_member_cnt: safeInt(r.click_member_cnt),
      converted_member_cnt: safeInt(r.converted_member_cnt),
      zone_click_cnt: safeInt(r.zone_click_cnt),
      cvr: safeFloat(r.cvr),
      wow_cvr: r.cvr != null && r.prev_cvr != null
        ? Math.round((Number(r.cvr) - Number(r.prev_cvr)) * 10000) / 10000
        : 0,
    }))
    .sort((a, b) => b.cvr - a.cvr);

  const latestTrend = trendMap.get(latestWeek);
  const prevTrend = prevWeek ? trendMap.get(prevWeek) : null;

  const totalClick = latestTrend?.click ?? 0;
  const totalConverted = latestTrend?.converted ?? 0;
  const totalZoneClick = latestTrend?.zone_click ?? 0;
  const cvr = totalClick > 0 ? totalConverted / totalClick : 0;

  const prevClick = prevTrend?.click ?? 0;
  const prevConverted = prevTrend?.converted ?? 0;
  const prevCvr = prevClick > 0 ? prevConverted / prevClick : 0;

  const summary = {
    total_click_members: totalClick,
    total_converted_members: totalConverted,
    cvr: Math.round(cvr * 10000) / 10000,
    clicks_per_user: totalClick > 0 ? Math.round((totalZoneClick / totalClick) * 10) / 10 : 0,
    wow_click_members: prevClick > 0 ? Math.round(((totalClick - prevClick) / prevClick) * 1000) / 1000 : 0,
    wow_converted_members: prevConverted > 0 ? Math.round(((totalConverted - prevConverted) / prevConverted) * 1000) / 1000 : 0,
    wow_cvr: Math.round((cvr - prevCvr) * 10000) / 10000,
  };

  return NextResponse.json({ summary, trend, ranking });
});
