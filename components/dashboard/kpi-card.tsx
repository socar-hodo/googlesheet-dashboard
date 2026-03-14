'use client';

// 단일 KPI 카드 컴포넌트 — 달성률, 프로그레스 바, 델타 표시, 스파크라인
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getAchievementColorClass, getProgressColorClass } from '@/lib/kpi-utils';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface KpiCardProps {
  title: string;            // KPI 명칭 (예: "매출")
  value: string;            // 포맷된 실적값 (예: "₩1,234만")
  target?: string;          // 포맷된 목표값 (Weekly 전용, Daily면 undefined)
  achievementRate?: number; // 달성률 % (Weekly 전용, Daily면 undefined)
  deltaText?: string;       // 포맷된 델타 문자열 (예: "▲ +12% / ₩120만")
  deltaColorClass?: string; // 델타 색상 클래스
  icon: React.ReactNode;    // lucide-react 아이콘
  sparklineData?: number[]; // 스파크라인 데이터 포인트 배열
}

export function KpiCard({
  title,
  value,
  target,
  achievementRate,
  deltaText,
  deltaColorClass,
  icon,
  sparklineData,
}: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold">{value}</div>
        {achievementRate !== undefined && (
          <>
            <div className={cn('text-xs font-medium', getAchievementColorClass(achievementRate))}>
              달성률 {achievementRate}%
            </div>
            <Progress
              value={Math.min(achievementRate, 100)}
              className={cn('h-2', getProgressColorClass(achievementRate))}
            />
          </>
        )}
        {target && (
          <p className="text-xs text-muted-foreground">목표: {target}</p>
        )}
        {deltaText && (
          <p className={cn('text-xs', deltaColorClass)}>{deltaText}</p>
        )}
        {sparklineData && sparklineData.length >= 2 && (
          <div className="pt-1">
            <ResponsiveContainer width="100%" height={40} minWidth={0}>
              <AreaChart
                data={sparklineData.map((v, i) => ({ v, i }))}
                margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
              >
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--chart-1)"
                  strokeWidth={1.5}
                  fill="var(--chart-1)"
                  fillOpacity={0.15}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
