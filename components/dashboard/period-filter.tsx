"use client";

import { Button } from "@/components/ui/button";
import type { PeriodKey } from "@/lib/period-utils";
import { PERIOD_LABELS } from "@/lib/period-utils";

interface PeriodFilterProps {
  periods: PeriodKey[];
  active: PeriodKey;
  onChange: (p: PeriodKey) => void;
}

export function PeriodFilter({ periods, active, onChange }: PeriodFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {periods.map((p) => (
        <Button
          key={p}
          variant={active === p ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(p)}
          className="min-w-[72px]"
        >
          {PERIOD_LABELS[p]}
        </Button>
      ))}
    </div>
  );
}
