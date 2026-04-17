"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** KPI 제목별 설명 텍스트 */
const KPI_DESCRIPTIONS: Record<string, string> = {
  매출: "해당 기간의 총 매출액",
  "대당 매출": "운영일수(opr_day) 기준 대당 평균 매출",
  GPM: "Gross Profit Margin (매출 총이익률)",
  "대당 이용건수": "운영일수(opr_day) 기준 대당 평균 예약 건수",
  가동률: "배치 시간 대비 이용 시간 비율",
  "대당 이용시간": "운영일수(opr_day) 기준 대당 평균 이용 시간",
};

interface KpiCardProps {
  title: string;
  value: string;
  deltaText?: string;
  deltaColorClass?: string;
  icon: React.ReactNode;
  sparklineData?: number[];
}

export function KpiCard({
  title,
  value,
  deltaText,
  deltaColorClass,
  icon,
  sparklineData,
}: KpiCardProps) {
  return (
    <Card className="gap-4 overflow-hidden border-border/60 bg-card/80">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-0">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <CardTitle className="cursor-help text-sm font-semibold tracking-[-0.01em] text-foreground/88">
                {title}
              </CardTitle>
            </TooltipTrigger>
            {KPI_DESCRIPTIONS[title] && (
              <TooltipContent>
                <p>{KPI_DESCRIPTIONS[title]}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary" aria-hidden="true">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-semibold tracking-[-0.04em]">{value}</div>
        {deltaText && (
          <Badge variant="outline" className={cn("text-xs font-medium", deltaColorClass)}>
            {deltaText}
          </Badge>
        )}
        {sparklineData && sparklineData.length >= 2 && (
          <div className="rounded-2xl bg-muted/50 px-2 py-1.5" role="img" aria-label={`${title} 최근 추이 스파크라인`}>
            <ResponsiveContainer width="100%" height={40} minWidth={0}>
              <AreaChart
                data={sparklineData.map((v, i) => ({ v, i }))}
                margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
              >
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--chart-1)"
                  strokeWidth={1.75}
                  fill="var(--chart-1)"
                  fillOpacity={0.12}
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
