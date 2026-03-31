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
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)} className="rounded-2xl text-xs">
        {open ? (
          <>
            <ChevronDown className="mr-1 h-3 w-3" />
            점수 산식 접기
          </>
        ) : (
          <>
            <ChevronRight className="mr-1 h-3 w-3" />
            점수 산식 보기
          </>
        )}
      </Button>

      {open && (
        <div className="mt-4 space-y-4 rounded-[1.5rem] border border-border/60 bg-card/95 p-5 text-sm">
          <div className="rounded-2xl border border-blue-200/70 bg-blue-50/80 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
            <p className="mb-1 font-semibold text-foreground">배분 철학</p>
            <p className="text-xs leading-6 text-muted-foreground">
              현재 수치가 높은 곳만 보는 방식이 아니라, 전년 동기 대비 성장 흐름을 함께 반영해 다음 시즌에
              더 좋아질 가능성이 높은 권역에 우선 배분하는 구조입니다.
            </p>
          </div>

          <div>
            <p className="mb-2 font-semibold text-foreground">산식 흐름</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-6 text-muted-foreground">
              <li>기준일 기준 직전 90일과 전년 동기 90일을 비교합니다.</li>
              <li>동일 모델 우선, 부족하면 동일 세그먼트, 마지막으로 보완 기준을 참조합니다.</li>
              <li>매출 YoY와 가동률 YoY를 0.5~2.0 범위에서 정리합니다.</li>
              <li>극단값을 완화한 뒤 0~1 범위로 정규화합니다.</li>
              <li>가동률 가중치와 매출 가중치를 섞어 최종 점수를 계산합니다.</li>
              <li>최종 점수 순으로 배분 대수를 배정합니다.</li>
            </ol>
          </div>

          <div>
            <p className="mb-1 font-semibold text-foreground">
              민감도 분석
              {spearman !== null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  S1-S5 Spearman 상관계수: {spearman}
                </span>
              )}
            </p>
            <p className="mb-3 text-xs leading-6 text-muted-foreground">
              가중치 변화에 따라 순위가 얼마나 흔들리는지 확인할 수 있습니다.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/55 text-muted-foreground">
                    <th className="border-b border-border/60 px-2 py-2 text-left">권역</th>
                    <th className="border-b border-border/60 px-2 py-2 text-left">세부 존</th>
                    {ALPHA_SCORE_MAP.map(({ label, alpha }) => (
                      <th
                        key={label}
                        className={`border-b border-border/60 px-2 py-2 text-right ${
                          alpha === 0.5 ? "bg-blue-100/60 dark:bg-blue-950/40" : ""
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                    <th className="border-b border-border/60 px-2 py-2 text-right">순위 α=0.3</th>
                    <th className="border-b border-border/60 px-2 py-2 text-right">순위 α=0.7</th>
                    <th className="border-b border-border/60 px-2 py-2 text-right">순위 차이</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const diff = Math.abs(row.rank_s1 - row.rank_s5);
                    const diffColor =
                      diff >= 5
                        ? "text-red-600 dark:text-red-300 font-bold"
                        : diff >= 3
                          ? "text-amber-600 dark:text-amber-300"
                          : "text-green-600 dark:text-green-300";

                    return (
                      <tr key={`${row.region1}-${row.region2}-${index}`} className="hover:bg-muted/25">
                        <td className="border-b border-border/60 px-2 py-2">{row.region1}</td>
                        <td className="border-b border-border/60 px-2 py-2">{row.region2}</td>
                        {ALPHA_SCORE_MAP.map(({ key, alpha }) => (
                          <td
                            key={key}
                            className={`border-b border-border/60 px-2 py-2 text-right ${
                              alpha === 0.5 ? "bg-blue-50/60 dark:bg-blue-950/20" : ""
                            }`}
                          >
                            {row[key].toFixed(3)}
                          </td>
                        ))}
                        <td className="border-b border-border/60 px-2 py-2 text-right">{row.rank_s1}</td>
                        <td className="border-b border-border/60 px-2 py-2 text-right">{row.rank_s5}</td>
                        <td className={`border-b border-border/60 px-2 py-2 text-right ${diffColor}`}>{diff}</td>
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
