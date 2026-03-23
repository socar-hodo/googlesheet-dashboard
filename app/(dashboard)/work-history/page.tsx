import { WorkHistoryPortal } from '@/components/work-history/work-history-portal';
import { getWorkHistoryRecords } from '@/lib/work-history-server';

export const dynamic = 'force-dynamic';

export default async function WorkHistoryPage() {
  const records = await getWorkHistoryRecords();

  return <WorkHistoryPortal records={records} />;
}
