import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  replaceSqlParams,
  safeInt,
  safeFloat,
  isValidDate,
} from "@/lib/roas";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("start_date") ?? "";
  const endDate = sp.get("end_date") ?? "";

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 400 });
  }

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
    return NextResponse.json([]);
  }

  const now = new Date().toISOString().slice(0, 10);

  const campaigns = rows.map((row) => {
    const startOn = row.usable_start_on;
    const endOn = row.usable_end_on;
    const endDate = endOn ? String(endOn).slice(0, 10) : "";

    return {
      policy_id: safeInt(row.policy_id),
      name: String(row.name ?? ""),
      division: String(row.division ?? ""),
      start_date: startOn ? String(startOn).slice(0, 10) : "",
      end_date: endDate,
      issued: safeInt(row.issued_count),
      used: safeInt(row.used_count),
      usage_rate: safeFloat(row.usage_rate),
      revenue: safeFloat(row.total_revenue),
      discount: safeFloat(row.total_discount),
      roas: safeFloat(row.roas),
      is_ongoing: endDate ? endDate >= now : false,
    };
  });

  return NextResponse.json(campaigns);
});
