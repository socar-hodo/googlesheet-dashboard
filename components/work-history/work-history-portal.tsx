'use client';

import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Circle,
  Clock3,
  ExternalLink,
  Filter,
  ListTodo,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { GoogleSheetsFinder } from '@/components/work-history/google-sheets-finder';
import {
  GoogleSheetsGlobalSearch,
  type SpreadsheetSearchMatch,
} from '@/components/work-history/google-sheets-global-search';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { buildWorkspaceOwnerKey } from '@/lib/workspace-owner';
import { workStatusLabels } from '@/lib/work-history';
import { cn } from '@/lib/utils';
import type { GoogleSpreadsheetFile } from '@/types/google-drive';
import type { WorkCategory, WorkHistoryRecord, WorkStatus } from '@/types/work-history';
import type { MemoItem, TodoItem, TodoPriority, WorkspaceState } from '@/types/workspace-state';
import type { WorkspaceResource } from '@/types/workspace-resource';
import { useSession } from 'next-auth/react';

const RECENT_STORAGE_KEY = 'workspace-portal-recent';
const FAVORITES_STORAGE_KEY = 'workspace-portal-favorites';
const TODO_STORAGE_KEY = 'workspace-portal-todos';
const WORK_LOG_STORAGE_KEY = 'workspace-portal-work-logs';
const MEMO_STORAGE_KEY = 'workspace-portal-memos';
const WORKSPACE_SETTINGS_STORAGE_KEY = 'workspace-portal-settings';
const DEFAULT_KEYWORDS = ['지표', '대시보드', '주간', '운영', '리포트', '자동화'];

type ResourceCardId = 'recent' | 'favorites' | 'recommended';

type WorkspaceTone = 'sand' | 'sky' | 'mint';

interface WorkspaceSettings {
  title: string;
  subtitle: string;
  tone: WorkspaceTone;
  showTodoFocus: boolean;
  showMemos: boolean;
  showResources: boolean;
  resourceCardOrder: ResourceCardId[];
}

const todoPriorities: Array<{ value: TodoPriority; label: string }> = [
  { value: 'high', label: '높음' },
  { value: 'medium', label: '중간' },
  { value: 'low', label: '낮음' },
];

const priorityTone: Record<TodoPriority, string> = {
  high: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300',
  medium: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300',
  low: 'bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300',
};

interface WorkHistoryPortalProps {
  records: WorkHistoryRecord[];
}

