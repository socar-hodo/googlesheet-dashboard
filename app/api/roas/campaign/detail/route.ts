import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  parseSqlSections,
  replaceSqlParams,
  buildCrosstab,
  safeInt,
  safeFloat,
  BQ_ERROR_MSG,
} from "@/lib/roas";
import type { CampaignSummary, DailyTrendItem, CampaignDetailResult } from "@/lib/roas";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const policyId = Number(body.policy_id);

  if (!policyId || policyId <= 0) {
    return NextResponse.json({ error: "policy_id is required" }, { status: 400 });
  }

  try {
    const rawSql = loadRoasSql("campaign-detail.sql");
    const sections = parseSqlSections(rawSql);
    const policyIdStr = String(policyId);

    // 1) Meta
    const metaSql = replaceSqlParams(sections.get("meta")!, { policy_id: policyIdStr });
    const metaRows = await runQuery(metaSql);
    if (!metaRows || metaRows.length === 0) {
      return NextResponse.json({ error: "policy not found" }, { status: 404 });
    }

    const meta = metaRows[0];
    const includeZoneStr = String(meta.include_zone ?? "");
    const targetZones = includeZoneStr
      .split(",")
      .map((z) => z.trim())
      .filter((z) => /^\d+$/.test(z))
      .map(Number);
    const targetRegions = {
      region1: String(meta.include_region1 ?? ""),
      region2: String(meta.include_region2 ?? "")
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
    };

    // 2) Summary
    const summarySql = replaceSqlParams(sections.get("summary")!, { policy_id: policyIdStr });
    const summaryRows = await runQuery(summarySql);
    const s = summaryRows?.[0] ?? {};
    const issued = safeInt(s.issued);
    const used = safeInt(s.used);
    const postDiscountRevenue = safeFloat(s.revenue); // revenue = 쿠폰 할인 후
    const discount = safeFloat(s.discount);
    const totalRevenue = Math.round((postDiscountRevenue + discount) * 100) / 100;

    const summary: CampaignSummary = {
      issued,
      used,
      usage_rate: issued > 0 ? Math.round((used / issued) * 10000) / 100 : 0,
      revenue: totalRevenue,
      discount,
      net_revenue: postDiscountRevenue,
      roas: discount > 0 ? Math.round((totalRevenue / discount) * 10000) / 100 : 0,
    };

    // 3) Crosstab
    const crosstabSql = replaceSqlParams(sections.get("crosstab")!, { policy_id: policyIdStr });
    const crosstabRows = await runQuery(crosstabSql);
    const crosstab = buildCrosstab(crosstabRows ?? []);

    // 4) Daily trend
    const dailySql = replaceSqlParams(sections.get("daily_trend")!, { policy_id: policyIdStr });
    const dailyRows = await runQuery(dailySql);
    const dailyTrend: DailyTrendItem[] = (dailyRows ?? []).map((row) => ({
      date: String(row.date ?? ""),
      used_count: safeInt(row.used_count),
      revenue: safeFloat(row.revenue),
      discount: safeFloat(row.discount),
    }));

    const result: CampaignDetailResult = {
      summary,
      crosstab,
      daily_trend: dailyTrend,
      target_zones: targetZones,
      target_regions: targetRegions,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[roas/campaign/detail]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
