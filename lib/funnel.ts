import "server-only";

import { readFileSync } from "fs";
import { resolve } from "path";

const _funnelSqlCache = new Map<string, string>();

function _readFunnelSqlFile(filename: string): string {
  if (_funnelSqlCache.has(filename)) return _funnelSqlCache.get(filename)!;
  const content = readFileSync(
    resolve(process.cwd(), "sql/funnel", filename),
    "utf-8",
  );
  _funnelSqlCache.set(filename, content);
  return content;
}

export function loadFunnelSql(filename: string): string {
  return _readFunnelSqlFile(filename);
}

export function replaceSqlParams(
  sql: string,
  params: Record<string, string>,
): string {
  let result = sql;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

export function safeInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function safeFloat(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
}
