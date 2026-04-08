"use client";

import type { ZoneMode } from "@/types/zone";

/** 모드별 범례 아이템 */
const LEGEND_ITEMS: Record<ZoneMode, Array<{ color: string; label: string }>> = {
  open: [
    { color: "#EF4444", label: "후보 지점" },
    { color: "#3B82F6", label: "운영 존" },
    { color: "#999999", label: "비운영 존" },
    { color: "#F59E0B", label: "주의 (잠식 위험)" },
  ],
  close: [
    { color: "#EF4444", label: "폐쇄 대상" },
    { color: "#3B82F6", label: "인근 존" },
    { color: "#22C55E", label: "수요 흡수" },
  ],
  compare: [
    { color: "#3B82F6", label: "비교 존 1" },
    { color: "#10B981", label: "비교 존 2" },
    { color: "#F59E0B", label: "비교 존 3" },
    { color: "#EF4444", label: "비교 존 4" },
    { color: "#8B5CF6", label: "비교 존 5" },
  ],
  optimize: [
    { color: "#3B82F6", label: "운영 존" },
    { color: "#EF4444", label: "폐쇄 권고" },
    { color: "#F59E0B", label: "재배치 대상" },
    { color: "#22C55E", label: "개설 후보" },
  ],
};

interface ZoneLegendProps {
  mode: ZoneMode;
}

/**
 * 지도 하단 좌측에 겹쳐 표시되는 범례.
 * 모드 전환 시 해당 모드의 마커 색상 설명을 보여준다.
 */
export function ZoneLegend({ mode }: ZoneLegendProps) {
  const items = LEGEND_ITEMS[mode];

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10">
      <div className="pointer-events-auto flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-border/60 bg-card/95 px-3 py-2 text-[11px] shadow-sm backdrop-blur-sm">
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
