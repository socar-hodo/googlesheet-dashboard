'use client';

import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Circle,
  Clock3,
  Edit3,
  ExternalLink,
  FileSearch,
  FileText,
  Filter,
  FolderOpen,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  StickyNote,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GoogleSheetsFinder } from '@/components/work-history/google-sheets-finder';
import { GoogleSheetsGlobalSearch } from '@/components/work-history/google-sheets-global-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildWorkspaceOwnerKey } from '@/lib/workspace-owner';
import { workStatusLabels } from '@/lib/work-history';
import { cn } from '@/lib/utils';
import type { WorkHistoryRecord, WorkStatus } from '@/types/work-history';
import type { TodoPriority } from '@/types/workspace-state';
import type { WorkspaceResource } from '@/types/workspace-resource';
import { useSession } from 'next-auth/react';

// Custom hooks
import { useWorkspaceTodos } from './hooks/use-workspace-todos';
import { useWorkspaceMemos } from './hooks/use-workspace-memos';
import { useWorkspaceResources } from './hooks/use-workspace-resources';

// Search bar
import { WorkspaceSearchBar, type AutocompleteItem } from './workspace-search-bar';

// Extracted utilities
import {
  type ResourceCardId,
  type WorkspaceTone,
  type WorkspaceSettings,
  resourceCardLabelMap,
  buildScopedStorageKey,
  normalizeResourceCardOrder,
  readStoredResources,
  readStoredTodos,
  readStoredMemos,
  readStoredWorkLogs,
  readStoredWorkspaceSettings,
  writeStoredResources,
  writeStoredTodos,
  writeStoredWorkLogs,
  writeStoredMemos,
  writeStoredWorkspaceSettings,
  createDefaultWorkspaceSettings,
  dedupeResources,
  serializeWorkspaceState,
  fetchWorkspaceState,
  saveWorkspaceState,
} from './utils/workspace-storage';
import { todoPriorities, sortTodos, groupTodosByProject } from './utils/workspace-todo-utils';
import { getTodayDateInputValue, getMonthStartKey, shiftMonthKey, isTodayTask, buildCalendarDays } from './utils/workspace-calendar-utils';
import {
  formatMonthLabel,
  formatSelectedDateLabel,
  formatDateTime,
  formatPreviewDate,
  toHistoryResource,
  toMemoResource,
  toSheetFileResource,
  toSpreadsheetSearchResource,
  pruneTodoDerivedWorkLogs,
  pruneRemovedWorkLogResources,
  buildKeywordSuggestions,
} from './utils/workspace-formatters';
import { SummaryCard, PriorityBadge, TodoDateBadge, WorkspaceSettingToggle, workspaceToneClassMap } from './workspace-shared';
import { ResourcePanel } from './workspace-resources';

const RECENT_STORAGE_KEY = 'workspace-portal-recent';
const FAVORITES_STORAGE_KEY = 'workspace-portal-favorites';
const TODO_STORAGE_KEY = 'workspace-portal-todos';
const WORK_LOG_STORAGE_KEY = 'workspace-portal-work-logs';
const MEMO_STORAGE_KEY = 'workspace-portal-memos';
const WORKSPACE_SETTINGS_STORAGE_KEY = 'workspace-portal-settings';

// ── SectionHeading component ────────────────────────────────────────

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-4.5 w-4.5 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────

