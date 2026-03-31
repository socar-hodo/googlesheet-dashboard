"use client";

import { useState } from "react";
import type { RelocationCarCandidate, RelocationRecommendation } from "@/types/relocation";
import { ArrowRight, Car, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  recommendations: RelocationRecommendation[];
  pastDays: number;
}

interface CardState {
  open: boolean;
  loading: boolean;
  candidates: RelocationCarCandidate[] | null;
  error: string | null;
}

export function RelocationRecommendations({ recommendations, pastDays }: Props) {
  const [cardStates, setCardStates] = useState<Record<number, CardState>>({});

  if (recommendations.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">추천할 이동 경로가 없습니다.</p>;
  }

  async function toggleCandidates(index: number, fromZone: string, limit: number) {
    const current = cardStates[index];

    if (current !== undefined) {
      setCardStates((state) => ({ ...state, [index]: { ...current, open: !current.open } }));
      return;
    }

    setCardStates((state) => ({
      ...state,
      [index]: { open: true, loading: true, candidates: null, error: null },
    }));

    try {
      const res = await fetch("/api/relocation/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones: [fromZone], limit, pastDays }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCardStates((state) => ({
          ...state,
          [index]: {
            open: true,
            loading: false,
            candidates: null,
            error: data.errors?.[0] ?? "차량 후보를 불러오지 못했습니다.",
          },
        }));
      } else {
        setCardStates((state) => ({
          ...state,
          [index]: {
            open: true,
            loading: false,
            candidates: data.candidates,
            error: null,
          },
        }));
      }
    } catch {
      setCardStates((state) => ({
        ...state,
        [index]: {
          open: true,
          loading: false,
          candidates: null,
          error: "네트워크 오류가 발생했습니다.",
        },
      }));
    }
  }

  return (
    <div className="space-y-3">
      {recommendations.map((recommendation, index) => {
        const state = cardStates[index];
        const isOpen = state?.open ?? false;

        return (
          <div key={index} className="overflow-hidden rounded-[1.35rem] border border-border/60 bg-background/65 text-sm">
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">{recommendation.fromRegion1}</span>
                <p className="truncate font-semibold text-red-600 dark:text-red-300">{recommendation.fromZone}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">{recommendation.toRegion1}</span>
                <p className="truncate font-semibold text-green-600 dark:text-green-300">{recommendation.toZone}</p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <span className="font-medium">{recommendation.carCount}대 이동 권장</span>
                {recommendation.sameRegion && (
                  <Badge variant="secondary" className="text-xs">
                    동일 권역
                  </Badge>
                )}
                <button
                  onClick={() => toggleCandidates(index, recommendation.fromZone, recommendation.carCount)}
                  className="flex items-center gap-1 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs transition-colors hover:bg-muted/50"
                  title="차량 후보 보기"
                >
                  <Car className="h-3 w-3" />
                  차량 후보
                  {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
                {state?.loading && <p className="text-xs text-muted-foreground">차량 후보를 조회하는 중입니다.</p>}
                {state?.error && <p className="text-xs text-red-500">{state.error}</p>}
                {state?.candidates && (
                  <>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {recommendation.fromZone}에서 가동률이 낮은 차량 {state.candidates.length}대를 기준으로 추렸습니다.
                      최근 {pastDays}일 데이터 기준입니다.
                    </p>
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/60 text-muted-foreground">
                            <th className="pb-1 text-left font-medium">차량번호</th>
                            <th className="pb-1 text-left font-medium">모델명</th>
                            <th className="pb-1 text-right font-medium">가동률</th>
                            <th className="pb-1 text-left font-medium">차량 ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.candidates.map((candidate) => (
                            <tr key={candidate.carId} className="border-b border-border/40 last:border-0">
                              <td className="py-1 font-medium">{candidate.carNum}</td>
                              <td className="py-1 text-muted-foreground">{candidate.carName}</td>
                              <td className="py-1 text-right">
                                {candidate.utilRate != null ? (
                                  <span className="text-red-500 dark:text-red-300">
                                    {(candidate.utilRate * 100).toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="py-1 text-muted-foreground">{candidate.carId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
