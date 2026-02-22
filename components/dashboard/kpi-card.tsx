// 단일 KPI 카드 컴포넌트 — 달성률, 프로그레스 바, 델타 표시
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getAchievementColorClass, getProgressColorClass } from '@/lib/kpi-utils';

interface KpiCardProps {
  title: string;            // KPI 명칭 (예: "매출")
  value: string;            // 포맷된 실적값 (예: "₩1,234만")
  target?: string;          // 포맷된 목표값 (Weekly 전용, Daily면 undefined)
  achievementRate?: number; // 달성률 % (Weekly 전용, Daily면 undefined)
  deltaText?: string;       // 포맷된 델타 문자열 (예: "▲ +12% / ₩120만")
  deltaColorClass?: string; // 델타 색상 클래스
  icon: React.ReactNode;    // lucide-react 아이콘
}

export function KpiCard({
  title,
  value,
  target,
  achievementRate,
  deltaText,
  deltaColorClass,
  icon,
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
      </CardContent>
    </Card>
  );
}
