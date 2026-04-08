import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  replaceSqlParams,
  toIntInClause,
  safeFloat,
  safeInt,
  isValidDate,
  AGE_LABELS,
  DURATION_LABELS,
  BQ_ERROR_MSG,
} from "@/lib/roas";
import type { PerformanceResult } from "@/lib/roas";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const zoneIds: number[] = Array.isArray(body.zone_ids) ? body.zone_ids.map(Number) : [];
  const startDate: string = body.start_date ?? "";
  const endDate: string = body.end_date ?? "";

  if (zoneIds.length === 0) {
    return NextResponse.json({ error: "zone_ids must not be empty" }, { status: 400 });
  }
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const raw = loadRoasSql("performance.sql");
    const sql = replaceSqlParams(raw, {
      zone_ids: toIntInClause(zoneIds),
      start_date: `'${startDate}'`,
      end_date: `'${endDate}'`,
    });
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }

    if (rows.length === 0) {
      const empty: PerformanceResult = {
        matrix: [],
        age_groups: [],
        age_labels: {},
        duration_groups: [],
        duration_labels: { ...DURATION_LABELS },
        summary: { total_nuse: 0, total_revenue: 0, avg_rev_per_use: 0 },
      };
      return NextResponse.json(empty);
    }

    // performance는 day_type 포함하여 crosstab보다 확장된 형태
    const matrix = rows.map((row) => ({
      age_group: String(row.age_group ?? ""),
      age_label: AGE_LABELS[String(row.age_group ?? "")] ?? String(row.age_group ?? ""),
      duration_group: String(row.duration_group ?? ""),
      duration_label: DURATION_LABELS[String(row.duration_group ?? "")] ?? String(row.duration_group ?? ""),
      day_type: String(row.day_type ?? "all"),
      nuse: safeInt(row.nuse),
      revenue: safeFloat(row.revenue),
    }));

    const ageGroupsSet = new Set(matrix.map((r) => r.age_group));
    const durationGroupsSet = new Set(matrix.map((r) => r.duration_group));
    const ageGroups = [...ageGroupsSet].sort();
    const durationGroups = [...durationGroupsSet].sort();

    const ageLabels: Record<string, string> = {};
    for (const ag of ageGroups) ageLabels[ag] = AGE_LABELS[ag] ?? ag;
    const durationLabels: Record<string, string> = {};
    for (const dg of durationGroups) durationLabels[dg] = DURATION_LABELS[dg] ?? dg;

    const totalNuse = matrix.reduce((s, r) => s + r.nuse, 0);
    const totalRevenue = matrix.reduce((s, r) => s + r.revenue, 0);
    const avgRevPerUse = totalNuse > 0 ? Math.round((totalRevenue / totalNuse) * 100) / 100 : 0;

    const result: PerformanceResult = {
      matrix,
      age_groups: ageGroups,
      age_labels: ageLabels,
      duration_groups: durationGroups,
      duration_labels: durationLabels,
      summary: {
        total_nuse: totalNuse,
        total_revenue: totalRevenue,
        avg_rev_per_use: avgRevPerUse,
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[roas/performance]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
