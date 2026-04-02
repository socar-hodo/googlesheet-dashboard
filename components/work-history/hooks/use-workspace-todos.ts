'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { TodoItem, TodoPriority } from '@/types/workspace-state';
import type { WorkHistoryRecord } from '@/types/work-history';
import type { WorkspaceResource } from '@/types/workspace-resource';
import { sortTodos, todoPriorities, mapTodoPriorityToCategory } from '../utils/workspace-todo-utils';
import { getTodayDateInputValue } from '../utils/workspace-calendar-utils';
import { buildTodoWorkLogId, toHistoryResource, formatDateTime } from '../utils/workspace-formatters';

export interface UseWorkspaceTodosOptions {
  workspaceOwnerKey: string;
  selectedDate: string;
  onOpenResource: (resource: WorkspaceResource) => void;
  setLocalRecords: React.Dispatch<React.SetStateAction<WorkHistoryRecord[]>>;
  setRecentResources: React.Dispatch<React.SetStateAction<WorkspaceResource[]>>;
  setFavoriteResources: React.Dispatch<React.SetStateAction<WorkspaceResource[]>>;
}

export function useWorkspaceTodos(
  initialTodos: TodoItem[],
  options: UseWorkspaceTodosOptions,
) {
  const {
    workspaceOwnerKey,
    selectedDate,
    onOpenResource,
    setLocalRecords,
    setRecentResources,
    setFavoriteResources,
  } = options;

  const [todos, setTodos] = useState<TodoItem[]>(initialTodos);

  // Add-todo form state
  const [selectedDateTodoInput, setSelectedDateTodoInput] = useState('');
  const [selectedDateTodoPriority, setSelectedDateTodoPriority] = useState<TodoPriority>('medium');
  const [selectedDateTodoProject, setSelectedDateTodoProject] = useState('미분류');

  // Edit-todo form state
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState('');
  const [editingTodoPriority, setEditingTodoPriority] = useState<TodoPriority>('medium');
  const [editingTodoProject, setEditingTodoProject] = useState('미분류');
  const [editingTodoDueDate, setEditingTodoDueDate] = useState(getTodayDateInputValue());

  const sortedTodos = useMemo(() => sortTodos(todos), [todos]);

  const appendTodo = useCallback(
    ({
      title,
      dueDate,
      priority,
      project,
    }: {
      title: string;
      dueDate?: string;
      priority: TodoPriority;
      project: string;
    }) => {
      setTodos((current) =>
        sortTodos([
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
        ]),
      );
    },
    [workspaceOwnerKey],
  );

  const handleAddSelectedDateTodo = useCallback(() => {
    const title = selectedDateTodoInput.trim();
    if (!title) return;
    const project = selectedDateTodoProject.trim() || '미분류';
    appendTodo({ title, dueDate: selectedDate, priority: selectedDateTodoPriority, project });
    setSelectedDateTodoInput('');
    setSelectedDateTodoProject('미분류');
    setSelectedDateTodoPriority('medium');
  }, [selectedDateTodoInput, selectedDateTodoProject, selectedDate, selectedDateTodoPriority, appendTodo]);

  // Track recently toggled todo for animation (Item #9)
  const [recentlyToggledId, setRecentlyToggledId] = useState<string | null>(null);

  const handleToggleTodo = useCallback((todoId: string) => {
    setTodos((current) =>
      current.map((todo) => {
        if (todo.id !== todoId) return todo;
        const next = {
          ...todo,
          completed: !todo.completed,
          completedAt: !todo.completed ? new Date().toISOString() : undefined,
        };
        toast(next.completed ? '할 일을 완료했습니다.' : '할 일을 다시 진행합니다.');
        return next;
      }),
    );
    // Trigger animation (Item #9)
    setRecentlyToggledId(todoId);
    setTimeout(() => setRecentlyToggledId(null), 500);
  }, []);

  const handleRestoreTodoToToday = useCallback((todoId: string) => {
    handleRestoreTodoToDate(todoId, getTodayDateInputValue());
  }, []);

  const handleRestoreTodoToDate = useCallback((todoId: string, dateKey: string) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === todoId
          ? { ...todo, completed: false, completedAt: undefined, dueDate: dateKey }
          : todo,
      ),
    );
  }, []);

  const handleStartEditingTodo = useCallback(
    (todo: TodoItem) => {
      setEditingTodoId(todo.id);
      setEditingTodoTitle(todo.title);
      setEditingTodoPriority(todo.priority);
      setEditingTodoProject(todo.project);
      setEditingTodoDueDate(todo.dueDate ?? selectedDate);
    },
    [selectedDate],
  );

  const handleCancelEditingTodo = useCallback(() => {
    setEditingTodoId(null);
    setEditingTodoTitle('');
    setEditingTodoPriority('medium');
    setEditingTodoProject('미분류');
    setEditingTodoDueDate(getTodayDateInputValue());
  }, []);

  const handleSaveEditedTodo = useCallback(() => {
    const title = editingTodoTitle.trim();
    const project = editingTodoProject.trim() || '미분류';
    const dueDate = editingTodoDueDate || selectedDate;
    if (!editingTodoId || !title) return;

    setTodos((current) =>
      sortTodos(
        current.map((todo) =>
          todo.id === editingTodoId
            ? { ...todo, title, priority: editingTodoPriority, project, dueDate }
            : todo,
        ),
      ),
    );
    handleCancelEditingTodo();
    toast('할 일을 수정했습니다.');
  }, [editingTodoId, editingTodoTitle, editingTodoPriority, editingTodoProject, editingTodoDueDate, selectedDate, handleCancelEditingTodo]);

  const handleRemoveTodo = useCallback(
    (todoId: string) => {
      const workLogId = buildTodoWorkLogId(workspaceOwnerKey, todoId);
      const resourceId = `history-${workLogId}`;

      // Snapshot for undo (Item #4)
      let removedTodo: TodoItem | undefined;
      let removedRecord: import('@/types/work-history').WorkHistoryRecord | undefined;
      let removedRecentResource: import('@/types/workspace-resource').WorkspaceResource | undefined;
      let removedFavoriteResource: import('@/types/workspace-resource').WorkspaceResource | undefined;

      setTodos((current) => {
        removedTodo = current.find((todo) => todo.id === todoId);
        return current.filter((todo) => todo.id !== todoId);
      });
      setLocalRecords((current) => {
        removedRecord = current.find((record) => record.id === workLogId);
        return current.filter((record) => record.id !== workLogId);
      });
      setRecentResources((current) => {
        removedRecentResource = current.find((resource) => resource.id === resourceId);
        return current.filter((resource) => resource.id !== resourceId);
      });
      setFavoriteResources((current) => {
        removedFavoriteResource = current.find((resource) => resource.id === resourceId);
        return current.filter((resource) => resource.id !== resourceId);
      });
      if (editingTodoId === todoId) {
        handleCancelEditingTodo();
      }
      // Undo toast (Item #4)
      toast('할 일을 삭제했습니다.', {
        action: {
          label: '되돌리기',
          onClick: () => {
            if (removedTodo) {
              setTodos((current) => sortTodos([removedTodo!, ...current]));
            }
            if (removedRecord) {
              setLocalRecords((current) => [removedRecord!, ...current].sort((a, b) => b.date.localeCompare(a.date)));
            }
            if (removedRecentResource) {
              setRecentResources((current) => [removedRecentResource!, ...current]);
            }
            if (removedFavoriteResource) {
              setFavoriteResources((current) => [removedFavoriteResource!, ...current]);
            }
            toast('할 일을 복원했습니다.');
          },
        },
      });
    },
    [workspaceOwnerKey, editingTodoId, handleCancelEditingTodo, setLocalRecords, setRecentResources, setFavoriteResources],
  );

  const handleCreateWorkLogFromTodo = useCallback(
    (todo: TodoItem) => {
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
      onOpenResource(toHistoryResource(record));
    },
    [workspaceOwnerKey, onOpenResource, setLocalRecords],
  );

  return {
    todos,
    setTodos,
    sortedTodos,

    // Add form
    selectedDateTodoInput,
    setSelectedDateTodoInput,
    selectedDateTodoPriority,
    setSelectedDateTodoPriority,
    selectedDateTodoProject,
    setSelectedDateTodoProject,

    // Animation state (Item #9)
    recentlyToggledId,

    // Edit form
    editingTodoId,
    editingTodoTitle,
    setEditingTodoTitle,
    editingTodoPriority,
    setEditingTodoPriority,
    editingTodoProject,
    setEditingTodoProject,
    editingTodoDueDate,
    setEditingTodoDueDate,

    // Handlers
    handleAddSelectedDateTodo,
    handleToggleTodo,
    handleRestoreTodoToToday,
    handleRestoreTodoToDate,
    handleStartEditingTodo,
    handleCancelEditingTodo,
    handleSaveEditedTodo,
    handleRemoveTodo,
    handleCreateWorkLogFromTodo,
  };
}
