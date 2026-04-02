import { KpiCardsSkeleton } from '@/components/dashboard/kpi-cards-skeleton';
import { ChartsSkeleton } from '@/components/dashboard/charts/charts-skeleton';
import { DataTableSkeleton } from '@/components/dashboard/data-table-skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
      </div>
      {/* Header skeleton */}
      <div className="h-14 animate-pulse rounded-3xl bg-card/80" />
      {/* KPI cards */}
      <KpiCardsSkeleton />
      {/* Charts */}
      <ChartsSkeleton />
      {/* Data table */}
      <DataTableSkeleton />
    </div>
  );
}
