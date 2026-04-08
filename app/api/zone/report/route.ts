import { NextRequest, NextResponse } from "next/server";
import type { SlackReportParams } from "@/types/zone";
import { withAuth } from "@/lib/api-utils";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";

const MODE_LABELS: Record<string, string> = {
  open: "개설 검토",
  close: "폐쇄 검토",
  compare: "존 비교",
  optimize: "최적화",
};

/**
 * POST /api/zone/report
 *
 * Body: { mode, data }
 *
 * Slack Block Kit 메시지를 웹훅으로 발송.
 */
export const POST = withAuth(async (req: NextRequest) => {
  const body: SlackReportParams = await req.json();
  const { mode, data } = body;

  if (!SLACK_WEBHOOK_URL) {
    return NextResponse.json(
      { error: "Slack 웹훅이 설정되지 않았습니다." },
      { status: 400 },
    );
  }

  const blocks = buildSlackBlocks(mode, data);
  const resp = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json(
      { error: `Slack 발송 실패: ${text}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
});

/** 모드별 Slack Block Kit 메시지 생성. */
function buildSlackBlocks(
  mode: string,
  data: Record<string, unknown>,
): unknown[] {
  const header = {
    type: "header",
    text: {
      type: "plain_text",
      text: `📍 존 시뮬레이터 — ${MODE_LABELS[mode] ?? mode}`,
    },
  };
  const divider = { type: "divider" };

  let fields: string[];

  if (mode === "open") {
    fields = [
      `*예상 대당 매출:* ₩${(Number(data.estimated_revenue_per_car) || 0).toLocaleString()}/일`,
      `*예상 가동률:* ${Math.round((Number(data.estimated_utilization) || 0) * 1000) / 10}%`,
      `*클러스터 유형:* ${data.cluster_type ?? "미분류"}`,
      `*반경 내 존:* ${Array.isArray(data.nearby_zones) ? data.nearby_zones.length : 0}개`,
    ];
    const cannibal = Array.isArray(data.cannibalization) ? data.cannibalization : [];
    const danger = cannibal.filter(
      (c: Record<string, unknown>) => c.level === "danger",
    );
    if (danger.length > 0) {
      fields.push(
        `*⚠️ 카니발리제이션:* ${danger.map((c: Record<string, unknown>) => `${c.zone_name}(${c.distance_m}m)`).join(", ")}`,
      );
    }
  } else if (mode === "close") {
    const t = (data.target_zone ?? {}) as Record<string, unknown>;
    const d = (data.demand_transfer ?? {}) as Record<string, unknown>;
    fields = [
      `*대상 존:* ${t.name ?? ""}`,
      `*가동률:* ${Math.round((Number(t.utilization) || 0) * 1000) / 10}%`,
      `*흡수율:* ${d.total_absorption_pct ?? 0}%`,
      `*이탈율:* ${d.churn_pct ?? 0}%`,
      `*순 효과:* ₩${(Number(d.net_effect_monthly) || 0).toLocaleString()}/월`,
    ];
  } else if (mode === "compare") {
    const zones = Array.isArray(data.zones) ? data.zones : [];
    fields = zones.map(
      (z: Record<string, unknown>) =>
        `*${z.name ?? ""}:* 매출 ₩${(Number(z.revenue_per_car) || 0).toLocaleString()} / 가동률 ${Math.round((Number(z.utilization) || 0) * 1000) / 10}%`,
    );
  } else if (mode === "optimize") {
    const s = (data.summary ?? {}) as Record<string, unknown>;
    const p = (data.projected ?? {}) as Record<string, unknown>;
    fields = [
      `*운영 존:* ${s.total_zones ?? 0}개`,
      `*평균 가동률:* ${Math.round((Number(s.avg_utilization) || 0) * 1000) / 10}%`,
      `*개선 후 예상:* ${Math.round((Number(p.new_avg_utilization) || 0) * 1000) / 10}%`,
      `*월 절감:* ₩${(Number(p.monthly_savings) || 0).toLocaleString()}`,
    ];
  } else {
    fields = [JSON.stringify(data)];
  }

  const bodyBlock = {
    type: "section",
    fields: fields.slice(0, 10).map((f) => ({ type: "mrkdwn", text: f })),
  };

  return [header, divider, bodyBlock];
}
