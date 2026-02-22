// KPI 카드 로딩 스켈레턴 — Suspense fallback으로 사용
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** KPI 카드 5개에 대응하는 Suspense 폴백 스켈레턴 컴포넌트 */
export function KpiCardsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            {/* KPI 제목 스켈레턴 */}
            <Skeleton className="h-4 w-20" />
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 실적값 스켈레턴 */}
            <Skeleton className="h-7 w-28" />
            {/* 프로그레스 바 스켈레턴 */}
            <Skeleton className="h-2 w-full" />
            {/* 달성률 + 델타 스켈레턴 */}
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
