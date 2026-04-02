"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PeriodKey, DateRange } from "@/lib/period-utils";
import { PERIOD_LABELS } from "@/lib/period-utils";
import type { DateRange as DayPickerDateRange } from "react-day-picker";

interface PeriodFilterProps {
  periods: PeriodKey[];
  active: PeriodKey;
  onChange: (p: PeriodKey) => void;
  onCustomRange?: (range: DateRange) => void;
  customRange?: DateRange;
}

export function PeriodFilter({ periods, active, onChange, onCustomRange, customRange }: PeriodFilterProps) {
  const [dateRange, setDateRange] = useState<DayPickerDateRange | undefined>(() => {
    if (customRange) {
      return {
        from: new Date(customRange.start + "T00:00:00"),
        to: new Date(customRange.end + "T00:00:00"),
      };
    }
    return undefined;
  });

  function handleDateSelect(range: DayPickerDateRange | undefined) {
    setDateRange(range);
    if (range?.from && range?.to && onCustomRange) {
      const toDateStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      onCustomRange({ start: toDateStr(range.from), end: toDateStr(range.to) });
    }
  }

  const formatRangeLabel = () => {
    if (!dateRange?.from) return "날짜 선택";
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    if (!dateRange.to) return fmt(dateRange.from);
    return `${fmt(dateRange.from)} - ${fmt(dateRange.to)}`;
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="기간 선택">
      {periods.map((p) => (
        <Button
          key={p}
          variant={active === p ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(p)}
          className="min-w-[72px]"
          aria-pressed={active === p}
        >
          {PERIOD_LABELS[p]}
        </Button>
      ))}
      {onCustomRange && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={active === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => onChange("custom")}
              className="min-w-[72px]"
              aria-pressed={active === "custom"}
            >
              <CalendarDays className="mr-1 h-3.5 w-3.5" />
              {active === "custom" ? formatRangeLabel() : "직접 선택"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
