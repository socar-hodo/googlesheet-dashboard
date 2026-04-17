"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type {
  DailyRecord,
  TeamDashboardData,
  WeeklyRecord,
} from "@/types/dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableProps {
  data: TeamDashboardData;
  tab: "daily" | "weekly";
}

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

function formatCurrency(value: number): string {
  return `₩${Math.round(value / 10000).toLocaleString()}만`;
}

function formatRevenuePerCar(value: number): string {
  return `₩${Math.round(value).toLocaleString()}원`;
}

function formatHoursPerCar(hours: number): string {
  return `${hours.toFixed(1)}시간`;
}

function formatCountPerCar(count: number): string {
  return `${count.toFixed(1)}건`;
}

function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

function calcGpm(profit: number, revenue: number): number {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

function formatGpm(gpm: number): string {
  return `${gpm.toFixed(1)}%`;
}

function formatGpmTrend(current: number, prev: number | null): string {
  if (prev === null) return "-";
  const delta = current - prev;
  if (Math.abs(delta) < 0.05) return "-";
  return `${delta > 0 ? "↑" : "↓"}${Math.abs(delta).toFixed(1)}%p`;
}

function gpmTrendClass(current: number, prev: number | null): string {
  if (prev === null) return "";
  const delta = current - prev;
  if (Math.abs(delta) < 0.05) return "";
  return delta > 0 ? "text-blue-600 dark:text-blue-300" : "text-rose-600 dark:text-rose-300";
}

/** Sortable column header */
function SortableHead({
  children,
  column,
  sort,
  onSort,
  className,
}: {
  children: React.ReactNode;
  column: string;
  sort: SortState;
  onSort: (col: string) => void;
  className?: string;
}) {
  const active = sort.column === column;
  return (
    <TableHead
      scope="col"
      className={cn("cursor-pointer select-none", className)}
      onClick={() => onSort(column)}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && sort.direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : active && sort.direction === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </TableHead>
  );
}

function useSort() {
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });

  const handleSort = useCallback((col: string) => {
    setSort((prev) => {
      if (prev.column !== col) return { column: col, direction: "asc" };
      if (prev.direction === "asc") return { column: col, direction: "desc" };
      return { column: null, direction: null };
    });
  }, []);

  return { sort, handleSort };
}

/** Detects horizontal scroll to show/hide right fade indicator */
function useScrollIndicator() {
  const ref = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    };

    check();
    el.addEventListener("scroll", check, { passive: true });
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      observer.disconnect();
    };
  }, []);

  return { ref, atEnd };
}

