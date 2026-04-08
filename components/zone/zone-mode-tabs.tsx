"use client";

import type { ZoneMode } from "@/types/zone";

const MODES: { value: ZoneMode; label: string; color: string }[] = [
  { value: "open", label: "개설", color: "text-blue-600" },
  { value: "close", label: "폐쇄", color: "text-red-600" },
  { value: "compare", label: "비교", color: "text-purple-600" },
  { value: "optimize", label: "최적화", color: "text-emerald-600" },
];

interface ZoneModeTabsProps {
  activeMode: ZoneMode;
  onChange: (mode: ZoneMode) => void;
}

/**
 * 4개 모드 탭.
 * 활성 탭은 foreground 배경, 비활성은 hover:bg-muted.
 * allocation-form.tsx의 라디오 그룹 패턴을 따른다.
 */
export function ZoneModeTabs({ activeMode, onChange }: ZoneModeTabsProps) {
  return (
    <div
      className="flex overflow-hidden rounded-2xl border border-border/70"
      role="tablist"
      aria-label="시뮬레이터 모드"
    >
      {MODES.map((mode, i) => (
        <button
          key={mode.value}
          type="button"
          role="tab"
          aria-selected={activeMode === mode.value}
          className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
            i > 0 ? "border-l border-border/70" : ""
          } ${
            activeMode === mode.value
              ? "bg-foreground text-background"
              : "hover:bg-muted"
          }`}
          onClick={() => onChange(mode.value)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
