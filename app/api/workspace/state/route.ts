import { auth } from '@/auth';
import { buildWorkspaceOwnerKey } from '@/lib/workspace-owner';
import { readWorkspaceState, replaceWorkspaceState } from '@/lib/workspace-state-store';
import type { WorkCategory, WorkHistoryRecord, WorkStatus } from '@/types/work-history';
import type { WorkspaceResource } from '@/types/workspace-resource';
import type { MemoItem, TodoItem, TodoPriority, WorkspaceState } from '@/types/workspace-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return Response.json(
      { error: '로그인 세션이 없어 워크스페이스 상태를 불러올 수 없습니다.' },
      { status: 401 },
    );
  }

  return Response.json(readWorkspaceState(ownerKey));
}

export async function PUT(req: Request) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return Response.json(
      { error: '로그인 세션이 없어 워크스페이스 상태를 저장할 수 없습니다.' },
      { status: 401 },
    );
  }

  try {
    const body = (await req.json()) as Partial<WorkspaceState>;
    const nextState: WorkspaceState = {
      recentResources: normalizeResources(body.recentResources),
      favoriteResources: normalizeResources(body.favoriteResources),
      todos: normalizeTodos(body.todos),
      localRecords: normalizeWorkLogs(body.localRecords),
      memos: normalizeMemos(body.memos),
    };

    replaceWorkspaceState(ownerKey, nextState);

    return Response.json(nextState);
  } catch (error) {
    return Response.json(
      {
        error: '워크스페이스 상태를 저장하지 못했습니다.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function getOwnerKey() {
  const session = await auth();
  return session?.user ? buildWorkspaceOwnerKey(session.user.email, session.user.id) : null;
}

function normalizeResources(input: unknown): WorkspaceResource[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter(
      (item): item is Partial<WorkspaceResource> & Pick<WorkspaceResource, 'id' | 'title' | 'source'> =>
        Boolean(item && typeof item === 'object' && 'id' in item && 'title' in item && 'source' in item),
    )
    .map((item) => ({
      id: String(item.id),
      title: String(item.title).trim(),
      href: typeof item.href === 'string' ? item.href : undefined,
      subtitle: typeof item.subtitle === 'string' ? item.subtitle.trim() : undefined,
      description: typeof item.description === 'string' ? item.description.trim() : undefined,
      source: normalizeResourceSource(item.source),
      openedAt: item.openedAt ? normalizeIsoString(item.openedAt) : undefined,
      openedCount: normalizeCount(item.openedCount),
    }))
    .filter((item) => item.title.length > 0);
}

function normalizeTodos(input: unknown): TodoItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter(
      (item): item is Partial<TodoItem> & Pick<TodoItem, 'id' | 'title'> =>
        Boolean(item && typeof item === 'object' && 'id' in item && 'title' in item),
    )
    .map((item) => ({
      id: String(item.id),
      title: String(item.title).trim(),
      completed: Boolean(item.completed),
      createdAt: normalizeIsoString(item.createdAt),
      completedAt: item.completedAt ? normalizeIsoString(item.completedAt) : undefined,
      dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : undefined,
      priority: normalizeTodoPriority(item.priority),
      project: typeof item.project === 'string' && item.project.trim().length > 0 ? item.project.trim() : '미분류',
    }))
    .filter((item) => item.title.length > 0);
}

function normalizeWorkLogs(input: unknown): WorkHistoryRecord[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter(
      (item): item is Partial<WorkHistoryRecord> & Pick<WorkHistoryRecord, 'id' | 'title' | 'date'> =>
        Boolean(item && typeof item === 'object' && 'id' in item && 'title' in item && 'date' in item),
    )
    .map((item) => ({
      id: String(item.id),
      date: normalizeDateKey(item.date),
      title: String(item.title).trim(),
      summary: typeof item.summary === 'string' ? item.summary.trim() : '',
      category: normalizeWorkCategory(item.category),
      status: normalizeWorkStatus(item.status),
      owner: typeof item.owner === 'string' && item.owner.trim().length > 0 ? item.owner.trim() : '나',
      tags: Array.isArray(item.tags)
        ? item.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
        : [],
      project: typeof item.project === 'string' && item.project.trim().length > 0 ? item.project.trim() : '미분류',
      outcome: typeof item.outcome === 'string' ? item.outcome.trim() : '',
      source: typeof item.source === 'string' && item.source.trim().length > 0 ? item.source.trim() : 'Workspace Portal',
      pinned: Boolean(item.pinned),
    }))
    .filter((item) => item.title.length > 0)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function normalizeMemos(input: unknown): MemoItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter(
      (item): item is Partial<MemoItem> & Pick<MemoItem, 'id' | 'title' | 'content'> =>
        Boolean(item && typeof item === 'object' && 'id' in item && 'title' in item && 'content' in item),
    )
    .map((item) => ({
      id: String(item.id),
      title: String(item.title).trim(),
      content: String(item.content).trim(),
      tags: Array.isArray(item.tags)
        ? item.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
        : [],
      pinned: Boolean(item.pinned),
      createdAt: normalizeIsoString(item.createdAt),
      updatedAt: normalizeIsoString(item.updatedAt ?? item.createdAt),
    }))
    .filter((item) => item.title.length > 0 && item.content.length > 0);
}

function normalizeIsoString(value: unknown): string {
  if (typeof value !== 'string') {
    return new Date(0).toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }

  return parsed.toISOString();
}

function normalizeDateKey(value: unknown): string {
  if (typeof value !== 'string') {
    return new Date(0).toISOString().slice(0, 10);
  }

  const candidate = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate)
    ? candidate
    : new Date(0).toISOString().slice(0, 10);
}

function normalizeTodoPriority(value: unknown): TodoPriority {
  if (value === 'high' || value === 'low' || value === 'medium') {
    return value;
  }

  return 'medium';
}

function normalizeWorkCategory(value: unknown): WorkCategory {
  if (
    value === 'planning' ||
    value === 'meeting' ||
    value === 'analysis' ||
    value === 'delivery' ||
    value === 'automation' ||
    value === 'improvement'
  ) {
    return value;
  }

  return 'planning';
}

function normalizeWorkStatus(value: unknown): WorkStatus {
  if (value === 'done' || value === 'in-progress' || value === 'blocked') {
    return value;
  }

  return 'done';
}

function normalizeResourceSource(value: unknown): WorkspaceResource['source'] {
  if (value === 'sheets-search' || value === 'sheets-list' || value === 'history') {
    return value;
  }

  return 'history';
}

function normalizeCount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.floor(value));
}