async function fetchWorkspaceState(): Promise<WorkspaceState> {
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

async function saveWorkspaceState(state: WorkspaceState) {
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

function serializeWorkspaceState(state: WorkspaceState): string {
  return JSON.stringify({
    recentResources: normalizeStoredResources(state.recentResources),
    favoriteResources: normalizeStoredResources(state.favoriteResources),
    todos: normalizeStoredTodos(state.todos),
    localRecords: normalizeStoredWorkLogs(state.localRecords),
    memos: normalizeStoredMemos(state.memos),
  });
}

export function WorkHistoryPortal({ records }: WorkHistoryPortalProps) {
  const { data: session, status } = useSession();
  const workspaceOwnerKey = useMemo(
    () => buildWorkspaceOwnerKey(session?.user?.email, session?.user?.id),
    [session?.user?.email, session?.user?.id],
  );
  const workspaceDisplayName = session?.user?.name?.trim() || session?.user?.email?.split('@')[0] || '나';

  if (status === 'loading') {
    return (
      <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.25)]">
        <CardContent className="flex min-h-[220px] items-center justify-center">
          <div className="space-y-2 text-center">
            <p className="text-sm font-medium text-foreground">워크스페이스를 불러오는 중입니다.</p>
            <p className="text-sm text-muted-foreground">
              로그인 정보를 확인한 뒤 저장된 To-do와 메모를 가져오고 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScopedWorkHistoryPortal
      key={workspaceOwnerKey}
      records={records}
      workspaceOwnerKey={workspaceOwnerKey}
      workspaceDisplayName={workspaceDisplayName}
    />
  );
}

function ScopedWorkHistoryPortal({
  records,
  workspaceOwnerKey,
  workspaceDisplayName,
}: WorkHistoryPortalProps & {
  workspaceOwnerKey: string;
  workspaceDisplayName: string;
}) {
  const lastSyncedWorkspaceState = useRef<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | WorkStatus>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [showDetailedSearch, setShowDetailedSearch] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDateInputValue());
  const [calendarMonth, setCalendarMonth] = useState(getMonthStartKey(getTodayDateInputValue()));

  const [selectedDateTodoInput, setSelectedDateTodoInput] = useState('');
  const [selectedDateTodoPriority, setSelectedDateTodoPriority] = useState<TodoPriority>('medium');
  const [selectedDateTodoProject, setSelectedDateTodoProject] = useState('미분류');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState('');
  const [editingTodoPriority, setEditingTodoPriority] = useState<TodoPriority>('medium');
  const [editingTodoProject, setEditingTodoProject] = useState('미분류');
  const [editingTodoDueDate, setEditingTodoDueDate] = useState(getTodayDateInputValue());

  const [memoTitle, setMemoTitle] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [memoTags, setMemoTags] = useState('');
  const [memoQuery, setMemoQuery] = useState('');

  const recentStorageKey = useMemo(() => buildScopedStorageKey(RECENT_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const favoritesStorageKey = useMemo(() => buildScopedStorageKey(FAVORITES_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const todoStorageKey = useMemo(() => buildScopedStorageKey(TODO_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const workLogStorageKey = useMemo(() => buildScopedStorageKey(WORK_LOG_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const memoStorageKey = useMemo(() => buildScopedStorageKey(MEMO_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const workspaceSettingsStorageKey = useMemo(() => buildScopedStorageKey(WORKSPACE_SETTINGS_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const defaultWorkspaceSettings = useMemo(() => createDefaultWorkspaceSettings(workspaceDisplayName), [workspaceDisplayName]);
  const [recentResources, setRecentResources] = useState<WorkspaceResource[]>(() => readStoredResources(recentStorageKey));
  const [favoriteResources, setFavoriteResources] = useState<WorkspaceResource[]>(() => readStoredResources(favoritesStorageKey));
  const [todos, setTodos] = useState<TodoItem[]>(() => readStoredTodos(todoStorageKey));
  const [localRecords, setLocalRecords] = useState<WorkHistoryRecord[]>(() => readStoredWorkLogs(workLogStorageKey));
  const [memos, setMemos] = useState<MemoItem[]>(() => readStoredMemos(memoStorageKey));
  const [workspaceStateReady, setWorkspaceStateReady] = useState(false);
  const [workspaceStateError, setWorkspaceStateError] = useState<string | null>(null);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [draggingResourceCard, setDraggingResourceCard] = useState<ResourceCardId | null>(null);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(() => readStoredWorkspaceSettings(workspaceSettingsStorageKey, defaultWorkspaceSettings));
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceSettings>(() => readStoredWorkspaceSettings(workspaceSettingsStorageKey, defaultWorkspaceSettings));
  const [sheetSearchPreview, setSheetSearchPreview] = useState<{ query: string; loading: boolean; error: string | null; indexedFileCount: number; results: SpreadsheetSearchMatch[] }>({ query: '', loading: false, error: null, indexedFileCount: 0, results: [] });
  const [sheetListPreview, setSheetListPreview] = useState<{ query: string; loading: boolean; error: string | null; files: GoogleSpreadsheetFile[] }>({ query: '', loading: false, error: null, files: [] });

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const allRecords = useMemo(() => [...localRecords, ...records].sort((a, b) => b.date.localeCompare(a.date)), [localRecords, records]);
  const projectOptions = useMemo(
    () => [...new Set(['미분류', ...allRecords.map((record) => record.project).filter(Boolean)])],
    [allRecords],
  );

  const filteredRecords = useMemo(() => {
    return allRecords.filter((record) => {
      const haystack = [record.title, record.summary, record.project, record.outcome, record.source, ...record.tags].join(' ').toLowerCase();
      return (
        (normalizedQuery.length === 0 || haystack.includes(normalizedQuery)) &&
        (status === 'all' || record.status === status) &&
        (!pinnedOnly || record.pinned)
      );
    });
  }, [allRecords, normalizedQuery, status, pinnedOnly]);

  const visibleMemos = useMemo(() => {
    const normalized = (memoQuery.trim() || deferredQuery.trim()).toLowerCase();
    return sortMemos(
      memos.filter((memo) => {
        const haystack = [memo.title, memo.content, ...memo.tags].join(' ').toLowerCase();
        return normalized.length === 0 || haystack.includes(normalized);
      }),
    );
  }, [memos, memoQuery, deferredQuery]);

  const sortedTodos = useMemo(() => sortTodos(todos), [todos]);
  const todayTodos = useMemo(() => sortedTodos.filter((todo) => !todo.completed && isTodayTask(todo)), [sortedTodos]);
  const completedTodos = useMemo(() => sortedTodos.filter((todo) => todo.completed).slice(0, 8), [sortedTodos]);
  const selectedDateTodos = useMemo(
    () => sortTodos(sortedTodos.filter((todo) => todo.dueDate === selectedDate)),
    [selectedDate, sortedTodos],
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth, sortedTodos),
    [calendarMonth, sortedTodos],
  );

  const stats = useMemo(() => ({
    total: filteredRecords.length,
    active: filteredRecords.filter((record) => record.status === 'in-progress').length,
    recent: recentResources.length,
    favorites: favoriteResources.length,
  }), [filteredRecords, recentResources.length, favoriteResources.length]);

  const todoSummary = useMemo(() => {
    const total = sortedTodos.length;
    const completed = sortedTodos.filter((todo) => todo.completed).length;
    const active = total - completed;
    return {
      total,
      completed,
      active,
      progress: total === 0 ? 0 : Math.round((completed / total) * 100),
      dueToday: sortedTodos.filter((todo) => !todo.completed && isTodayTask(todo)).length,
    };
  }, [sortedTodos]);

  const memoSummary = useMemo(() => ({ total: memos.length, pinned: memos.filter((memo) => memo.pinned).length, visible: visibleMemos.length }), [memos, visibleMemos]);
  const recommendedResources = useMemo(() => dedupeResources([...favoriteResources, ...recentResources]).slice(0, 6), [favoriteResources, recentResources]);
  const keywordSuggestions = useMemo(() => buildKeywordSuggestions(allRecords, recentResources, favoriteResources, sortedTodos, memos), [allRecords, recentResources, favoriteResources, sortedTodos, memos]);
  const workspaceToneClass = workspaceToneClassMap[workspaceSettings.tone];

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceState() {
      setWorkspaceStateReady(false);
      setWorkspaceStateError(null);

      try {
        const serverState = await fetchWorkspaceState();
        const localRecentResources = readStoredResources(recentStorageKey);
        const localFavoriteResources = readStoredResources(favoritesStorageKey);
        const localTodos = readStoredTodos(todoStorageKey);
        const localRecords = readStoredWorkLogs(workLogStorageKey);
        const localMemos = readStoredMemos(memoStorageKey);
        const nextTodos =
          serverState.todos.length === 0 && localTodos.length > 0 ? localTodos : serverState.todos;
        const mergedLocalRecords =
          serverState.localRecords.length === 0 && localRecords.length > 0
            ? localRecords
            : serverState.localRecords;
        const nextLocalRecords = pruneTodoDerivedWorkLogs(mergedLocalRecords, nextTodos, workspaceOwnerKey);
        const nextMemos =
          serverState.memos.length === 0 && localMemos.length > 0 ? localMemos : serverState.memos;
        const nextRecentResources = pruneRemovedWorkLogResources(
          serverState.recentResources.length === 0 && localRecentResources.length > 0
            ? localRecentResources
            : serverState.recentResources,
          nextLocalRecords,
        );
        const nextFavoriteResources = pruneRemovedWorkLogResources(
          serverState.favoriteResources.length === 0 && localFavoriteResources.length > 0
            ? localFavoriteResources
            : serverState.favoriteResources,
          nextLocalRecords,
        );

        if (cancelled) return;

        lastSyncedWorkspaceState.current = serializeWorkspaceState(serverState);
        setRecentResources(nextRecentResources);
        setFavoriteResources(nextFavoriteResources);
        setTodos(nextTodos);
        setLocalRecords(nextLocalRecords);
        setMemos(nextMemos);
      } catch (error) {
        if (cancelled) return;
        setWorkspaceStateError(
          error instanceof Error ? error.message : '워크스페이스 상태를 불러오지 못했습니다.',
        );
      } finally {
        if (!cancelled) {
          setWorkspaceStateReady(true);
        }
      }
    }

    void loadWorkspaceState();

    return () => {
      cancelled = true;
    };
  }, [
    favoritesStorageKey,
    memoStorageKey,
    recentStorageKey,
    todoStorageKey,
    workLogStorageKey,
    workspaceOwnerKey,
  ]);

  useEffect(() => {
    writeStoredResources(recentStorageKey, recentResources);
  }, [recentResources, recentStorageKey]);

  useEffect(() => {
    writeStoredResources(favoritesStorageKey, favoriteResources);
  }, [favoriteResources, favoritesStorageKey]);

  useEffect(() => {
    writeStoredTodos(todoStorageKey, todos);
  }, [todoStorageKey, todos]);

  useEffect(() => {
    writeStoredWorkLogs(workLogStorageKey, localRecords);
  }, [localRecords, workLogStorageKey]);

  useEffect(() => {
    writeStoredMemos(memoStorageKey, memos);
  }, [memoStorageKey, memos]);

  useEffect(() => {
    if (!workspaceStateReady) return;
    const serializedState = serializeWorkspaceState({
      recentResources,
      favoriteResources,
      todos,
      localRecords,
      memos,
    });
    if (lastSyncedWorkspaceState.current === serializedState) return;

    let cancelled = false;

    async function persistWorkspaceState() {
      try {
        await saveWorkspaceState({
          recentResources,
          favoriteResources,
          todos,
          localRecords,
          memos,
        });
        if (!cancelled) {
          lastSyncedWorkspaceState.current = serializedState;
          setWorkspaceStateError(null);
        }
      } catch (error) {
        if (cancelled) return;
        setWorkspaceStateError(
          error instanceof Error ? error.message : '워크스페이스 상태를 저장하지 못했습니다.',
        );
      }
    }

    void persistWorkspaceState();

      return () => {
        cancelled = true;
      };
  }, [workspaceStateReady, recentResources, favoriteResources, todos, localRecords, memos]);

  function handleOpenResource(resource: WorkspaceResource) {
    setRecentResources((current) => {
      const existing = current.find((item) => item.id === resource.id);
      return dedupeResources([
        {
          ...resource,
          openedAt: new Date().toISOString(),
          openedCount: (existing?.openedCount ?? resource.openedCount ?? 0) + 1,
        },
        ...current,
      ]).slice(0, 8);
    });
  }

  function handleToggleFavorite(resource: WorkspaceResource) {
    setFavoriteResources((current) => {
      const exists = current.some((item) => item.id === resource.id);
      return exists
        ? current.filter((item) => item.id !== resource.id)
        : [{ ...resource, openedAt: resource.openedAt ?? new Date().toISOString() }, ...current].slice(0, 8);
    });
  }

  function handleRemoveRecent(resourceId: string) {
    setRecentResources((current) => current.filter((item) => item.id !== resourceId));
  }

  function handleRemoveFavorite(resourceId: string) {
    setFavoriteResources((current) => current.filter((item) => item.id !== resourceId));
  }

  function handleAddSelectedDateTodo() {
    const title = selectedDateTodoInput.trim();
    if (!title) return;
    const project = selectedDateTodoProject.trim() || '미분류';

    appendTodo({
      title,
      dueDate: selectedDate,
      priority: selectedDateTodoPriority,
      project,
    });
    setSelectedDateTodoInput('');
    setSelectedDateTodoProject('미분류');
    setSelectedDateTodoPriority('medium');
  }

  function appendTodo({
    title,
    dueDate,
    priority,
    project,
  }: {
    title: string;
    dueDate?: string;
    priority: TodoPriority;
    project: string;
  }) {
    setTodos((current) => {
      return sortTodos([
        {
          id: `todo-${workspaceOwnerKey}-${crypto.randomUUID()}`,
          title,
          completed: false,
          createdAt: new Date().toISOString(),
          dueDate,
          priority,
          project,
        },
        ...current,
      ]);
    });
  }

  function handleToggleTodo(todoId: string) {
    setTodos((current) =>
      current.map((todo) => todo.id === todoId ? { ...todo, completed: !todo.completed, completedAt: !todo.completed ? new Date().toISOString() : undefined } : todo),
    );
  }

  function handleRestoreTodoToToday(todoId: string) {
    handleRestoreTodoToDate(todoId, getTodayDateInputValue());
  }

  function handleRestoreTodoToDate(todoId: string, dateKey: string) {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              completed: false,
              completedAt: undefined,
              dueDate: dateKey,
            }
          : todo,
      ),
    );
  }

  function handleStartEditingTodo(todo: TodoItem) {
    setEditingTodoId(todo.id);
    setEditingTodoTitle(todo.title);
    setEditingTodoPriority(todo.priority);
    setEditingTodoProject(todo.project);
    setEditingTodoDueDate(todo.dueDate ?? selectedDate);
  }

  function handleCancelEditingTodo() {
    setEditingTodoId(null);
    setEditingTodoTitle('');
    setEditingTodoPriority('medium');
    setEditingTodoProject('미분류');
    setEditingTodoDueDate(getTodayDateInputValue());
  }

  function handleSaveEditedTodo() {
    const title = editingTodoTitle.trim();
    const project = editingTodoProject.trim() || '미분류';
    const dueDate = editingTodoDueDate || selectedDate;
    if (!editingTodoId || !title) return;

    setTodos((current) =>
      sortTodos(
        current.map((todo) =>
          todo.id === editingTodoId
            ? {
                ...todo,
                title,
                priority: editingTodoPriority,
                project,
                dueDate,
              }
            : todo,
        ),
      ),
    );
    handleCancelEditingTodo();
  }

  function handleRemoveTodo(todoId: string) {
    const workLogId = buildTodoWorkLogId(workspaceOwnerKey, todoId);
    const resourceId = `history-${workLogId}`;

    setTodos((current) => current.filter((todo) => todo.id !== todoId));
    setLocalRecords((current) => current.filter((record) => record.id !== workLogId));
    setRecentResources((current) => current.filter((resource) => resource.id !== resourceId));
    setFavoriteResources((current) => current.filter((resource) => resource.id !== resourceId));
    if (editingTodoId === todoId) {
      handleCancelEditingTodo();
    }
  }

  function handleCreateWorkLogFromTodo(todo: TodoItem) {
    const record: WorkHistoryRecord = {
      id: buildTodoWorkLogId(workspaceOwnerKey, todo.id),
      date: getTodayDateInputValue(),
      title: todo.title,
      summary: todo.project + ' 프로젝트에서 완료한 할 일을 업무 기록으로 남겼습니다.',
      category: mapTodoPriorityToCategory(todo.priority),
      status: 'done',
      owner: '나',
      tags: ['todo', todo.project, todo.priority],
      project: todo.project,
      outcome: todoPriorities.find((item) => item.value === todo.priority)?.label + ' 우선순위 업무 완료',
      source: 'Workspace Todo',
      pinned: todo.priority === 'high',
    };
    setLocalRecords((current) => {
      return [record, ...current.filter((item) => item.id !== record.id)].sort((a, b) =>
        b.date.localeCompare(a.date),
      );
    });
    handleOpenResource(toHistoryResource(record));
  }

  function handleAddMemo() {
    const title = memoTitle.trim();
    const content = memoContent.trim();
    if (!title || !content) return;
    setMemos((current) => {
      const now = new Date().toISOString();
      return sortMemos([
        {
          id: `memo-${workspaceOwnerKey}-${crypto.randomUUID()}`,
          title,
          content,
          tags: parseMemoTags(memoTags),
          pinned: false,
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ]);
    });
    setMemoTitle('');
    setMemoContent('');
    setMemoTags('');
  }

  function handleToggleMemoPinned(memoId: string) {
    setMemos((current) =>
      sortMemos(current.map((memo) => memo.id === memoId ? { ...memo, pinned: !memo.pinned, updatedAt: new Date().toISOString() } : memo)),
    );
  }

  function handleRemoveMemo(memoId: string) {
    setMemos((current) => current.filter((memo) => memo.id !== memoId));
  }

  function handleWorkspaceSettingChange<Key extends keyof WorkspaceSettings>(
    key: Key,
    value: WorkspaceSettings[Key],
  ) {
    setWorkspaceDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSaveWorkspaceSettings() {
    const next = {
      ...workspaceDraft,
      title: workspaceDraft.title.trim() || defaultWorkspaceSettings.title,
      subtitle: workspaceDraft.subtitle.trim() || defaultWorkspaceSettings.subtitle,
      resourceCardOrder: normalizeResourceCardOrder(workspaceDraft.resourceCardOrder),
    };
    setWorkspaceSettings(next);
    setWorkspaceDraft(next);
    writeStoredWorkspaceSettings(workspaceSettingsStorageKey, next);
    setShowWorkspaceSettings(false);
  }

  function handleResetWorkspaceSettings() {
    setWorkspaceSettings(defaultWorkspaceSettings);
    setWorkspaceDraft(defaultWorkspaceSettings);
    writeStoredWorkspaceSettings(workspaceSettingsStorageKey, defaultWorkspaceSettings);
  }

  function handleMoveResourceCard(sourceId: ResourceCardId, targetId: ResourceCardId) {
    if (sourceId === targetId) return;

    setWorkspaceDraft((current) => {
      const order = [...normalizeResourceCardOrder(current.resourceCardOrder)];
      const sourceIndex = order.indexOf(sourceId);
      const targetIndex = order.indexOf(targetId);
      if (sourceIndex === -1 || targetIndex === -1) return current;
      const [moved] = order.splice(sourceIndex, 1);
      order.splice(targetIndex, 0, moved);
      return {
        ...current,
        resourceCardOrder: order,
      };
    });
  }

  const previewSections = [
    {
      key: 'history',
      title: '업무 기록',
      count: filteredRecords.length,
      emptyText: '일치하는 업무 기록이 없습니다.',
      items: filteredRecords.slice(0, 3).map((record) => ({ id: record.id, title: record.title, subtitle: record.project + ' · ' + record.date, href: '#workspace-overview', external: false, onOpen: () => handleOpenResource(toHistoryResource(record)) })),
    },
    {
      key: 'memo',
      title: '업무 메모',
      count: visibleMemos.length,
      emptyText: '일치하는 메모가 없습니다.',
      items: visibleMemos.slice(0, 3).map((memo) => ({ id: memo.id, title: memo.title, subtitle: memo.tags.length > 0 ? memo.tags.map((tag) => '#' + tag).join(' ') : '업무 메모', href: '#workspace-memos', external: false, onOpen: () => handleOpenResource(toMemoResource(memo)) })),
    },
    {
      key: 'sheet-search',
      title: '시트 내용',
      count: sheetSearchPreview.results.length,
      emptyText: sheetSearchPreview.loading ? '시트 내용 검색 중입니다.' : sheetSearchPreview.error ?? '일치하는 시트 내용이 없습니다.',
      items: sheetSearchPreview.results.slice(0, 3).map((result) => ({ id: result.fileId + '-' + result.sheetName + '-' + result.rowNumber, title: result.fileName, subtitle: result.sheetName + ' · ' + result.rowNumber + '행', href: result.webViewLink, external: true, onOpen: () => handleOpenResource(toSpreadsheetSearchResource(result)) })),
    },
    {
      key: 'sheet-list',
      title: '내 시트 목록',
      count: sheetListPreview.files.length,
      emptyText: sheetListPreview.loading ? '시트 목록을 불러오는 중입니다.' : sheetListPreview.error ?? '일치하는 시트가 없습니다.',
      items: sheetListPreview.files.slice(0, 3).map((file) => ({ id: file.id, title: file.name, subtitle: '수정 ' + formatPreviewDate(file.modifiedTime), href: file.webViewLink, external: true, onOpen: () => handleOpenResource(toSheetFileResource(file)) })),
    },
  ];

  const resourceCards = {
    recent: <ResourcePanel icon={Clock3} title="최근 본 문서" emptyText="아직 최근 문서가 없습니다. 시트나 메모를 열면 여기에 자동으로 쌓입니다." removeLabel="최근 문서에서 제거" resources={recentResources} onRemove={handleRemoveRecent} />,
    favorites: <ResourcePanel icon={Star} title="즐겨찾기" emptyText="자주 보는 시트나 문서를 즐겨찾기로 고정해 두세요." removeLabel="즐겨찾기 제거" resources={favoriteResources} onRemove={handleRemoveFavorite} />,
    recommended: <ResourcePanel icon={Sparkles} title="추천 문서" emptyText="열람 기록이 쌓이면 최근 문서와 즐겨찾기 기준으로 추천해 드립니다." resources={recommendedResources} />,
  } as const;

  const autocompleteItems = (() => {
    if (!normalizedQuery) return [];

    const sectionPriority = ['sheet-search', 'sheet-list', 'history', 'memo'];
    const orderedSections = [...previewSections].sort(
      (left, right) => sectionPriority.indexOf(left.key) - sectionPriority.indexOf(right.key),
    );
    const queues = orderedSections.map((section) => ({
      title: section.title,
      items: section.items.map((item) => ({
        ...item,
        sectionTitle: section.title,
      })),
    }));
    const seen = new Set<string>();
    const next: Array<(typeof queues)[number]['items'][number]> = [];

    while (next.length < 8) {
      let appended = false;

      for (const queue of queues) {
        const candidate = queue.items.shift();
        if (!candidate || seen.has(candidate.id)) continue;

        seen.add(candidate.id);
        next.push(candidate);
        appended = true;

        if (next.length >= 8) break;
      }

      if (!appended) break;
    }

    return next;
  })();
  const autocompleteLoading = normalizedQuery.length > 0 && (sheetSearchPreview.loading || sheetListPreview.loading);
  const autocompleteHasResults = autocompleteItems.length > 0;

  return (
    <div id="workspace-overview" className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_22rem]">
        <Card
          className={cn(
            'overflow-hidden border border-border/60 shadow-[0_28px_70px_-50px_rgba(20,26,36,0.28)]',
            workspaceToneClass.card,
          )}
        >
          <CardContent className="p-6 md:p-7">
            <div className="space-y-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cn(
                        'rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]',
                        workspaceToneClass.badge,
                      )}
                    >
                      {workspaceDisplayName} workspace
                    </p>
                    <span className="text-xs font-medium text-muted-foreground">
                      필요한 문서와 해야 할 일을 빠르게 다시 여는 허브
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-[2.25rem]">
                      {workspaceSettings.title}
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      {workspaceSettings.subtitle}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard label="업무 기록" value={`${stats.total}건`} />
                    <SummaryCard label="진행 중" value={`${stats.active}건`} />
                    <SummaryCard label="최근 문서" value={`${stats.recent}건`} />
                    <SummaryCard label="즐겨찾기" value={`${stats.favorites}건`} />
                  </div>
                </div>
                <div className="flex flex-col gap-3 xl:min-w-[16rem]">
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      'h-11 rounded-2xl border border-border/70 bg-background/90 text-foreground hover:bg-background',
                      showWorkspaceSettings && 'border-foreground bg-foreground text-background hover:bg-foreground/92',
                    )}
                    onClick={() => {
                      setWorkspaceDraft(workspaceSettings);
                      setShowWorkspaceSettings((current) => !current);
                    }}
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    워크스페이스 편집
                  </Button>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground">오늘 마감</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{todoSummary.dueToday}건</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground">To-do 진행률</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{todoSummary.progress}%</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground">메모</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{memoSummary.total}건</p>
                    </div>
                  </div>
                </div>
              </div>

              {showWorkspaceSettings && (
                <div className="grid gap-4 rounded-[1.75rem] border border-border/70 bg-background/80 p-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">헤더 커스텀</p>
                  <input value={workspaceDraft.title} onChange={(event) => handleWorkspaceSettingChange('title', event.target.value)} placeholder="포털 제목" className="h-11 w-full rounded-2xl border border-border/70 bg-background px-4 text-sm text-foreground outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10" />
                  <textarea value={workspaceDraft.subtitle} onChange={(event) => handleWorkspaceSettingChange('subtitle', event.target.value)} placeholder="포털 설명" className="min-h-28 w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10" />
                  <select value={workspaceDraft.tone} onChange={(event) => handleWorkspaceSettingChange('tone', event.target.value as WorkspaceTone)} className="h-11 w-full rounded-2xl border border-border/70 bg-background px-4 text-sm text-foreground outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10">
                    <option value="sand">샌드 톤</option>
                    <option value="sky">스카이 톤</option>
                    <option value="mint">민트 톤</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">보여줄 섹션</p>
                  <WorkspaceSettingToggle label="오늘/완료 패널" checked={workspaceDraft.showTodoFocus} onChange={(checked) => handleWorkspaceSettingChange('showTodoFocus', checked)} />
                  <WorkspaceSettingToggle label="메모 보관함" checked={workspaceDraft.showMemos} onChange={(checked) => handleWorkspaceSettingChange('showMemos', checked)} />
                  <WorkspaceSettingToggle label="최근/즐겨찾기/추천 문서" checked={workspaceDraft.showResources} onChange={(checked) => handleWorkspaceSettingChange('showResources', checked)} />
                  <div className="space-y-2 pt-1">
                    <p className="text-sm font-semibold text-foreground">카드 순서 드래그 변경</p>
                    {workspaceDraft.resourceCardOrder.map((cardId) => (
                      <button
                        key={cardId}
                        type="button"
                        draggable
                        onDragStart={() => setDraggingResourceCard(cardId)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (draggingResourceCard) handleMoveResourceCard(draggingResourceCard, cardId);
                          setDraggingResourceCard(null);
                        }}
                        onDragEnd={() => setDraggingResourceCard(null)}
                        className={cn('flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground transition', draggingResourceCard === cardId && 'border-foreground/30 bg-foreground/[0.04]')}
                      >
                        <span>{resourceCardLabelMap[cardId]}</span>
                        <span className="text-xs text-muted-foreground">드래그</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button type="button" className="rounded-2xl bg-foreground text-background hover:bg-foreground/92" onClick={handleSaveWorkspaceSettings}>저장</Button>
                    <Button type="button" variant="outline" className="rounded-2xl border-border/70 bg-background text-foreground hover:bg-background/80" onClick={() => { setWorkspaceDraft(workspaceSettings); setShowWorkspaceSettings(false); }}>취소</Button>
                    <Button type="button" variant="ghost" className="rounded-2xl text-muted-foreground hover:bg-background hover:text-foreground" onClick={handleResetWorkspaceSettings}>기본값 복원</Button>
                  </div>
                </div>
              </div>
            )}

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,0.9fr)_auto]">
              <div className="relative">
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업무명, 프로젝트, 태그, 결과로 검색" className="h-13 w-full rounded-[1.4rem] border border-border/70 bg-background pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10" />
                </label>
                {normalizedQuery && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-20 overflow-hidden rounded-[1.75rem] border border-border/70 bg-white/98 shadow-[0_26px_70px_-34px_rgba(20,26,36,0.24)] backdrop-blur">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Quick Results</p>
                      <span className="text-xs text-slate-500">{autocompleteHasResults ? `${autocompleteItems.length}개 미리보기` : '검색 중'}</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto p-2">
                      {autocompleteItems.map((item) => (
                        <a
                          key={item.id}
                          href={item.href}
                          target={item.external ? '_blank' : undefined}
                          rel={item.external ? 'noreferrer' : undefined}
                          onClick={item.onOpen}
                          className="flex items-start justify-between gap-3 rounded-2xl px-3 py-3 transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">{item.sectionTitle}</span>
                              <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                            </div>
                            <p className="mt-1 truncate text-xs text-slate-500">{item.subtitle}</p>
                          </div>
                          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        </a>
                      ))}
                      {!autocompleteHasResults && autocompleteLoading && (
                        <div className="rounded-2xl px-3 py-4 text-sm text-slate-500">검색 결과를 불러오는 중입니다.</div>
                      )}
                      {!autocompleteHasResults && !autocompleteLoading && (
                        <div className="rounded-2xl px-3 py-4 text-sm text-slate-500">일치하는 결과가 없습니다. 다른 키워드로 다시 검색해보세요.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <select value={status} onChange={(event) => setStatus(event.target.value as 'all' | WorkStatus)} className="h-13 rounded-[1.4rem] border border-border/70 bg-background px-4 text-sm text-slate-900 outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10">
                <option value="all">전체 상태</option>
                {Object.entries(workStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <Button type="button" variant="ghost" className={cn('h-13 rounded-[1.4rem] border px-4 text-sm', pinnedOnly ? 'border-foreground bg-foreground text-background hover:bg-foreground/92' : 'border-border/70 bg-background text-foreground hover:bg-background/80')} onClick={() => setPinnedOnly((current) => !current)}><Filter className="mr-2 h-4 w-4" />중요 기록만 보기</Button>
            </div>

              <div className="flex flex-wrap gap-2">
                {keywordSuggestions.map((keyword) => (
                  <button key={keyword} type="button" onClick={() => setQuery(keyword)} className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-sm text-foreground transition hover:border-foreground/30 hover:bg-background/80">{keyword}</button>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[1.5rem] border border-border/60 bg-background/75 p-4 shadow-[0_18px_40px_-34px_rgba(20,26,36,0.14)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">월간 일정</p>
                      <p className="mt-1 text-sm text-muted-foreground">날짜를 선택하면 그날 마감인 To-do를 바로 볼 수 있습니다.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => setCalendarMonth(shiftMonthKey(calendarMonth, -1))}
                        aria-label="이전 달"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="min-w-[7rem] text-center text-sm font-semibold text-foreground">
                        {formatMonthLabel(calendarMonth)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => setCalendarMonth(shiftMonthKey(calendarMonth, 1))}
                        aria-label="다음 달"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-2">
                    <div className="px-2 py-1 text-center text-xs font-semibold text-muted-foreground">
                      주차
                    </div>
                    {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                      <div
                        key={day}
                        className={cn(
                          'px-2 py-1 text-center text-xs font-semibold',
                          day === '일' && 'text-rose-500 dark:text-rose-300',
                          day === '토' && 'text-sky-500 dark:text-sky-300',
                          day !== '일' && day !== '토' && 'text-muted-foreground',
                        )}
                      >
                        {day}
                      </div>
                    ))}
                    {calendarDays.map((week) => (
                      <Fragment key={week.weekKey}>
                        <div className="flex items-start justify-center px-2 py-3">
                          <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            {week.isoWeek}
                          </span>
                        </div>
                        {week.days.map((day) => (
                          <button
                            key={day.dateKey}
                            type="button"
                            onClick={() => {
                              setSelectedDate(day.dateKey);
                              if (!day.inMonth) {
                                setCalendarMonth(getMonthStartKey(day.dateKey));
                              }
                            }}
                            className={cn(
                              'min-h-[5.75rem] rounded-2xl border px-2 py-2 text-left transition',
                              day.inMonth
                                ? 'border-border/60 bg-background/80 hover:border-foreground/20'
                                : 'border-border/30 bg-background/35 text-muted-foreground/55',
                              day.dateKey === selectedDate && 'border-primary bg-primary/8 ring-2 ring-primary/20',
                              day.isToday && 'shadow-[inset_0_0_0_1px_rgba(0,120,255,0.25)]',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  day.isHoliday && 'text-rose-500 dark:text-rose-300',
                                  !day.isHoliday && day.dayOfWeek === 0 && 'text-rose-500 dark:text-rose-300',
                                  !day.isHoliday && day.dayOfWeek === 6 && 'text-sky-500 dark:text-sky-300',
                                  !day.isHoliday && day.dayOfWeek !== 0 && day.dayOfWeek !== 6 && (day.isToday ? 'text-primary' : 'text-foreground'),
                                )}
                              >
                                {day.dayNumber}
                              </span>
                              {day.total > 0 && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                  {day.total}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 space-y-1">
                              {day.holidayLabel && (
                                <div className="truncate text-[11px] font-medium text-rose-500 dark:text-rose-300">
                                  {day.holidayLabel}
                                </div>
                              )}
                              {day.total === 0 ? (
                                <div className="text-[11px] text-muted-foreground/70">일정 없음</div>
                              ) : (
                                <>
                                  <div className="text-[11px] text-muted-foreground">진행중 {day.active}건</div>
                                  {day.completed > 0 && (
                                    <div className="text-[11px] text-muted-foreground">완료 {day.completed}건</div>
                                  )}
                                </>
                              )}
                            </div>
                          </button>
                        ))}
                      </Fragment>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-border/60 bg-background/75 p-4 shadow-[0_18px_40px_-34px_rgba(20,26,36,0.14)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">선택한 날짜 To-do</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatSelectedDateLabel(selectedDate)}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {selectedDateTodos.length}건
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                      <div className="grid gap-3">
                        <input
                          value={selectedDateTodoInput}
                          onChange={(event) => setSelectedDateTodoInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleAddSelectedDateTodo();
                            }
                          }}
                          placeholder={`${formatSelectedDateLabel(selectedDate)}에 할 일을 추가하세요`}
                          className="h-11 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                        />
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
                          <input
                            value={selectedDateTodoProject}
                            onChange={(event) => setSelectedDateTodoProject(event.target.value)}
                            list="todo-project-suggestions"
                            placeholder="분류를 입력하세요"
                            className="h-11 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                          />
                          <select
                            value={selectedDateTodoPriority}
                            onChange={(event) => setSelectedDateTodoPriority(event.target.value as TodoPriority)}
                            className="h-11 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                          >
                            {todoPriorities.map((option) => (
                              <option key={`selected-date-priority-${option.value}`} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <Button type="button" className="h-11 rounded-2xl px-4" onClick={handleAddSelectedDateTodo}>
                            <Plus className="mr-2 h-4 w-4" />
                            추가
                          </Button>
                        </div>
                        <datalist id="todo-project-suggestions">
                          {projectOptions.map((project) => (
                            <option key={`project-suggestion-${project}`} value={project} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {selectedDateTodos.length === 0 && (
                      <div className="rounded-2xl bg-background/70 px-4 py-8 text-sm text-muted-foreground">
                        선택한 날짜에 연결된 To-do가 없습니다.
                      </div>
                    )}
                    {selectedDateTodos.map((todo) => {
                      const isEditing = editingTodoId === todo.id;

                      return (
                        <div key={todo.id} className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => (todo.completed ? handleRestoreTodoToDate(todo.id, selectedDate) : handleToggleTodo(todo.id))}
                              className="mt-0.5 shrink-0 text-primary transition hover:opacity-80"
                              aria-label={todo.completed ? `${todo.title} 다시 진행` : `${todo.title} 완료 처리`}
                            >
                              {todo.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="space-y-3">
                                  <input
                                    value={editingTodoTitle}
                                    onChange={(event) => setEditingTodoTitle(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        handleSaveEditedTodo();
                                      }
                                      if (event.key === 'Escape') {
                                        event.preventDefault();
                                        handleCancelEditingTodo();
                                      }
                                    }}
                                    className="h-10 w-full rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                                  />
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <input
                                      value={editingTodoProject}
                                      onChange={(event) => setEditingTodoProject(event.target.value)}
                                      list="todo-project-suggestions"
                                      placeholder="분류를 입력하세요"
                                      className="h-10 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                                    />
                                    <input
                                      type="date"
                                      value={editingTodoDueDate}
                                      onChange={(event) => setEditingTodoDueDate(event.target.value)}
                                      className="h-10 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                                    />
                                    <select
                                      value={editingTodoPriority}
                                      onChange={(event) => setEditingTodoPriority(event.target.value as TodoPriority)}
                                      className="h-10 rounded-2xl border border-border/70 bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                                    >
                                      {todoPriorities.map((option) => (
                                        <option key={`editing-priority-${todo.id}-${option.value}`} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button type="button" className="h-9 rounded-2xl px-3" onClick={handleSaveEditedTodo}>
                                      저장
                                    </Button>
                                    <Button type="button" variant="outline" className="h-9 rounded-2xl px-3" onClick={handleCancelEditingTodo}>
                                      취소
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className={cn('text-sm font-medium text-foreground', todo.completed && 'text-muted-foreground line-through')}>
                                    {todo.title}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <PriorityBadge priority={todo.priority} />
                                    <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                                      {todo.project}
                                    </span>
                                    {todo.completed && (
                                      <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                                        완료 {formatDateTime(todo.completedAt ?? todo.createdAt)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" className="h-9 rounded-2xl px-3" onClick={() => handleStartEditingTodo(todo)}>
                                      수정
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="h-9 rounded-2xl px-3 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleRemoveTodo(todo.id)}
                                    >
                                      삭제
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {workspaceSettings.showTodoFocus && (
        <div className="space-y-4">
          <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.2)]">
            <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ListTodo className="h-4 w-4 text-primary" /><CardTitle className="text-base">오늘/완료 현황</CardTitle></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{todoSummary.progress}%</span></div></CardHeader>
            <CardContent className="space-y-4">
              <Progress value={todoSummary.progress} className="h-2.5" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.35rem] border border-border/60 bg-background/65 px-4 py-4"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">오늘 할 일</p><p className="mt-2 text-2xl font-semibold text-foreground">{todayTodos.length}건</p></div>
                <div className="rounded-[1.35rem] border border-border/60 bg-background/65 px-4 py-4"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">완료한 일</p><p className="mt-2 text-2xl font-semibold text-foreground">{todoSummary.completed}건</p></div>
              </div>
              <div className="rounded-[1.35rem] border border-border/60 bg-background/65 p-4 text-sm leading-6 text-muted-foreground">
                전체 To-do {todoSummary.total}건 중 {todoSummary.completed}건을 완료했고, 현재 {todoSummary.active}건이 진행 중입니다.
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.28)]">
            <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><CardTitle className="text-base">오늘 할 일</CardTitle></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{todayTodos.length}건</span></div></CardHeader>
            <CardContent className="space-y-3">
              {todayTodos.length === 0 && <div className="rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">오늘 처리할 일이 없습니다.</div>}
              {groupTodosByProject(todayTodos).map((group) => (
                <div key={group.project} className="space-y-2">
                  <div className="flex items-center justify-between rounded-2xl bg-background/55 px-3 py-2"><p className="text-sm font-semibold text-foreground">{group.project}</p><span className="text-xs text-muted-foreground">{group.todos.length}건</span></div>
                  {group.todos.slice(0, 3).map((todo) => <button key={todo.id} type="button" onClick={() => handleToggleTodo(todo.id)} className="flex w-full items-start gap-3 rounded-2xl border border-border/60 bg-background/65 px-4 py-3 text-left"><Circle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{todo.title}</p><div className="mt-2 flex flex-wrap gap-2"><PriorityBadge priority={todo.priority} /><TodoDateBadge dueDate={todo.dueDate} /></div></div></button>)}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.28)]">
            <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /><CardTitle className="text-base">완료한 일</CardTitle></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{completedTodos.length}건</span></div></CardHeader>
            <CardContent className="space-y-3">
              {completedTodos.length === 0 && <div className="rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">아직 완료한 일이 없습니다.</div>}
              {groupTodosByProject(completedTodos).map((group) => (
                <div key={group.project} className="space-y-2">
                  <div className="flex items-center justify-between rounded-2xl bg-background/55 px-3 py-2"><p className="text-sm font-semibold text-foreground">{group.project}</p><span className="text-xs text-muted-foreground">{group.todos.length}건</span></div>
                  {group.todos.slice(0, 3).map((todo) => (
                    <div key={todo.id} className="rounded-2xl border border-border/60 bg-background/65 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => handleRestoreTodoToToday(todo.id)}
                          className="mt-0.5 shrink-0 text-primary transition hover:opacity-80"
                          aria-label={`${todo.title} 오늘 할 일로 되돌리기`}
                        >
                          <CheckCircle2 className="h-4.5 w-4.5" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-muted-foreground line-through">{todo.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <PriorityBadge priority={todo.priority} />
                            <TodoDateBadge dueDate={todo.dueDate} />
                            <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">완료 {formatDateTime(todo.completedAt ?? todo.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            왼쪽 체크를 누르면 오늘 할 일로 다시 되돌립니다.
                          </p>
                          <div className="mt-3">
                            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => handleCreateWorkLogFromTodo(todo)}>
                              업무 기록 만들기
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        )}
      </section>

      {workspaceStateError && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {workspaceStateError}
          <span className="ml-2 text-amber-600/80 dark:text-amber-200/80">
            현재 화면 변경은 브라우저 임시 상태에는 남아 있지만 서버 저장은 완료되지 않았을 수 있습니다.
          </span>
        </div>
      )}

      {normalizedQuery && (
        <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.25)]">
          <CardHeader className="pb-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="text-base">통합 미리보기</CardTitle><p className="mt-1 text-sm text-muted-foreground">&quot;{deferredQuery.trim()}&quot; 검색 결과를 바로 확인할 수 있도록 검색 영역 아래에 보여줍니다.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{previewSections.map((section) => <SummaryCard key={section.key} label={section.title} value={section.count + '건'} />)}</div></div></CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-4">{previewSections.map((section) => <div key={section.key} className="rounded-2xl border border-border/60 bg-background/65 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-foreground">{section.title}</p><span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">{section.count}건</span></div><div className="mt-3 space-y-2">{section.items.length === 0 && <div className="rounded-2xl bg-background px-3 py-4 text-sm text-muted-foreground">{section.emptyText}</div>}{section.items.map((item) => <a key={item.id} href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined} onClick={item.onOpen} className="flex items-start justify-between gap-3 rounded-2xl bg-background px-3 py-3 transition hover:bg-card"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p></div><ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /></a>)}</div></div>)}</CardContent>
        </Card>
      )}

      {workspaceSettings.showMemos && (
      <section id="workspace-memos" className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.25)]">
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Bookmark className="h-4 w-4 text-primary" /><CardTitle className="text-base">업무 메모 보관함</CardTitle></div></CardHeader>
          <CardContent className="space-y-3"><input value={memoTitle} onChange={(event) => setMemoTitle(event.target.value)} placeholder="메모 제목을 입력하세요" className="h-11 w-full rounded-2xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition focus:border-primary/40" /><input value={memoTags} onChange={(event) => setMemoTags(event.target.value)} placeholder="태그를 쉼표로 구분해 입력하세요" className="h-11 w-full rounded-2xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition focus:border-primary/40" /><textarea value={memoContent} onChange={(event) => setMemoContent(event.target.value)} placeholder="업무 팁, 실수 방지 포인트, 운영 메모를 남겨두세요" className="min-h-44 w-full rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/40" /><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">자주 찾는 팁과 체크포인트를 쌓아 두면 포털 검색으로 다시 찾기 쉬워집니다.</p><Button type="button" className="h-11 rounded-2xl px-4" onClick={handleAddMemo}><Plus className="mr-2 h-4 w-4" />메모 저장</Button></div></CardContent>
        </Card>
        <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.25)]">
          <CardHeader className="pb-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" /><CardTitle className="text-base">메모 검색</CardTitle></div><div className="grid grid-cols-3 gap-2"><SummaryCard label="전체" value={memoSummary.total + '건'} /><SummaryCard label="고정" value={memoSummary.pinned + '건'} /><SummaryCard label="검색결과" value={memoSummary.visible + '건'} /></div></div></CardHeader>
          <CardContent className="space-y-3"><input value={memoQuery} onChange={(event) => setMemoQuery(event.target.value)} placeholder="메모 제목, 내용, 태그로 검색" className="h-11 w-full rounded-2xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition focus:border-primary/40" />{visibleMemos.length === 0 && <div className="rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">아직 저장된 메모가 없거나 검색 조건에 맞는 메모가 없습니다.</div>}{visibleMemos.slice(0, 8).map((memo) => <div key={memo.id} className="rounded-2xl border border-border/60 bg-background/65 p-4 transition hover:border-primary/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-foreground">{memo.title}</p>{memo.pinned && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">고정</span>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{memo.content}</p></div><Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => handleRemoveMemo(memo.id)} aria-label={memo.title + ' 메모 삭제'}><Trash2 className="h-4 w-4" /></Button></div><div className="mt-3 flex flex-wrap gap-2">{memo.tags.map((tag) => <span key={memo.id + '-' + tag} className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground">#{tag}</span>)}<span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">수정 {formatDateTime(memo.updatedAt)}</span></div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" className="rounded-2xl" onClick={() => handleOpenResource(toMemoResource(memo))}>최근 문서에 추가</Button><Button type="button" variant="outline" className="rounded-2xl" onClick={() => handleToggleMemoPinned(memo.id)}>{memo.pinned ? '고정 해제' : '고정'}</Button></div></div>)}</CardContent>
        </Card>
      </section>
      )}

      {workspaceSettings.showResources && (
      <section className="grid gap-4 xl:grid-cols-3">
        {workspaceSettings.resourceCardOrder.map((cardId) => (
          <div key={cardId}>{resourceCards[cardId]}</div>
        ))}
      </section>
      )}

      <section id="workspace-search" className="space-y-4">
        <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.25)]"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-foreground">상세 시트 검색</p><p className="mt-1 text-sm text-muted-foreground">통합 미리보기만으로 부족할 때만 펼쳐서 전체 결과와 정렬 옵션을 볼 수 있습니다.</p></div><Button type="button" variant={showDetailedSearch ? 'default' : 'outline'} className="rounded-2xl" onClick={() => setShowDetailedSearch((current) => !current)}>{showDetailedSearch ? '상세 검색 숨기기' : '상세 검색 열기'}</Button></CardContent></Card>
        <div className={showDetailedSearch ? 'space-y-4' : 'hidden'}><GoogleSheetsGlobalSearch favorites={favoriteResources} suggestedKeywords={keywordSuggestions} onOpenResource={handleOpenResource} onToggleFavorite={handleToggleFavorite} externalQuery={query} onPreviewChange={setSheetSearchPreview} /><GoogleSheetsFinder favorites={favoriteResources} suggestedKeywords={keywordSuggestions} onOpenResource={handleOpenResource} onToggleFavorite={handleToggleFavorite} externalQuery={query} onPreviewChange={setSheetListPreview} /></div>
      </section>
    </div>
  );
}

function buildScopedStorageKey(baseKey: string, ownerKey: string): string {
  return `${baseKey}:${ownerKey}`;
}

const defaultResourceCardOrder: ResourceCardId[] = ['recent', 'favorites', 'recommended'];

const resourceCardLabelMap: Record<ResourceCardId, string> = {
  recent: '최근 본 문서',
  favorites: '즐겨찾기',
  recommended: '추천 문서',
};

function normalizeResourceCardOrder(order?: ResourceCardId[]): ResourceCardId[] {
  const candidates = Array.isArray(order) ? order : [];
  const normalized = candidates.filter((item, index, array): item is ResourceCardId =>
    defaultResourceCardOrder.includes(item) && array.indexOf(item) === index,
  );

  for (const cardId of defaultResourceCardOrder) {
    if (!normalized.includes(cardId)) {
      normalized.push(cardId);
    }
  }

  return normalized;
}

function createDefaultWorkspaceSettings(displayName: string): WorkspaceSettings {
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

function readStoredWorkspaceSettings(
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
      resourceCardOrder: normalizeResourceCardOrder(parsed.resourceCardOrder as ResourceCardId[] | undefined),
    };
  } catch {
    return fallback;
  }
}

function writeStoredWorkspaceSettings(key: string, settings: WorkspaceSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(settings));
}

function readStoredResources(key: string): WorkspaceResource[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return normalizeStoredResources(JSON.parse(raw) as WorkspaceResource[]);
  } catch {
    return [];
  }
}

function normalizeStoredResources(input: unknown): WorkspaceResource[] {
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

function normalizeStoredTodos(input: unknown): TodoItem[] {
  if (!Array.isArray(input)) return [];

  return sortTodos(
    input
      .filter((item): item is Partial<TodoItem> & Pick<TodoItem, 'id' | 'title'> => Boolean(item?.id && item?.title))
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

function readStoredTodos(key: string): TodoItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return normalizeStoredTodos(JSON.parse(raw) as Partial<TodoItem>[]);
  } catch {
    return [];
  }
}

function normalizeStoredMemos(input: unknown): MemoItem[] {
  if (!Array.isArray(input)) return [];

  return sortMemos(
    input
      .filter((item): item is Partial<MemoItem> & Pick<MemoItem, 'id' | 'title' | 'content'> => Boolean(item?.id && item?.title && item?.content))
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

function readStoredWorkLogs(key: string): WorkHistoryRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return normalizeStoredWorkLogs(JSON.parse(raw) as Partial<WorkHistoryRecord>[]);
  } catch {
    return [];
  }
}

function normalizeStoredWorkLogs(input: unknown): WorkHistoryRecord[] {
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

function readStoredMemos(key: string): MemoItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return normalizeStoredMemos(JSON.parse(raw) as Partial<MemoItem>[]);
  } catch {
    return [];
  }
}

function writeStoredResources(key: string, resources: WorkspaceResource[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(resources));
}

function writeStoredTodos(key: string, todos: TodoItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(todos));
}

function writeStoredWorkLogs(key: string, records: WorkHistoryRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(records));
}

function writeStoredMemos(key: string, memos: MemoItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(memos));
}

function dedupeResources(resources: WorkspaceResource[]): WorkspaceResource[] {
  const seen = new Set<string>();
  const next: WorkspaceResource[] = [];

  for (const resource of resources) {
    if (!resource?.id || seen.has(resource.id)) continue;
    seen.add(resource.id);
    next.push(resource);
  }

  return next;
}

function toHistoryResource(record: WorkHistoryRecord): WorkspaceResource {
  return {
    id: `history-${record.id}`,
    title: record.title,
    href: '#workspace-overview',
    subtitle: `${record.project} · ${record.date}`,
    description: record.summary,
    source: 'history',
  };
}

function buildTodoWorkLogId(workspaceOwnerKey: string, todoId: string): string {
  return `local-work-${workspaceOwnerKey}-${todoId}`;
}

function pruneTodoDerivedWorkLogs(
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

function pruneRemovedWorkLogResources(
  resources: WorkspaceResource[],
  records: WorkHistoryRecord[],
): WorkspaceResource[] {
  const activeRecordIds = new Set(records.map((record) => `history-${record.id}`));

  return resources.filter((resource) => {
    if (!resource.id.startsWith('history-local-work-')) return true;
    return activeRecordIds.has(resource.id);
  });
}

function toMemoResource(memo: MemoItem): WorkspaceResource {
  return {
    id: `memo-${memo.id}`,
    title: memo.title,
    href: '#workspace-memos',
    subtitle: memo.tags.length > 0 ? memo.tags.map((tag) => `#${tag}`).join(' ') : '업무 메모',
    description: memo.content,
    source: 'history',
  };
}

function toSheetFileResource(file: GoogleSpreadsheetFile): WorkspaceResource {
  return {
    id: `sheet-${file.id}`,
    title: file.name,
    href: file.webViewLink,
    subtitle: 'Google Sheets',
    description: file.owners?.[0]?.displayName ?? file.owners?.[0]?.emailAddress ?? 'Google Sheets 문서',
    source: 'sheets-list',
  };
}

function toSpreadsheetSearchResource(result: SpreadsheetSearchMatch): WorkspaceResource {
  return {
    id: `search-${result.fileId}-${result.sheetName}-${result.rowNumber}`,
    title: result.fileName,
    href: result.webViewLink,
    subtitle: `${result.sheetName} · ${result.rowNumber}행`,
    description: result.snippet,
    source: 'sheets-search',
  };
}

function buildKeywordSuggestions(
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

function sortTodos(todos: TodoItem[]): TodoItem[] {
  return [...todos].sort((left, right) => {
    if (left.completed !== right.completed) return left.completed ? 1 : -1;

    const dateGap = getTimeValue(left.dueDate) - getTimeValue(right.dueDate);
    if (dateGap !== 0) return dateGap;

    const priorityGap = getPriorityWeight(right.priority) - getPriorityWeight(left.priority);
    if (priorityGap !== 0) return priorityGap;

    return getTimeValue(right.createdAt) - getTimeValue(left.createdAt);
  });
}

function sortMemos(memos: MemoItem[]): MemoItem[] {
  return [...memos].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return getTimeValue(right.updatedAt) - getTimeValue(left.updatedAt);
  });
}

function parseMemoTags(raw: string): string[] {
  return raw
    .split(/[,\n#]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function mapTodoPriorityToCategory(priority: TodoPriority): WorkCategory {
  if (priority === 'high') return 'delivery';
  if (priority === 'medium') return 'analysis';
  return 'planning';
}

function formatDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthStartKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

function shiftMonthKey(monthKey: string, offset: number): string {
  const date = new Date(`${monthKey}T00:00:00`);
  date.setMonth(date.getMonth() + offset);
  date.setDate(1);
  return formatDateKey(date);
}

function formatMonthLabel(monthKey: string): string {
  const date = new Date(`${monthKey}T00:00:00`);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

function formatSelectedDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

function buildCalendarDays(monthKey: string, todos: TodoItem[]) {
  const monthStart = new Date(`${monthKey}T00:00:00`);
  const firstWeekday = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - firstWeekday);
  const holidays = getKoreanPublicHolidays(monthStart.getFullYear());

  const dueDateSummary = new Map<string, { total: number; active: number; completed: number }>();
  for (const todo of todos) {
    if (!todo.dueDate) continue;
    const current = dueDateSummary.get(todo.dueDate) ?? { total: 0, active: 0, completed: 0 };
    current.total += 1;
    if (todo.completed) current.completed += 1;
    else current.active += 1;
    dueDateSummary.set(todo.dueDate, current);
  }

  return Array.from({ length: 6 }, (_, weekIndex) => {
    const weekStart = new Date(gridStart);
    weekStart.setDate(gridStart.getDate() + weekIndex * 7);

    return {
      weekKey: formatDateKey(weekStart),
      isoWeek: getIsoWeekNumber(addDays(weekStart, 1)),
      days: Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDays(weekStart, dayIndex);
        const dateKey = formatDateKey(date);
        const summary = dueDateSummary.get(dateKey) ?? { total: 0, active: 0, completed: 0 };
        const holidayLabel = holidays.get(dateKey);

        return {
          dateKey,
          dayNumber: date.getDate(),
          inMonth: date.getMonth() === monthStart.getMonth(),
          isToday: dateKey === getTodayDateInputValue(),
          dayOfWeek: date.getDay(),
          isHoliday: Boolean(holidayLabel),
          holidayLabel,
          total: summary.total,
          active: summary.active,
          completed: summary.completed,
        };
      }),
    };
  });
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getIsoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getKoreanPublicHolidays(year: number): Map<string, string> {
  const holidaysByYear: Record<number, Array<[string, string]>> = {
    2026: [
      ['2026-01-01', '신정'],
      ['2026-02-16', '설날 연휴'],
      ['2026-02-17', '설날'],
      ['2026-02-18', '설날 연휴'],
      ['2026-03-01', '삼일절'],
      ['2026-03-02', '삼일절 대체'],
      ['2026-05-05', '어린이날'],
      ['2026-05-24', '부처님오신날'],
      ['2026-05-25', '석가탄신일 대체'],
      ['2026-06-03', '전국동시지방선거'],
      ['2026-06-06', '현충일'],
      ['2026-08-15', '광복절'],
      ['2026-08-17', '광복절 대체'],
      ['2026-09-24', '추석 연휴'],
      ['2026-09-25', '추석'],
      ['2026-09-26', '추석 연휴'],
      ['2026-10-03', '개천절'],
      ['2026-10-05', '개천절 대체'],
      ['2026-10-09', '한글날'],
      ['2026-12-25', '성탄절'],
    ],
  };

  return new Map(holidaysByYear[year] ?? []);
}

function groupTodosByProject(todos: TodoItem[]) {
  const groups = new Map<string, TodoItem[]>();

  for (const todo of todos) {
    const project = todo.project?.trim() || '미분류';
    groups.set(project, [...(groups.get(project) ?? []), todo]);
  }

  return [...groups.entries()].map(([project, groupedTodos]) => ({
    project,
    todos: groupedTodos,
  }));
}

function getPriorityWeight(priority: TodoPriority): number {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

function getTodayDateInputValue(): string {
  return formatDateKey(new Date());
}

function isTodayTask(todo: TodoItem): boolean {
  if (!todo.dueDate) return false;
  return todo.dueDate <= getTodayDateInputValue();
}

function formatDateTime(value?: string): string {
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

function formatPreviewDate(value?: string): string {
  if (!value) return '정보 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '정보 없음';

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatDueDate(value?: string): string {
  if (!value) return '마감일 없음';

  const today = getTodayDateInputValue();
  if (value < today) return `지남 · ${value}`;
  if (value === today) return '오늘 마감';
  return value;
}

function getTimeValue(value?: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-border/60 bg-background/70 px-4 py-4 shadow-[0_18px_40px_-34px_rgba(20,26,36,0.12)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">{value}</p>
    </div>
  );
}

const workspaceToneClassMap: Record<
  WorkspaceTone,
  { card: string; badge: string }
> = {
  sand: {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.92))] dark:bg-[linear-gradient(180deg,rgba(22,28,38,0.96),rgba(28,24,20,0.92))]',
    badge: 'border-[#d7c7ad] bg-[#fbf4e8] text-[#765a2c] dark:border-[#5a4b34] dark:bg-[#2e261c] dark:text-[#f1d8aa]',
  },
  sky: {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,246,255,0.94))] dark:bg-[linear-gradient(180deg,rgba(20,27,38,0.96),rgba(18,30,48,0.94))]',
    badge: 'border-[#b7d0f8] bg-[#edf4ff] text-[#28518d] dark:border-[#314a72] dark:bg-[#17273d] dark:text-[#bdd7ff]',
  },
  mint: {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,251,247,0.94))] dark:bg-[linear-gradient(180deg,rgba(20,27,38,0.96),rgba(18,36,32,0.94))]',
    badge: 'border-[#b8dccd] bg-[#ebf8f1] text-[#2f6b57] dark:border-[#365a4d] dark:bg-[#152a24] dark:text-[#bfe5d5]',
  },
};

function WorkspaceSettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
      />
    </label>
  );
}

function PriorityBadge({ priority }: { priority: TodoPriority }) {
  const label = todoPriorities.find((item) => item.value === priority)?.label ?? '중간';
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', priorityTone[priority])}>{label}</span>;
}

function TodoDateBadge({ dueDate }: { dueDate?: string }) {
  const isOverdue = Boolean(dueDate) && dueDate! < getTodayDateInputValue();
  const isToday = Boolean(dueDate) && dueDate === getTodayDateInputValue();

  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium',
        !dueDate && 'bg-background text-muted-foreground',
        isOverdue && 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300',
        !isOverdue && isToday && 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300',
        !isOverdue && !isToday && dueDate && 'bg-background text-muted-foreground',
      )}
    >
      {formatDueDate(dueDate)}
    </span>
  );
}

function ResourcePanel({
  icon: Icon,
  title,
  emptyText,
  resources,
  onRemove,
  removeLabel,
}: {
  icon: typeof Clock3;
  title: string;
  emptyText: string;
  resources: WorkspaceResource[];
  onRemove?: (resourceId: string) => void;
  removeLabel?: string;
}) {
  return (
    <Card className="border-border/60 bg-card/98 shadow-[0_20px_50px_-40px_rgba(20,26,36,0.16)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {resources.length === 0 && <div className="rounded-2xl border border-dashed border-border/70 bg-background/65 px-4 py-6 text-sm text-muted-foreground">{emptyText}</div>}
        {resources.map((resource) => (
          <div key={resource.id} className="rounded-2xl border border-border/60 bg-background/65 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{resource.title}</p>
                {resource.subtitle && <p className="mt-1 text-xs text-muted-foreground">{resource.subtitle}</p>}
                {resource.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{resource.description}</p>}
              </div>
              {resource.href && (
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <a href={resource.href} target={resource.href.startsWith('#') ? undefined : '_blank'} rel={resource.href.startsWith('#') ? undefined : 'noreferrer'}>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
            {(resource.openedAt || onRemove) && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {resource.openedAt ? `최근 열람 ${formatDateTime(resource.openedAt)}` : '저장된 항목'}
                </span>
                {onRemove && (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => onRemove(resource.id)} aria-label={removeLabel ?? `${resource.title} 제거`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