function DailyTable({ records }: { records: DailyRecord[] }) {
  const { sort, handleSort } = useSort();
  const { ref: scrollRef, atEnd } = useScrollIndicator();

  const gpms = useMemo(() => records.map((r) => calcGpm(r.profit, r.revenue)), [records]);

  const sortedIndices = useMemo(() => {
    const indices = records.map((_, i) => i);
    if (!sort.column || !sort.direction) return indices;

    const getValue = (i: number): number | string => {
      const r = records[i];
      switch (sort.column) {
        case "date": return r.date;
        case "revenue": return r.revenue;
        case "revenuePerCar": return r.revenuePerCar;
        case "gpm": return gpms[i];
        case "usageHoursPerCar": return r.usageHoursPerCar;
        case "usageCountPerCar": return r.usageCountPerCar;
        case "utilizationRate": return r.utilizationRate;
        default: return 0;
      }
    };

    indices.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort.direction === "asc" ? cmp : -cmp;
    });

    return indices;
  }, [records, gpms, sort]);

  const sumRevenue = records.reduce((acc, r) => acc + r.revenue, 0);
  const sumProfit = records.reduce((acc, r) => acc + r.profit, 0);

  const len = records.length;
  const avgRevenue = len > 0 ? sumRevenue / len : 0;
  const avgRevenuePerCar = len > 0 ? records.reduce((a, r) => a + r.revenuePerCar, 0) / len : 0;
  const avgUsageHoursPerCar = len > 0 ? records.reduce((a, r) => a + r.usageHoursPerCar, 0) / len : 0;
  const avgUsageCountPerCar = len > 0 ? records.reduce((a, r) => a + r.usageCountPerCar, 0) / len : 0;
  const avgUtilization =
    len > 0
      ? records.reduce((acc, r) => acc + r.utilizationRate, 0) / len
      : 0;
  const totalGpm = calcGpm(sumProfit, sumRevenue);
  const avgGpm = len > 0 ? gpms.reduce((a, b) => a + b, 0) / len : 0;

  return (
    <div ref={scrollRef} data-scroll-end={String(atEnd)} className="table-scroll-container relative max-h-[70vh] overflow-auto rounded-3xl border border-border/60 bg-card/80 p-2 shadow-[var(--shadow-card,0_18px_44px_-34px_rgba(20,26,36,0.28))] backdrop-blur">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          <TableRow>
            <SortableHead column="date" sort={sort} onSort={handleSort} className="text-left">날짜</SortableHead>
            <SortableHead column="revenue" sort={sort} onSort={handleSort} className="text-right">매출</SortableHead>
            <SortableHead column="revenuePerCar" sort={sort} onSort={handleSort} className="text-right">대당 매출</SortableHead>
            <SortableHead column="gpm" sort={sort} onSort={handleSort} className="text-right">GPM</SortableHead>
            <TableHead scope="col" className="text-right">GPM 추이</TableHead>
            <SortableHead column="usageHoursPerCar" sort={sort} onSort={handleSort} className="text-right">대당 이용시간</SortableHead>
            <SortableHead column="usageCountPerCar" sort={sort} onSort={handleSort} className="text-right">대당 이용건수</SortableHead>
            <SortableHead column="utilizationRate" sort={sort} onSort={handleSort} className="text-right">가동률</SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedIndices.map((originalIndex, displayIndex) => {
            const record = records[originalIndex];
            return (
              <TableRow key={record.date} className={cn("hover:bg-muted/40", displayIndex % 2 === 1 ? "bg-muted/30" : "")}>
                <TableCell className="text-left">{record.date}</TableCell>
                <TableCell className="text-right">{formatCurrency(record.revenue)}</TableCell>
                <TableCell className="text-right">{formatRevenuePerCar(record.revenuePerCar)}</TableCell>
                <TableCell className="text-right">{formatGpm(gpms[originalIndex])}</TableCell>
                <TableCell
                  className={`text-right ${gpmTrendClass(
                    gpms[originalIndex],
                    originalIndex > 0 ? gpms[originalIndex - 1] : null
                  )}`}
                >
                  {formatGpmTrend(gpms[originalIndex], originalIndex > 0 ? gpms[originalIndex - 1] : null)}
                </TableCell>
                <TableCell className="text-right">{formatHoursPerCar(record.usageHoursPerCar)}</TableCell>
                <TableCell className="text-right">{formatCountPerCar(record.usageCountPerCar)}</TableCell>
                <TableCell className="text-right">{formatRate(record.utilizationRate)}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-secondary font-bold" aria-label="합계">
            <TableCell className="text-left">합계</TableCell>
            <TableCell className="text-right">{formatCurrency(sumRevenue)}</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">{formatGpm(totalGpm)}</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
          </TableRow>
          <TableRow className="bg-secondary font-bold" aria-label="평균">
            <TableCell className="text-left">평균</TableCell>
            <TableCell className="text-right">{formatCurrency(Math.round(avgRevenue))}</TableCell>
            <TableCell className="text-right">{formatRevenuePerCar(avgRevenuePerCar)}</TableCell>
            <TableCell className="text-right">{formatGpm(avgGpm)}</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">{formatHoursPerCar(avgUsageHoursPerCar)}</TableCell>
            <TableCell className="text-right">{formatCountPerCar(avgUsageCountPerCar)}</TableCell>
            <TableCell className="text-right">{formatRate(avgUtilization)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function WeeklyTable({ records }: { records: WeeklyRecord[] }) {
  const { sort, handleSort } = useSort();
  const { ref: scrollRef, atEnd } = useScrollIndicator();

  const gpms = useMemo(() => records.map((r) => calcGpm(r.profit, r.revenue)), [records]);

  const sortedIndices = useMemo(() => {
    const indices = records.map((_, i) => i);
    if (!sort.column || !sort.direction) return indices;

    const getValue = (i: number): number | string => {
      const r = records[i];
      switch (sort.column) {
        case "week": return r.week;
        case "revenue": return r.revenue;
        case "revenuePerCar": return r.revenuePerCar;
        case "gpm": return gpms[i];
        case "usageHoursPerCar": return r.usageHoursPerCar;
        case "usageCountPerCar": return r.usageCountPerCar;
        case "utilizationRate": return r.utilizationRate;
        case "weeklyTarget": return r.weeklyTarget;
        default: return 0;
      }
    };

    indices.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort.direction === "asc" ? cmp : -cmp;
    });

    return indices;
  }, [records, gpms, sort]);

  const sumRevenue = records.reduce((acc, r) => acc + r.revenue, 0);
  const sumProfit = records.reduce((acc, r) => acc + r.profit, 0);
  const sumTarget = records.reduce((acc, r) => acc + r.weeklyTarget, 0);

  const len = records.length;
  const avgRevenue = len > 0 ? sumRevenue / len : 0;
  const avgRevenuePerCar = len > 0 ? records.reduce((a, r) => a + r.revenuePerCar, 0) / len : 0;
  const avgUsageHoursPerCar = len > 0 ? records.reduce((a, r) => a + r.usageHoursPerCar, 0) / len : 0;
  const avgUsageCountPerCar = len > 0 ? records.reduce((a, r) => a + r.usageCountPerCar, 0) / len : 0;
  const avgUtilization =
    len > 0
      ? records.reduce((acc, r) => acc + r.utilizationRate, 0) / len
      : 0;
  const avgTarget = len > 0 ? sumTarget / len : 0;
  const totalGpm = calcGpm(sumProfit, sumRevenue);
  const avgGpm = len > 0 ? gpms.reduce((a, b) => a + b, 0) / len : 0;

  return (
    <div ref={scrollRef} data-scroll-end={String(atEnd)} className="table-scroll-container relative max-h-[70vh] overflow-auto rounded-3xl border border-border/60 bg-card/80 p-2 shadow-[var(--shadow-card,0_18px_44px_-34px_rgba(20,26,36,0.28))] backdrop-blur">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          <TableRow>
            <SortableHead column="week" sort={sort} onSort={handleSort} className="text-left">주차별</SortableHead>
            <SortableHead column="revenue" sort={sort} onSort={handleSort} className="text-right">매출</SortableHead>
            <SortableHead column="revenuePerCar" sort={sort} onSort={handleSort} className="text-right">대당 매출</SortableHead>
            <SortableHead column="gpm" sort={sort} onSort={handleSort} className="text-right">GPM</SortableHead>
            <TableHead scope="col" className="text-right">GPM 추이</TableHead>
            <SortableHead column="usageHoursPerCar" sort={sort} onSort={handleSort} className="text-right">대당 이용시간</SortableHead>
            <SortableHead column="usageCountPerCar" sort={sort} onSort={handleSort} className="text-right">대당 이용건수</SortableHead>
            <SortableHead column="utilizationRate" sort={sort} onSort={handleSort} className="text-right">가동률</SortableHead>
            <SortableHead column="weeklyTarget" sort={sort} onSort={handleSort} className="text-right">목표</SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedIndices.map((originalIndex, displayIndex) => {
            const record = records[originalIndex];
            return (
              <TableRow key={record.week} className={cn("hover:bg-muted/40", displayIndex % 2 === 1 ? "bg-muted/30" : "")}>
                <TableCell className="text-left">
                  {record.week}
                  {record.isoWeek > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (W{record.isoWeek})
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(record.revenue)}</TableCell>
                <TableCell className="text-right">{formatRevenuePerCar(record.revenuePerCar)}</TableCell>
                <TableCell className="text-right">{formatGpm(gpms[originalIndex])}</TableCell>
                <TableCell
                  className={`text-right ${gpmTrendClass(
                    gpms[originalIndex],
                    originalIndex > 0 ? gpms[originalIndex - 1] : null
                  )}`}
                >
                  {formatGpmTrend(gpms[originalIndex], originalIndex > 0 ? gpms[originalIndex - 1] : null)}
                </TableCell>
                <TableCell className="text-right">{formatHoursPerCar(record.usageHoursPerCar)}</TableCell>
                <TableCell className="text-right">{formatCountPerCar(record.usageCountPerCar)}</TableCell>
                <TableCell className="text-right">{formatRate(record.utilizationRate)}</TableCell>
                <TableCell className="text-right">{formatCurrency(record.weeklyTarget)}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-secondary font-bold" aria-label="합계">
            <TableCell className="text-left">합계</TableCell>
            <TableCell className="text-right">{formatCurrency(sumRevenue)}</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">{formatGpm(totalGpm)}</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">{formatCurrency(sumTarget)}</TableCell>
          </TableRow>
          <TableRow className="bg-secondary font-bold" aria-label="평균">
            <TableCell className="text-left">평균</TableCell>
            <TableCell className="text-right">{formatCurrency(Math.round(avgRevenue))}</TableCell>
            <TableCell className="text-right">{formatRevenuePerCar(avgRevenuePerCar)}</TableCell>
            <TableCell className="text-right">{formatGpm(avgGpm)}</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">{formatHoursPerCar(avgUsageHoursPerCar)}</TableCell>
            <TableCell className="text-right">{formatCountPerCar(avgUsageCountPerCar)}</TableCell>
            <TableCell className="text-right">{formatRate(avgUtilization)}</TableCell>
            <TableCell className="text-right">{formatCurrency(Math.round(avgTarget))}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/80 py-16 backdrop-blur">
      <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-10 w-10 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground/70">기간을 변경하거나 데이터 소스를 확인하세요.</p>
    </div>
  );
}

export function DataTable({ data, tab }: DataTableProps) {
  if (tab === "daily") {
    if (data.daily.length === 0) {
      return <EmptyState message="일별 데이터가 없습니다." />;
    }
    return <DailyTable records={data.daily} />;
  }

  if (data.weekly.length === 0) {
    return <EmptyState message="주차별 데이터가 없습니다." />;
  }

  return <WeeklyTable records={data.weekly} />;
}
