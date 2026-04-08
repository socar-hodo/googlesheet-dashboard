"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ZoneMode } from "@/types/zone";

const MODE_LABELS: Record<string, string> = {
  open: "개설 검토",
  close: "폐쇄 검토",
  compare: "존 비교",
  optimize: "최적화",
};

interface SlackReportDialogProps {
  mode: ZoneMode;
  data: Record<string, unknown> | null;
  children: React.ReactNode;
}

/**
 * Slack 리포트 발송 확인 다이얼로그.
 *
 * 발송 전 확인 단계를 거쳐 POST /api/zone/report을 호출한다.
 */
export function SlackReportDialog({ mode, data, children }: SlackReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!data) return;
    setSending(true);
    try {
      const res = await fetch("/api/zone/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, data }),
      });
      if (!res.ok) throw new Error();
      toast.success("Slack으로 발송되었습니다.");
      setOpen(false);
    } catch {
      toast.error("Slack 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Slack 리포트 발송</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <strong>{MODE_LABELS[mode] ?? mode}</strong> 분석 결과를 Slack 채널로 발송합니다.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            취소
          </Button>
          <Button onClick={handleSend} disabled={sending || !data}>
            {sending ? "발송 중..." : "발송"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
