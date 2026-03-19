'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import {
  Bookmark,
  CalendarDays,
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
import { workCategoryLabels, workStatusLabels } from '@/lib/work-history';
import { cn } from '@/lib/utils';
import type { GoogleSpreadsheetFile } from '@/types/google-drive';
import type { WorkCategory, WorkHistoryRecord, WorkStatus } from '@/types/work-history';
import type { WorkspaceResource } from '@/types/workspace-resource';
import { useSession } from 'next-auth/react';

const RECENT_STORAGE_KEY = 'workspace-portal-recent';
const FAVORITES_STORAGE_KEY = 'workspace-portal-favorites';
const TODO_STORAGE_KEY = 'workspace-portal-todos';
const WORK_LOG_STORAGE_KEY = 'workspace-portal-work-logs';
const MEMO_STORAGE_KEY = 'workspace-portal-memos';
const WORKSPACE_SETTINGS_STORAGE_KEY = 'workspace-portal-settings';
const DEFAULT_KEYWORDS = ['지표', '대시보드', '주간', '운영', '리포트', '자동화'];

type TodoFilter = 'all' | 'active' | 'completed';
type TodoPriority = 'high' | 'medium' | 'low';

interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  dueDate?: string;
  priority: TodoPriority;
  project: string;
}

interface MemoItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

type ResourceCardId = 'recent' | 'favorites' | 'recommended';

type WorkspaceTone = 'sand' | 'sky' | 'mint';

interface WorkspaceSettings {
  title: string;
  subtitle: string;
  tone: WorkspaceTone;
  showTodoFocus: boolean;
  showWeeklySummary: boolean;
  showMemos: boolean;
  showResources: boolean;
  resourceCardOrder: ResourceCardId[];
}

const todoFilters: Array<{ value: TodoFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행중' },
  { value: 'completed', label: '완료' },
];

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

