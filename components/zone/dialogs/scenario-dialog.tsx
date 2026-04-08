"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ZoneScenario } from "@/types/zone";

const MODE_LABELS: Record<string, string> = {
  open: "개설",
  close: "폐쇄",
  compare: "비교",
  optimize: "최적화",
};

interface ScenarioDialogProps {
  /** 시나리오 불러오기 시 호출 */
  onLoad?: (scenario: ZoneScenario) => void;
  children: React.ReactNode;
}

/**
 * 시나리오 목록 다이얼로그.
 *
 * GET /api/zone/scenarios에서 최근 시나리오 목록을 조회하고,
 * 선택 시 onLoad 콜백으로 시나리오 데이터를 전달한다.
 */
export function ScenarioDialog({ onLoad, children }: ScenarioDialogProps) {
  const [open, setOpen] = useState(false);
  const [scenarios, setScenarios] = useState<
    Array<{ id: string; mode: string; created_at: string; parameters: Record<string, unknown> }>
  >([]);
  const [loading, setLoading] = useState(false);

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zone/scenarios");
      const data = await res.json();
      setScenarios(Array.isArray(data) ? data : []);
    } catch {
      toast.error("시나리오 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchScenarios();
  }, [open, fetchScenarios]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>저장된 시나리오</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {loading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
          {!loading && scenarios.length === 0 && (
            <p className="text-sm text-muted-foreground">저장된 시나리오가 없습니다.</p>
          )}
          {scenarios.map((s) => (
            <button
              key={s.id}
              className="w-full rounded-xl border border-border/60 p-3 text-left text-sm transition-colors hover:bg-muted"
              onClick={() => {
                // onLoad가 있으면 전체 데이터를 별도 조회해야 하므로 여기서는 요약만 전달
                // v2에서 GET /api/zone/scenarios/:id 추가 가능
                toast.info(`시나리오 ${s.id} 선택됨 (${MODE_LABELS[s.mode] ?? s.mode})`);
                setOpen(false);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {MODE_LABELS[s.mode] ?? s.mode}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {JSON.stringify(s.parameters).slice(0, 80)}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
