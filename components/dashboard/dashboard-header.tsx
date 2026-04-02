"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PeriodFilter } from "./period-filter";
import {
  type PeriodKey,
  type DateRange,
  DAILY_PERIODS,
  WEEKLY_PERIODS,
  DEFAULT_DAILY_PERIOD,
  DEFAULT_WEEKLY_PERIOD,
} from "@/lib/period-utils";

interface DashboardHeaderProps {
  tab: "daily" | "weekly" | "forecast";
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onCustomRange?: (range: DateRange) => void;
  customRange?: DateRange;
}

export function DashboardHeader({
  tab,
  period,
  onPeriodChange,
  onExportCsv,
  onExportXlsx,
  onCustomRange,
  customRange,
}: DashboardHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    params.set(
      "period",
      value === "weekly" ? DEFAULT_WEEKLY_PERIOD : DEFAULT_DAILY_PERIOD
    );
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    const tabLabels: Record<string, string> = { daily: "일별", weekly: "주차별", forecast: "예측" };
    toast.info(`${tabLabels[value] ?? value} 탭으로 전환 — 기간이 초기화되었습니다.`, { duration: 2000 });
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-card/75 px-5 py-4 shadow-[var(--shadow-card,0_18px_44px_-34px_rgba(20,26,36,0.28))] backdrop-blur md:flex-row md:items-center md:justify-between">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="daily">일별</TabsTrigger>
          <TabsTrigger value="weekly">주차별</TabsTrigger>
          <TabsTrigger value="forecast">예측</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Desktop: inline filters */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <PeriodFilter
          periods={tab === "weekly" ? WEEKLY_PERIODS : DAILY_PERIODS}
          active={period}
          onChange={onPeriodChange}
          onCustomRange={tab !== "weekly" ? onCustomRange : undefined}
          customRange={customRange}
        />
        {tab !== "forecast" && (
          <>
            <div className="h-5 w-px bg-border" />
            <Button variant="outline" size="sm" onClick={onExportCsv} aria-label="CSV로 내보내기">
              <Download className="mr-1 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExportXlsx} aria-label="Excel로 내보내기">
              <Download className="mr-1 h-4 w-4" />
              Excel
            </Button>
          </>
        )}
      </div>

      {/* Mobile: Sheet filter panel */}
      <div className="flex items-center gap-2 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="mr-1 h-4 w-4" />
              필터
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>필터 및 내보내기</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">기간 선택</p>
                <PeriodFilter
                  periods={tab === "weekly" ? WEEKLY_PERIODS : DAILY_PERIODS}
                  active={period}
                  onChange={onPeriodChange}
                />
              </div>
              {tab !== "forecast" && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">내보내기</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onExportCsv} aria-label="CSV로 내보내기">
                      <Download className="mr-1 h-4 w-4" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={onExportXlsx} aria-label="Excel로 내보내기">
                      <Download className="mr-1 h-4 w-4" />
                      Excel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
