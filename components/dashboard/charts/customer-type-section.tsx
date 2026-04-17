'use client';

// components/dashboard/charts/customer-type-section.tsx
// 고객 유형 분석 섹션 — BQ API 우선, Sheets 폴백

import { useEffect, useState } from 'react';
import type { CustomerTypeRow } from '@/types/dashboard';
import { CustomerTypeDonut } from './customer-type-donut';
import { CustomerTypeTrend } from './customer-type-trend';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomerTypeSectionProps {
  daily: CustomerTypeRow[];
  weekly: CustomerTypeRow[];
  tab: 'daily' | 'weekly';
}

export function CustomerTypeSection({ daily, weekly, tab }: CustomerTypeSectionProps) {
  const [bqDaily, setBqDaily] = useState<CustomerTypeRow[]>([]);
  const [bqWeekly, setBqWeekly] = useState<CustomerTypeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() - 1);
    const start = new Date(today);
    start.setDate(start.getDate() - 90);

    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    setLoading(true);
    fetch(`/api/customer-type?start_date=${startDate}&end_date=${endDate}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBqDaily(data.daily ?? []);
        setBqWeekly(data.weekly ?? []);
      })
      .catch((err) => {
        console.warn('[CustomerTypeSection] BQ fetch failed, using Sheets fallback:', err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // BQ 데이터 우선, 실패 시 Sheets 폴백
  const effectiveDaily = bqDaily.length > 0 ? bqDaily : daily;
  const effectiveWeekly = bqWeekly.length > 0 ? bqWeekly : weekly;
  const data = tab === 'daily' ? effectiveDaily : effectiveWeekly;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr]">
        <Card>
          <CardContent className="flex items-center justify-center h-[320px]">
            <Skeleton className="h-40 w-40 rounded-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-center h-[320px]">
            <Skeleton className="h-full w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    // 모바일: 단일 컬럼 / md 이상: 도넛 1/3 + 추이 2/3
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr]">
      <CustomerTypeDonut data={data} />
      <CustomerTypeTrend data={data} tab={tab} />
    </div>
  );
}
