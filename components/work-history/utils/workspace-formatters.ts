import type { MemoItem, TodoItem } from '@/types/workspace-state';
import type { WorkspaceResource } from '@/types/workspace-resource';
import type { WorkHistoryRecord } from '@/types/work-history';
import type { GoogleSpreadsheetFile } from '@/types/google-drive';
import type { SpreadsheetSearchMatch } from '@/components/work-history/google-sheets-global-search';
import { getTodayDateInputValue } from './workspace-calendar-utils';

const DEFAULT_KEYWORDS = ['지표', '대시보드', '주간', '운영', '리포트', '자동화'];

export function formatMonthLabel(monthKey: string): string {
  const date = new Date(`${monthKey}T00:00:00`);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatSelectedDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

export function formatDateTime(value?: string): string {
  if (!value) return '정보 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '정보 없음';

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatPreviewDate(value?: string): string {
  if (!value) return '정보 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '정보 없음';

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDueDate(value?: string): string {
  if (!value) return '마감일 없음';

  const today = getTodayDateInputValue();
  if (value < today) return `지남 · ${value}`;
  if (value === today) return '오늘 마감';
  return value;
}

// ── Resource transform helpers ──────────────────────────────────────

export function toHistoryResource(record: WorkHistoryRecord): WorkspaceResource {
  return {
    id: `history-${record.id}`,
    title: record.title,
    href: '#workspace-overview',
    subtitle: `${record.project} · ${record.date}`,
    description: record.summary,
    source: 'history',
  };
}

export function toMemoResource(memo: MemoItem): WorkspaceResource {
  return {
    id: `memo-${memo.id}`,
    title: memo.title,
    href: '#workspace-memos',
    subtitle: memo.tags.length > 0 ? memo.tags.map((tag) => `#${tag}`).join(' ') : '업무 메모',
    description: memo.content,
    source: 'history',
  };
}

export function toSheetFileResource(file: GoogleSpreadsheetFile): WorkspaceResource {
  return {
    id: `sheet-${file.id}`,
    title: file.name,
    href: file.webViewLink,
    subtitle: 'Google Sheets',
    description:
      file.owners?.[0]?.displayName ?? file.owners?.[0]?.emailAddress ?? 'Google Sheets 문서',
    source: 'sheets-list',
  };
}

export function toSpreadsheetSearchResource(result: SpreadsheetSearchMatch): WorkspaceResource {
  return {
    id: `search-${result.fileId}-${result.sheetName}-${result.rowNumber}`,
    title: result.fileName,
    href: result.webViewLink,
    subtitle: `${result.sheetName} · ${result.rowNumber}행`,
    description: result.snippet,
    source: 'sheets-search',
  };
}

// ── Work log helpers ────────────────────────────────────────────────

export function buildTodoWorkLogId(workspaceOwnerKey: string, todoId: string): string {
  return `local-work-${workspaceOwnerKey}-${todoId}`;
}

export function pruneTodoDerivedWorkLogs(
  records: WorkHistoryRecord[],
  todos: TodoItem[],
  workspaceOwnerKey: string,
): WorkHistoryRecord[] {
  const todoDerivedRecordIds = new Set(
    todos.map((todo) => buildTodoWorkLogId(workspaceOwnerKey, todo.id)),
  );

  return records.filter((record) => {
    if (record.source !== 'Workspace Todo') return true;
    return todoDerivedRecordIds.has(record.id);
  });
}

export function pruneRemovedWorkLogResources(
  resources: WorkspaceResource[],
  records: WorkHistoryRecord[],
): WorkspaceResource[] {
  const activeRecordIds = new Set(records.map((record) => `history-${record.id}`));

  return resources.filter((resource) => {
    if (!resource.id.startsWith('history-local-work-')) return true;
    return activeRecordIds.has(resource.id);
  });
}

// ── Keyword suggestions ─────────────────────────────────────────────

export function buildKeywordSuggestions(
  records: WorkHistoryRecord[],
  recentResources: WorkspaceResource[],
  favoriteResources: WorkspaceResource[],
  todos: TodoItem[],
  memos: MemoItem[],
): string[] {
  const counts = new Map<string, number>();

  const add = (value: string, weight = 1) => {
    for (const token of tokenizeKeywordSource(value)) {
      counts.set(token, (counts.get(token) ?? 0) + weight);
    }
  };

  DEFAULT_KEYWORDS.forEach((keyword) => add(keyword, 4));
  records.forEach((record) => {
    add(record.title, 3);
    add(record.project, 2);
    record.tags.forEach((tag) => add(tag, 2));
  });
  [...recentResources, ...favoriteResources].forEach((resource) => {
    add(resource.title, 3);
    add(resource.subtitle ?? '', 1);
  });
  todos.forEach((todo) => {
    add(todo.title, todo.completed ? 1 : 3);
    add(todo.project, 2);
  });
  memos.forEach((memo) => {
    add(memo.title, memo.pinned ? 3 : 1);
    memo.tags.forEach((tag) => add(tag, 2));
  });

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0], 'ko');
    })
    .map(([keyword]) => keyword)
    .filter((keyword) => keyword.length >= 2)
    .slice(0, 8);
}

function tokenizeKeywordSource(value: string): string[] {
  return value
    .split(/[\s,./|#()[\]-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}
