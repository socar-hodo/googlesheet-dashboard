import 'server-only';

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { WorkHistoryRecord } from '@/types/work-history';
import type { WorkspaceResource } from '@/types/workspace-resource';
import type { TodoItem, WorkspaceState } from '@/types/workspace-state';

const DB_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DB_DIR, 'workspace-state.sqlite');

type WorkspaceDatabase = DatabaseSync;
type GlobalWorkspaceDatabase = typeof globalThis & {
  __workspaceStateDb?: WorkspaceDatabase;
};

function ensureSchema(db: WorkspaceDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_todos (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      due_date TEXT,
      priority TEXT NOT NULL,
      project TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS workspace_todos_owner_idx
    ON workspace_todos(owner_key);

    CREATE TABLE IF NOT EXISTS workspace_memos (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS workspace_memos_owner_idx
    ON workspace_memos(owner_key);

    CREATE TABLE IF NOT EXISTS workspace_meta (
      owner_key TEXT PRIMARY KEY,
      recent_resources_json TEXT NOT NULL DEFAULT '[]',
      favorite_resources_json TEXT NOT NULL DEFAULT '[]',
      work_logs_json TEXT NOT NULL DEFAULT '[]'
    );
  `);
}

function getDatabase(): WorkspaceDatabase {
  const globalWorkspace = globalThis as GlobalWorkspaceDatabase;
  if (globalWorkspace.__workspaceStateDb) {
    ensureSchema(globalWorkspace.__workspaceStateDb);
    return globalWorkspace.__workspaceStateDb;
  }

  mkdirSync(DB_DIR, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  ensureSchema(db);

  globalWorkspace.__workspaceStateDb = db;
  return db;
}

export function readWorkspaceState(ownerKey: string): WorkspaceState {
  const db = getDatabase();

  const todoRows = db
    .prepare(
      `
        SELECT id, title, completed, created_at, completed_at, due_date, priority, project
        FROM workspace_todos
        WHERE owner_key = ?
      `,
    )
    .all(ownerKey) as Array<{
    id: string;
    title: string;
    completed: number;
    created_at: string;
    completed_at?: string | null;
    due_date?: string | null;
    priority: TodoItem['priority'];
    project: string;
  }>;

  const memoRows = db
    .prepare(
      `
        SELECT id, title, content, tags_json, pinned, created_at, updated_at
        FROM workspace_memos
        WHERE owner_key = ?
      `,
    )
    .all(ownerKey) as Array<{
    id: string;
    title: string;
    content: string;
    tags_json: string;
    pinned: number;
    created_at: string;
    updated_at: string;
  }>;

  const metaRow = db
    .prepare(
      `
        SELECT recent_resources_json, favorite_resources_json, work_logs_json
        FROM workspace_meta
        WHERE owner_key = ?
      `,
    )
    .get(ownerKey) as
    | {
        recent_resources_json: string;
        favorite_resources_json: string;
        work_logs_json: string;
      }
    | undefined;

  return {
    recentResources: safeParseResources(metaRow?.recent_resources_json),
    favoriteResources: safeParseResources(metaRow?.favorite_resources_json),
    todos: todoRows.map((row) => ({
      id: row.id,
      title: row.title,
      completed: Boolean(row.completed),
      createdAt: row.created_at,
      completedAt: row.completed_at ?? undefined,
      dueDate: row.due_date ?? undefined,
      priority: row.priority,
      project: row.project,
        })),
    localRecords: safeParseWorkLogs(metaRow?.work_logs_json),
    memos: memoRows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      tags: safeParseTags(row.tags_json),
      pinned: Boolean(row.pinned),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export function replaceWorkspaceState(ownerKey: string, state: WorkspaceState) {
  const db = getDatabase();
  const deleteTodos = db.prepare('DELETE FROM workspace_todos WHERE owner_key = ?');
  const deleteMemos = db.prepare('DELETE FROM workspace_memos WHERE owner_key = ?');
  const upsertMeta = db.prepare(`
    INSERT INTO workspace_meta (
      owner_key, recent_resources_json, favorite_resources_json, work_logs_json
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(owner_key) DO UPDATE SET
      recent_resources_json = excluded.recent_resources_json,
      favorite_resources_json = excluded.favorite_resources_json,
      work_logs_json = excluded.work_logs_json
  `);
  const insertTodo = db.prepare(`
    INSERT INTO workspace_todos (
      id, owner_key, title, completed, created_at, completed_at, due_date, priority, project
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMemo = db.prepare(`
    INSERT INTO workspace_memos (
      id, owner_key, title, content, tags_json, pinned, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');

  try {
    deleteTodos.run(ownerKey);
    deleteMemos.run(ownerKey);
    upsertMeta.run(
      ownerKey,
      JSON.stringify(state.recentResources),
      JSON.stringify(state.favoriteResources),
      JSON.stringify(state.localRecords),
    );

    for (const todo of state.todos) {
      insertTodo.run(
        todo.id,
        ownerKey,
        todo.title,
        todo.completed ? 1 : 0,
        todo.createdAt,
        todo.completedAt ?? null,
        todo.dueDate ?? null,
        todo.priority,
        todo.project,
      );
    }

    for (const memo of state.memos) {
      insertMemo.run(
        memo.id,
        ownerKey,
        memo.title,
        memo.content,
        JSON.stringify(memo.tags),
        memo.pinned ? 1 : 0,
        memo.createdAt,
        memo.updatedAt,
      );
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function safeParseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

function safeParseResources(raw?: string): WorkspaceResource[] {
  try {
    const parsed = JSON.parse(raw ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is Partial<WorkspaceResource> & Pick<WorkspaceResource, 'id' | 'title' | 'source'> =>
          Boolean(item?.id && item?.title && item?.source),
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        href: item.href,
        subtitle: item.subtitle,
        description: item.description,
        source: item.source,
        openedAt: item.openedAt,
        openedCount: item.openedCount,
      }));
  } catch {
    return [];
  }
}

function safeParseWorkLogs(raw?: string): WorkHistoryRecord[] {
  try {
    const parsed = JSON.parse(raw ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
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
        tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [],
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
