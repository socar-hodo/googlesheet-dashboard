import { NextRequest, NextResponse } from "next/server";
import { runParameterizedQuery } from "@/lib/bigquery";
import {
  loadCustomerTypeSql,
  buildDailyResponse,
  buildWeeklyResponse,
} from "@/lib/customer-type";
import { replaceSqlParams } from "@/lib/funnel";
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

// 날짜 형식 검증 (YYYY-MM-DD)
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("start_date") || defaultStartDate();
  const endDate = sp.get("end_date") || defaultEndDate();

  // 날짜 검증 — SQL injection 방지
  const safeStart = isValidDate(startDate) ? startDate : defaultStartDate();
  const safeEnd = isValidDate(endDate) ? endDate : defaultEndDate();

  // 날짜는 문자열 치환 (기존 ROAS 쿼리 패턴과 동일)
  const dailySql = replaceSqlParams(loadCustomerTypeSql("daily.sql"), {
    start_date: safeStart,
    end_date: safeEnd,
  });
  const weeklySql = replaceSqlParams(loadCustomerTypeSql("weekly.sql"), {
    start_date: safeStart,
    end_date: safeEnd,
  });

  const [dailyRows, weeklyRows] = await Promise.all([
    runParameterizedQuery(dailySql),
    runParameterizedQuery(weeklySql),
  ]);

  const daily = dailyRows ? buildDailyResponse(dailyRows) : [];
  const weekly = weeklyRows ? buildWeeklyResponse(weeklyRows) : [];

  return NextResponse.json({ daily, weekly });
});
