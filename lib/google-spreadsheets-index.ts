import 'server-only';

import type { GoogleSpreadsheetFile } from '@/types/google-drive';

const DRIVE_FIELDS =
  'nextPageToken,files(id,name,createdTime,modifiedTime,webViewLink,owners(displayName,emailAddress))';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RESULTS = 50;
const MAX_COLUMNS = 20;
const MAX_ROWS = 100;

interface SpreadsheetSheetMeta {
  title: string;
  gid?: number;
}

interface IndexedSpreadsheetRow {
  fileId: string;
  fileName: string;
  webViewLink?: string;
  modifiedTime?: string;
  ownerName?: string;
  sheetName: string;
  gid?: number;
  rowNumber: number;
  text: string;
  snippet: string;
}

interface IndexCacheEntry {
  expiresAt: number;
  rows: IndexedSpreadsheetRow[];
  fileCount: number;
}

class GoogleApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'GoogleApiError';
    this.status = status;
    this.detail = detail;
  }
}

export interface SpreadsheetSearchMatch {
  fileId: string;
  fileName: string;
  webViewLink?: string;
  modifiedTime?: string;
  ownerName?: string;
  sheetName: string;
  rowNumber: number;
  snippet: string;
}

export interface SpreadsheetSearchResponse {
  indexedFileCount: number;
  results: SpreadsheetSearchMatch[];
}

const indexCache = new Map<string, IndexCacheEntry>();

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function createRowSnippet(row: string[]): string {
  return row.join(' | ').replace(/\s+/g, ' ').trim();
}

function createRowText(row: string[]): string {
  return row.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

async function fetchJson<T>(url: string | URL, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new GoogleApiError(response.status, await response.text());
  }

  return (await response.json()) as T;
}

async function listOwnedSpreadsheets(accessToken: string): Promise<GoogleSpreadsheetFile[]> {
  const files: GoogleSpreadsheetFile[] = [];
  let pageToken: string | undefined;

  do {
    const driveUrl = new URL('https://www.googleapis.com/drive/v3/files');
    driveUrl.searchParams.set(
      'q',
      [
        "mimeType='application/vnd.google-apps.spreadsheet'",
        'trashed=false',
        "'me' in owners",
      ].join(' and '),
    );
    driveUrl.searchParams.set('pageSize', '100');
    driveUrl.searchParams.set('orderBy', 'modifiedTime desc');
    driveUrl.searchParams.set('fields', DRIVE_FIELDS);

    if (pageToken) {
      driveUrl.searchParams.set('pageToken', pageToken);
    }

    const data = await fetchJson<{ files?: GoogleSpreadsheetFile[]; nextPageToken?: string }>(
      driveUrl,
      accessToken,
    );

    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

async function getSheetMetas(accessToken: string, fileId: string): Promise<SpreadsheetSheetMeta[]> {
  const metadataUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}`);
  metadataUrl.searchParams.set('fields', 'sheets(properties(title,sheetId,index))');

  const data = await fetchJson<{
    sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  }>(metadataUrl, accessToken);

  return (data.sheets ?? [])
    .map((sheet) => ({
      title: sheet.properties?.title ?? '',
      gid: sheet.properties?.sheetId,
    }))
    .filter((sheet) => sheet.title);
}

async function getSheetValues(
  accessToken: string,
  fileId: string,
  title: string,
): Promise<string[][]> {
  const range = `${quoteSheetTitle(title)}!A1:T${MAX_ROWS}`;
  const valuesUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(range)}`,
  );

  const data = await fetchJson<{ values?: string[][] }>(valuesUrl, accessToken);
  return data.values ?? [];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function buildSpreadsheetRows(
  accessToken: string,
  file: GoogleSpreadsheetFile,
): Promise<IndexedSpreadsheetRow[]> {
  try {
    const sheets = await getSheetMetas(accessToken, file.id);
    const sheetRows = await mapWithConcurrency(sheets, 3, async (sheet) => {
      try {
        const values = await getSheetValues(accessToken, file.id, sheet.title);

        return values
          .slice(0, MAX_ROWS)
          .map((row) => row.slice(0, MAX_COLUMNS).map((cell) => cell.trim()))
          .filter((row) => row.some(Boolean))
          .map((row, index): IndexedSpreadsheetRow => ({
            fileId: file.id,
            fileName: file.name,
            webViewLink: file.webViewLink,
            modifiedTime: file.modifiedTime,
            ownerName: file.owners?.[0]?.displayName ?? file.owners?.[0]?.emailAddress,
            sheetName: sheet.title,
            gid: sheet.gid,
            rowNumber: index + 1,
            text: createRowText(row),
            snippet: createRowSnippet(row),
          }));
      } catch {
        return [];
      }
    });

    return sheetRows.flat();
  } catch {
    return [];
  }
}

async function getOrBuildIndex(
  accessToken: string,
  cacheKey: string,
  refresh: boolean,
): Promise<IndexCacheEntry> {
  const existing = indexCache.get(cacheKey);
  if (!refresh && existing && existing.expiresAt > Date.now()) {
    return existing;
  }

  const files = await listOwnedSpreadsheets(accessToken);
  const rowsByFile = await mapWithConcurrency(files, 4, async (file) => buildSpreadsheetRows(accessToken, file));

  const nextEntry: IndexCacheEntry = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    rows: rowsByFile.flat(),
    fileCount: files.length,
  };

  indexCache.set(cacheKey, nextEntry);
  return nextEntry;
}

export async function searchAcrossOwnedSpreadsheets(params: {
  accessToken: string;
  cacheKey: string;
  query: string;
  refresh?: boolean;
}): Promise<SpreadsheetSearchResponse> {
  const { accessToken, cacheKey, query, refresh = false } = params;
  const normalizedQuery = query.trim().toLowerCase();

  const index = await getOrBuildIndex(accessToken, cacheKey, refresh);

  if (!normalizedQuery) {
    return {
      indexedFileCount: index.fileCount,
      results: [],
    };
  }

  const results = index.rows
    .filter((row) => row.text.includes(normalizedQuery))
    .slice(0, MAX_RESULTS)
    .map((row) => ({
      fileId: row.fileId,
      fileName: row.fileName,
      webViewLink:
        row.webViewLink && row.gid !== undefined
          ? `${row.webViewLink}#gid=${row.gid}&range=A${row.rowNumber}:T${row.rowNumber}`
          : row.webViewLink,
      modifiedTime: row.modifiedTime,
      ownerName: row.ownerName,
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      snippet: row.snippet,
    }));

  return {
    indexedFileCount: index.fileCount,
    results,
  };
}

export function buildDriveNameQuery(query: string): string {
  const normalized = query.trim();
  if (!normalized) return '';
  return `name contains '${escapeDriveQuery(normalized)}'`;
}

export function isGoogleApiError(error: unknown): error is GoogleApiError {
  return error instanceof GoogleApiError;
}
