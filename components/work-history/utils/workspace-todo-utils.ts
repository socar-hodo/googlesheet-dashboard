import type { TodoItem, TodoPriority, MemoItem } from '@/types/workspace-state';
import type { WorkCategory } from '@/types/work-history';

export const todoPriorities: Array<{ value: TodoPriority; label: string }> = [
  { value: 'high', label: '높음' },
  { value: 'medium', label: '중간' },
  { value: 'low', label: '낮음' },
];

export const priorityTone: Record<TodoPriority, string> = {
  high: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300',
  medium: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300',
  low: 'bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300',
};

export function sortTodos(todos: TodoItem[]): TodoItem[] {
  return [...todos].sort((left, right) => {
    if (left.completed !== right.completed) return left.completed ? 1 : -1;

    const dateGap = getTimeValue(left.dueDate) - getTimeValue(right.dueDate);
    if (dateGap !== 0) return dateGap;

    const priorityGap = getPriorityWeight(right.priority) - getPriorityWeight(left.priority);
    if (priorityGap !== 0) return priorityGap;

    return getTimeValue(right.createdAt) - getTimeValue(left.createdAt);
  });
}

export function sortMemos(memos: MemoItem[]): MemoItem[] {
  return [...memos].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return getTimeValue(right.updatedAt) - getTimeValue(left.updatedAt);
  });
}

export function groupTodosByProject(todos: TodoItem[]) {
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

export function parseMemoTags(raw: string): string[] {
  return raw
    .split(/[,\n#]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function mapTodoPriorityToCategory(priority: TodoPriority): WorkCategory {
  if (priority === 'high') return 'delivery';
  if (priority === 'medium') return 'analysis';
  return 'planning';
}

function getPriorityWeight(priority: TodoPriority): number {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

function getTimeValue(value?: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}