export function WorkHistoryPortal({ records }: WorkHistoryPortalProps) {
  const { data: session } = useSession();
  const workspaceOwnerKey = useMemo(
    () => buildWorkspaceOwnerKey(session?.user?.email, session?.user?.id),
    [session?.user?.email, session?.user?.id],
  );
  const workspaceDisplayName = session?.user?.name?.trim() || session?.user?.email?.split('@')[0] || '나';

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
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | WorkCategory>('all');
  const [status, setStatus] = useState<'all' | WorkStatus>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [showDetailedSearch, setShowDetailedSearch] = useState(false);

  const [todoInput, setTodoInput] = useState('');
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('all');
  const [todoPriority, setTodoPriority] = useState<TodoPriority>('medium');
  const [todoDueDate, setTodoDueDate] = useState(getTodayDateInputValue());
  const [todoProject, setTodoProject] = useState('미분류');

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
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [draggingResourceCard, setDraggingResourceCard] = useState<ResourceCardId | null>(null);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(() => readStoredWorkspaceSettings(workspaceSettingsStorageKey, defaultWorkspaceSettings));
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceSettings>(() => readStoredWorkspaceSettings(workspaceSettingsStorageKey, defaultWorkspaceSettings));
  const [sheetSearchPreview, setSheetSearchPreview] = useState<{ query: string; loading: boolean; error: string | null; indexedFileCount: number; results: SpreadsheetSearchMatch[] }>({ query: '', loading: false, error: null, indexedFileCount: 0, results: [] });
  const [sheetListPreview, setSheetListPreview] = useState<{ query: string; loading: boolean; error: string | null; files: GoogleSpreadsheetFile[] }>({ query: '', loading: false, error: null, files: [] });

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const allRecords = useMemo(() => [...localRecords, ...records].sort((a, b) => b.date.localeCompare(a.date)), [localRecords, records]);
  const projectOptions = useMemo(() => ['미분류', ...new Set(allRecords.map((record) => record.project).filter(Boolean))], [allRecords]);

  const filteredRecords = useMemo(() => {
    return allRecords.filter((record) => {
      const haystack = [record.title, record.summary, record.project, record.outcome, record.source, ...record.tags].join(' ').toLowerCase();
      return (
        (normalizedQuery.length === 0 || haystack.includes(normalizedQuery)) &&
        (category === 'all' || record.category === category) &&
        (status === 'all' || record.status === status) &&
        (!pinnedOnly || record.pinned)
      );
    });
  }, [allRecords, normalizedQuery, category, status, pinnedOnly]);

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
  const visibleTodos = useMemo(() => {
    if (todoFilter === 'active') return sortedTodos.filter((todo) => !todo.completed);
    if (todoFilter === 'completed') return sortedTodos.filter((todo) => todo.completed);
    return sortedTodos;
  }, [sortedTodos, todoFilter]);

  const todayTodos = useMemo(() => sortedTodos.filter((todo) => !todo.completed && isTodayTask(todo)), [sortedTodos]);
  const completedTodos = useMemo(() => sortedTodos.filter((todo) => todo.completed).slice(0, 8), [sortedTodos]);

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

  const weeklySummary = useMemo(() => buildWeeklySummary(sortedTodos, allRecords), [sortedTodos, allRecords]);
  const weeklySummaryText = useMemo(() => buildWeeklySummaryText(weeklySummary), [weeklySummary]);
  const memoSummary = useMemo(() => ({ total: memos.length, pinned: memos.filter((memo) => memo.pinned).length, visible: visibleMemos.length }), [memos, visibleMemos]);
  const recommendedResources = useMemo(() => dedupeResources([...favoriteResources, ...recentResources]).slice(0, 6), [favoriteResources, recentResources]);
  const keywordSuggestions = useMemo(() => buildKeywordSuggestions(allRecords, recentResources, favoriteResources, sortedTodos, memos), [allRecords, recentResources, favoriteResources, sortedTodos, memos]);
  const workspaceToneClass = workspaceToneClassMap[workspaceSettings.tone];
  function handleOpenResource(resource: WorkspaceResource) {
    setRecentResources((current) => {
      const existing = current.find((item) => item.id === resource.id);
      const next = dedupeResources([
        {
          ...resource,
          openedAt: new Date().toISOString(),
          openedCount: (existing?.openedCount ?? resource.openedCount ?? 0) + 1,
        },
        ...current,
      ]).slice(0, 8);
      writeStoredResources(recentStorageKey, next);
      return next;
    });
  }

  function handleToggleFavorite(resource: WorkspaceResource) {
    setFavoriteResources((current) => {
      const exists = current.some((item) => item.id === resource.id);
      const next = exists
        ? current.filter((item) => item.id !== resource.id)
        : [{ ...resource, openedAt: resource.openedAt ?? new Date().toISOString() }, ...current].slice(0, 8);
      writeStoredResources(favoritesStorageKey, next);
      return next;
    });
  }

  function handleRemoveRecent(resourceId: string) {
    setRecentResources((current) => {
      const next = current.filter((item) => item.id !== resourceId);
      writeStoredResources(recentStorageKey, next);
      return next;
    });
  }

  function handleRemoveFavorite(resourceId: string) {
    setFavoriteResources((current) => {
      const next = current.filter((item) => item.id !== resourceId);
      writeStoredResources(favoritesStorageKey, next);
      return next;
    });
  }

  function handleAddTodo() {
    const title = todoInput.trim();
    if (!title) return;
    setTodos((current) => {
      const next = sortTodos([
        { id: 'todo-' + Date.now(), title, completed: false, createdAt: new Date().toISOString(), dueDate: todoDueDate || undefined, priority: todoPriority, project: todoProject },
        ...current,
      ]);
      writeStoredTodos(todoStorageKey, next);
      return next;
    });
    setTodoInput('');
    setTodoDueDate(getTodayDateInputValue());
    setTodoPriority('medium');
    setTodoProject('미분류');
    setTodoFilter('all');
  }

  function handleToggleTodo(todoId: string) {
    setTodos((current) => {
      const next = current.map((todo) => todo.id === todoId ? { ...todo, completed: !todo.completed, completedAt: !todo.completed ? new Date().toISOString() : undefined } : todo);
      writeStoredTodos(todoStorageKey, next);
      return next;
    });
  }

  function handleRemoveTodo(todoId: string) {
    setTodos((current) => {
      const next = current.filter((todo) => todo.id !== todoId);
      writeStoredTodos(todoStorageKey, next);
      return next;
    });
  }

  function handleCreateWorkLogFromTodo(todo: TodoItem) {
    const record: WorkHistoryRecord = {
      id: 'local-work-' + todo.id,
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
      const next = [record, ...current.filter((item) => item.id !== record.id)].sort((a, b) => b.date.localeCompare(a.date));
      writeStoredWorkLogs(workLogStorageKey, next);
      return next;
    });
    handleOpenResource(toHistoryResource(record));
  }

  function handleAddMemo() {
    const title = memoTitle.trim();
    const content = memoContent.trim();
    if (!title || !content) return;
    setMemos((current) => {
      const now = new Date().toISOString();
      const next = sortMemos([{ id: 'memo-' + Date.now(), title, content, tags: parseMemoTags(memoTags), pinned: false, createdAt: now, updatedAt: now }, ...current]);
      writeStoredMemos(memoStorageKey, next);
      return next;
    });
    setMemoTitle('');
    setMemoContent('');
    setMemoTags('');
  }

  function handleToggleMemoPinned(memoId: string) {
    setMemos((current) => {
      const next = sortMemos(current.map((memo) => memo.id === memoId ? { ...memo, pinned: !memo.pinned, updatedAt: new Date().toISOString() } : memo));
      writeStoredMemos(memoStorageKey, next);
      return next;
    });
  }

  function handleRemoveMemo(memoId: string) {
    setMemos((current) => {
      const next = current.filter((memo) => memo.id !== memoId);
      writeStoredMemos(memoStorageKey, next);
      return next;
    });
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
    <div id="workspace-overview" className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card className={cn('border-border/60 bg-card/95 shadow-[0_20px_60px_-40px_rgba(20,26,36,0.28)]', workspaceToneClass.card)}>
          <CardContent className="space-y-5 p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn('rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]', workspaceToneClass.badge)}>Workspace Portal</p>
                  <span className="text-xs text-muted-foreground">{workspaceDisplayName}님의 공간</span>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{workspaceSettings.title}</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">{workspaceSettings.subtitle}</p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <Button type="button" variant={showWorkspaceSettings ? 'default' : 'outline'} className="rounded-2xl" onClick={() => { setWorkspaceDraft(workspaceSettings); setShowWorkspaceSettings((current) => !current); }}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  워크스페이스 편집
                </Button>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SummaryCard label="기록" value={stats.total + '건'} />
                  <SummaryCard label="진행 중" value={stats.active + '건'} />
                  <SummaryCard label="최근 문서" value={stats.recent + '건'} />
                  <SummaryCard label="즐겨찾기" value={stats.favorites + '건'} />
                </div>
              </div>
            </div>

            {showWorkspaceSettings && (
              <div className="grid gap-4 rounded-3xl border border-border/70 bg-background/75 p-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">헤더 커스텀</p>
                  <input value={workspaceDraft.title} onChange={(event) => handleWorkspaceSettingChange('title', event.target.value)} placeholder="포털 제목" className="h-11 w-full rounded-2xl border border-border/70 bg-card/80 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                  <textarea value={workspaceDraft.subtitle} onChange={(event) => handleWorkspaceSettingChange('subtitle', event.target.value)} placeholder="포털 설명" className="min-h-28 w-full rounded-2xl border border-border/70 bg-card/80 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                  <select value={workspaceDraft.tone} onChange={(event) => handleWorkspaceSettingChange('tone', event.target.value as WorkspaceTone)} className="h-11 w-full rounded-2xl border border-border/70 bg-card/80 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10">
                    <option value="sand">샌드 톤</option>
                    <option value="sky">스카이 톤</option>
                    <option value="mint">민트 톤</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">보여줄 섹션</p>
                  <WorkspaceSettingToggle label="오늘/완료 패널" checked={workspaceDraft.showTodoFocus} onChange={(checked) => handleWorkspaceSettingChange('showTodoFocus', checked)} />
                  <WorkspaceSettingToggle label="주간 진행률 요약" checked={workspaceDraft.showWeeklySummary} onChange={(checked) => handleWorkspaceSettingChange('showWeeklySummary', checked)} />
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
                        className={cn('flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card/80 px-4 py-3 text-sm text-foreground transition', draggingResourceCard === cardId && 'border-primary/50 bg-primary/5')}
                      >
                        <span>{resourceCardLabelMap[cardId]}</span>
                        <span className="text-xs text-muted-foreground">드래그</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button type="button" className="rounded-2xl" onClick={handleSaveWorkspaceSettings}>저장</Button>
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => { setWorkspaceDraft(workspaceSettings); setShowWorkspaceSettings(false); }}>취소</Button>
                    <Button type="button" variant="ghost" className="rounded-2xl" onClick={handleResetWorkspaceSettings}>기본값 복원</Button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-[1.6fr_repeat(3,minmax(0,0.7fr))]">
              <div className="relative">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업무명, 프로젝트, 태그, 결과로 검색" className="h-12 w-full rounded-2xl border border-border/70 bg-background/70 pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                </label>
                {normalizedQuery && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-20 overflow-hidden rounded-3xl border border-border/70 bg-card/98 shadow-[0_24px_60px_-30px_rgba(20,26,36,0.32)] backdrop-blur">
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quick Results</p>
                      <span className="text-xs text-muted-foreground">{autocompleteHasResults ? `${autocompleteItems.length}개 미리보기` : '검색 중'}</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto p-2">
                      {autocompleteItems.map((item) => (
                        <a
                          key={item.id}
                          href={item.href}
                          target={item.external ? '_blank' : undefined}
                          rel={item.external ? 'noreferrer' : undefined}
                          onClick={item.onOpen}
                          className="flex items-start justify-between gap-3 rounded-2xl px-3 py-3 transition hover:bg-background"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{item.sectionTitle}</span>
                              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{item.subtitle}</p>
                          </div>
                          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        </a>
                      ))}
                      {!autocompleteHasResults && autocompleteLoading && (
                        <div className="rounded-2xl px-3 py-4 text-sm text-muted-foreground">검색 결과를 불러오는 중입니다.</div>
                      )}
                      {!autocompleteHasResults && !autocompleteLoading && (
                        <div className="rounded-2xl px-3 py-4 text-sm text-muted-foreground">일치하는 결과가 없습니다. 다른 키워드로 다시 검색해보세요.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <select value={category} onChange={(event) => setCategory(event.target.value as 'all' | WorkCategory)} className="h-12 rounded-2xl border border-border/70 bg-background/70 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10">
                <option value="all">전체 카테고리</option>
                {Object.entries(workCategoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value as 'all' | WorkStatus)} className="h-12 rounded-2xl border border-border/70 bg-background/70 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10">
                <option value="all">전체 상태</option>
                {Object.entries(workStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <Button type="button" variant={pinnedOnly ? 'default' : 'outline'} className="h-12 rounded-2xl" onClick={() => setPinnedOnly((current) => !current)}><Filter className="mr-2 h-4 w-4" />중요 기록만 보기</Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {keywordSuggestions.map((keyword) => (
                <button key={keyword} type="button" onClick={() => setQuery(keyword)} className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm text-foreground transition hover:border-primary/40 hover:bg-background">{keyword}</button>
              ))}
            </div>
          </CardContent>
        </Card>

        {workspaceSettings.showTodoFocus && (
        <div className="space-y-4">
          <Card className="border-border/60 bg-card/95">
            <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ListTodo className="h-4 w-4 text-primary" /><CardTitle className="text-base">오늘/완료 현황</CardTitle></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{todoSummary.progress}%</span></div></CardHeader>
            <CardContent className="space-y-4">
              <Progress value={todoSummary.progress} className="h-2.5" />
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryCard label="오늘 할 일" value={todayTodos.length + '건'} />
                <SummaryCard label="완료한 일" value={todoSummary.completed + '건'} />
              </div>
              <div className="rounded-2xl bg-background/65 p-4 text-sm text-muted-foreground">{weeklySummaryText}</div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/95">
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

          <Card className="border-border/60 bg-card/95">
            <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /><CardTitle className="text-base">완료한 일</CardTitle></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{completedTodos.length}건</span></div></CardHeader>
            <CardContent className="space-y-3">
              {completedTodos.length === 0 && <div className="rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">아직 완료한 일이 없습니다.</div>}
              {groupTodosByProject(completedTodos).map((group) => (
                <div key={group.project} className="space-y-2">
                  <div className="flex items-center justify-between rounded-2xl bg-background/55 px-3 py-2"><p className="text-sm font-semibold text-foreground">{group.project}</p><span className="text-xs text-muted-foreground">{group.todos.length}건</span></div>
                  {group.todos.slice(0, 3).map((todo) => (
                    <div key={todo.id} className="rounded-2xl border border-border/60 bg-background/65 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-muted-foreground line-through">{todo.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <PriorityBadge priority={todo.priority} />
                            <TodoDateBadge dueDate={todo.dueDate} />
                            <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">완료 {formatDateTime(todo.completedAt ?? todo.createdAt)}</span>
                          </div>
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

      {normalizedQuery && (
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="text-base">통합 미리보기</CardTitle><p className="mt-1 text-sm text-muted-foreground">&quot;{deferredQuery.trim()}&quot; 검색 결과를 바로 확인할 수 있도록 검색 영역 아래에 보여줍니다.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{previewSections.map((section) => <SummaryCard key={section.key} label={section.title} value={section.count + '건'} />)}</div></div></CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-4">{previewSections.map((section) => <div key={section.key} className="rounded-2xl border border-border/60 bg-background/65 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-foreground">{section.title}</p><span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">{section.count}건</span></div><div className="mt-3 space-y-2">{section.items.length === 0 && <div className="rounded-2xl bg-background px-3 py-4 text-sm text-muted-foreground">{section.emptyText}</div>}{section.items.map((item) => <a key={item.id} href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined} onClick={item.onOpen} className="flex items-start justify-between gap-3 rounded-2xl bg-background px-3 py-3 transition hover:bg-card"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p></div><ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /></a>)}</div></div>)}</CardContent>
        </Card>
      )}

      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ListTodo className="h-4 w-4 text-primary" /><CardTitle className="text-base">To-do 리스트</CardTitle></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{todoSummary.progress}%</span></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">완료 {todoSummary.completed} / 전체 {todoSummary.total}</span><span className="font-medium text-foreground">진행중 {todoSummary.active}건</span></div><Progress value={todoSummary.progress} className="h-2.5" /></div>
          <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_auto]">
            <input value={todoInput} onChange={(event) => setTodoInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddTodo(); } }} placeholder="할 일을 입력하세요" className="h-11 rounded-2xl border border-border/70 bg-background/70 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
            <select value={todoProject} onChange={(event) => setTodoProject(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-background/70 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10">{projectOptions.map((project) => <option key={project} value={project}>{project}</option>)}</select>
            <input type="date" value={todoDueDate} onChange={(event) => setTodoDueDate(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-background/70 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
            <select value={todoPriority} onChange={(event) => setTodoPriority(event.target.value as TodoPriority)} className="h-11 rounded-2xl border border-border/70 bg-background/70 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10">{todoPriorities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <Button type="button" className="h-11 rounded-2xl px-4" onClick={handleAddTodo}><Plus className="mr-2 h-4 w-4" />추가</Button>
          </div>
          <div className="flex flex-wrap gap-2">{todoFilters.map((option) => <button key={option.value} type="button" onClick={() => setTodoFilter(option.value)} className={cn('rounded-full border px-3 py-1.5 text-sm transition', todoFilter === option.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 bg-background/70 text-foreground hover:border-primary/40')}>{option.label}</button>)}</div>
          <div className="space-y-2">
            {visibleTodos.length === 0 && <div className="rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">{todoSummary.total === 0 ? '아직 등록된 할 일이 없습니다.' : '현재 필터에 맞는 할 일이 없습니다.'}</div>}
            {groupTodosByProject(visibleTodos).map((group) => (
              <div key={group.project} className="space-y-2">
                <div className="flex items-center justify-between rounded-2xl bg-background/55 px-3 py-2"><p className="text-sm font-semibold text-foreground">{group.project}</p><span className="text-xs text-muted-foreground">{group.todos.length}건</span></div>
                {group.todos.map((todo) => (
                  <div key={todo.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/65 px-3 py-3">
                    <button type="button" onClick={() => handleToggleTodo(todo.id)} className="shrink-0 text-primary transition hover:opacity-80" aria-label={todo.completed ? '미완료로 변경' : '완료로 변경'}>{todo.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}</button>
                    <div className="min-w-0 flex-1"><p className={cn('text-sm font-medium text-foreground', todo.completed && 'text-muted-foreground line-through')}>{todo.title}</p><div className="mt-2 flex flex-wrap gap-2"><PriorityBadge priority={todo.priority} /><TodoDateBadge dueDate={todo.dueDate} /><span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">추가 {formatDateTime(todo.createdAt)}</span></div></div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => handleRemoveTodo(todo.id)} aria-label={todo.title + ' 삭제'}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {workspaceSettings.showWeeklySummary && (
      <>
      <section className="grid gap-4 lg:grid-cols-4">
        <SummaryCard label="이번 주 완료 To-do" value={weeklySummary.completedTodos + '건'} />
        <SummaryCard label="이번 주 생성 To-do" value={weeklySummary.createdTodos + '건'} />
        <SummaryCard label="이번 주 업무 기록" value={weeklySummary.completedRecords + '건'} />
        <SummaryCard label="주간 진행률" value={weeklySummary.progress + '%'} />
      </section>

      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><CardTitle className="text-base">주간 진행률 요약</CardTitle></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">이번 주</span></div></CardHeader>
        <CardContent className="space-y-4"><Progress value={weeklySummary.progress} className="h-2.5" /><div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl bg-background/65 p-4"><p className="text-sm font-semibold text-foreground">활성 프로젝트</p><p className="mt-1 text-sm text-muted-foreground">{weeklySummary.activeProjects.length > 0 ? weeklySummary.activeProjects.join(', ') : '이번 주 진행 중인 프로젝트가 없습니다.'}</p></div><div className="rounded-2xl bg-background/65 p-4"><p className="text-sm font-semibold text-foreground">완료 흐름</p><p className="mt-1 text-sm text-muted-foreground">To-do {weeklySummary.completedTodos}건 완료, 업무 기록 {weeklySummary.completedRecords}건 생성</p></div><div className="rounded-2xl bg-background/65 p-4"><p className="text-sm font-semibold text-foreground">주의 필요</p><p className="mt-1 text-sm text-muted-foreground">오늘 기준 미완료 To-do {weeklySummary.overdueTodos}건이 남아 있습니다.</p></div></div><div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><p className="text-sm font-semibold text-foreground">자동 요약</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{weeklySummaryText}</p></div></CardContent>
      </Card>
      </>
      )}

      {workspaceSettings.showMemos && (
      <section id="workspace-memos" className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Bookmark className="h-4 w-4 text-primary" /><CardTitle className="text-base">업무 메모 보관함</CardTitle></div></CardHeader>
          <CardContent className="space-y-3"><input value={memoTitle} onChange={(event) => setMemoTitle(event.target.value)} placeholder="메모 제목을 입력하세요" className="h-11 w-full rounded-2xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition focus:border-primary/40" /><input value={memoTags} onChange={(event) => setMemoTags(event.target.value)} placeholder="태그를 쉼표로 구분해 입력하세요" className="h-11 w-full rounded-2xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition focus:border-primary/40" /><textarea value={memoContent} onChange={(event) => setMemoContent(event.target.value)} placeholder="업무 팁, 실수 방지 포인트, 운영 메모를 남겨두세요" className="min-h-44 w-full rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/40" /><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">자주 찾는 팁과 체크포인트를 쌓아 두면 포털 검색으로 다시 찾기 쉬워집니다.</p><Button type="button" className="h-11 rounded-2xl px-4" onClick={handleAddMemo}><Plus className="mr-2 h-4 w-4" />메모 저장</Button></div></CardContent>
        </Card>
        <Card className="border-border/60 bg-card/95">
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
        <Card className="border-border/60 bg-card/95"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-foreground">상세 시트 검색</p><p className="mt-1 text-sm text-muted-foreground">통합 미리보기만으로 부족할 때만 펼쳐서 전체 결과와 정렬 옵션을 볼 수 있습니다.</p></div><Button type="button" variant={showDetailedSearch ? 'default' : 'outline'} className="rounded-2xl" onClick={() => setShowDetailedSearch((current) => !current)}>{showDetailedSearch ? '상세 검색 숨기기' : '상세 검색 열기'}</Button></CardContent></Card>
        <div className={showDetailedSearch ? 'space-y-4' : 'hidden'}><GoogleSheetsGlobalSearch favorites={favoriteResources} suggestedKeywords={keywordSuggestions} onOpenResource={handleOpenResource} onToggleFavorite={handleToggleFavorite} externalQuery={query} onPreviewChange={setSheetSearchPreview} /><GoogleSheetsFinder favorites={favoriteResources} suggestedKeywords={keywordSuggestions} onOpenResource={handleOpenResource} onToggleFavorite={handleToggleFavorite} externalQuery={query} onPreviewChange={setSheetListPreview} /></div>
      </section>
    </div>
  );
}

function buildWorkspaceOwnerKey(email?: string | null, id?: string | null): string {
  const raw = (email || id || 'guest').trim().toLowerCase();
  return raw.replace(/[^a-z0-9._-]/g, '-');
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
    showWeeklySummary: true,
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
    const parsed = JSON.parse(raw) as WorkspaceResource[];
    if (!Array.isArray(parsed)) return [];

    return dedupeResources(
      parsed
        .filter((item): item is WorkspaceResource => Boolean(item?.id && item?.title))
        .map((item) => ({
          ...item,
          source: item.source ?? 'history',
          openedCount: item.openedCount ?? 0,
        })),
    );
  } catch {
    return [];
  }
}

function readStoredTodos(key: string): TodoItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<TodoItem>[];
    if (!Array.isArray(parsed)) return [];

    return sortTodos(
      parsed
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
  } catch {
    return [];
  }
}

function readStoredWorkLogs(key: string): WorkHistoryRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<WorkHistoryRecord>[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is Partial<WorkHistoryRecord> & Pick<WorkHistoryRecord, 'id' | 'title' | 'date'> => Boolean(item?.id && item?.title && item?.date))
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
  } catch {
    return [];
  }
}

function readStoredMemos(key: string): MemoItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<MemoItem>[];
    if (!Array.isArray(parsed)) return [];

    return sortMemos(
      parsed
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

function buildWeeklySummary(todos: TodoItem[], records: WorkHistoryRecord[]) {
  const range = getCurrentWeekRange();
  const createdTodos = todos.filter((todo) => isDateInRange(todo.createdAt, range.start, range.end)).length;
  const completedTodos = todos.filter((todo) => todo.completed && isDateInRange(todo.completedAt, range.start, range.end)).length;
  const completedRecords = records.filter((record) => isDateInRange(record.date, range.start, range.end)).length;
  const overdueTodos = todos.filter((todo) => !todo.completed && Boolean(todo.dueDate) && todo.dueDate! < getTodayDateInputValue()).length;
  const activeProjects = [...new Set(todos.filter((todo) => !todo.completed).map((todo) => todo.project).filter(Boolean))].slice(0, 5);
  const progress = todos.length === 0 ? 0 : Math.round((todos.filter((todo) => todo.completed).length / todos.length) * 100);

  return {
    createdTodos,
    completedTodos,
    completedRecords,
    overdueTodos,
    activeProjects,
    progress,
    start: range.start,
    end: range.end,
  };
}

function buildWeeklySummaryText(summary: ReturnType<typeof buildWeeklySummary>): string {
  const projectText = summary.activeProjects.length > 0 ? `${summary.activeProjects.join(', ')} 프로젝트를 중심으로` : '이번 주에는';
  return `${projectText} To-do ${summary.createdTodos}건을 만들고 ${summary.completedTodos}건을 완료했습니다. 업무 기록은 ${summary.completedRecords}건 남겼고, 오늘 기준 미완료 항목은 ${summary.overdueTodos}건입니다.`;
}

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start: formatDateKey(start),
    end: formatDateKey(end),
  };
}

function formatDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateInRange(value: string | undefined, start: string, end: string): boolean {
  if (!value) return false;
  const key = value.slice(0, 10);
  return key >= start && key <= end;
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
    <div className="rounded-2xl border border-border/60 bg-background/65 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

const workspaceToneClassMap: Record<
  WorkspaceTone,
  { card: string; badge: string }
> = {
  sand: {
    card: 'bg-gradient-to-br from-amber-50/70 via-card to-orange-50/40 dark:from-card dark:via-card dark:to-card',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  sky: {
    card: 'bg-gradient-to-br from-sky-50/80 via-card to-blue-50/40 dark:from-card dark:via-card dark:to-card',
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  mint: {
    card: 'bg-gradient-to-br from-emerald-50/80 via-card to-teal-50/40 dark:from-card dark:via-card dark:to-card',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
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
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
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
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {resources.length === 0 && <div className="rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">{emptyText}</div>}
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
