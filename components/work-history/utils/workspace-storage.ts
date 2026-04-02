import type { MemoItem, TodoItem, WorkspaceState } from '@/types/workspace-state';
import type { WorkspaceResource } from '@/types/workspace-resource';
import type { WorkHistoryRecord } from '@/types/work-history';
import { sortTodos, sortMemos } from './workspace-todo-utils';

// ── Storage key helpers ─────────────────────────────────────────────

export type ResourceCardId = 'recent' | 'favorites' | 'recommended';

export type WorkspaceTone = 'sand' | 'sky' | 'mint';

export interface WorkspaceSettings {
  title: string;
  subtitle: string;
  tone: WorkspaceTone;
  showTodoFocus: boolean;
  showMemos: boolean;
  showResources: boolean;
  resourceCardOrder: ResourceCardId[];
}

export const defaultResourceCardOrder: ResourceCardId[] = ['recent', 'favorites', 'recommended'];

export const resourceCardLabelMap: Record<ResourceCardId, string> = {
  recent: '최근 본 문서',
  favorites: '즐겨찾기',
  recommended: '추천 문서',
};

export function buildScopedStorageKey(baseKey: string, ownerKey: string): string {
  return `${baseKey}:${ownerKey}`;
}

// ── Normalize helpers ───────────────────────────────────────────────

export function normalizeResourceCardOrder(order?: ResourceCardId[]): ResourceCardId[] {
  const candidates = Array.isArray(order) ? order : [];
  const normalized = candidates.filter(
    (item, index, array): item is ResourceCardId =>
      defaultResourceCardOrder.includes(item) && array.indexOf(item) === index,
  );

  for (const cardId of defaultResourceCardOrder) {
    if (!normalized.includes(cardId)) {
      normalized.push(cardId);
    }
  }

  return normalized;
}

export function normalizeStoredResources(input: unknown): WorkspaceResource[] {
  if (!Array.isArray(input)) return [];

  return dedupeResources(
    input
      .filter(
        (item): item is Partial<WorkspaceResource> & Pick<WorkspaceResource, 'id' | 'title'> =>
          Boolean(item?.id && item?.title),
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        href: item.href,
        subtitle: item.subtitle,
        description: item.description,
        source:
          item.source === 'sheets-search' || item.source === 'sheets-list' || item.source === 'history'
            ? item.source
            : 'history',
        openedAt: item.openedAt,
        openedCount: typeof item.openedCount === 'number' ? item.openedCount : 0,
      })),
  );
}

export function normalizeStoredTodos(input: unknown): TodoItem[] {
  if (!Array.isArray(input)) return [];

  return sortTodos(
    input
      .filter(
        (item): item is Partial<TodoItem> & Pick<TodoItem, 'id' | 'title'> =>
          Boolean(item?.id && item?.title),
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        completed: Boolean(item.completed),
        createdAt: item.createdAt ?? new Date(0).toISOString(),
        completedAt: item.completedAt,
        dueDate: item.dueDate,
        priority: item.priority ?? 'medium',
        project: item.project?.trim() || '미분류',
      })),
  );
}

export function normalizeStoredMemos(input: unknown): MemoItem[] {
  if (!Array.isArray(input)) return [];

  return sortMemos(
    input
      .filter(
        (item): item is Partial<MemoItem> & Pick<MemoItem, 'id' | 'title' | 'content'> =>
          Boolean(item?.id && item?.title && item?.content),
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        tags: Array.isArray(item.tags) ? item.tags.filter(Boolean) : [],
        pinned: Boolean(item.pinned),
        createdAt: item.createdAt ?? new Date(0).toISOString(),
        updatedAt: item.updatedAt ?? item.createdAt ?? new Date(0).toISOString(),
      })),
  );
}

export function normalizeStoredWorkLogs(input: unknown): WorkHistoryRecord[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter(
      (item): item is Partial<WorkHistoryRecord> & Pick<WorkHistoryRecord, 'id' | 'title' | 'date'> =>
        Boolean(item?.id && item?.title && item?.date),
    )
    .map((item) => ({
      id: item.id,
      date: item.date,
      title: item.title,
      summary: item.summary ?? '',
      category: item.category ?? 'planning',
      status: item.status ?? 'done',
      owner: item.owner ?? '나',
      tags: Array.isArray(item.tags) ? item.tags.filter(Boolean) : [],
      project: item.project?.trim() || '미분류',
      outcome: item.outcome ?? '',
      source: item.source ?? 'Workspace Portal',
      pinned: Boolean(item.pinned),
    }))
    .sort((left, right) => right.date.localeCompare(left.date));
}

