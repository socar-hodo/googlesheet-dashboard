import { NextRequest, NextResponse } from "next/server";
import { runParameterizedQuery } from "@/lib/bigquery";
import {
  loadDashboardSql,
  buildForecastRows,
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

  // 예측 기간: 과거 60일 ~ 미래 45일 (lib/data.ts forecastRange와 동일)
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 60);
  const end = new Date(today);
  end.setDate(end.getDate() + 45);
  const params = {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };

  const regionFilter = `AND region1 = '${region1}'`;

  const forecastSql = replaceSqlParams(loadDashboardSql("forecast-daily.sql"), {
    ...params,
    region_filter: regionFilter,
  });
  const rankingSql = replaceSqlParams(
    loadDashboardSql("forecast-region-ranking.sql"),
    {
      ...params,
      group_field: "region2",
      parent_filter: regionFilter,
    },
  );

  const [forecastRows, rankingRows] = await Promise.all([
    runParameterizedQuery(forecastSql),
    runParameterizedQuery(rankingSql),
  ]);

  return NextResponse.json({
    region1,
    forecast: forecastRows ? buildForecastRows(forecastRows) : [],
    ranking: rankingRows ? buildRegionRanking(rankingRows) : [],
  });
});
