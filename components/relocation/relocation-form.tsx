"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RelocationChart } from "./relocation-chart";
import { RelocationRecommendations } from "./relocation-recommendations";
import { RelocationTable } from "./relocation-table";
import { FUTURE_DAYS_OPTIONS, PAST_DAYS_OPTIONS } from "@/types/relocation";
import type { RelocationResult } from "@/types/relocation";

const REGION1_OPTIONS = [
  "전체",
  "서울특별시",
  "경기도",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

export function RelocationForm() {
  const [form, setForm] = useState({
    region1: "전체",
    pastDays: 14,
    futureDays: 7,
    weightUtil: 0.4,
    weightRev: 0.4,
    weightPre: 0.2,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RelocationResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/relocation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region1: form.region1,
          pastDays: form.pastDays,
          futureDays: form.futureDays,
          weights: {
            utilization: form.weightUtil,
            revenue: form.weightRev,
            prereservation: form.weightPre,
          },
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.errors?.join(" / ") ?? "알 수 없는 오류가 발생했습니다.");
        return;
      }

      setResult(data);
    } catch {
      setLoading(false);
      setError("네트워크 오류가 발생했습니다. 연결 상태를 확인해 주세요.");
    }
  }

  function handleWeightChange(field: "weightUtil" | "weightRev" | "weightPre", value: number) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      const others = (["weightUtil", "weightRev", "weightPre"] as const).filter((key) => key !== field);
      const othersSum = next[others[0]] + next[others[1]];
      const target = 1 - value;

      if (othersSum > 0) {
        next[others[0]] = parseFloat(((next[others[0]] / othersSum) * target).toFixed(2));
        next[others[1]] = parseFloat((target - next[others[0]]).toFixed(2));
      }

      return next;
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="h-fit border-border/60 bg-card/95 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.16)] xl:sticky xl:top-24">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">조회 파라미터</CardTitle>
          <p className="text-sm text-muted-foreground">
            조회 범위와 가중치를 조정해 재배치 우선순위를 확인합니다.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">권역 필터</label>
              <select
                className="h-11 w-full rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10"
                value={form.region1}
                onChange={(e) => setForm((current) => ({ ...current, region1: e.target.value }))}
              >
                {REGION1_OPTIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">과거 실적 기간</label>
              <div className="grid grid-cols-3 gap-2">
                {PAST_DAYS_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, pastDays: days }))}
                    className={`rounded-2xl border px-2 py-2 text-xs transition-colors ${
                      form.pastDays === days
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/70 bg-background hover:bg-muted/50"
                    }`}
                  >
                    {days}일
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">사전예약 조회</label>
              <div className="grid grid-cols-3 gap-2">
                {FUTURE_DAYS_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, futureDays: days }))}
                    className={`rounded-2xl border px-2 py-2 text-xs transition-colors ${
                      form.futureDays === days
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/70 bg-background hover:bg-muted/50"
                    }`}
                  >
                    +{days}일
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">
                가중치 합계 {(form.weightUtil + form.weightRev + form.weightPre).toFixed(2)}
              </label>
              {[
                { key: "weightUtil" as const, label: "가동률", value: form.weightUtil },
                { key: "weightRev" as const, label: "매출", value: form.weightRev },
                { key: "weightPre" as const, label: "사전예약", value: form.weightPre },
              ].map(({ key, label, value }) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{label}</span>
                    <span>{value.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={value}
                    onChange={(e) => handleWeightChange(key, parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            <Button type="submit" className="h-11 w-full rounded-2xl" disabled={loading}>
              {loading ? "조회 중..." : "조회 실행"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-5">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <Card className="border-border/60 bg-card/95 shadow-[0_20px_50px_-40px_rgba(20,26,36,0.16)]">
            <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
              BigQuery에서 재배치 점수를 계산하고 있습니다. 보통 10~30초 정도 걸립니다.
            </CardContent>
          </Card>
        )}

        {!loading && !result && !error && (
          <Card className="border-border/60 bg-card/95 shadow-[0_20px_50px_-40px_rgba(20,26,36,0.16)]">
            <CardContent className="space-y-3 px-6 py-10">
              <p className="text-base font-semibold text-foreground">재배치 결과가 여기에 표시됩니다.</p>
              <p className="text-sm leading-6 text-muted-foreground">
                과거 실적 기간과 미래 예약 기간을 고른 뒤 조회하면 점수표, 차트, 이동 추천을 함께 확인할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        )}

        {result && !loading && (
          <>
            <Card className="border-border/60 bg-card/95 shadow-[0_20px_50px_-40px_rgba(20,26,36,0.16)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">권역 점수표</CardTitle>
                <p className="text-sm text-muted-foreground">
                  가동률, 매출, 사전예약 반영 후 계산된 종합 점수입니다.
                </p>
              </CardHeader>
              <CardContent>
                <RelocationTable rows={result.rows} />
              </CardContent>
            </Card>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <Card className="border-border/60 bg-card/95 shadow-[0_20px_50px_-40px_rgba(20,26,36,0.16)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">점수 분포</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    종합 점수를 그래프로 비교해 상하위 권역을 빠르게 확인합니다.
                  </p>
                </CardHeader>
                <CardContent className="rounded-[1.5rem] border border-border/60 bg-background/60 p-4">
                  <RelocationChart rows={result.rows} />
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/95 shadow-[0_20px_50px_-40px_rgba(20,26,36,0.16)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">이동 추천</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    점수 차이를 기준으로 이동 권장 수량과 차량 후보를 제안합니다.
                  </p>
                </CardHeader>
                <CardContent>
                  <RelocationRecommendations
                    recommendations={result.recommendations}
                    pastDays={form.pastDays}
                  />
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground">
              조회 시각: {new Date(result.fetchedAt).toLocaleString("ko-KR")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
