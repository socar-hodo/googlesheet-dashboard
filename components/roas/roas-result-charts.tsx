"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CouponResult, SimulationResult, CouponInput } from "@/types/roas";

interface ResultChartsProps {
  simResult: SimulationResult | null;
  coupons: CouponInput[];
  adCost: number;
  etcCost: number;
  scenarios?: Array<{
    name: string;
    roas: number | null;
    incrementalRoas: number | null;
    totalRevenue: number;
    totalCost: number;
  }>;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

// ── ROAS 바 차트 ───────────────────────────────────────────────

function RoasBarChart({ perCoupon }: { perCoupon: CouponResult[] }) {
  if (perCoupon.length === 0) return null;

  const data = perCoupon.map((c) => ({
    name: c.name,
    roas: c.roas !== null ? Math.round(c.roas * 10) / 10 : 0,
    revenue: Math.round(c.revenue),
    cost: Math.round(c.cost),
  }));

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">쿠폰별 ROAS 비교</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              label={{
                value: "ROAS (%)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11 },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              label={{
                value: "금액 (원)",
                angle: 90,
                position: "insideRight",
                style: { fontSize: 11 },
              }}
            />
            <Tooltip
              formatter={(value: number | undefined, name: string | undefined) => {
                if (value == null) return ["-", name];
                return name === "ROAS (%)"
                  ? [`${value.toFixed(1)}%`, name]
                  : [`${formatNumber(Math.round(value))}원`, name];
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="roas" name="ROAS (%)" fill="var(--chart-1)" />
            <Bar yAxisId="right" dataKey="revenue" name="매출" fill="var(--chart-2)" />
            <Bar yAxisId="right" dataKey="cost" name="쿠폰비용" fill="var(--chart-4)" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── 민감도 히트맵 ──────────────────────────────────────────────

const RATE_SCALES = [0.5, 0.7, 0.85, 1.0, 1.15, 1.3, 1.5];
const DISCOUNT_SCALES = [0.5, 0.75, 1.0, 1.25, 1.5];

function computeScaledRoas(
  coupons: CouponInput[],
  rateScale: number,
  discountScale: number,
  adCost: number,
  etcCost: number
): number | null {
  let totalRevenue = 0;
  let totalCouponCost = 0;
  for (const c of coupons) {
    const scaledRate = Math.min(c.conv_rate * rateScale, 100);
    const scaledDiscount = c.discount * discountScale;
    const conv = c.qty * (scaledRate / 100);
    totalRevenue += conv * c.rev_per_use;
    totalCouponCost += conv * scaledDiscount;
  }
  const total = totalCouponCost + adCost + etcCost;
  return total > 0 ? (totalRevenue / total) * 100 : null;
}

function roasCellColor(roas: number | null): string {
  if (roas === null) return "transparent";
  if (roas >= 300) return "rgb(34 197 94 / 0.35)";
  if (roas >= 100) return "rgb(34 197 94 / 0.15)";
  if (roas >= 50) return "rgb(234 179 8 / 0.15)";
  return "rgb(239 68 68 / 0.15)";
}

function SensitivityHeatmap({
  coupons,
  adCost,
  etcCost,
}: {
  coupons: CouponInput[];
  adCost: number;
  etcCost: number;
}) {
  const hasData = coupons.some(
    (c) => c.qty > 0 && c.conv_rate > 0 && c.rev_per_use > 0
  );
  if (!hasData) return null;

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">민감도 분석 — 전환율 × 할인 스케일</CardTitle>
        <p className="text-xs text-muted-foreground">
          셀 색상: 녹색(ROAS≥300%) / 연두(≥100%) / 노랑(≥50%) / 빨강({"<"}50%)
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="border border-border/30 bg-muted/50 px-2 py-1 text-left font-medium">
                전환율↓ / 할인→
              </th>
              {DISCOUNT_SCALES.map((ds) => (
                <th
                  key={ds}
                  className={`border border-border/30 px-2 py-1 text-center font-medium ${
                    ds === 1.0 ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" : "bg-muted/30"
                  }`}
                >
                  {Math.round(ds * 100)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RATE_SCALES.map((rs) => (
              <tr key={rs}>
                <td
                  className={`border border-border/30 px-2 py-1 font-medium ${
                    rs === 1.0 ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" : "bg-muted/30"
                  }`}
                >
                  {Math.round(rs * 100)}%
                </td>
                {DISCOUNT_SCALES.map((ds) => {
                  const roas = computeScaledRoas(coupons, rs, ds, adCost, etcCost);
                  const isCurrent = rs === 1.0 && ds === 1.0;
                  return (
                    <td
                      key={ds}
                      style={{ backgroundColor: roasCellColor(roas) }}
                      className={`border px-2 py-1.5 text-center ${
                        isCurrent ? "ring-2 ring-blue-500 ring-inset font-semibold" : ""
                      } ${roas !== null && roas < 50 ? "border-red-200" : "border-border/30"}`}
                    >
                      {roas !== null ? `${roas.toFixed(0)}%` : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ── 워터폴 차트 ───────────────────────────────────────────────

function WaterfallChart({ result }: { result: SimulationResult }) {
  if (result.totalRevenue <= 0) return null;

  const incrementalRev = result.perCoupon.reduce((s, c) => s + c.incrementalRev, 0);
  const baseRevenue = result.totalRevenue - incrementalRev;
  const netRevenue = result.totalRevenue - result.totalCost;

  // Recharts waterfall: [invisible_base, visible_value] stacked pattern
  const raw = [
    { name: "기저매출", base: 0, value: baseRevenue, fill: "var(--chart-1)" },
    { name: "증분매출", base: baseRevenue, value: incrementalRev, fill: "var(--chart-2)" },
    { name: "쿠폰비용", base: Math.max(0, netRevenue), value: result.totalCost, fill: "var(--chart-5)" },
    {
      name: "순매출",
      base: 0,
      value: Math.max(0, netRevenue),
      fill: "var(--chart-3)",
    },
  ];

  const data = raw.map((d) => ({
    name: d.name,
    invisible: d.base,
    visible: d.value,
    fill: d.fill,
  }));

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">수익 구성 워터폴</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                v >= 10_000 ? `${Math.round(v / 10_000)}만` : String(v)
              }
            />
            <Tooltip
              formatter={(value: number | undefined, name: string | undefined) => {
                if (value == null) return ["-", name];
                return [`${formatNumber(Math.round(value))}원`, name];
              }}
            />
            {/* invisible base (transparent) */}
            <Bar dataKey="invisible" stackId="a" fill="transparent" />
            {/* visible value */}
            <Bar dataKey="visible" name="금액" stackId="a">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── 시나리오 오버레이 차트 ─────────────────────────────────────

function ScenarioOverlayChart({
  scenarios,
}: {
  scenarios: NonNullable<ResultChartsProps["scenarios"]>;
}) {
  if (scenarios.length < 2) return null;

  const data = scenarios.map((s) => ({
    name: s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name,
    roas: s.roas ?? 0,
    incrementalRoas: s.incrementalRoas ?? 0,
    revenue: s.totalRevenue,
    cost: s.totalCost,
  }));

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">저장된 시나리오 비교</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              label={{
                value: "ROAS (%)",
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
            <Tooltip
              formatter={(value: number | undefined, name: string | undefined) => {
                if (value == null) return ["-", name];
                return name === "ROAS (%)" || name === "증분 ROAS (%)"
                  ? [`${value.toFixed(0)}%`, name]
                  : [`${formatNumber(Math.round(value))}원`, name];
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="roas" name="ROAS (%)" fill="var(--chart-1)" />
            <Bar yAxisId="left" dataKey="incrementalRoas" name="증분 ROAS (%)" fill="var(--chart-4)" />
            <Bar yAxisId="right" dataKey="revenue" name="매출" fill="var(--chart-2)" />
            <Bar yAxisId="right" dataKey="cost" name="총비용" fill="var(--chart-5)" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── 메인 export ───────────────────────────────────────────────

export function RoasResultCharts({
  simResult,
  coupons,
  adCost,
  etcCost,
  scenarios,
}: ResultChartsProps) {
  if (!simResult) return null;

  return (
    <div className="space-y-4">
      {simResult.perCoupon.length >= 1 && (
        <RoasBarChart perCoupon={simResult.perCoupon} />
      )}
      <SensitivityHeatmap coupons={coupons} adCost={adCost} etcCost={etcCost} />
      <WaterfallChart result={simResult} />
      {scenarios && scenarios.length >= 2 && (
        <ScenarioOverlayChart scenarios={scenarios} />
      )}
    </div>
  );
}

// ── DID 일별 라인 차트 (campaign-impact에서도 재사용) ─────────
// This is also exported separately for use in campaign-impact.tsx

export function DIDLineChart({
  data,
  campStart,
}: {
  data: Array<{
    date: string;
    target_nuse: number;
    target_revenue: number;
    control_nuse: number;
    control_revenue: number;
  }>;
  campStart?: string;
}) {
  if (!data || data.length === 0) return null;

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">타겟 vs 대조군 일별 추이 (DID)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
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
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="target_nuse"
              name="타겟 이용건수"
              stroke="var(--chart-1)"
              dot={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="control_nuse"
              name="대조군 이용건수"
              stroke="var(--chart-4)"
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="target_revenue"
              name="타겟 매출"
              stroke="var(--chart-2)"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="control_revenue"
              name="대조군 매출"
              stroke="var(--chart-3)"
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
