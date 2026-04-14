"use client";

import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PRESETS = [
  { label: "4주", value: 4 },
  { label: "8주", value: 8 },
  { label: "12주", value: 12 },
] as const;

interface FunnelHeaderProps {
  weeks: number;
  onWeeksChange: (w: number) => void;
  drillRegion: string | null;
  onBack: () => void;
  loading?: boolean;
}

export function FunnelHeader({
  weeks,
  onWeeksChange,
  drillRegion,
  onBack,
  loading,
}: FunnelHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {drillRegion && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" /> 전국
          </Button>
        )}
        <h1 className="text-lg font-bold tracking-tight">전환율 퍼널</h1>
        <Badge variant="secondary" className="text-xs">
          {drillRegion ?? "전국"}
        </Badge>
        {loading && (
          <span className="text-xs text-muted-foreground animate-pulse">
            로딩중...
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            variant={weeks === p.value ? "default" : "outline"}
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => onWeeksChange(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
