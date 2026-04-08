import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
  loadRoasSql,
  parseSqlSections,
  replaceSqlParams,
  toIntInClause,
  toStrInClause,
  buildAnalysisA,
  buildAnalysisB,
  buildAnalysisC,
  buildDailySeries,
  computeVerdict,
  safeInt,
  safeFloat,
  BQ_ERROR_MSG,
} from "@/lib/roas";
import type { AnalysisC, CampaignImpactResult } from "@/lib/roas";

/** 날짜 문자열 연산 헬퍼 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  return addDays(today(), -1);
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function dateDiffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const policyId = Number(body.policy_id);

  if (!policyId || policyId <= 0) {
    return NextResponse.json({ error: "policy_id is required" }, { status: 400 });
  }

  try {
    const rawSql = loadRoasSql("campaign-impact.sql");
    const sections = parseSqlSections(rawSql);
    const policyIdStr = String(policyId);

    // ── 메타 조회 ──
    const metaSql = replaceSqlParams(sections.get("meta")!, { policy_id: policyIdStr });
    const metaRows = await runQuery(metaSql);
    if (!metaRows || metaRows.length === 0) {
      return NextResponse.json({ error: "policy not found" }, { status: 404 });
    }

    const m = metaRows[0];
    const campStartRaw = m.usable_start_on;
    const campEndRaw = m.usable_end_on;
    const campStart = campStartRaw ? String(campStartRaw).slice(0, 10) : today();
    const campEndDate = campEndRaw
      ? minDate(String(campEndRaw).slice(0, 10), yesterday())
      : yesterday();
    const campEnd = campEndDate;
    const isOngoing = campEndRaw ? String(campEndRaw).slice(0, 10) >= today() : false;

    const includeZoneStr = String(m.include_zone ?? "");
    const targetZones = includeZoneStr
      .split(",")
      .map((z) => z.trim())
      .filter((z) => /^\d+$/.test(z))
      .map(Number);
    const region1 = String(m.include_region1 ?? "");

    // ── Analysis A ──
    let analysisASql: string;
    if (targetZones.length > 0) {
      analysisASql = replaceSqlParams(sections.get("analysis_a_with_zones")!, {
        policy_id: policyIdStr,
        target_zones: toIntInClause(targetZones),
        camp_start: `'${campStart}'`,
        camp_end: `'${campEnd}'`,
      });
    } else if (region1) {
      analysisASql = replaceSqlParams(sections.get("analysis_a_with_region")!, {
        policy_id: policyIdStr,
        camp_start: `'${campStart}'`,
        camp_end: `'${campEnd}'`,
        region1: `'${region1}'`,
      });
    } else {
      analysisASql = replaceSqlParams(sections.get("analysis_a_no_filter")!, {
        policy_id: policyIdStr,
        camp_start: `'${campStart}'`,
        camp_end: `'${campEnd}'`,
      });
    }
    const aRows = await runQuery(analysisASql);
    const analysisA = buildAnalysisA(aRows ?? []);

    // ── Analysis B: 전후 비교 ──
    const durationDays = dateDiffDays(campStart, campEnd);
    const beforeEnd = addDays(campStart, -1);
    const beforeStart = addDays(beforeEnd, -durationDays);

    // B 분석용 존 목록
    let bZones = targetZones.length > 0 ? [...targetZones] : [];
    if (bZones.length === 0 && region1) {
      const zoneFetchSql = replaceSqlParams(sections.get("zone_fetch_by_region")!, {
        region1: `'${region1}'`,
      });
      const zoneRows = await runQuery(zoneFetchSql);
      bZones = (zoneRows ?? []).map((r) => Number(r.id ?? 0));
    }

    let analysisB;
    if (bZones.length > 0) {
      const bSql = replaceSqlParams(sections.get("analysis_b")!, {
        before_start: `'${beforeStart}'`,
        before_end: `'${beforeEnd}'`,
        camp_start: `'${campStart}'`,
        camp_end: `'${campEnd}'`,
        b_zones: toIntInClause(bZones),
      });
      const bRows = await runQuery(bSql);
      analysisB = buildAnalysisB(bRows ?? [], beforeStart, beforeEnd, campStart, campEnd, isOngoing);
    } else {
      analysisB = buildAnalysisB([], beforeStart, beforeEnd, campStart, campEnd, isOngoing);
    }

    // ── Analysis C: DID ──
    let analysisC: AnalysisC = {
      title: "타겟존 vs 비타겟존 (DID)",
      note: "계산 불가 — 비교 대상 존 없음",
      daily_series: [],
      camp_start: "",
    };
    let didPossible = false;
    let controlZones: number[] = [];

    if (targetZones.length > 0 && region1) {
      // 비타겟존 = 동일 region1 내 target 제외
      const controlSql = replaceSqlParams(sections.get("control_zones_with_region")!, {
        region1: `'${region1}'`,
        target_zones: toIntInClause(targetZones),
      });
      const controlRows = await runQuery(controlSql);
      controlZones = (controlRows ?? []).map((r) => Number(r.id ?? 0));
      didPossible = controlZones.length > 0;
    } else if (targetZones.length > 0 && !region1) {
      // target_zones에서 region1 추출 후 비타겟존 선정
      const regionSql = replaceSqlParams(sections.get("control_zones_infer_region")!, {
        target_zones: toIntInClause(targetZones),
      });
      const regionRows = await runQuery(regionSql);
      if (regionRows && regionRows.length > 0) {
        const regions = regionRows.map((r) => String(r.region1 ?? ""));
        const controlSql2 = replaceSqlParams(sections.get("control_zones_from_regions")!, {
          regions: toStrInClause(regions),
          target_zones: toIntInClause(targetZones),
        });
        const controlRows2 = await runQuery(controlSql2);
        controlZones = (controlRows2 ?? []).map((r) => Number(r.id ?? 0));
        didPossible = controlZones.length > 0;
      }
    }

    if (didPossible) {
      const allZones = [...targetZones, ...controlZones];
      const commonParams = {
        target_zones: toIntInClause(targetZones),
        before_start: `'${beforeStart}'`,
        before_end: `'${beforeEnd}'`,
        camp_start: `'${campStart}'`,
        camp_end: `'${campEnd}'`,
        all_zones: toIntInClause(allZones),
      };

      const didSql = replaceSqlParams(sections.get("did")!, commonParams);
      const didRows = await runQuery(didSql);
      analysisC = buildAnalysisC(didRows ?? []);

      // Daily time series
      const dailyDidSql = replaceSqlParams(sections.get("did_daily")!, commonParams);
      const dailyRows = await runQuery(dailyDidSql);
      analysisC.daily_series = buildDailySeries(dailyRows ?? []);
      analysisC.camp_start = campStart;
    }

    // ── Verdict ──
    const verdictSummarySql = replaceSqlParams(sections.get("verdict_summary")!, { policy_id: policyIdStr });
    const verdictRevSql = replaceSqlParams(sections.get("verdict_revenue")!, { policy_id: policyIdStr });

    const [sRows, rRows] = await Promise.all([
      runQuery(verdictSummarySql),
      runQuery(verdictRevSql),
    ]);

    const issued = safeInt(sRows?.[0]?.issued);
    const used = safeInt(sRows?.[0]?.used);
    const usageRate = issued > 0 ? (used / issued) * 100 : 0;

    const postDiscountRev = safeFloat(rRows?.[0]?.post_discount_revenue);
    const totalDiscount = safeFloat(rRows?.[0]?.total_discount);
    const totalRevenue = postDiscountRev + totalDiscount;
    const roas = totalDiscount > 0 ? (totalRevenue / totalDiscount) * 100 : 0;

    const verdict = computeVerdict(roas, usageRate, analysisB, analysisC, didPossible);

    const result: CampaignImpactResult = {
      analysis_a: analysisA,
      analysis_b: analysisB,
      analysis_c: analysisC,
      verdict,
      is_ongoing: isOngoing,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[roas/campaign/impact]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
