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

  const daily = dailyRows ? buildDailyResponse(dailyRows) : [];
  const weekly = weeklyRows ? buildWeeklyResponse(weeklyRows) : [];

  // 디버그: 날짜 범위 및 데이터 개수 확인
  console.log(`[customer-type] range=${startDate}~${endDate} daily=${daily.length} weekly=${weekly.length}`);
  if (daily.length > 0) {
    console.log(`[customer-type] daily first=${daily[0].date} last=${daily[daily.length - 1].date}`);
  }
  if (weekly.length > 0) {
    console.log(`[customer-type] weekly samples:`, weekly.map((w) => w.week).join(", "));
  }

  return NextResponse.json({ daily, weekly });
});
