"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  getAchievementColorClass,
  getProgressColorClass,
} from "@/lib/kpi-utils";

interface KpiCardProps {
  title: string;
  value: string;
  target?: string;
  achievementRate?: number;
  deltaText?: string;
  deltaColorClass?: string;
  icon: React.ReactNode;
  sparklineData?: number[];
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
    <Card className="gap-4 overflow-hidden border-white/80 bg-white/80">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-0">
        <CardTitle className="text-sm font-semibold tracking-[-0.01em] text-foreground/88">
          {title}
        </CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF5FF] text-[#0078FF]">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-[2rem] font-semibold tracking-[-0.04em]">{value}</div>
        {achievementRate !== undefined && (
          <>
            <div
              className={cn(
                "text-xs font-medium",
                getAchievementColorClass(achievementRate)
              )}
            >
              달성률 {achievementRate}%
            </div>
            <Progress
              value={Math.min(achievementRate, 100)}
              className={cn("h-2", getProgressColorClass(achievementRate))}
            />
          </>
        )}
        {target && <p className="text-xs text-muted-foreground">목표: {target}</p>}
        {deltaText && (
          <p className={cn("text-xs font-medium", deltaColorClass)}>{deltaText}</p>
        )}
        {sparklineData && sparklineData.length >= 2 && (
          <div className="rounded-2xl bg-[#F7FAFF] px-2 py-1.5 dark:bg-white/3">
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
