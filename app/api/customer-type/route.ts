import { NextRequest, NextResponse } from "next/server";
import { runParameterizedQuery } from "@/lib/bigquery";
import {
  loadCustomerTypeSql,
  buildDailyResponse,
  buildWeeklyResponse,
} from "@/lib/customer-type";
import { withAuth } from "@/lib/api-utils";

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("start_date") || defaultStartDate();
  const endDate = sp.get("end_date") || defaultEndDate();
  const region1 = sp.get("region1") || "";
  const zoneIds = sp
    .get("zone_ids")
    ?.split(",")
    .map(Number)
    .filter((n) => !isNaN(n)) ?? [];

  const params = [
    { name: "start_date", type: "DATE" as const, value: startDate },
    { name: "end_date", type: "DATE" as const, value: endDate },
    { name: "region1", type: "STRING" as const, value: region1 },
    { name: "zone_ids", type: "INT64" as const, values: zoneIds },
  ];

  const dailySql = loadCustomerTypeSql("daily.sql");
  const weeklySql = loadCustomerTypeSql("weekly.sql");

  const [dailyRows, weeklyRows] = await Promise.all([
    runParameterizedQuery(dailySql, params),
    runParameterizedQuery(weeklySql, params),
  ]);

  return NextResponse.json({
    daily: dailyRows ? buildDailyResponse(dailyRows) : [],
    weekly: weeklyRows ? buildWeeklyResponse(weeklyRows) : [],
  });
});
