// 대시보드 메인 페이지 (Server Component)
// searchParams로 탭/기간 상태를 읽어 DashboardContent에 전달
import { Suspense } from 'react';
import { getTeamDashboardData } from '@/lib/data';
import { DashboardContent } from '@/components/dashboard/dashboard-content';
import { KpiCardsSkeleton } from '@/components/dashboard/kpi-cards-skeleton';
import { UpdateTimestamp } from '@/components/dashboard/update-timestamp';

// 탭/기간 전환 시 서버에서 최신 데이터를 가져오도록 캐시 비활성화
export const dynamic = 'force-dynamic';

// period 파라미터 추가 — 기간 필터 URL 상태 복원에 사용
type SearchParams = Promise<{ tab?: string; period?: string; region1?: string; region2?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Next.js 16: searchParams는 Promise — await 필수
  const { tab = 'daily', period, region1, region2 } = await searchParams;
  const activeTab = tab === 'weekly' ? 'weekly' : tab === 'forecast' ? 'forecast' : 'daily';

  const data = await getTeamDashboardData({ region1, region2 });

  return (
    <div className="space-y-6">
      {/* 마지막 업데이트 타임스탬프 — 대시보드 상단 우측 정렬 (UX-03) */}
      <div className="flex justify-end">
        <UpdateTimestamp fetchedAt={data.fetchedAt} />
      </div>

      {/* DashboardContent: 기간 필터 상태 소유 Client Component
          탭 전환 + 기간 선택 + 데이터 필터링 + 렌더링을 모두 담당 */}
      <Suspense fallback={<KpiCardsSkeleton />}>
        <DashboardContent data={data} tab={activeTab} initialPeriod={period} />
      </Suspense>
    </div>
  );
}
