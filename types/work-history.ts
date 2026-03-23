export type WorkStatus = 'done' | 'in-progress' | 'blocked';

export type WorkCategory =
  | 'planning'
  | 'meeting'
  | 'analysis'
  | 'delivery'
  | 'automation'
  | 'improvement';

export interface WorkHistoryRecord {
  id: string;
  date: string;
  title: string;
  summary: string;
  category: WorkCategory;
  status: WorkStatus;
  owner: string;
  tags: string[];
  project: string;
  outcome: string;
  source: string;
  pinned?: boolean;
}
