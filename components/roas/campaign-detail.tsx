"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CampaignDetailData, CampaignSummary } from "@/types/roas";

interface CampaignDetailProps {
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

function SummaryKpi({ summary }: { summary: CampaignSummary }) {
  const kpis = [
    { label: "발급수", value: formatNumber(summary.issued) + "매" },
    { label: "사용수", value: formatNumber(summary.used) + "매" },
    { label: "사용률", value: summary.usage_rate.toFixed(1) + "%" },
    { label: "매출", value: formatMoney(summary.revenue) },
    { label: "할인액", value: formatMoney(summary.discount) },
    { label: "순매출", value: formatMoney(summary.net_revenue) },
    {
      label: "ROAS",
      value: `${summary.roas.toFixed(0)}%`,
      highlight: summary.roas >= 100 ? "text-green-600" : "text-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="rounded-xl border border-border/40 bg-muted/20 p-3"
        >
          <p className="text-[11px] text-muted-foreground">{k.label}</p>
          <p className={`mt-0.5 text-base font-semibold ${k.highlight ?? ""}`}>
            {k.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CampaignDetail({ policyId }: CampaignDetailProps) {
  const [detail, setDetail] = useState<CampaignDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDetail(null);
    setLoading(true);
    fetch("/api/roas/campaign/detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy_id: policyId }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("조회 실패");
        return r.json();
      })
      .then((data: CampaignDetailData) => setDetail(data))
      .catch(() => toast.error("캠페인 상세 조회에 실패했습니다."))
      .finally(() => setLoading(false));
  }, [policyId]);

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/95">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          상세 정보를 불러오는 중...
        </CardContent>
      </Card>
    );
  }

  if (!detail) return null;

  const { summary, crosstab, daily_trend } = detail;

  return (
    <div className="space-y-4">
      {/* KPI 카드 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">캠페인 요약 KPI</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryKpi summary={summary} />
        </CardContent>
      </Card>

      {/* 크로스탭 테이블 */}
      {crosstab.matrix.length > 0 && (
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">연령대 × 이용시간 크로스탭</CardTitle>
            <p className="text-xs text-muted-foreground">
              각 셀: 이용건수 / 매출
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="border border-border/30 bg-muted/50 px-2 py-1.5 text-left font-medium">
                    연령대↓ / 이용시간→
                  </th>
                  {crosstab.duration_groups.map((dg) => (
                    <th
                      key={dg}
                      className="border border-border/30 bg-muted/30 px-2 py-1.5 text-center font-medium"
                    >
                      {crosstab.duration_labels[dg] ?? dg}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crosstab.age_groups.map((ag) => (
                  <tr key={ag}>
                    <td className="border border-border/30 bg-muted/20 px-2 py-1.5 font-medium">
                      {crosstab.age_labels[ag] ?? ag}
                    </td>
                    {crosstab.duration_groups.map((dg) => {
                      const rows = crosstab.matrix.filter(
                        (r) => r.age_group === ag && r.duration_group === dg
                      );
                      const nuse = rows.reduce((s, r) => s + r.nuse, 0);
                      const revenue = rows.reduce((s, r) => s + r.revenue, 0);
                      return (
                        <td
                          key={dg}
                          className="border border-border/30 px-2 py-1.5 text-center"
                        >
                          {nuse > 0 ? (
                            <>
                              <div>{formatNumber(nuse)}건</div>
                              <div className="text-muted-foreground">{formatMoney(revenue)}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 일별 트렌드 */}
      {daily_trend.length > 0 && (
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">일별 사용 트렌드</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={daily_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "매출 (원)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11 },
                  }}
                  tickFormatter={(v: number) =>
                    v >= 10_000 ? `${Math.round(v / 10_000)}만` : String(v)
                  }
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "이용건수",
                    angle: 90,
                    position: "insideRight",
                    style: { fontSize: 11 },
                  }}
                />
                <Tooltip
                  formatter={(value: number | undefined, name: string | undefined) => {
                    if (value == null) return ["-", name];
                    return name === "매출"
                      ? [formatMoney(value), name]
                      : [`${formatNumber(value)}건`, name];
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="매출"
                  stroke="var(--chart-1)"
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="used_count"
                  name="이용건수"
                  stroke="var(--chart-2)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
