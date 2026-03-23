"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "./period-filter";
import {
  type PeriodKey,
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
}

export function DashboardHeader({
  tab,
  period,
  onPeriodChange,
  onExportCsv,
  onExportXlsx,
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
  }

  return (
    <div className="flex flex-col gap-4 rounded-[1.75rem] border border-white/70 bg-white/75 px-5 py-4 shadow-[0_18px_50px_-34px_rgba(20,26,36,0.4)] backdrop-blur md:flex-row md:items-center md:justify-between">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="daily">일별</TabsTrigger>
          <TabsTrigger value="weekly">주차별</TabsTrigger>
          <TabsTrigger value="forecast">예측</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <PeriodFilter
          periods={tab === "weekly" ? WEEKLY_PERIODS : DAILY_PERIODS}
          active={period}
          onChange={onPeriodChange}
        />
        {tab !== "forecast" && (
          <>
            <div className="hidden h-5 w-px bg-border md:block" />
            <Button variant="outline" size="sm" onClick={onExportCsv}>
              <Download className="mr-1 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExportXlsx}>
              <Download className="mr-1 h-4 w-4" />
              Excel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
