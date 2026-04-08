import 'server-only';

import { getRedis as _getSharedRedis } from '@/lib/redis';
import type { WorkspaceResource } from '@/types/workspace-resource';
import type { MemoItem, TodoItem, WorkspaceState } from '@/types/workspace-state';
import type { WorkHistoryRecord } from '@/types/work-history';

// ── Redis client (shared singleton from lib/redis) ───────────────────

function getRedis() {
  try {
    return _getSharedRedis();
  } catch {
    console.warn('[workspace-state] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — server persistence disabled');
    return null;
  }
}

// ── Key helpers ─────────────────────────────────────────────────────

function stateKey(ownerKey: string): string {
  return `ws:state:${ownerKey}`;
}

// ── Public API (same interface as before) ───────────────────────────

const EMPTY_STATE: WorkspaceState = {
  recentResources: [],
  favoriteResources: [],
  todos: [],
  localRecords: [],
  memos: [],
};

export async function readWorkspaceState(ownerKey: string): Promise<WorkspaceState> {
  const redis = getRedis();
  if (!redis) return EMPTY_STATE;

  try {
    const raw = await redis.get<WorkspaceState>(stateKey(ownerKey));
    if (!raw) return EMPTY_STATE;

    // Upstash auto-deserializes JSON, but validate shape
    return {
      recentResources: safeArray<WorkspaceResource>(raw.recentResources),
      favoriteResources: safeArray<WorkspaceResource>(raw.favoriteResources),
      todos: safeArray<TodoItem>(raw.todos),
      localRecords: safeArray<WorkHistoryRecord>(raw.localRecords),
      memos: safeArray<MemoItem>(raw.memos),
    };
  } catch (error) {
    console.error('[workspace-state] Redis read failed:', error);
    return EMPTY_STATE;
  }
}

export async function replaceWorkspaceState(ownerKey: string, state: WorkspaceState): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    // Store as JSON with 90-day TTL (seconds)
    await redis.set(stateKey(ownerKey), state, { ex: 90 * 24 * 60 * 60 });
  } catch (error) {
    console.error('[workspace-state] Redis write failed:', error);
    throw error;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}
