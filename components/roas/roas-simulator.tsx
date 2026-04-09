"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RoasRegionSelector } from "./roas-region-selector";
import { RoasResultCharts } from "./roas-result-charts";
import type {
  CouponInput,
  PerformanceData,
  SimulationResult,
  CouponResult,
  Scenario,
} from "@/types/roas";

const MAX_COUPONS = 5;
const QUICK_DATE_OPTIONS = [
  { label: "1개월", months: 1 },
  { label: "3개월", months: 3 },
  { label: "6개월", months: 6 },
  { label: "12개월", months: 12 },
];

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDateRange(months: number): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - 1);
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  return { start: formatDate(start), end: formatDate(end) };
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억원`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만원`;
  return `${formatNumber(Math.round(n))}원`;
}

let couponIdCounter = 0;
function newCouponId(): string {
  return `cpn-${++couponIdCounter}`;
}

function createDefaultCoupon(revPerUse = 0): CouponInput {
  return {
    id: newCouponId(),
    name: "쿠폰 1",
    qty: 0,
    conv_rate: 0,
    discount: 0,
    rev_per_use: revPerUse,
    organic_rate: 0,
  };
}

// ── 클라이언트 사이드 ROAS 계산 ──────────────────────────────

/**
 * 시뮬레이션 결과를 계산한다. (클라이언트 사이드)
 * simulator.js의 calculateROAS() 로직을 1:1 포팅.
 */
function calculateSimulation(
  coupons: CouponInput[],
  adCost: number,
  etcCost: number
): SimulationResult | null {
  const hasData = coupons.some(
    (c) => c.qty > 0 && c.conv_rate > 0 && c.rev_per_use > 0
  );
  if (!hasData) return null;

  let totalConversions = 0;
  let totalRevenue = 0;
  let totalCouponCost = 0;
  let totalIncrementalConv = 0;
  let totalIncrementalRev = 0;
  let totalQty = 0;
  let weightedMarginNum = 0;
  let weightedMarginDen = 0;

  const perCoupon: CouponResult[] = [];

  for (const c of coupons) {
    const conv = c.qty * (c.conv_rate / 100);
    const rev = conv * c.rev_per_use;
    const cost = conv * c.discount;
    const organicConv = c.qty * (c.organic_rate / 100);
    const incrConv = conv - organicConv;
    const incrRev = incrConv * c.rev_per_use;
    const indivRoas = cost > 0 ? (rev / cost) * 100 : null;

    perCoupon.push({
      name: c.name,
      conversions: conv,
      revenue: rev,
      cost,
      roas: indivRoas,
      incrementalConv: incrConv,
      incrementalRev: incrRev,
    });

    totalConversions += conv;
    totalRevenue += rev;
    totalCouponCost += cost;
    totalIncrementalConv += incrConv;
    totalIncrementalRev += incrRev;
    totalQty += c.qty;

    if (conv > 0) {
      weightedMarginNum += conv * (c.rev_per_use - c.discount);
      weightedMarginDen += conv;
    }
  }

  const totalCost = totalCouponCost + adCost + etcCost;
  const roas = totalCost > 0 ? (totalRevenue / totalCost) * 100 : null;
  const incrementalRoas =
    totalCost > 0 ? (totalIncrementalRev / totalCost) * 100 : null;

  let breakEvenRate: number | null = null;
  const fixedCosts = adCost + etcCost;
  if (totalQty > 0 && weightedMarginDen > 0) {
    const weightedMargin = weightedMarginNum / weightedMarginDen;
    if (weightedMargin > 0) {
      breakEvenRate = (fixedCosts * 100) / (totalQty * weightedMargin);
    }
  }

  return {
    totalConversions,
    totalRevenue,
    totalCouponCost,
    totalCost,
    roas,
    incrementalConv: totalIncrementalConv,
    incrementalRoas,
    breakEvenRate,
    perCoupon,
  };
}

