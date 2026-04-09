"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type {
  CampaignImpactData,
  AnalysisA,
  AnalysisB,
  AnalysisC,
  Verdict,
  Scenario,
  ForecastComparisonData,
} from "@/types/roas";

interface CampaignImpactProps {
  policyId: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억원`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만원`;
  return `${sign}${formatNumber(Math.round(n))}원`;
}

function DiffBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const color = value >= 0 ? "text-green-600" : "text-red-500";
  return (
    <span className={`font-semibold ${color}`}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}

// ── 분석 A: 쿠폰 사용자 vs 미사용자 ─────────────────────────

function AnalysisACard({ data }: { data: AnalysisA }) {
  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{data.title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/30 bg-muted/30">
              <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">구분</th>
              <th className="py-1.5 px-2 text-right font-medium text-muted-foreground">건수</th>
              <th className="py-1.5 px-2 text-right font-medium text-muted-foreground">평균매출</th>
              <th className="py-1.5 px-2 text-right font-medium text-muted-foreground">평균이용시간</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/20">
              <td className="py-1.5 px-2 font-medium">쿠폰 사용자</td>
              <td className="py-1.5 px-2 text-right">{formatNumber(data.coupon_users.count)}</td>
              <td className="py-1.5 px-2 text-right">{formatMoney(data.coupon_users.avg_revenue)}</td>
              <td className="py-1.5 px-2 text-right">{data.coupon_users.avg_utime.toFixed(1)}h</td>
            </tr>
            <tr className="border-b border-border/20">
              <td className="py-1.5 px-2 font-medium">미사용자</td>
              <td className="py-1.5 px-2 text-right">{formatNumber(data.non_coupon_users.count)}</td>
              <td className="py-1.5 px-2 text-right">{formatMoney(data.non_coupon_users.avg_revenue)}</td>
              <td className="py-1.5 px-2 text-right">{data.non_coupon_users.avg_utime.toFixed(1)}h</td>
            </tr>
            <tr className="bg-muted/10">
              <td className="py-1.5 px-2 font-medium text-muted-foreground">차이</td>
              <td className="py-1.5 px-2 text-right">-</td>
              <td className="py-1.5 px-2 text-right">
                <DiffBadge value={data.diff_pct.revenue} />
              </td>
              <td className="py-1.5 px-2 text-right">
                <DiffBadge value={data.diff_pct.utime} />
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ── 분석 B: 캠페인 전/후 비교 ────────────────────────────────

function AnalysisBCard({ data }: { data: AnalysisB }) {
  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{data.title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/30 bg-muted/30">
              <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">구분</th>
              <th className="py-1.5 px-2 text-center font-medium text-muted-foreground">기간</th>
              <th className="py-1.5 px-2 text-right font-medium text-muted-foreground">이용건수</th>
              <th className="py-1.5 px-2 text-right font-medium text-muted-foreground">매출</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/20">
              <td className="py-1.5 px-2 font-medium">이전</td>
              <td className="py-1.5 px-2 text-center text-muted-foreground text-[10px]">{data.before.period}</td>
              <td className="py-1.5 px-2 text-right">{formatNumber(data.before.nuse)}</td>
              <td className="py-1.5 px-2 text-right">{formatMoney(data.before.revenue)}</td>
            </tr>
            <tr className="border-b border-border/20">
              <td className="py-1.5 px-2 font-medium">이후</td>
              <td className="py-1.5 px-2 text-center text-muted-foreground text-[10px]">{data.after.period}</td>
              <td className="py-1.5 px-2 text-right">{formatNumber(data.after.nuse)}</td>
              <td className="py-1.5 px-2 text-right">{formatMoney(data.after.revenue)}</td>
            </tr>
            <tr className="bg-muted/10">
              <td className="py-1.5 px-2 font-medium text-muted-foreground">변화</td>
              <td className="py-1.5 px-2 text-center">-</td>
              <td className="py-1.5 px-2 text-right">
                <DiffBadge value={data.change_pct.nuse} />
              </td>
              <td className="py-1.5 px-2 text-right">
                <DiffBadge value={data.change_pct.revenue} />
              </td>
            </tr>
          </tbody>
        </table>
        {data.after.note && (
          <p className="mt-2 text-[11px] text-muted-foreground">{data.after.note}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── 분석 C: DID (타겟 vs 비타겟) ─────────────────────────────

function AnalysisCCard({ data }: { data: AnalysisC }) {
  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{data.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.note ? (
          <p className="text-xs text-muted-foreground py-4">{data.note}</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/30 bg-muted/30">
                <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">구분</th>
                <th className="py-1.5 px-2 text-right font-medium text-muted-foreground">이용건수%</th>
                <th className="py-1.5 px-2 text-right font-medium text-muted-foreground">매출%</th>
              </tr>
            </thead>
            <tbody>
              {data.target_change && (
                <tr className="border-b border-border/20">
                  <td className="py-1.5 px-2 font-medium">타겟존</td>
                  <td className="py-1.5 px-2 text-right">
                    <DiffBadge value={data.target_change.nuse_pct} />
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <DiffBadge value={data.target_change.revenue_pct} />
                  </td>
                </tr>
              )}
              {data.control_change && (
                <tr className="border-b border-border/20">
                  <td className="py-1.5 px-2 font-medium">비타겟존</td>
                  <td className="py-1.5 px-2 text-right">
                    <DiffBadge value={data.control_change.nuse_pct} />
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <DiffBadge value={data.control_change.revenue_pct} />
                  </td>
                </tr>
              )}
              {data.did_effect && (
                <tr className="bg-muted/10 font-semibold">
                  <td className="py-1.5 px-2">DID 효과</td>
                  <td className="py-1.5 px-2 text-right">
                    <DiffBadge value={data.did_effect.nuse_pct} />
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <DiffBadge value={data.did_effect.revenue_pct} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ── DID 일별 차트 ─────────────────────────────────────────────

function DIDDailyChart({ analysisC }: { analysisC: AnalysisC }) {
  if (!analysisC.daily_series || analysisC.daily_series.length === 0) return null;

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">타겟 vs 대조군 일별 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analysisC.daily_series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              label={{
                value: "이용건수",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11 },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                v >= 10_000 ? `${Math.round(v / 10_000)}만` : String(v)
              }
            />
            <Tooltip />
            <Legend />
            {analysisC.camp_start && (
              <ReferenceLine
                x={analysisC.camp_start}
                yAxisId="left"
                stroke="#FF7043"
                strokeDasharray="6 4"
                label={{
                  value: "캠페인 시작",
                  position: "top",
                  fill: "#FF7043",
                  fontSize: 11,
                }}
              />
            )}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="target_nuse"
              name="타겟 이용건수"
              stroke="#00B4D8"
              dot={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="control_nuse"
              name="대조군 이용건수"
              stroke="#90CAF9"
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="target_revenue"
              name="타겟 매출"
              stroke="#43A047"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="control_revenue"
              name="대조군 매출"
              stroke="#A5D6A7"
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── 판정 배너 ─────────────────────────────────────────────────

function VerdictBanner({ verdict }: { verdict: Verdict }) {
  const colorClass =
    verdict.score >= 80
      ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
      : verdict.score >= 50
        ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900"
        : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900";

  const scoreColor =
    verdict.score >= 80
      ? "bg-green-500"
      : verdict.score >= 50
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className={`rounded-2xl border p-4 ${colorClass}`}>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-white font-bold text-sm ${scoreColor}`}
        >
          {Math.round(verdict.score)}
        </span>
        <span className="text-base font-semibold">{verdict.label}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{verdict.summary}</p>
      {verdict.note && (
        <p className="mt-1 text-xs text-muted-foreground">{verdict.note}</p>
      )}
      {verdict.insights.length > 0 && (
        <ul className="mt-2 space-y-1">
          {verdict.insights.map((insight, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              - {insight}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 예측 vs 실적 비교 ─────────────────────────────────────────

function ForecastComparison({
  policyId,
  scenarios,
  forecast,
  onForecastChange,
}: {
  policyId: number;
  scenarios: Scenario[];
  forecast: ForecastComparisonData | null;
  onForecastChange: (data: ForecastComparisonData) => void;
}) {
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (!selectedScenarioId) return;
    setLoading(true);
    try {
      const resp = await fetch("/api/roas/campaign/vs-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_id: policyId,
          scenario_id: selectedScenarioId,
        }),
      });
      if (!resp.ok) throw new Error("비교 실패");
      const data: ForecastComparisonData = await resp.json();
      onForecastChange(data);
    } catch {
      toast.error("예측 vs 실적 비교에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">예측 vs 실적 비교</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="space-y-1 flex-1">
            <label className="text-xs text-muted-foreground">비교할 시나리오</label>
            <select
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm"
            >
              <option value="">-- 시나리오 선택 --</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCompare}
            disabled={loading || !selectedScenarioId}
            className="h-9 rounded-xl bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50 transition-colors hover:bg-primary/90"
          >
            {loading ? "비교 중..." : "비교"}
          </button>
        </div>

        {forecast && (
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              시나리오: {forecast.scenario_name}
            </p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/30 bg-muted/30">
                  <th className="py-1.5 px-3 text-left font-medium text-muted-foreground">항목</th>
                  <th className="py-1.5 px-3 text-right font-medium text-muted-foreground">예측</th>
                  <th className="py-1.5 px-3 text-right font-medium text-muted-foreground">실적</th>
                  <th className="py-1.5 px-3 text-right font-medium text-muted-foreground">차이</th>
                  <th className="py-1.5 px-3 text-right font-medium text-muted-foreground">차이%</th>
                </tr>
              </thead>
              <tbody>
                {forecast.items.map((item, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td className="py-1.5 px-3 font-medium">{item.label}</td>
                    <td className="py-1.5 px-3 text-right">
                      {formatNumber(Math.round(item.predicted))}
                      {item.unit ? item.unit : ""}
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      {formatNumber(Math.round(item.actual))}
                      {item.unit ? item.unit : ""}
                    </td>
                    <td
                      className={`py-1.5 px-3 text-right font-semibold ${
                        (item.diff ?? 0) >= 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {item.diff != null
                        ? `${item.diff >= 0 ? "+" : ""}${formatNumber(Math.round(item.diff))}`
                        : "-"}
                    </td>
                    <td
                      className={`py-1.5 px-3 text-right font-semibold ${
                        (item.diff_pct ?? 0) >= 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {item.diff_pct != null
                        ? `${item.diff_pct >= 0 ? "+" : ""}${item.diff_pct.toFixed(1)}%`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 메인 export ───────────────────────────────────────────────

export function CampaignImpact({ policyId }: CampaignImpactProps) {
  const [impact, setImpact] = useState<CampaignImpactData | null>(null);
  const [forecast, setForecast] = useState<ForecastComparisonData | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setImpact(null);
    setForecast(null);
    setLoading(true);

    fetch("/api/roas/campaign/impact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy_id: policyId }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("조회 실패");
        return r.json();
      })
      .then((data: CampaignImpactData) => setImpact(data))
      .catch(() => toast.error("영향도 분석 조회에 실패했습니다."))
      .finally(() => setLoading(false));

    fetch("/api/roas/scenarios")
      .then((r) => {
        if (!r.ok) throw new Error(`scenarios fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => setScenarios(Array.isArray(data) ? data : []))
      .catch((err) => console.error("scenarios fetch error:", err));
  }, [policyId]);

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/95">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          영향도 분석 중...
        </CardContent>
      </Card>
    );
  }

  if (!impact) return null;

  return (
    <div className="space-y-4">
      {/* 3-view 분석 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <AnalysisACard data={impact.analysis_a} />
        <AnalysisBCard data={impact.analysis_b} />
        <AnalysisCCard data={impact.analysis_c} />
      </div>

      {/* DID 일별 차트 */}
      {impact.analysis_c.daily_series?.length > 0 && (
        <DIDDailyChart analysisC={impact.analysis_c} />
      )}

      {/* 판정 배너 */}
      <VerdictBanner verdict={impact.verdict} />

      {/* 예측 vs 실적 비교 */}
      {scenarios.length > 0 && (
        <ForecastComparison
          policyId={policyId}
          scenarios={scenarios}
          forecast={forecast}
          onForecastChange={setForecast}
        />
      )}
    </div>
  );
}
