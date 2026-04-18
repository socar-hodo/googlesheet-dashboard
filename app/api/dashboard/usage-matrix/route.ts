// /api/dashboard/usage-matrix
// 사용자 지정(custom) 기간에 대한 매트릭스 사전 집계 번들 반환.
// 표준 4기간(this-week/last-week/this-month/last-month)은 SSR 페이로드에 포함되어 있으므로
// 이 엔드포인트는 custom range에서만 호출된다.

import { NextRequest, NextResponse } from "next/server";
import type { UsageMatrixPeriodBundle } from "@/types/dashboard";
import { isBigQueryConfigured, runParameterizedQuery } from "@/lib/bigquery";
import { replaceSqlParams } from "@/lib/funnel";
import { buildRegionFilter, sanitizeRegionName } from "@/lib/dashboard-bq";
import {
  loadUsageMatrixSql,
  buildMatrixResponse,
  aggregateMatrixForRange,
  computePreviousRange,
} from "@/lib/usage-matrix";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const start = sp.get("start") ?? "";
  const end = sp.get("end") ?? "";
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end) || start > end) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  const region1 = sp.get("region1")
    ? sanitizeRegionName(sp.get("region1")!)
    : undefined;
  const region2 = sp.get("region2")
    ? sanitizeRegionName(sp.get("region2")!)
    : undefined;
  const effRegion2 = region1 ? region2 : undefined;
  const regionFilter = buildRegionFilter(region1, effRegion2);

  if (!isBigQueryConfigured()) {
    const empty: UsageMatrixPeriodBundle = {
      current: [],
      previous: [],
      currentRange: { start, end },
      previousRange: computePreviousRange({ start, end }),
    };
    return NextResponse.json(empty);
  }

  const previousRange = computePreviousRange({ start, end });
  // 현재+직전 구간을 모두 커버하도록 SQL은 previousRange.start ~ end로 조회
  const sql = replaceSqlParams(loadUsageMatrixSql("matrix.sql"), {
    start_date: previousRange.start,
    end_date: end,
    region_filter: regionFilter,
  });

  try {
    const rows = await runParameterizedQuery(sql);
    const matrix = rows ? buildMatrixResponse(rows) : [];
    const bundle: UsageMatrixPeriodBundle = {
      current: aggregateMatrixForRange(matrix, { start, end }),
      previous: aggregateMatrixForRange(matrix, previousRange),
      currentRange: { start, end },
      previousRange,
    };
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("usage-matrix custom range failed:", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
