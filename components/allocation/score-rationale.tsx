"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALPHA_SCORE_MAP } from "@/types/allocation";
import type { AllocationRow } from "@/types/allocation";

interface ScoreRationaleProps {
  rows: AllocationRow[];
  spearman: number | null;
}

export function ScoreRationale({ rows, spearman }: ScoreRationaleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="text-xs"
      >
        {open
          ? <><ChevronDown className="mr-1 h-3 w-3" />점수 산출 근거 닫기</>
          : <><ChevronRight className="mr-1 h-3 w-3" />점수 산출 근거 보기</>
        }
      </Button>

      {open && (
        <div className="mt-3 rounded-lg border p-4 text-sm space-y-4">
          {/* 배분 철학 */}
          <div className="rounded-md border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950 p-3">
            <p className="font-semibold mb-1">배분 철학</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              신차를 <em>&quot;지금 잘 팔리는 곳&quot;</em>이 아닌 <em>&quot;성장하고 있는 곳&quot;</em>에 배분합니다.
              현재 수익·가동률의 절대값 대신 <strong>전년 동기 대비 성장률(YoY)</strong>을 기준으로 삼아,
              시장이 확대되는 지역에 우선 공급합니다.
            </p>
          </div>

          {/* 7단계 프로세스 */}
          <div>
            <p className="font-semibold mb-2">산출 단계</p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
              <li><strong className="text-foreground">데이터 기간</strong> — 기준일 직전 90일 vs 전년 동기 90일 (계절성 제거)</li>
              <li><strong className="text-foreground">참조 기준 결정</strong> — 해당 차종 5대↑ → <span className="rounded bg-green-100 dark:bg-green-900 px-1">model</span>, 동일 세그먼트 5대↑ → <span className="rounded bg-blue-100 dark:bg-blue-900 px-1">segment</span>, 그 외 → <span className="rounded bg-yellow-100 dark:bg-yellow-900 px-1">fallback</span>(전국 평균)</li>
              <li><strong className="text-foreground">YoY 계산</strong> — 데이터 30일 미만이면 1.0(중립), 0.5~2.0 클리핑</li>
              <li><strong className="text-foreground">원점수</strong> — 대당수익 × 수익YoY, 가동률 × 가동률YoY</li>
              <li><strong className="text-foreground">윈저라이징</strong> — 상·하위 5% 극단값 제거</li>
              <li><strong className="text-foreground">Min-Max 정규화</strong> — 0~1 스케일 (단위 차이 제거)</li>
              <li><strong className="text-foreground">최종 점수</strong> — α×수익<sub>정규화</sub> + (1-α)×가동률<sub>정규화</sub> → 점수 비례 배분</li>
            </ol>
          </div>

          {/* 민감도 테이블 */}
          <div>
            <p className="font-semibold mb-1">
              민감도 분석
              {spearman !== null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  S1-S5 스피어만 상관계수: {spearman}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              순위차 ≥5는 빨강, ≥3은 주황 — 가중치 선택에 민감한 지역입니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="border px-2 py-1 text-left">시/도</th>
                    <th className="border px-2 py-1 text-left">시/군/구</th>
                    {ALPHA_SCORE_MAP.map(({ label, alpha }) => (
                      <th
                        key={label}
                        className={`border px-2 py-1 text-right ${alpha === 0.5 ? "bg-blue-100 dark:bg-blue-900" : ""}`}
                      >
                        {label}
                      </th>
                    ))}
                    <th className="border px-2 py-1 text-right">순위 α=0.3</th>
                    <th className="border px-2 py-1 text-right">순위 α=0.7</th>
                    <th className="border px-2 py-1 text-right">순위차</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const diff = Math.abs(r.rank_s1 - r.rank_s5);
                    const diffColor =
                      diff >= 5 ? "text-red-600 font-bold" :
                      diff >= 3 ? "text-orange-500" :
                      "text-green-600";
                    return (
                      <tr key={i} className="hover:bg-muted/50">
                        <td className="border px-2 py-1">{r.region1}</td>
                        <td className="border px-2 py-1">{r.region2}</td>
                        {ALPHA_SCORE_MAP.map(({ key, alpha }) => (
                          <td
                            key={key}
                            className={`border px-2 py-1 text-right ${alpha === 0.5 ? "bg-blue-50 dark:bg-blue-950" : ""}`}
                          >
                            {r[key].toFixed(3)}
                          </td>
                        ))}
                        <td className="border px-2 py-1 text-right">{r.rank_s1}</td>
                        <td className="border px-2 py-1 text-right">{r.rank_s5}</td>
                        <td className={`border px-2 py-1 text-right ${diffColor}`}>{diff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