function generateExecSummary(result: SimulationResult, couponCount: number): string | null {
  if (!result || result.totalCost <= 0) return null;
  const { totalCost, totalRevenue, roas, incrementalRoas, breakEvenRate } = result;

  const costText = formatMoney(totalCost);
  const revenueText = totalRevenue >= 100_000_000
    ? `약 ${(totalRevenue / 100_000_000).toFixed(1)}억원`
    : totalRevenue >= 10_000
      ? `약 ${Math.round(totalRevenue / 10_000).toLocaleString("ko-KR")}만원`
      : `${formatNumber(Math.round(totalRevenue))}원`;

  let summary = couponCount > 1 ? `${couponCount}개 쿠폰 합산 기준, ` : "";
  summary += `본 캠페인은 ${costText} 투자로 ${revenueText} 매출이 기대되며 (ROAS ${roas?.toFixed(0)}%)`;

  if (incrementalRoas !== null && incrementalRoas > 0) {
    summary += `, 자연전환을 제외한 증분 기준으로도 ROAS ${incrementalRoas.toFixed(0)}%가 예상됩니다.`;
  } else {
    summary += ".";
  }

  if (breakEvenRate !== null && breakEvenRate <= 100) {
    summary += ` 손익분기 전환율 ${breakEvenRate.toFixed(1)}%.`;
  }

  return summary;
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────

export function RoasSimulator() {
  // -- 지역/존 상태 --
  const [selectedZoneIds, setSelectedZoneIds] = useState<number[]>([]);
  const [region1, setRegion1] = useState("");
  const [region2, setRegion2] = useState<string[]>([]);

  // -- 날짜 상태 --
  const defaultRange = getDateRange(3);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  // -- 매트릭스 상태 --
  const [perfData, setPerfData] = useState<PerformanceData | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [selectedAges, setSelectedAges] = useState<Record<string, boolean>>({});
  const [selectedDurations, setSelectedDurations] = useState<Record<string, boolean>>({});
  const [dayType, setDayType] = useState<"all" | "weekday" | "weekend">("all");

  // -- 쿠폰 상태 --
  const [coupons, setCoupons] = useState<CouponInput[]>([createDefaultCoupon()]);
  const [adCost, setAdCost] = useState(0);
  const [etcCost, setEtcCost] = useState(0);

  // -- 시나리오 상태 --
  const [scenarioName, setScenarioName] = useState("");
  const [savingScenario, setSavingScenario] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);

  // ── 가중평균 건당매출 계산 ────────────────────────────────────
  const weightedAvgRevPerUse = useMemo(() => {
    if (!perfData) return 0;
    let totalNuse = 0;
    let totalRevenue = 0;
    for (const row of perfData.matrix) {
      if (dayType !== "all" && row.day_type !== dayType) continue;
      if (selectedAges[row.age_group] && selectedDurations[row.duration_group]) {
        totalNuse += row.nuse;
        totalRevenue += row.revenue;
      }
    }
    return totalNuse > 0 ? Math.round(totalRevenue / totalNuse) : 0;
  }, [perfData, selectedAges, selectedDurations, dayType]);

  // ── ROAS 계산 ─────────────────────────────────────────────────
  const simResult = useMemo(
    () => calculateSimulation(coupons, adCost, etcCost),
    [coupons, adCost, etcCost]
  );

  // ── 성능 매트릭스 조회 ────────────────────────────────────────
  const handleFetchPerformance = useCallback(async () => {
    if (selectedZoneIds.length === 0) {
      toast.error("존을 선택해 주세요.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("날짜를 선택해 주세요.");
      return;
    }
    setPerfLoading(true);
    try {
      const resp = await fetch("/api/roas/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone_ids: selectedZoneIds,
          start_date: startDate,
          end_date: endDate,
        }),
      });
      if (!resp.ok) throw new Error("조회 실패");
      const data: PerformanceData = await resp.json();
      setPerfData(data);

      // 모든 연령대/이용시간 기본 선택
      const ages: Record<string, boolean> = {};
      for (const ag of data.age_groups) ages[ag] = true;
      setSelectedAges(ages);

      const durs: Record<string, boolean> = {};
      for (const dg of data.duration_groups) durs[dg] = true;
      setSelectedDurations(durs);

      // 쿠폰 rev_per_use 업데이트 (첫 번째 쿠폰에만)
      const avg = data.summary.avg_rev_per_use;
      if (avg > 0) {
        setCoupons((prev) =>
          prev.map((c, i) => (i === 0 ? { ...c, rev_per_use: avg } : c))
        );
      }
      toast.success("성능 매트릭스를 불러왔습니다.");
    } catch {
      toast.error("성능 매트릭스 조회에 실패했습니다.");
    } finally {
      setPerfLoading(false);
    }
  }, [selectedZoneIds, startDate, endDate]);

  // ── 쿠폰 관리 ─────────────────────────────────────────────────
  function addCoupon() {
    if (coupons.length >= MAX_COUPONS) return;
    setCoupons((prev) => [
      ...prev,
      {
        ...createDefaultCoupon(weightedAvgRevPerUse),
        name: `쿠폰 ${prev.length + 1}`,
      },
    ]);
  }

  function removeCoupon(id: string) {
    if (coupons.length <= 1) return;
    setCoupons((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCoupon(id: string, field: keyof CouponInput, value: string | number) {
    setCoupons((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  // ── 시나리오 저장 ─────────────────────────────────────────────
  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) {
      toast.error("시나리오 이름을 입력해 주세요.");
      return;
    }
    if (!simResult) {
      toast.error("시뮬레이션 결과가 없습니다.");
      return;
    }
    setSavingScenario(true);
    try {
      const resp = await fetch("/api/roas/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: scenarioName,
          inputs: {
            zone_ids: selectedZoneIds,
            region1,
            region2,
            start_date: startDate,
            end_date: endDate,
            coupons: coupons.map(({ id: _id, ...rest }) => rest),
            ad_cost: adCost,
            etc_cost: etcCost,
          },
          results: {
            conversions: simResult.totalConversions,
            revenue: simResult.totalRevenue,
            total_cost: simResult.totalCost,
            roas: simResult.roas ?? 0,
            incremental_roas: simResult.incrementalRoas ?? 0,
          },
        }),
      });
      if (!resp.ok) throw new Error("저장 실패");
      toast.success("시나리오가 저장되었습니다.");
      setScenarioName("");
      // 시나리오 목록 새로고침
      const listResp = await fetch("/api/roas/scenarios");
      if (!listResp.ok) throw new Error(`scenarios list fetch failed: ${listResp.status}`);
      const list = await listResp.json();
      setSavedScenarios(Array.isArray(list) ? list : []);
    } catch {
      toast.error("시나리오 저장에 실패했습니다.");
    } finally {
      setSavingScenario(false);
    }
  };

  // ── 퀵 날짜 버튼 ─────────────────────────────────────────────
  const setQuickDate = (months: number) => {
    const range = getDateRange(months);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  // ── 크로스탭 렌더 헬퍼 ───────────────────────────────────────
  function getCellData(ageGroup: string, durGroup: string) {
    if (!perfData) return null;
    const rows = perfData.matrix.filter(
      (r) =>
        r.age_group === ageGroup &&
        r.duration_group === durGroup &&
        (dayType === "all" || r.day_type === dayType)
    );
    if (rows.length === 0) return null;
    const nuse = rows.reduce((s, r) => s + r.nuse, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    return { nuse, revenue };
  }

  const execSummary = simResult ? generateExecSummary(simResult, coupons.length) : null;

  // 손익분기 색상
  const breakEvenColor =
    simResult?.breakEvenRate == null
      ? "bg-gray-100 text-gray-600"
      : simResult.breakEvenRate <= 30
        ? "bg-green-100 text-green-700"
        : simResult.breakEvenRate <= 70
          ? "bg-yellow-100 text-yellow-700"
          : "bg-red-100 text-red-700";

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      {/* ── 왼쪽: 지역/날짜 패널 ── */}
      <div className="space-y-4">
        <RoasRegionSelector
          selectedZoneIds={selectedZoneIds}
          onZoneChange={setSelectedZoneIds}
          onRegionChange={(r1, r2) => {
            setRegion1(r1);
            setRegion2(r2);
          }}
        />

        {/* 날짜 선택 */}
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">분석 기간</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1.5 flex-wrap">
              {QUICK_DATE_OPTIONS.map((opt) => (
                <Button
                  key={opt.months}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setQuickDate(opt.months)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">시작일</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">종료일</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <Button
              onClick={handleFetchPerformance}
              disabled={perfLoading || selectedZoneIds.length === 0}
              className="w-full"
              size="sm"
            >
              {perfLoading ? "조회 중..." : "성능 매트릭스 조회"}
            </Button>
          </CardContent>
        </Card>

        {/* 추가 비용 */}
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">추가 비용</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">광고비 (원)</label>
              <Input
                type="number"
                min={0}
                value={adCost || ""}
                onChange={(e) => setAdCost(Number(e.target.value) || 0)}
                placeholder="0"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">기타 비용 (원)</label>
              <Input
                type="number"
                min={0}
                value={etcCost || ""}
                onChange={(e) => setEtcCost(Number(e.target.value) || 0)}
                placeholder="0"
                className="h-8 text-xs"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 오른쪽: 매트릭스 + 쿠폰 + 결과 ── */}
      <div className="space-y-6">

        {/* 성능 매트릭스 크로스탭 */}
        {perfData && (
          <Card className="border-border/60 bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">성능 매트릭스</CardTitle>
                <div className="flex gap-1">
                  {(["all", "weekday", "weekend"] as const).map((dt) => (
                    <button
                      key={dt}
                      onClick={() => setDayType(dt)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] transition-colors ${
                        dayType === dt
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {dt === "all" ? "전체" : dt === "weekday" ? "평일" : "주말"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                가중평균 건당매출:{" "}
                <span className="font-semibold text-foreground">
                  {formatNumber(weightedAvgRevPerUse)}원
                </span>
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="border border-border/40 bg-muted/50 px-2 py-1 text-left font-medium">
                      연령대↓ / 이용시간→
                    </th>
                    {perfData.duration_groups.map((dg) => (
                      <th
                        key={dg}
                        className={`border border-border/40 px-3 py-2 text-center font-medium cursor-pointer transition-colors select-none ${
                          selectedDurations[dg]
                            ? "bg-blue-600 text-white"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        }`}
                        onClick={() =>
                          setSelectedDurations((prev) => ({
                            ...prev,
                            [dg]: !prev[dg],
                          }))
                        }
                      >
                        {perfData.duration_labels[dg] ?? dg}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perfData.age_groups.map((ag) => (
                    <tr key={ag}>
                      <td
                        className={`border border-border/40 px-3 py-2 font-medium cursor-pointer transition-colors select-none ${
                          selectedAges[ag]
                            ? "bg-blue-600 text-white"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        }`}
                        onClick={() =>
                          setSelectedAges((prev) => ({
                            ...prev,
                            [ag]: !prev[ag],
                          }))
                        }
                      >
                        {perfData.age_labels[ag] ?? ag}
                      </td>
                      {perfData.duration_groups.map((dg) => {
                        const cell = getCellData(ag, dg);
                        const highlighted = selectedAges[ag] && selectedDurations[dg];
                        return (
                          <td
                            key={dg}
                            className={`border border-border/40 px-3 py-2 text-center transition-colors ${
                              highlighted ? "bg-blue-50 dark:bg-blue-950/30" : "opacity-40"
                            }`}
                          >
                            {cell ? (
                              <>
                                <div>{formatNumber(cell.nuse)}건</div>
                                <div className="text-muted-foreground">
                                  {formatMoney(cell.revenue)}
                                </div>
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

        {/* 쿠폰 입력 테이블 */}
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">쿠폰 파라미터</CardTitle>
              <span className="text-xs text-muted-foreground">
                {coupons.length} / {MAX_COUPONS}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="py-2 text-left font-medium text-muted-foreground pr-1 w-24">쿠폰명</th>
                    <th className="py-2 text-right font-medium text-muted-foreground px-1 w-20">발급수</th>
                    <th className="py-2 text-right font-medium text-muted-foreground px-1 w-20">전환율(%)</th>
                    <th className="py-2 text-right font-medium text-muted-foreground px-1 w-24">할인(원)</th>
                    <th className="py-2 text-right font-medium text-muted-foreground px-1 w-28">건당매출(원)</th>
                    <th className="py-2 text-right font-medium text-muted-foreground px-1 w-20">자연전환(%)</th>
                    <th className="py-2 text-center font-medium text-muted-foreground px-1 w-16">ROAS</th>
                    <th className="py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => {
                    const conv = c.qty * (c.conv_rate / 100);
                    const rev = conv * c.rev_per_use;
                    const cost = conv * c.discount;
                    const rowRoas = cost > 0 ? (rev / cost) * 100 : null;
                    return (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-2 pr-1">
                          <Input
                            value={c.name}
                            onChange={(e) => updateCoupon(c.id, "name", e.target.value)}
                            className="h-8 w-full text-xs"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            type="number"
                            min={0}
                            value={c.qty || ""}
                            onChange={(e) => updateCoupon(c.id, "qty", Number(e.target.value) || 0)}
                            placeholder="1,000"
                            className="h-8 w-full text-xs text-right"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={c.conv_rate || ""}
                            onChange={(e) => updateCoupon(c.id, "conv_rate", Number(e.target.value) || 0)}
                            placeholder="10"
                            className="h-8 w-full text-xs text-right"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            type="number"
                            min={0}
                            value={c.discount || ""}
                            onChange={(e) => updateCoupon(c.id, "discount", Number(e.target.value) || 0)}
                            placeholder="5,000"
                            className="h-8 w-full text-xs text-right"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            type="number"
                            min={0}
                            value={Math.round(c.rev_per_use) || ""}
                            onChange={(e) => updateCoupon(c.id, "rev_per_use", Number(e.target.value) || 0)}
                            placeholder="자동"
                            className="h-8 w-full text-xs text-right bg-muted/30"
                            readOnly={!!perfData}
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={c.organic_rate || ""}
                            onChange={(e) => updateCoupon(c.id, "organic_rate", Number(e.target.value) || 0)}
                            placeholder="0"
                            className="h-8 w-full text-xs text-right"
                          />
                        </td>
                        <td className="py-2 px-1 text-center">
                          {rowRoas !== null ? (
                            <Badge variant={rowRoas >= 100 ? "default" : "destructive"} className="text-[10px] px-1.5">
                              {rowRoas.toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">-</span>
                          )}
                        </td>
                        <td className="py-1.5 pl-2">
                          <button
                            type="button"
                            onClick={() => removeCoupon(c.id)}
                            disabled={coupons.length <= 1}
                            className="text-muted-foreground hover:text-red-500 disabled:opacity-30 transition-colors"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addCoupon}
              disabled={coupons.length >= MAX_COUPONS}
              className="w-full text-xs"
            >
              + 쿠폰 추가
            </Button>
          </CardContent>
        </Card>

        {/* 결과 카드 */}
        {simResult && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="border-border/60 bg-card/95 p-4">
                <p className="text-xs text-muted-foreground">전환수</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatNumber(Math.round(simResult.totalConversions))}건
                </p>
              </Card>
              <Card className="border-border/60 bg-card/95 p-4">
                <p className="text-xs text-muted-foreground">예상 매출</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatMoney(simResult.totalRevenue)}
                </p>
              </Card>
              <Card className="border-border/60 bg-card/95 p-4">
                <p className="text-xs text-muted-foreground">총 비용</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatMoney(simResult.totalCost)}
                </p>
              </Card>
              <Card className="border-border/60 bg-card/95 p-4">
                <p className="text-xs text-muted-foreground">ROAS</p>
                <p className={`mt-1 text-xl font-semibold ${
                  simResult.roas == null ? "text-muted-foreground" :
                  simResult.roas >= 100 ? "text-green-600" : "text-red-500"
                }`}>
                  {simResult.roas != null ? `${simResult.roas.toFixed(0)}%` : "-"}
                </p>
              </Card>
              <Card className="border-border/60 bg-card/95 p-4">
                <p className="text-xs text-muted-foreground">증분 전환수</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatNumber(Math.round(simResult.incrementalConv))}건
                </p>
              </Card>
              <Card className="border-border/60 bg-card/95 p-4">
                <p className="text-xs text-muted-foreground">증분 ROAS</p>
                <p className={`mt-1 text-xl font-semibold ${
                  simResult.incrementalRoas == null ? "text-muted-foreground" :
                  simResult.incrementalRoas >= 100 ? "text-green-600" : "text-red-500"
                }`}>
                  {simResult.incrementalRoas != null ? `${simResult.incrementalRoas.toFixed(0)}%` : "-"}
                </p>
              </Card>
              {simResult.breakEvenRate !== null && (
                <Card className="border-border/60 bg-card/95 p-4 col-span-2">
                  <p className="text-xs text-muted-foreground">손익분기 전환율</p>
                  <p className="mt-1">
                    <Badge className={`text-sm font-semibold ${breakEvenColor}`}>
                      {simResult.breakEvenRate.toFixed(1)}%
                    </Badge>
                  </p>
                </Card>
              )}
            </div>

            {/* Executive Summary */}
            {execSummary && (
              <Card className="border-border/60 bg-blue-50/50">
                <CardContent className="pt-4">
                  <p className="text-sm leading-6 text-foreground/80">{execSummary}</p>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* 시나리오 저장 */}
            <Card className="border-border/60 bg-card/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">시나리오 저장</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="시나리오 이름..."
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    onClick={handleSaveScenario}
                    disabled={savingScenario || !scenarioName.trim()}
                    size="sm"
                  >
                    {savingScenario ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 차트 */}
            <RoasResultCharts
              simResult={simResult}
              coupons={coupons}
              adCost={adCost}
              etcCost={etcCost}
              scenarios={savedScenarios.map((s) => ({
                name: s.name,
                roas: s.results.roas,
                incrementalRoas: s.results.incremental_roas,
                totalRevenue: s.results.revenue,
                totalCost: s.results.total_cost,
              }))}
            />
          </>
        )}

        {/* 초기 안내 */}
        {!simResult && !perfData && (
          <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-12 text-center shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
            <p className="text-sm text-muted-foreground">
              좌측에서 지역과 존을 선택하고, 날짜 범위를 설정한 후 성능 매트릭스를 조회하세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
