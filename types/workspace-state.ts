import type { WorkHistoryRecord } from '@/types/work-history';
import type { WorkspaceResource } from '@/types/workspace-resource';

export type TodoPriority = 'high' | 'medium' | 'low';

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  dueDate?: string;
  priority: TodoPriority;
  project: string;
}

export interface MemoItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceState {
  recentResources: WorkspaceResource[];
  favoriteResources: WorkspaceResource[];
  todos: TodoItem[];
  localRecords: WorkHistoryRecord[];
  memos: MemoItem[];
}
