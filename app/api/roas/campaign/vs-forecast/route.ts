import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  parseSqlSections,
  replaceSqlParams,
  getScenario,
  safeInt,
  safeFloat,
  BQ_ERROR_MSG,
} from "@/lib/roas";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const policyId = Number(body.policy_id);
  const scenarioId = String(body.scenario_id ?? "");

  if (!policyId || !scenarioId) {
    return NextResponse.json(
      { error: "policy_id and scenario_id are required" },
      { status: 400 }
    );
  }

  try {
    // 시나리오 조회
    const scenario = await getScenario(scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { error: "시나리오를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 캠페인 상세 조회 (campaign-detail.sql의 summary 섹션 재사용)
    const rawSql = loadRoasSql("campaign-detail.sql");
    const sections = parseSqlSections(rawSql);
    const policyIdStr = String(policyId);

    // meta 확인
    const metaSql = replaceSqlParams(sections.get("meta")!, { policy_id: policyIdStr });
    const metaRows = await runQuery(metaSql);
    if (!metaRows || metaRows.length === 0) {
      return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
    }

    // summary
    const summarySql = replaceSqlParams(sections.get("summary")!, { policy_id: policyIdStr });
    const summaryRows = await runQuery(summarySql);
    const s = summaryRows?.[0] ?? {};

    const actualIssued = safeInt(s.issued);
    const actualUsed = safeInt(s.used);
    const postDiscountRevenue = safeFloat(s.revenue);
    const actualDiscount = safeFloat(s.discount);
    const actualRevenue = Math.round((postDiscountRevenue + actualDiscount) * 100) / 100;
    const actualRoas = actualDiscount > 0
      ? Math.round((actualRevenue / actualDiscount) * 10000) / 100
      : 0;
    const actualConvRate = actualIssued > 0
      ? Math.round((actualUsed / actualIssued) * 10000) / 100
      : 0;

    // 예측 데이터
    const pred = (scenario.results ?? {}) as Record<string, unknown>;
    const predConversions = Number(pred.conversions ?? 0);
    const predRevenue = Number(pred.revenue ?? 0);
    const predRoas = Number(pred.roas ?? 0);

    const inputs = (scenario.inputs ?? {}) as Record<string, unknown>;
    let predConvRate: number;
    if (Array.isArray(inputs.coupons) && inputs.coupons.length > 0) {
      const totalQty = (inputs.coupons as Array<Record<string, unknown>>).reduce(
        (sum, c) => sum + Number(c.qty ?? 0),
        0
      );
      predConvRate = totalQty > 0
        ? Math.round((predConversions / totalQty) * 10000) / 100
        : 0;
    } else {
      predConvRate = Number(inputs.conv_rate ?? 0);
    }

    const comparison = {
      scenario_name: scenario.name ?? "",
      items: [
        {
          label: "전환건수",
          predicted: predConversions,
          actual: actualUsed,
          diff_pct: predConversions
            ? Math.round(((actualUsed - predConversions) / predConversions) * 1000) / 10
            : 0,
        },
        {
          label: "매출",
          predicted: predRevenue,
          actual: actualRevenue,
          diff_pct: predRevenue
            ? Math.round(((actualRevenue - predRevenue) / predRevenue) * 1000) / 10
            : 0,
        },
        {
          label: "ROAS",
          predicted: predRoas,
          actual: actualRoas,
          diff: Math.round((actualRoas - predRoas) * 10) / 10,
          unit: "%p",
        },
        {
          label: "전환율",
          predicted: predConvRate,
          actual: actualConvRate,
          diff: Math.round((actualConvRate - predConvRate) * 10) / 10,
          unit: "%p",
        },
      ],
    };

    return NextResponse.json(comparison);
  } catch (err) {
    console.error("[roas/campaign/vs-forecast]", err);
    return NextResponse.json(
      { error: "예측 vs 실적 비교에 실패했습니다." },
      { status: 500 }
    );
  }
}
