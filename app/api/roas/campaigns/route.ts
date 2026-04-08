import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  replaceSqlParams,
  safeInt,
  safeFloat,
  isValidDate,
  BQ_ERROR_MSG,
} from "@/lib/roas";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("start_date") ?? "";
  const endDate = sp.get("end_date") ?? "";

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const raw = loadRoasSql("campaigns.sql");
    const sql = replaceSqlParams(raw, {
      start_date: `'${startDate}'`,
      end_date: `'${endDate}'`,
    });
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ campaigns: [] });
    }

    const campaigns = rows.map((row) => {
      // usable_start_on / usable_end_on: BigQuery TIMESTAMP -> 날짜 문자열
      const startOn = row.usable_start_on;
      const endOn = row.usable_end_on;

      return {
        policy_id: safeInt(row.policy_id),
        name: String(row.name ?? ""),
        division: String(row.division ?? ""),
        discount_price: safeInt(row.discount_price),
        discount_percent: safeFloat(row.discount_percent),
        usable_start_on: startOn ? String(startOn).slice(0, 10) : "",
        usable_end_on: endOn ? String(endOn).slice(0, 10) : "",
        issued_count: safeInt(row.issued_count),
        used_count: safeInt(row.used_count),
        usage_rate: safeFloat(row.usage_rate),
        total_revenue: safeFloat(row.total_revenue),
        total_discount: safeFloat(row.total_discount),
        net_revenue: safeFloat(row.net_revenue),
        roas: safeFloat(row.roas),
        first_issued: String(row.first_issued ?? ""),
        last_used: String(row.last_used ?? ""),
      };
    });

    return NextResponse.json({ campaigns });
  } catch (err) {
    console.error("[roas/campaigns]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