function WorkspaceSkeleton() {
  return (
    <div className="space-y-8 lg:space-y-10">
      {/* Search bar skeleton */}
      <Skeleton className="h-13 w-full rounded-[1.4rem]" />

      <section className="grid gap-5 lg:grid-cols-[1fr_20rem] xl:grid-cols-[1fr_22rem]">
        {/* Header card skeleton */}
        <Card className="border-border/60">
          <CardContent className="p-6 md:p-7">
            <div className="space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-5 w-48 rounded-full" />
                <Skeleton className="h-10 w-3/4 rounded-lg" />
                <Skeleton className="h-5 w-2/3 rounded-lg" />
              </div>
              {/* Stats skeleton */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[5.5rem] rounded-[1.35rem]" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </section>

      {/* Calendar skeleton */}
      <Skeleton className="h-80 w-full rounded-[1.5rem]" />
    </div>
  );
}

// ── Main portal ─────────────────────────────────────────────────────

interface WorkHistoryPortalProps {
  records: WorkHistoryRecord[];
}

export function WorkHistoryPortal({ records }: WorkHistoryPortalProps) {
  const { data: session, status } = useSession();
  const workspaceOwnerKey = useMemo(
    () => buildWorkspaceOwnerKey(session?.user?.email, session?.user?.id),
    [session?.user?.email, session?.user?.id],
  );
  const workspaceDisplayName = session?.user?.name?.trim() || session?.user?.email?.split('@')[0] || '나';

  if (status === 'loading') {
    return <WorkspaceSkeleton />;
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

  const recentStorageKey = useMemo(() => buildScopedStorageKey(RECENT_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const favoritesStorageKey = useMemo(() => buildScopedStorageKey(FAVORITES_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const todoStorageKey = useMemo(() => buildScopedStorageKey(TODO_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const workLogStorageKey = useMemo(() => buildScopedStorageKey(WORK_LOG_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const memoStorageKey = useMemo(() => buildScopedStorageKey(MEMO_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const workspaceSettingsStorageKey = useMemo(() => buildScopedStorageKey(WORKSPACE_SETTINGS_STORAGE_KEY, workspaceOwnerKey), [workspaceOwnerKey]);
  const defaultWorkspaceSettings = useMemo(() => createDefaultWorkspaceSettings(workspaceDisplayName), [workspaceDisplayName]);

  const [localRecords, setLocalRecords] = useState<WorkHistoryRecord[]>(() => readStoredWorkLogs(workLogStorageKey));
  const [workspaceStateReady, setWorkspaceStateReady] = useState(false);
  const [workspaceStateError, setWorkspaceStateError] = useState<string | null>(null);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [draggingResourceCard, setDraggingResourceCard] = useState<ResourceCardId | null>(null);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(() => readStoredWorkspaceSettings(workspaceSettingsStorageKey, defaultWorkspaceSettings));
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceSettings>(() => readStoredWorkspaceSettings(workspaceSettingsStorageKey, defaultWorkspaceSettings));

  // Custom hooks
  const resources = useWorkspaceResources(
    readStoredResources(recentStorageKey),
    readStoredResources(favoritesStorageKey),
  );

  const todoHook = useWorkspaceTodos(readStoredTodos(todoStorageKey), {
    workspaceOwnerKey,
    selectedDate,
    onOpenResource: resources.handleOpenResource,
    setLocalRecords,
    setRecentResources: resources.setRecentResources,
    setFavoriteResources: resources.setFavoriteResources,
  });

  const memoHook = useWorkspaceMemos(readStoredMemos(memoStorageKey), workspaceOwnerKey);

  // Calendar keyboard navigation ref
  const calendarGridRef = useRef<HTMLDivElement>(null);

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

  const visibleMemos = useMemo(
    () => memoHook.getVisibleMemos(deferredQuery),
    [memoHook, deferredQuery],
  );

  const todayTodos = useMemo(() => todoHook.sortedTodos.filter((todo) => !todo.completed && isTodayTask(todo)), [todoHook.sortedTodos]);
  const completedTodos = useMemo(() => todoHook.sortedTodos.filter((todo) => todo.completed).slice(0, 8), [todoHook.sortedTodos]);
  const selectedDateTodos = useMemo(
    () => sortTodos(todoHook.sortedTodos.filter((todo) => todo.dueDate === selectedDate)),
    [selectedDate, todoHook.sortedTodos],
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth, todoHook.sortedTodos),
    [calendarMonth, todoHook.sortedTodos],
  );

  const stats = useMemo(() => ({
    total: filteredRecords.length,
    active: filteredRecords.filter((record) => record.status === 'in-progress').length,
    recent: resources.recentResources.length,
    favorites: resources.favoriteResources.length,
  }), [filteredRecords, resources.recentResources.length, resources.favoriteResources.length]);

  const todoSummary = useMemo(() => {
    const total = todoHook.sortedTodos.length;
    const completed = todoHook.sortedTodos.filter((todo) => todo.completed).length;
    const active = total - completed;
    return {
      total,
      completed,
      active,
      progress: total === 0 ? 0 : Math.round((completed / total) * 100),
      dueToday: todoHook.sortedTodos.filter((todo) => !todo.completed && isTodayTask(todo)).length,
    };
  }, [todoHook.sortedTodos]);

  const memoSummary = useMemo(() => ({ total: memoHook.memos.length, pinned: memoHook.memos.filter((memo) => memo.pinned).length, visible: visibleMemos.length }), [memoHook.memos, visibleMemos]);
  const recommendedResources = useMemo(() => dedupeResources([...resources.favoriteResources, ...resources.recentResources]).slice(0, 6), [resources.favoriteResources, resources.recentResources]);
  const keywordSuggestions = useMemo(() => buildKeywordSuggestions(allRecords, resources.recentResources, resources.favoriteResources, todoHook.sortedTodos, memoHook.memos), [allRecords, resources.recentResources, resources.favoriteResources, todoHook.sortedTodos, memoHook.memos]);
  const workspaceToneClass = workspaceToneClassMap[workspaceSettings.tone];

  // ── Workspace state sync effects ──────────────────────────────────

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
        const localRecs = readStoredWorkLogs(workLogStorageKey);
        const localMemos = readStoredMemos(memoStorageKey);
        const nextTodos =
          serverState.todos.length === 0 && localTodos.length > 0 ? localTodos : serverState.todos;
        const mergedLocalRecords =
          serverState.localRecords.length === 0 && localRecs.length > 0
            ? localRecs
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
        resources.setRecentResources(nextRecentResources);
        resources.setFavoriteResources(nextFavoriteResources);
        todoHook.setTodos(nextTodos);
        setLocalRecords(nextLocalRecords);
        memoHook.setMemos(nextMemos);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    favoritesStorageKey,
    memoStorageKey,
    recentStorageKey,
    todoStorageKey,
    workLogStorageKey,
    workspaceOwnerKey,
  ]);

  useEffect(() => {
    writeStoredResources(recentStorageKey, resources.recentResources);
  }, [resources.recentResources, recentStorageKey]);

  useEffect(() => {
    writeStoredResources(favoritesStorageKey, resources.favoriteResources);
  }, [resources.favoriteResources, favoritesStorageKey]);

  useEffect(() => {
    writeStoredTodos(todoStorageKey, todoHook.todos);
  }, [todoStorageKey, todoHook.todos]);

  useEffect(() => {
    writeStoredWorkLogs(workLogStorageKey, localRecords);
  }, [localRecords, workLogStorageKey]);

  useEffect(() => {
    writeStoredMemos(memoStorageKey, memoHook.memos);
  }, [memoStorageKey, memoHook.memos]);

  // Item #3: Debounced server sync (800ms) + Item #11: Retry/rollback support
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStateRef = useRef({
    recentResources: resources.recentResources,
    favoriteResources: resources.favoriteResources,
    todos: todoHook.todos,
    localRecords,
    memos: memoHook.memos,
  });
  latestStateRef.current = {
    recentResources: resources.recentResources,
    favoriteResources: resources.favoriteResources,
    todos: todoHook.todos,
    localRecords,
    memos: memoHook.memos,
  };

  const doPersist = useCallback(async () => {
    const state = latestStateRef.current;
    const serializedState = serializeWorkspaceState(state);
    if (lastSyncedWorkspaceState.current === serializedState) return;
    try {
      await saveWorkspaceState(state);
      lastSyncedWorkspaceState.current = serializedState;
      setWorkspaceStateError(null);
    } catch (error) {
      setWorkspaceStateError(
        error instanceof Error ? error.message : '워크스페이스 상태를 저장하지 못했습니다.',
      );
    }
  }, []);

  // Item #11: Manual retry handler
  const handleRetrySync = useCallback(() => {
    setWorkspaceStateError(null);
    void doPersist();
  }, [doPersist]);

  // Item #11: Rollback handler
  const handleRollbackSync = useCallback(() => {
    if (!lastSyncedWorkspaceState.current) return;
    try {
      const lastState = JSON.parse(lastSyncedWorkspaceState.current);
      if (lastState.recentResources) resources.setRecentResources(lastState.recentResources);
      if (lastState.favoriteResources) resources.setFavoriteResources(lastState.favoriteResources);
      if (lastState.todos) todoHook.setTodos(lastState.todos);
      if (lastState.localRecords) setLocalRecords(lastState.localRecords);
      if (lastState.memos) memoHook.setMemos(lastState.memos);
      setWorkspaceStateError(null);
      import('sonner').then(({ toast }) => toast('마지막 동기화 상태로 복원했습니다.'));
    } catch {
      // If parsing fails, just clear error
      setWorkspaceStateError(null);
    }
  }, [resources, todoHook, memoHook]);

  useEffect(() => {
    if (!workspaceStateReady) return;
    const serializedState = serializeWorkspaceState({
      recentResources: resources.recentResources,
      favoriteResources: resources.favoriteResources,
      todos: todoHook.todos,
      localRecords,
      memos: memoHook.memos,
    });
    if (lastSyncedWorkspaceState.current === serializedState) return;

    // Item #3: Debounce 800ms
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(() => {
      void doPersist();
    }, 800);

    return () => {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    };
  }, [workspaceStateReady, resources.recentResources, resources.favoriteResources, todoHook.todos, localRecords, memoHook.memos, doPersist]);

  // Item #3: Flush pending save on beforeunload
  useEffect(() => {
    function handleBeforeUnload() {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
        // Synchronous best-effort save via navigator.sendBeacon
        const state = latestStateRef.current;
        const serializedState = serializeWorkspaceState(state);
        if (lastSyncedWorkspaceState.current !== serializedState) {
          try {
            navigator.sendBeacon('/api/workspace-state', JSON.stringify(state));
          } catch {
            // Best-effort, ignore errors
          }
        }
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Workspace settings handlers ───────────────────────────────────

  function handleWorkspaceSettingChange<Key extends keyof WorkspaceSettings>(
    key: Key,
    value: WorkspaceSettings[Key],
  ) {
    setWorkspaceDraft((current) => ({ ...current, [key]: value }));
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
    import('sonner').then(({ toast }) => toast('워크스페이스 설정을 저장했습니다.'));
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
      return { ...current, resourceCardOrder: order };
    });
  }

  // Item #13: Arrow-based reorder for touch support
  function handleMoveResourceCardByOffset(cardId: ResourceCardId, offset: number) {
    setWorkspaceDraft((current) => {
      const order = [...normalizeResourceCardOrder(current.resourceCardOrder)];
      const index = order.indexOf(cardId);
      const targetIndex = index + offset;
      if (index === -1 || targetIndex < 0 || targetIndex >= order.length) return current;
      const [moved] = order.splice(index, 1);
      order.splice(targetIndex, 0, moved);
      return { ...current, resourceCardOrder: order };
    });
  }

  // ── Calendar keyboard navigation ──────────────────────────────────

  const handleCalendarKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const allDays = calendarDays.flatMap((week) => week.days);
      const currentIndex = allDays.findIndex((day) => day.dateKey === selectedDate);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      switch (event.key) {
        case 'ArrowRight':
          nextIndex = Math.min(currentIndex + 1, allDays.length - 1);
          break;
        case 'ArrowLeft':
          nextIndex = Math.max(currentIndex - 1, 0);
          break;
        case 'ArrowDown':
          nextIndex = Math.min(currentIndex + 7, allDays.length - 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(currentIndex - 7, 0);
          break;
        default:
          return;
      }

      event.preventDefault();
      const nextDay = allDays[nextIndex];
      if (nextDay) {
        setSelectedDate(nextDay.dateKey);
        if (!nextDay.inMonth) {
          setCalendarMonth(getMonthStartKey(nextDay.dateKey));
        }
        // Focus the corresponding button
        const grid = calendarGridRef.current;
        if (grid) {
          const buttons = grid.querySelectorAll<HTMLButtonElement>('button[role="gridcell"]');
          buttons[nextIndex]?.focus();
        }
      }
    },
    [calendarDays, selectedDate],
  );

  // ── Autocomplete / preview ────────────────────────────────────────

  const previewSections = [
    {
      key: 'history',
      title: '업무 기록',
      count: filteredRecords.length,
      emptyText: '일치하는 업무 기록이 없습니다.',
      items: filteredRecords.slice(0, 3).map((record) => ({ id: record.id, title: record.title, subtitle: record.project + ' · ' + record.date, href: '#workspace-overview', external: false, onOpen: () => resources.handleOpenResource(toHistoryResource(record)) })),
    },
    {
      key: 'memo',
      title: '업무 메모',
      count: visibleMemos.length,
      emptyText: '일치하는 메모가 없습니다.',
      items: visibleMemos.slice(0, 3).map((memo) => ({ id: memo.id, title: memo.title, subtitle: memo.tags.length > 0 ? memo.tags.map((tag) => '#' + tag).join(' ') : '업무 메모', href: '#workspace-memos', external: false, onOpen: () => resources.handleOpenResource(toMemoResource(memo)) })),
    },
    {
      key: 'sheet-search',
      title: '시트 내용',
      count: resources.sheetSearchPreview.results.length,
      emptyText: resources.sheetSearchPreview.loading ? '시트 내용 검색 중입니다.' : resources.sheetSearchPreview.error ?? '일치하는 시트 내용이 없습니다.',
      items: resources.sheetSearchPreview.results.slice(0, 3).map((result) => ({ id: result.fileId + '-' + result.sheetName + '-' + result.rowNumber, title: result.fileName, subtitle: result.sheetName + ' · ' + result.rowNumber + '행', href: result.webViewLink, external: true, onOpen: () => resources.handleOpenResource(toSpreadsheetSearchResource(result)) })),
    },
    {
      key: 'sheet-list',
      title: '내 시트 목록',
      count: resources.sheetListPreview.files.length,
      emptyText: resources.sheetListPreview.loading ? '시트 목록을 불러오는 중입니다.' : resources.sheetListPreview.error ?? '일치하는 시트가 없습니다.',
      items: resources.sheetListPreview.files.slice(0, 3).map((file) => ({ id: file.id, title: file.name, subtitle: '수정 ' + formatPreviewDate(file.modifiedTime), href: file.webViewLink, external: true, onOpen: () => resources.handleOpenResource(toSheetFileResource(file)) })),
    },
  ];

  const resourceCards = {
    recent: <ResourcePanel icon={Clock3} title="최근 본 문서" emptyText="아직 최근 문서가 없습니다." emptyContent={<div className="flex flex-col items-center gap-3"><FileSearch className="h-8 w-8 text-muted-foreground/50" /><p>아직 최근 문서가 없습니다.</p><p className="text-xs">시트나 메모를 열면 여기에 자동으로 쌓입니다.</p><Button type="button" variant="outline" className="rounded-2xl" onClick={() => setShowDetailedSearch(true)}><Search className="mr-2 h-4 w-4" />시트 검색으로 시작하기</Button></div>} removeLabel="최근 문서에서 제거" resources={resources.recentResources} onRemove={resources.handleRemoveRecent} />,
    favorites: <ResourcePanel icon={Star} title="즐겨찾기" emptyText="자주 보는 시트나 문서를 즐겨찾기로 고정해 두세요." emptyContent={<div className="flex flex-col items-center gap-3"><Star className="h-8 w-8 text-muted-foreground/50" /><p>자주 보는 시트나 문서를 즐겨찾기로 고정해 두세요.</p></div>} removeLabel="즐겨찾기 제거" resources={resources.favoriteResources} onRemove={resources.handleRemoveFavorite} />,
    recommended: <ResourcePanel icon={Sparkles} title="추천 문서" emptyText="열람 기록이 쌓이면 추천해 드립니다." emptyContent={<div className="flex flex-col items-center gap-3"><Sparkles className="h-8 w-8 text-muted-foreground/50" /><p>열람 기록이 쌓이면 최근 문서와 즐겨찾기 기준으로 추천해 드립니다.</p></div>} resources={recommendedResources} />,
  } as const;

  const autocompleteItems: AutocompleteItem[] = (() => {
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
    const next: AutocompleteItem[] = [];

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
  const autocompleteLoading = normalizedQuery.length > 0 && (resources.sheetSearchPreview.loading || resources.sheetListPreview.loading);
  const autocompleteHasResults = autocompleteItems.length > 0;

  return (
    <div id="workspace-overview" className="space-y-8 lg:space-y-10">
      {/* Search bar - top-level independent placement */}
      <WorkspaceSearchBar
        query={query}
        onQueryChange={setQuery}
        normalizedQuery={normalizedQuery}
        autocompleteItems={autocompleteItems}
        autocompleteLoading={autocompleteLoading}
        autocompleteHasResults={autocompleteHasResults}
        keywordSuggestions={keywordSuggestions}
      />

      {/* Header + sidebar 2-column */}
      <section className="grid gap-5 lg:grid-cols-[1fr_20rem] xl:grid-cols-[minmax(0,1.45fr)_22rem]">
        <Card
          className={cn(
            'border border-border/60 shadow-[0_28px_70px_-50px_rgba(20,26,36,0.28)]',
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

              <Dialog open={showWorkspaceSettings} onOpenChange={(open) => {
                if (!open) { setWorkspaceDraft(workspaceSettings); }
                setShowWorkspaceSettings(open);
              }}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>워크스페이스 편집</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-foreground">헤더 커스텀</p>
                      <Input value={workspaceDraft.title} onChange={(event) => handleWorkspaceSettingChange('title', event.target.value)} placeholder="포털 제목" className="h-11 rounded-2xl" />
                      <Textarea value={workspaceDraft.subtitle} onChange={(event) => handleWorkspaceSettingChange('subtitle', event.target.value)} placeholder="포털 설명" className="min-h-28 rounded-2xl" />
                      <Select value={workspaceDraft.tone} onValueChange={(value) => handleWorkspaceSettingChange('tone', value as WorkspaceTone)}>
                        <SelectTrigger className="h-11 w-full rounded-2xl">
                          <SelectValue placeholder="톤 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sand">샌드 톤</SelectItem>
                          <SelectItem value="sky">스카이 톤</SelectItem>
                          <SelectItem value="mint">민트 톤</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-foreground">보여줄 섹션</p>
                      <WorkspaceSettingToggle label="오늘/완료 패널" checked={workspaceDraft.showTodoFocus} onChange={(checked) => handleWorkspaceSettingChange('showTodoFocus', checked)} />
                      <WorkspaceSettingToggle label="메모 보관함" checked={workspaceDraft.showMemos} onChange={(checked) => handleWorkspaceSettingChange('showMemos', checked)} />
                      <WorkspaceSettingToggle label="최근/즐겨찾기/추천 문서" checked={workspaceDraft.showResources} onChange={(checked) => handleWorkspaceSettingChange('showResources', checked)} />
                      <div className="space-y-2 pt-1">
                        <p className="text-sm font-semibold text-foreground">카드 순서 변경</p>
                        {workspaceDraft.resourceCardOrder.map((cardId, index) => (
                          <div
                            key={cardId}
                            draggable
                            onDragStart={() => setDraggingResourceCard(cardId)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => {
                              if (draggingResourceCard) handleMoveResourceCard(draggingResourceCard, cardId);
                              setDraggingResourceCard(null);
                            }}
                            onDragEnd={() => setDraggingResourceCard(null)}
                            className={cn(
                              'flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground transition-all duration-200 cursor-grab',
                              draggingResourceCard === cardId && 'scale-[1.02] shadow-lg border-foreground/40 bg-foreground/[0.06]',
                            )}
                          >
                            <span>{resourceCardLabelMap[cardId]}</span>
                            {/* Item #13: Touch-friendly arrow buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="h-7 w-7 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                                disabled={index === 0}
                                onClick={() => handleMoveResourceCardByOffset(cardId, -1)}
                                aria-label={`${resourceCardLabelMap[cardId]} 위로 이동`}
                              >
                                <ArrowUp className="mx-auto h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="h-7 w-7 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                                disabled={index === workspaceDraft.resourceCardOrder.length - 1}
                                onClick={() => handleMoveResourceCardByOffset(cardId, 1)}
                                aria-label={`${resourceCardLabelMap[cardId]} 아래로 이동`}
                              >
                                <ArrowDown className="mx-auto h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button type="button" className="rounded-2xl bg-foreground text-background hover:bg-foreground/92" onClick={handleSaveWorkspaceSettings}>저장</Button>
                      <Button type="button" variant="outline" className="rounded-2xl border-border/70 bg-background text-foreground hover:bg-background/80" onClick={() => { setWorkspaceDraft(workspaceSettings); setShowWorkspaceSettings(false); }}>취소</Button>
                      <Button type="button" variant="ghost" className="rounded-2xl text-muted-foreground hover:bg-background hover:text-foreground" onClick={handleResetWorkspaceSettings}>기본값 복원</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="flex flex-wrap items-center gap-3">
                <Select value={status} onValueChange={(value) => setStatus(value as 'all' | WorkStatus)}>
                  <SelectTrigger className="h-11 w-40 rounded-[1.4rem]">
                    <SelectValue placeholder="전체 상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    {Object.entries(workStatusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" className={cn('h-11 rounded-[1.4rem] border px-4 text-sm', pinnedOnly ? 'border-foreground bg-foreground text-background hover:bg-foreground/92' : 'border-border/70 bg-background text-foreground hover:bg-background/80')} onClick={() => setPinnedOnly((current) => !current)}><Filter className="mr-2 h-4 w-4" />중요 기록만 보기</Button>
              </div>

              <Separator />
            </div>
          </CardContent>
        </Card>

        {/* Item #7: Mobile sidebar order - "오늘 할 일" card appears first on mobile */}
        {workspaceSettings.showTodoFocus && (
        <div className="order-first space-y-4 lg:order-none">
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
              {todayTodos.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/65 px-4 py-8 text-sm text-muted-foreground">
                  <CalendarPlus className="h-8 w-8 text-muted-foreground/50" />
                  <p>오늘 처리할 일이 없습니다.</p>
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => { setSelectedDate(getTodayDateInputValue()); setCalendarMonth(getMonthStartKey(getTodayDateInputValue())); }}>
                    <Plus className="mr-2 h-4 w-4" />할 일 추가하기
                  </Button>
                </div>
              )}
              {groupTodosByProject(todayTodos).map((group) => (
                <div key={group.project} className="space-y-2">
                  <div className="flex items-center justify-between rounded-2xl bg-background/55 px-3 py-2"><p className="text-sm font-semibold text-foreground">{group.project}</p><span className="text-xs text-muted-foreground">{group.todos.length}건</span></div>
                  {group.todos.slice(0, 3).map((todo) => <button key={todo.id} type="button" onClick={() => todoHook.handleToggleTodo(todo.id)} className={cn('flex w-full items-start gap-3 rounded-2xl border border-border/60 bg-background/65 px-4 py-3 text-left transition-all duration-300', todoHook.recentlyToggledId === todo.id && 'bg-primary/8')}><Circle className={cn('mt-0.5 h-4.5 w-4.5 shrink-0 text-primary transition-transform duration-200', todoHook.recentlyToggledId === todo.id && 'scale-125')} /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{todo.title}</p><div className="mt-2 flex flex-wrap gap-2"><PriorityBadge priority={todo.priority} /><TodoDateBadge dueDate={todo.dueDate} /></div></div></button>)}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.28)]">
            <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /><CardTitle className="text-base">완료한 일</CardTitle></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{completedTodos.length}건</span></div></CardHeader>
            <CardContent className="space-y-3">
              {completedTodos.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/65 px-4 py-8 text-sm text-muted-foreground">
                  <ClipboardCheck className="h-8 w-8 text-muted-foreground/50" />
                  <p>아직 완료한 일이 없습니다.</p>
                </div>
              )}
              {groupTodosByProject(completedTodos).map((group) => (
                <div key={group.project} className="space-y-2">
                  <div className="flex items-center justify-between rounded-2xl bg-background/55 px-3 py-2"><p className="text-sm font-semibold text-foreground">{group.project}</p><span className="text-xs text-muted-foreground">{group.todos.length}건</span></div>
                  {group.todos.slice(0, 3).map((todo) => (
                    <div key={todo.id} className="rounded-2xl border border-border/60 bg-background/65 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => todoHook.handleRestoreTodoToToday(todo.id)}
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
                            <Badge variant="outline" className="rounded-full bg-background px-2.5 py-1 text-xs font-normal text-muted-foreground">완료 {formatDateTime(todo.completedAt ?? todo.createdAt)}</Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            왼쪽 체크를 누르면 오늘 할 일로 다시 되돌립니다.
                          </p>
                          <div className="mt-3">
                            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => todoHook.handleCreateWorkLogFromTodo(todo)}>
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

      {/* Item #8: Calendar section separated from header card for reduced info density */}
      <section>
              <SectionHeading
                icon={CalendarDays}
                title="월간 일정"
                description="날짜를 선택하면 그날 마감인 To-do를 바로 볼 수 있습니다."
              />

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[1.5rem] border border-border/60 bg-background/75 p-4 shadow-[0_18px_40px_-34px_rgba(20,26,36,0.14)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold tracking-tight text-foreground">{formatMonthLabel(calendarMonth)}</h4>
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
                      {/* Item #5: Today button */}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-full px-3 text-xs font-semibold"
                        onClick={() => {
                          const today = getTodayDateInputValue();
                          setCalendarMonth(getMonthStartKey(today));
                          setSelectedDate(today);
                        }}
                      >
                        오늘
                      </Button>
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

                  <div
                    ref={calendarGridRef}
                    role="grid"
                    aria-label="월간 일정"
                    className="mt-4 grid grid-cols-7 gap-1 sm:grid-cols-[auto_repeat(7,minmax(0,1fr))] sm:gap-2"
                    onKeyDown={handleCalendarKeyDown}
                  >
                    <div role="row" className="contents">
                    <div className="hidden px-2 py-1 text-center text-xs font-semibold text-muted-foreground sm:flex sm:items-center sm:justify-center">
                      주차
                    </div>
                    {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                      <div
                        key={day}
                        role="columnheader"
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
                    </div>
                    {calendarDays.map((week) => (
                      <Fragment key={week.weekKey}>
                        <div className="hidden items-start justify-center px-2 py-3 sm:flex">
                          <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            {week.isoWeek}
                          </span>
                        </div>
                        {week.days.map((day) => (
                          <button
                            key={day.dateKey}
                            type="button"
                            role="gridcell"
                            tabIndex={day.dateKey === selectedDate ? 0 : -1}
                            aria-selected={day.dateKey === selectedDate}
                            aria-label={`${day.dayNumber}일${day.total > 0 ? `, ${day.total}건의 할 일` : ''}`}
                            onClick={() => {
                              setSelectedDate(day.dateKey);
                              if (!day.inMonth) {
                                setCalendarMonth(getMonthStartKey(day.dateKey));
                              }
                            }}
                            className={cn(
                              'min-h-[3.5rem] rounded-2xl border px-1.5 py-1.5 text-left transition sm:min-h-[5.75rem] sm:px-2 sm:py-2',
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
                            <div className="mt-1 hidden space-y-1 sm:mt-2 sm:block">
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
                      <h4 className="text-base font-semibold tracking-tight text-foreground">선택한 날짜 To-do</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{formatSelectedDateLabel(selectedDate)}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {selectedDateTodos.length}건
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                      <div className="grid gap-3">
                        <Input
                          value={todoHook.selectedDateTodoInput}
                          onChange={(event) => todoHook.setSelectedDateTodoInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              todoHook.handleAddSelectedDateTodo();
                            }
                          }}
                          placeholder={`${formatSelectedDateLabel(selectedDate)}에 할 일을 추가하세요`}
                          className="h-11 rounded-2xl"
                        />
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
                          <Input
                            value={todoHook.selectedDateTodoProject}
                            onChange={(event) => todoHook.setSelectedDateTodoProject(event.target.value)}
                            list="todo-project-suggestions"
                            placeholder="분류를 입력하세요"
                            className="h-11 rounded-2xl"
                          />
                          <Select
                            value={todoHook.selectedDateTodoPriority}
                            onValueChange={(value) => todoHook.setSelectedDateTodoPriority(value as TodoPriority)}
                          >
                            <SelectTrigger className="h-11 rounded-2xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {todoPriorities.map((option) => (
                                <SelectItem key={`selected-date-priority-${option.value}`} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" className="h-11 rounded-2xl px-4" onClick={todoHook.handleAddSelectedDateTodo}>
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
                      <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/70 px-4 py-8 text-sm text-muted-foreground">
                        <CalendarPlus className="h-8 w-8 text-muted-foreground/50" />
                        <p>선택한 날짜에 연결된 To-do가 없습니다.</p>
                        <p className="text-xs">위 입력란에서 할 일을 추가해보세요.</p>
                      </div>
                    )}
                    {selectedDateTodos.map((todo) => {
                      const isEditing = todoHook.editingTodoId === todo.id;
                      const isRecentlyToggled = todoHook.recentlyToggledId === todo.id;

                      return (
                        <div key={todo.id} className={cn('rounded-2xl border border-border/60 bg-background/80 px-4 py-3 transition-colors duration-300', isRecentlyToggled && 'bg-primary/8')}>
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => (todo.completed ? todoHook.handleRestoreTodoToDate(todo.id, selectedDate) : todoHook.handleToggleTodo(todo.id))}
                              className="mt-0.5 shrink-0 text-primary transition hover:opacity-80"
                              aria-label={todo.completed ? `${todo.title} 다시 진행` : `${todo.title} 완료 처리`}
                            >
                              {todo.completed ? <CheckCircle2 className={cn('h-5 w-5 transition-transform duration-200', isRecentlyToggled && 'scale-125')} /> : <Circle className={cn('h-5 w-5 transition-transform duration-200', isRecentlyToggled && 'scale-125')} />}
                            </button>
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="space-y-3">
                                  <Input
                                    value={todoHook.editingTodoTitle}
                                    onChange={(event) => todoHook.setEditingTodoTitle(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        todoHook.handleSaveEditedTodo();
                                      }
                                      if (event.key === 'Escape') {
                                        event.preventDefault();
                                        todoHook.handleCancelEditingTodo();
                                      }
                                    }}
                                    className="h-10 rounded-2xl"
                                  />
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <Input
                                      value={todoHook.editingTodoProject}
                                      onChange={(event) => todoHook.setEditingTodoProject(event.target.value)}
                                      list="todo-project-suggestions"
                                      placeholder="분류를 입력하세요"
                                      className="h-10 rounded-2xl"
                                    />
                                    <Input
                                      type="date"
                                      value={todoHook.editingTodoDueDate}
                                      onChange={(event) => todoHook.setEditingTodoDueDate(event.target.value)}
                                      className="h-10 rounded-2xl"
                                    />
                                    <Select
                                      value={todoHook.editingTodoPriority}
                                      onValueChange={(value) => todoHook.setEditingTodoPriority(value as TodoPriority)}
                                    >
                                      <SelectTrigger className="h-10 rounded-2xl">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {todoPriorities.map((option) => (
                                          <SelectItem key={`editing-priority-${todo.id}-${option.value}`} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button type="button" className="h-9 rounded-2xl px-3" onClick={todoHook.handleSaveEditedTodo}>
                                      저장
                                    </Button>
                                    <Button type="button" variant="outline" className="h-9 rounded-2xl px-3" onClick={todoHook.handleCancelEditingTodo}>
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
                                    <Badge variant="outline" className="rounded-full bg-background px-2.5 py-1 text-xs font-normal text-muted-foreground">
                                      {todo.project}
                                    </Badge>
                                    {todo.completed && (
                                      <Badge variant="outline" className="rounded-full bg-background px-2.5 py-1 text-xs font-normal text-muted-foreground">
                                        완료 {formatDateTime(todo.completedAt ?? todo.createdAt)}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" className="h-9 rounded-2xl px-3" onClick={() => todoHook.handleStartEditingTodo(todo)}>
                                      수정
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="h-9 rounded-2xl px-3 text-muted-foreground hover:text-foreground"
                                      onClick={() => todoHook.handleRemoveTodo(todo.id)}
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
      </section>

      {/* Item #11: Error banner with retry and rollback */}
      {workspaceStateError && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {workspaceStateError}
          <span className="ml-2 text-amber-600/80 dark:text-amber-200/80">
            현재 화면 변경은 브라우저 임시 상태에는 남아 있지만 서버 저장은 완료되지 않았을 수 있습니다.
          </span>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={handleRetrySync}>
              재시도
            </Button>
            {lastSyncedWorkspaceState.current && (
              <Button type="button" variant="ghost" className="h-8 rounded-xl px-3 text-xs text-amber-700 hover:text-amber-800 dark:text-amber-300" onClick={handleRollbackSync}>
                마지막 동기화 상태로 복원
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Item #15: Activity summary widget - always visible without search */}
      {!normalizedQuery && (todoHook.sortedTodos.length > 0 || memoHook.memos.length > 0 || resources.recentResources.length > 0) && (
        <Card className="border-border/60 bg-card/98 shadow-[0_18px_40px_-34px_rgba(20,26,36,0.14)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">최근 활동 요약</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/65 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">최근 할 일</p>
                {todoHook.sortedTodos.filter((t) => !t.completed).slice(0, 2).map((todo) => (
                  <div key={todo.id} className="mt-2 flex items-center gap-2">
                    <Circle className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <p className="truncate text-sm text-foreground">{todo.title}</p>
                  </div>
                ))}
                {todoHook.sortedTodos.filter((t) => !t.completed).length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">진행 중인 할 일이 없습니다.</p>
                )}
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/65 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">최근 메모</p>
                {memoHook.memos.slice(0, 2).map((memo) => (
                  <div key={memo.id} className="mt-2 flex items-center gap-2">
                    <StickyNote className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <p className="truncate text-sm text-foreground">{memo.title}</p>
                  </div>
                ))}
                {memoHook.memos.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">저장된 메모가 없습니다.</p>
                )}
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/65 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">최근 문서</p>
                {resources.recentResources.slice(0, 2).map((resource) => (
                  <div key={resource.id} className="mt-2 flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <p className="truncate text-sm text-foreground">{resource.title}</p>
                  </div>
                ))}
                {resources.recentResources.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">최근 열람한 문서가 없습니다.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {normalizedQuery && (
        <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.25)]">
          <CardHeader className="pb-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="text-base">통합 미리보기</CardTitle><p className="mt-1 text-sm text-muted-foreground">&quot;{deferredQuery.trim()}&quot; 검색 결과를 바로 확인할 수 있도록 검색 영역 아래에 보여줍니다.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{previewSections.map((section) => <SummaryCard key={section.key} label={section.title} value={section.count + '건'} />)}</div></div></CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-4">{previewSections.map((section) => <div key={section.key} className="rounded-2xl border border-border/60 bg-background/65 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-foreground">{section.title}</p><span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">{section.count}건</span></div><div className="mt-3 space-y-2">{section.items.length === 0 && <div className="rounded-2xl bg-background px-3 py-4 text-sm text-muted-foreground">{section.emptyText}</div>}{section.items.map((item) => <a key={item.id} href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined} onClick={item.onOpen} className="flex items-start justify-between gap-3 rounded-2xl bg-background px-3 py-3 transition hover:bg-card"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p></div><ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /></a>)}</div></div>)}</CardContent>
        </Card>
      )}

      <Separator />

      {workspaceSettings.showMemos && (
      <>
      <SectionHeading
        icon={Bookmark}
        title="업무 메모"
        description="자주 찾는 팁과 체크포인트를 보관합니다."
      />
      <section id="workspace-memos" className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.25)]">
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Bookmark className="h-4 w-4 text-primary" /><CardTitle className="text-base">업무 메모 보관함</CardTitle></div></CardHeader>
          <CardContent className="space-y-3"><Input value={memoHook.memoTitle} onChange={(event) => memoHook.setMemoTitle(event.target.value)} placeholder="메모 제목을 입력하세요" className="h-11 rounded-2xl" /><Input value={memoHook.memoTags} onChange={(event) => memoHook.setMemoTags(event.target.value)} placeholder="태그를 쉼표로 구분해 입력하세요" className="h-11 rounded-2xl" /><Textarea value={memoHook.memoContent} onChange={(event) => memoHook.setMemoContent(event.target.value)} placeholder="업무 팁, 실수 방지 포인트, 운영 메모를 남겨두세요" className="min-h-44 rounded-2xl" /><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">자주 찾는 팁과 체크포인트를 쌓아 두면 포털 검색으로 다시 찾기 쉬워집니다.</p><Button type="button" className="h-11 rounded-2xl px-4" onClick={memoHook.handleAddMemo}><Plus className="mr-2 h-4 w-4" />메모 저장</Button></div></CardContent>
        </Card>
        <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.25)]">
          <CardHeader className="pb-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" /><CardTitle className="text-base">메모 검색</CardTitle></div><div className="grid grid-cols-3 gap-2"><SummaryCard label="전체" value={memoSummary.total + '건'} /><SummaryCard label="고정" value={memoSummary.pinned + '건'} /><SummaryCard label="검색결과" value={memoSummary.visible + '건'} /></div></div></CardHeader>
          <CardContent className="space-y-3">
            <Input value={memoHook.memoQuery} onChange={(event) => memoHook.setMemoQuery(event.target.value)} placeholder="메모 제목, 내용, 태그로 검색" className="h-11 rounded-2xl" />
            {/* Item #6: Empty state CTA for memos */}
            {visibleMemos.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/65 px-4 py-8 text-sm text-muted-foreground">
                <StickyNote className="h-8 w-8 text-muted-foreground/50" />
                <p>아직 저장된 메모가 없거나 검색 조건에 맞는 메모가 없습니다.</p>
                <p className="text-xs">왼쪽 보관함에서 새 메모를 작성해보세요.</p>
              </div>
            )}
            {visibleMemos.slice(0, 8).map((memo) => {
              const isMemoEditing = memoHook.editingMemoId === memo.id;
              return (
                <div key={memo.id} className="rounded-2xl border border-border/60 bg-background/65 p-4 transition hover:border-primary/40">
                  {/* Item #10: Memo inline editing */}
                  {isMemoEditing ? (
                    <div className="space-y-3">
                      <Input value={memoHook.editingMemoTitle} onChange={(event) => memoHook.setEditingMemoTitle(event.target.value)} placeholder="메모 제목" className="h-10 rounded-2xl" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); memoHook.handleCancelEditingMemo(); } }} />
                      <Textarea value={memoHook.editingMemoContent} onChange={(event) => memoHook.setEditingMemoContent(event.target.value)} placeholder="메모 내용" className="min-h-28 rounded-2xl" />
                      <Input value={memoHook.editingMemoTags} onChange={(event) => memoHook.setEditingMemoTags(event.target.value)} placeholder="태그 (쉼표로 구분)" className="h-10 rounded-2xl" />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" className="h-9 rounded-2xl px-3" onClick={memoHook.handleSaveEditedMemo}>저장</Button>
                        <Button type="button" variant="outline" className="h-9 rounded-2xl px-3" onClick={memoHook.handleCancelEditingMemo}>취소</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{memo.title}</p>
                            {memo.pinned && <Badge className="rounded-full bg-primary/10 text-xs font-semibold text-primary border-transparent">고정</Badge>}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{memo.content}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => memoHook.handleStartEditingMemo(memo)} aria-label={memo.title + ' 메모 수정'}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => memoHook.handleRemoveMemo(memo.id)} aria-label={memo.title + ' 메모 삭제'}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {memo.tags.map((tag) => <Badge key={memo.id + '-' + tag} variant="outline" className="rounded-full bg-background px-2.5 py-1 text-xs font-normal text-muted-foreground">#{tag}</Badge>)}
                        <Badge variant="outline" className="rounded-full bg-background px-2.5 py-1 text-xs font-normal text-muted-foreground">수정 {formatDateTime(memo.updatedAt)}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="rounded-2xl" onClick={() => resources.handleOpenResource(toMemoResource(memo))}>최근 문서에 추가</Button>
                        <Button type="button" variant="outline" className="rounded-2xl" onClick={() => memoHook.handleToggleMemoPinned(memo.id)}>{memo.pinned ? '고정 해제' : '고정'}</Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
      </>
      )}

      <Separator />

      {workspaceSettings.showResources && (
      <>
      <SectionHeading
        icon={FolderOpen}
        title="문서 리소스"
        description="최근 본 문서, 즐겨찾기, 추천 문서를 한 곳에서 확인합니다."
      />
      <section className="grid gap-4 xl:grid-cols-3">
        {workspaceSettings.resourceCardOrder.map((cardId) => (
          <div key={cardId}>{resourceCards[cardId]}</div>
        ))}
      </section>
      </>
      )}

      <Separator />

      <SectionHeading
        icon={FileText}
        title="상세 시트 검색"
        description="통합 미리보기만으로 부족할 때만 펼쳐서 전체 결과와 정렬 옵션을 볼 수 있습니다."
      />
      <section id="workspace-search" className="space-y-4">
        <Card className="border-border/60 bg-card/98 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.25)]"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-foreground">상세 시트 검색</p><Button type="button" variant={showDetailedSearch ? 'default' : 'outline'} className="rounded-2xl" onClick={() => setShowDetailedSearch((current) => !current)}>{showDetailedSearch ? '상세 검색 숨기기' : '상세 검색 열기'}</Button></CardContent></Card>
        <div className={showDetailedSearch ? 'space-y-4' : 'hidden'}><GoogleSheetsGlobalSearch favorites={resources.favoriteResources} suggestedKeywords={keywordSuggestions} onOpenResource={resources.handleOpenResource} onToggleFavorite={resources.handleToggleFavorite} externalQuery={query} onPreviewChange={resources.setSheetSearchPreview} /><GoogleSheetsFinder favorites={resources.favoriteResources} suggestedKeywords={keywordSuggestions} onOpenResource={resources.handleOpenResource} onToggleFavorite={resources.handleToggleFavorite} externalQuery={query} onPreviewChange={resources.setSheetListPreview} /></div>
      </section>
    </div>
  );
}
