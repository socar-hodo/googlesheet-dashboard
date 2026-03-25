// components/relocation/relocation-form.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RelocationTable } from "./relocation-table";
import { RelocationChart } from "./relocation-chart";
import { RelocationRecommendations } from "./relocation-recommendations";
import { PAST_DAYS_OPTIONS, FUTURE_DAYS_OPTIONS } from "@/types/relocation";
import type { RelocationResult } from "@/types/relocation";

const REGION1_OPTIONS = ["전체", "서울특별시", "경기도", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도"];

export function RelocationForm() {
  const [form, setForm] = useState({
    region1:    "전체",
    pastDays:   14,
    futureDays: 7,
    weightUtil: 0.4,
    weightRev:  0.4,
    weightPre:  0.2,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<RelocationResult | null>(null);

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
          region1:    form.region1,
          pastDays:   form.pastDays,
          futureDays: form.futureDays,
          weights: {
            utilization:    form.weightUtil,
            revenue:        form.weightRev,
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
      setError("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
    }
  }

  // 가중치 슬라이더: 변경된 값에 맞게 나머지 두 값을 비례 조정
  function handleWeightChange(field: "weightUtil" | "weightRev" | "weightPre", value: number) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      const others = (["weightUtil", "weightRev", "weightPre"] as const).filter((k) => k !== field);
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
    <div className="flex gap-6">
      {/* 좌측: 필터 패널 */}
      <div className="w-72 shrink-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">조회 파라미터</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">지역 필터</label>
                <select
                  className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.region1}
                  onChange={(e) => setForm((f) => ({ ...f, region1: e.target.value }))}
                >
                  {REGION1_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">과거 실적 기간</label>
                <div className="flex gap-2">
                  {PAST_DAYS_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, pastDays: d }))}
                      className={`flex-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                        form.pastDays === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {d}일
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">사전예약 조회</label>
                <div className="flex gap-2">
                  {FUTURE_DAYS_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, futureDays: d }))}
                      className={`flex-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                        form.futureDays === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      향후 {d}일
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  가중치 (합계: {(form.weightUtil + form.weightRev + form.weightPre).toFixed(2)})
                </label>
                {[
                  { key: "weightUtil" as const, label: "α 가동률",   value: form.weightUtil },
                  { key: "weightRev"  as const, label: "β 매출",     value: form.weightRev  },
                  { key: "weightPre"  as const, label: "γ 사전예약", value: form.weightPre  },
                ].map(({ key, label, value }) => (
                  <div key={key} className="space-y-0.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "조회 중…" : "조회 실행"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 우측: 결과 */}
      <div className="flex-1 min-w-0 space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-md border bg-muted/50 p-8 text-center text-sm text-muted-foreground">
            BigQuery 조회 중입니다… (약 10~30초 소요)
          </div>
        )}

        {result && !loading && (
          <>
            <div>
              <h2 className="text-base font-semibold mb-2">존별 스코어</h2>
              <RelocationTable rows={result.rows} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="text-base font-semibold mb-2">스코어 비교</h2>
                <div className="rounded-xl border bg-card p-4">
                  <RelocationChart rows={result.rows} />
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-2">재배치 추천</h2>
                <RelocationRecommendations recommendations={result.recommendations} pastDays={form.pastDays} />
              </div>
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