// ── Read/Write localStorage ─────────────────────────────────────────

export function readStoredResources(key: string): WorkspaceResource[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return normalizeStoredResources(JSON.parse(raw) as WorkspaceResource[]);
  } catch {
    return [];
  }
}

export function readStoredTodos(key: string): TodoItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return normalizeStoredTodos(JSON.parse(raw) as Partial<TodoItem>[]);
  } catch {
    return [];
  }
}

export function readStoredMemos(key: string): MemoItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return normalizeStoredMemos(JSON.parse(raw) as Partial<MemoItem>[]);
  } catch {
    return [];
  }
}

export function readStoredWorkLogs(key: string): WorkHistoryRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return normalizeStoredWorkLogs(JSON.parse(raw) as Partial<WorkHistoryRecord>[]);
  } catch {
    return [];
  }
}

export function readStoredWorkspaceSettings(
  key: string,
  fallback: WorkspaceSettings,
): WorkspaceSettings {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettings>;
    return {
      ...fallback,
      ...parsed,
      resourceCardOrder: normalizeResourceCardOrder(
        parsed.resourceCardOrder as ResourceCardId[] | undefined,
      ),
    };
  } catch {
    return fallback;
  }
}

export function writeStoredResources(key: string, resources: WorkspaceResource[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(resources));
}

export function writeStoredTodos(key: string, todos: TodoItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(todos));
}

export function writeStoredWorkLogs(key: string, records: WorkHistoryRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(records));
}

export function writeStoredMemos(key: string, memos: MemoItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(memos));
}

export function writeStoredWorkspaceSettings(key: string, settings: WorkspaceSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(settings));
}

export function createDefaultWorkspaceSettings(displayName: string): WorkspaceSettings {
  return {
    title: `${displayName}의 워크스페이스 포털`,
    subtitle: '문서, 업무 기록, 메모, 할 일을 한 화면에서 찾고 관리하는 개인 작업 공간입니다.',
    tone: 'sand',
    showTodoFocus: true,
    showMemos: true,
    showResources: true,
    resourceCardOrder: defaultResourceCardOrder,
  };
}

// ── Resource dedup/transform helpers ────────────────────────────────

export function dedupeResources(resources: WorkspaceResource[]): WorkspaceResource[] {
  const seen = new Set<string>();
  const next: WorkspaceResource[] = [];

  for (const resource of resources) {
    if (!resource?.id || seen.has(resource.id)) continue;
    seen.add(resource.id);
    next.push(resource);
  }

  return next;
}

export function serializeWorkspaceState(state: WorkspaceState): string {
  return JSON.stringify({
    recentResources: normalizeStoredResources(state.recentResources),
    favoriteResources: normalizeStoredResources(state.favoriteResources),
    todos: normalizeStoredTodos(state.todos),
    localRecords: normalizeStoredWorkLogs(state.localRecords),
    memos: normalizeStoredMemos(state.memos),
  });
}

export async function fetchWorkspaceState(): Promise<WorkspaceState> {
  const response = await fetch('/api/workspace/state', {
    cache: 'no-store',
  });

  const payload = (await response.json()) as Partial<WorkspaceState> & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? '워크스페이스 상태를 불러오지 못했습니다.');
  }

  return {
    recentResources: normalizeStoredResources(payload.recentResources),
    favoriteResources: normalizeStoredResources(payload.favoriteResources),
    todos: normalizeStoredTodos(payload.todos),
    localRecords: normalizeStoredWorkLogs(payload.localRecords),
    memos: normalizeStoredMemos(payload.memos),
  };
}

export async function saveWorkspaceState(state: WorkspaceState) {
  const response = await fetch('/api/workspace/state', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(state),
  });

  const payload = (await response.json()) as Partial<WorkspaceState> & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? '워크스페이스 상태를 저장하지 못했습니다.');
  }

  return payload;
}
