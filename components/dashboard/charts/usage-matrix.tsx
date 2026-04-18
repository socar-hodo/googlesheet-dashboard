'use client';

// components/dashboard/charts/usage-matrix.tsx
// 연령×이용시간 매트릭스 — 현재 기간 건수/매출 + 직전 동일 길이 기간 대비 증감(%)
// 상단: 가중평균 건당매출 / 필터: 평일·주말·전체

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  USAGE_DURATION_BUCKETS,
  AGE_GROUP_LABELS,
  AGE_GROUP_ORDER,
  type UsageDurationBucketKey,
  type UsageMatrixRow,
} from '@/types/dashboard';

interface UsageMatrixProps {
  /** 현재 기간 데이터 (기간 셀렉터 적용 후) */
  current: UsageMatrixRow[];
  /** 직전 동일 길이 기간 데이터 (증감 계산용) */
  previous: UsageMatrixRow[];
}

type DayFilter = 'all' | 'weekday' | 'weekend';

interface Cell {
  nuse: number;
  revenue: number;
}

function formatRevenueShort(won: number): string {
  if (won === 0) return '0원';
  const eok = won / 1_0000_0000;
  if (Math.abs(eok) >= 1) return `${eok.toFixed(1)}억원`;
  const man = won / 10_000;
  return `${Math.round(man).toLocaleString()}만원`;
}

function formatCount(n: number): string {
  return `${n.toLocaleString()}건`;
}

function formatDeltaPct(curr: number, prev: number): { text: string; tone: 'up' | 'down' | 'flat' | 'new' } {
  if (prev === 0 && curr === 0) return { text: '–', tone: 'flat' };
  if (prev === 0) return { text: 'NEW', tone: 'new' };
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return { text: '±0%', tone: 'flat' };
  const sign = pct > 0 ? '+' : '';
  return { text: `${sign}${pct.toFixed(0)}%`, tone: pct > 0 ? 'up' : 'down' };
}

const DAY_FILTER_LABELS: Record<DayFilter, string> = {
  all: '전체',
  weekday: '평일',
  weekend: '주말',
};

const TONE_CLASS: Record<'up' | 'down' | 'flat' | 'new', string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-rose-600 dark:text-rose-400',
  flat: 'text-muted-foreground',
  new: 'text-sky-600 dark:text-sky-400',
};

function aggregate(
  rows: UsageMatrixRow[],
  dayFilter: DayFilter,
): { cellMap: Map<string, Map<UsageDurationBucketKey, Cell>>; totalNuse: number; totalRevenue: number } {
  const cellMap = new Map<string, Map<UsageDurationBucketKey, Cell>>();
  let tNuse = 0;
  let tRev = 0;
  for (const r of rows) {
    if (dayFilter !== 'all' && r.dayType !== dayFilter) continue;
    if (!cellMap.has(r.ageGroup)) cellMap.set(r.ageGroup, new Map());
    const row = cellMap.get(r.ageGroup)!;
    const prev = row.get(r.durationGroup) ?? { nuse: 0, revenue: 0 };
    row.set(r.durationGroup, { nuse: prev.nuse + r.nuse, revenue: prev.revenue + r.revenue });
    tNuse += r.nuse;
    tRev += r.revenue;
  }
  return { cellMap, totalNuse: tNuse, totalRevenue: tRev };
}

export function UsageMatrix({ current, previous }: UsageMatrixProps) {
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');

  const { curAgg, prevAgg } = useMemo(
    () => ({
      curAgg: aggregate(current, dayFilter),
      prevAgg: aggregate(previous, dayFilter),
    }),
    [current, previous, dayFilter],
  );

  const weightedRevPerUse = curAgg.totalNuse > 0 ? Math.round(curAgg.totalRevenue / curAgg.totalNuse) : 0;
  const hasPrevious = previous.length > 0;

  if (current.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>연령×이용시간 매트릭스</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-sm text-muted-foreground">선택한 기간에 데이터가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  const presentAges = AGE_GROUP_ORDER.filter((a) => curAgg.cellMap.has(a));
  for (const a of curAgg.cellMap.keys()) {
    if (!presentAges.includes(a as typeof AGE_GROUP_ORDER[number])) {
      presentAges.push(a as typeof AGE_GROUP_ORDER[number]);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>연령×이용시간 매트릭스</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              가중평균 건당매출: <span className="font-semibold text-foreground">{weightedRevPerUse.toLocaleString()}원</span>
              {hasPrevious && (
                <span className="ml-2 text-muted-foreground/70">· 증감은 직전 동일 길이 기간 대비</span>
              )}
            </p>
          </div>
          <div className="flex gap-1 self-start sm:self-auto" role="group" aria-label="요일 필터">
            {(['all', 'weekday', 'weekend'] as const).map((key) => (
              <Button
                key={key}
                size="sm"
                variant={dayFilter === key ? 'default' : 'outline'}
                onClick={() => setDayFilter(key)}
                aria-pressed={dayFilter === key}
              >
                {DAY_FILTER_LABELS[key]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-[140px] bg-muted/50 px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                >
                  연령대 ↓ / 이용시간 →
                </th>
                {USAGE_DURATION_BUCKETS.map((b) => (
                  <th
                    key={b.key}
                    scope="col"
                    className="bg-primary/10 px-3 py-2 text-center text-xs font-semibold text-primary"
                  >
                    {b.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {presentAges.map((age) => {
                const row = curAgg.cellMap.get(age);
                const prevRow = prevAgg.cellMap.get(age);
                return (
                  <tr key={age} className="border-b border-border/40 last:border-b-0">
                    <th
                      scope="row"
                      className="sticky left-0 bg-primary/10 px-3 py-2 text-left font-medium text-primary"
                    >
                      {AGE_GROUP_LABELS[age] ?? age}
                    </th>
                    {USAGE_DURATION_BUCKETS.map((b) => {
                      const cell = row?.get(b.key);
                      const prevCell = prevRow?.get(b.key);
                      const nuse = cell?.nuse ?? 0;
                      const revenue = cell?.revenue ?? 0;
                      const prevNuse = prevCell?.nuse ?? 0;
                      const delta = hasPrevious ? formatDeltaPct(nuse, prevNuse) : null;
                      return (
                        <td
                          key={b.key}
                          className="px-3 py-2 text-center tabular-nums"
                          title={
                            hasPrevious
                              ? `${nuse.toLocaleString()}건 (이전 ${prevNuse.toLocaleString()}건) · ${revenue.toLocaleString()}원`
                              : `${nuse.toLocaleString()}건 · ${revenue.toLocaleString()}원`
                          }
                        >
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="font-semibold text-foreground">{formatCount(nuse)}</span>
                            {delta && (
                              <span className={`text-[10px] font-medium ${TONE_CLASS[delta.tone]}`}>
                                {delta.text}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatRevenueShort(revenue)}</div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
