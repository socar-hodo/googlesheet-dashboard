// DataTable Server Component — Daily/Weekly 탭별 테이블 렌더링, 요약 행 포함
import type { TeamDashboardData, DailyRecord, WeeklyRecord } from '@/types/dashboard';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface DataTableProps {
  data: TeamDashboardData;
  tab: 'daily' | 'weekly';
}

/** 금액 포맷 — 원 단위 전체 (KPI 카드의 만원 단위와 다름) */
function formatCurrency(value: number): string {
  return `₩${value.toLocaleString()}`;
}

/** 이용시간 포맷 — Xh Ym 형식 */
function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return `${h}h ${m}m`;
}

/** 가동률 포맷 — 소수점 1자리 % */
function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

/** 이용건수 포맷 */
function formatCount(count: number): string {
  return `${count.toLocaleString()}건`;
}

/** 손익 셀 색상 클래스 */
function profitColorClass(value: number): string {
  return value < 0 ? 'text-red-600 dark:text-red-400' : '';
}

/** Daily 테이블 렌더링 */
function DailyTable({ records }: { records: DailyRecord[] }) {
  // 합계 계산
  const sumRevenue = records.reduce((acc, r) => acc + r.revenue, 0);
  const sumProfit = records.reduce((acc, r) => acc + r.profit, 0);
  const sumUsageHours = records.reduce((acc, r) => acc + r.usageHours, 0);
  const sumUsageCount = records.reduce((acc, r) => acc + r.usageCount, 0);

  // 평균 계산 (0으로 나누기 방어)
  const len = records.length;
  const avgRevenue = len > 0 ? sumRevenue / len : 0;
  const avgProfit = len > 0 ? sumProfit / len : 0;
  const avgUsageHours = len > 0 ? sumUsageHours / len : 0;
  const avgUsageCount = len > 0 ? sumUsageCount / len : 0;
  const avgUtilization = len > 0
    ? records.reduce((acc, r) => acc + r.utilizationRate, 0) / len
    : 0;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="text-left">날짜</TableHead>
            <TableHead className="text-right">매출</TableHead>
            <TableHead className="text-right">손익</TableHead>
            <TableHead className="text-right">이용시간</TableHead>
            <TableHead className="text-right">이용건수</TableHead>
            <TableHead className="text-right">가동률</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record, index) => (
            <TableRow key={record.date} className={index % 2 === 1 ? 'bg-muted/30' : ''}>
              <TableCell className="text-left">{record.date}</TableCell>
              <TableCell className="text-right">{formatCurrency(record.revenue)}</TableCell>
              <TableCell className={`text-right ${profitColorClass(record.profit)}`}>
                {formatCurrency(record.profit)}
              </TableCell>
              <TableCell className="text-right">{formatHours(record.usageHours)}</TableCell>
              <TableCell className="text-right">{formatCount(record.usageCount)}</TableCell>
              <TableCell className="text-right">{formatRate(record.utilizationRate)}</TableCell>
            </TableRow>
          ))}
          {/* 합계 행 */}
          <TableRow className="font-bold bg-muted/60">
            <TableCell className="text-left">합계</TableCell>
            <TableCell className="text-right">{formatCurrency(sumRevenue)}</TableCell>
            <TableCell className={`text-right ${profitColorClass(sumProfit)}`}>
              {formatCurrency(sumProfit)}
            </TableCell>
            <TableCell className="text-right">{formatHours(sumUsageHours)}</TableCell>
            <TableCell className="text-right">{formatCount(sumUsageCount)}</TableCell>
            <TableCell className="text-right">-</TableCell>
          </TableRow>
          {/* 평균 행 */}
          <TableRow className="font-bold bg-muted/60">
            <TableCell className="text-left">평균</TableCell>
            <TableCell className="text-right">{formatCurrency(Math.round(avgRevenue))}</TableCell>
            <TableCell className={`text-right ${profitColorClass(avgProfit)}`}>
              {formatCurrency(Math.round(avgProfit))}
            </TableCell>
            <TableCell className="text-right">{formatHours(avgUsageHours)}</TableCell>
            <TableCell className="text-right">{formatCount(Math.round(avgUsageCount))}</TableCell>
            <TableCell className="text-right">{formatRate(avgUtilization)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

/** Weekly 테이블 렌더링 */
function WeeklyTable({ records }: { records: WeeklyRecord[] }) {
  // 합계 계산
  const sumRevenue = records.reduce((acc, r) => acc + r.revenue, 0);
  const sumProfit = records.reduce((acc, r) => acc + r.profit, 0);
  const sumUsageHours = records.reduce((acc, r) => acc + r.usageHours, 0);
  const sumUsageCount = records.reduce((acc, r) => acc + r.usageCount, 0);
  const sumTarget = records.reduce((acc, r) => acc + r.weeklyTarget, 0);

  // 평균 계산 (0으로 나누기 방어)
  const len = records.length;
  const avgRevenue = len > 0 ? sumRevenue / len : 0;
  const avgProfit = len > 0 ? sumProfit / len : 0;
  const avgUsageHours = len > 0 ? sumUsageHours / len : 0;
  const avgUsageCount = len > 0 ? sumUsageCount / len : 0;
  const avgUtilization = len > 0
    ? records.reduce((acc, r) => acc + r.utilizationRate, 0) / len
    : 0;
  const avgTarget = len > 0 ? sumTarget / len : 0;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="text-left">주차</TableHead>
            <TableHead className="text-right">매출</TableHead>
            <TableHead className="text-right">손익</TableHead>
            <TableHead className="text-right">이용시간</TableHead>
            <TableHead className="text-right">이용건수</TableHead>
            <TableHead className="text-right">가동률</TableHead>
            <TableHead className="text-right">목표</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record, index) => (
            <TableRow key={record.week} className={index % 2 === 1 ? 'bg-muted/30' : ''}>
              <TableCell className="text-left">{record.week}</TableCell>
              <TableCell className="text-right">{formatCurrency(record.revenue)}</TableCell>
              <TableCell className={`text-right ${profitColorClass(record.profit)}`}>
                {formatCurrency(record.profit)}
              </TableCell>
              <TableCell className="text-right">{formatHours(record.usageHours)}</TableCell>
              <TableCell className="text-right">{formatCount(record.usageCount)}</TableCell>
              <TableCell className="text-right">{formatRate(record.utilizationRate)}</TableCell>
              <TableCell className="text-right">{formatCurrency(record.weeklyTarget)}</TableCell>
            </TableRow>
          ))}
          {/* 합계 행 */}
          <TableRow className="font-bold bg-muted/60">
            <TableCell className="text-left">합계</TableCell>
            <TableCell className="text-right">{formatCurrency(sumRevenue)}</TableCell>
            <TableCell className={`text-right ${profitColorClass(sumProfit)}`}>
              {formatCurrency(sumProfit)}
            </TableCell>
            <TableCell className="text-right">{formatHours(sumUsageHours)}</TableCell>
            <TableCell className="text-right">{formatCount(sumUsageCount)}</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">{formatCurrency(sumTarget)}</TableCell>
          </TableRow>
          {/* 평균 행 */}
          <TableRow className="font-bold bg-muted/60">
            <TableCell className="text-left">평균</TableCell>
            <TableCell className="text-right">{formatCurrency(Math.round(avgRevenue))}</TableCell>
            <TableCell className={`text-right ${profitColorClass(avgProfit)}`}>
              {formatCurrency(Math.round(avgProfit))}
            </TableCell>
            <TableCell className="text-right">{formatHours(avgUsageHours)}</TableCell>
            <TableCell className="text-right">{formatCount(Math.round(avgUsageCount))}</TableCell>
            <TableCell className="text-right">{formatRate(avgUtilization)}</TableCell>
            <TableCell className="text-right">{formatCurrency(Math.round(avgTarget))}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

/** DataTable — Daily/Weekly 탭별 상세 데이터 테이블 */
export function DataTable({ data, tab }: DataTableProps) {
  if (tab === 'daily') {
    if (data.daily.length === 0) {
      return <p className="text-muted-foreground py-4">일별 데이터가 없습니다.</p>;
    }
    return <DailyTable records={data.daily} />;
  }

  if (data.weekly.length === 0) {
    return <p className="text-muted-foreground py-4">주차별 데이터가 없습니다.</p>;
  }
  return <WeeklyTable records={data.weekly} />;
}
