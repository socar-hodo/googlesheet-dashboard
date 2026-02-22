// 대시보드 메인 페이지 (Server Component)
// searchParams로 탭 상태를 읽어 KPI 카드를 렌더링합니다
import { Suspense } from 'react';
import { getTeamDashboardData } from '@/lib/data';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { KpiCardsSkeleton } from '@/components/dashboard/kpi-cards-skeleton';
import { TabNav } from '@/components/dashboard/tab-nav';

// 탭 전환 시 서버에서 최신 데이터를 가져오도록 캐시 비활성화
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ tab?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Next.js 16: searchParams는 Promise — await 필수
  const { tab = 'daily' } = await searchParams;
  const activeTab = tab === 'weekly' ? 'weekly' : 'daily';

  const data = await getTeamDashboardData();

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 — useSearchParams() 사용으로 Suspense 감싸기 필요 */}
      <Suspense fallback={null}>
        <TabNav activeTab={activeTab} />
      </Suspense>

      {/* key prop으로 탭 전환 시 Suspense 리셋 → 스켈레턴 재표시 (UX-01) */}
      <Suspense key={activeTab} fallback={<KpiCardsSkeleton />}>
        <KpiCards data={data} tab={activeTab} />
      </Suspense>
    </div>
  );
}
