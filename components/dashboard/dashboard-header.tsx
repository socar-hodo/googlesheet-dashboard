'use client';

// DashboardHeader — 탭 전환(일별/주차별) + 기간 필터를 한 행에 좌우 배치
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Download } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PeriodFilter } from './period-filter';
import {
  type PeriodKey,
  DAILY_PERIODS,
  WEEKLY_PERIODS,
  DEFAULT_DAILY_PERIOD,
  DEFAULT_WEEKLY_PERIOD,
} from '@/lib/period-utils';

interface DashboardHeaderProps {
  tab: 'daily' | 'weekly' | 'forecast';
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
}

/** 대시보드 헤더 — 탭 전환 시 period를 해당 탭 기본값으로 리셋 */
export function DashboardHeader({ tab, period, onPeriodChange, onExportCsv, onExportXlsx }: DashboardHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  /** 탭 전환 핸들러 — URL 파라미터 동기화 및 period 리셋 */
  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    params.set('period', value === 'weekly' ? DEFAULT_WEEKLY_PERIOD : DEFAULT_DAILY_PERIOD);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center justify-between">
      {/* 왼쪽: 탭 전환 버튼 */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="daily">일별</TabsTrigger>
          <TabsTrigger value="weekly">주차별</TabsTrigger>
          <TabsTrigger value="forecast">예측</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 오른쪽: 기간 선택 + 내보내기 (예측 탭은 기간 필터만, 내보내기 숨김) */}
      <div className="flex items-center gap-2">
        <PeriodFilter
          periods={tab === 'weekly' ? WEEKLY_PERIODS : DAILY_PERIODS}
          active={period}
          onChange={onPeriodChange}
        />
        {tab !== 'forecast' && (
          <>
            <div className="h-4 w-px bg-border" />
            <Button variant="outline" size="sm" onClick={onExportCsv}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExportXlsx}>
              <Download className="h-4 w-4 mr-1" />
              Excel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
