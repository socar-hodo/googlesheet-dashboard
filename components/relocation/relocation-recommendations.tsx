"use client";

import { useState } from "react";
import type { RelocationRecommendation, RelocationCarCandidate } from "@/types/relocation";
import { ArrowRight, ChevronDown, ChevronUp, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  recommendations: RelocationRecommendation[];
}

interface CardState {
  open: boolean;
  loading: boolean;
  candidates: RelocationCarCandidate[] | null;
  error: string | null;
}

export function RelocationRecommendations({ recommendations }: Props) {
  const [cardStates, setCardStates] = useState<Record<number, CardState>>({});

  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        추천할 재배치 경로가 없습니다.
      </p>
    );
  }

  async function toggleCandidates(idx: number, fromZone: string) {
    const current = cardStates[idx];

    // 이미 초기화된 카드(조회한 적 있음): 열기/닫기 토글
    if (current !== undefined) {
      setCardStates((s) => ({ ...s, [idx]: { ...current, open: !current.open } }));
      return;
    }

    // 최초 조회
    setCardStates((s) => ({
      ...s,
      [idx]: { open: true, loading: true, candidates: null, error: null },
    }));

    try {
      const res = await fetch("/api/relocation/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones: [fromZone] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCardStates((s) => ({
          ...s,
          [idx]: { open: true, loading: false, candidates: null, error: data.errors?.[0] ?? "조회 실패" },
        }));
      } else {
        setCardStates((s) => ({
          ...s,
          [idx]: { open: true, loading: false, candidates: data.candidates, error: null },
        }));
      }
    } catch {
      setCardStates((s) => ({
        ...s,
        [idx]: { open: true, loading: false, candidates: null, error: "네트워크 오류" },
      }));
    }
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec, i) => {
        const state = cardStates[i];
        const isOpen = state?.open ?? false;

        return (
          <div key={i} className="rounded-xl border bg-card text-sm overflow-hidden">
            {/* 추천 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground">{rec.fromRegion1}</span>
                <span className="font-semibold text-red-600 dark:text-red-400 truncate">{rec.fromZone}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground">{rec.toRegion1}</span>
                <span className="font-semibold text-green-600 dark:text-green-400 truncate">{rec.toZone}</span>
              </div>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <span className="font-medium">{rec.carCount}대 이동 권장</span>
                {rec.sameRegion && (
                  <Badge variant="secondary" className="text-xs">동일 시/도</Badge>
                )}
                <button
                  onClick={() => toggleCandidates(i, rec.fromZone)}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors"
                  title="차량 후보 보기"
                >
                  <Car className="h-3 w-3" />
                  차량
                  {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            </div>

            {/* 차량 후보 패널 */}
            {isOpen && (
              <div className="border-t bg-muted/30 px-4 py-3">
                {state?.loading && (
                  <p className="text-xs text-muted-foreground">차량 목록 조회 중…</p>
                )}
                {state?.error && (
                  <p className="text-xs text-red-500">{state.error}</p>
                )}
                {state?.candidates && (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">
                      {rec.fromZone} 현재 배치 차량 ({state.candidates.length}대)
                    </p>
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b">
                            <th className="text-left pb-1 font-medium">차량번호</th>
                            <th className="text-left pb-1 font-medium">모델</th>
                            <th className="text-left pb-1 font-medium">차량 ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.candidates.map((c) => (
                            <tr key={c.carId} className="border-b border-muted last:border-0">
                              <td className="py-1 font-medium">{c.carNum}</td>
                              <td className="py-1 text-muted-foreground">{c.carName}</td>
                              <td className="py-1 text-muted-foreground">{c.carId}</td>
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
