'use client';

// 기간 토글 버튼 UI — 활성 기간은 default, 비활성은 outline 버튼으로 표시
import { Button } from '@/components/ui/button';
import type { PeriodKey } from '@/lib/period-utils';
import { PERIOD_LABELS } from '@/lib/period-utils';

interface PeriodFilterProps {
  periods: PeriodKey[];
  active: PeriodKey;
  onChange: (p: PeriodKey) => void;
}

/** 기간 선택 버튼 그룹 — 활성 버튼은 default, 나머지는 outline */
export function PeriodFilter({ periods, active, onChange }: PeriodFilterProps) {
  return (
    <div className="flex gap-1">
      {periods.map((p) => (
        <Button
          key={p}
          variant={active === p ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(p)}
        >
          {PERIOD_LABELS[p]}
        </Button>
      ))}
    </div>
  );
}
