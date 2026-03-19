'use client';

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';
import {
  ArrowDownAZ,
  CalendarClock,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Search,
  SearchCheck,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkspaceResource } from '@/types/workspace-resource';

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

interface SearchPayload {
  indexedFileCount: number;
  results: SpreadsheetSearchMatch[];
}

type SearchSortOption = 'relevance' | 'recent' | 'file-name';

interface GoogleSheetsGlobalSearchProps {
  favorites: WorkspaceResource[];
  suggestedKeywords: string[];
  onOpenResource: (resource: WorkspaceResource) => void;
  onToggleFavorite: (resource: WorkspaceResource) => void;
  externalQuery?: string;
  onPreviewChange?: (preview: {
    query: string;
    loading: boolean;
    error: string | null;
    indexedFileCount: number;
    results: SpreadsheetSearchMatch[];
  }) => void;
}

export function GoogleSheetsGlobalSearch({
  favorites,
  suggestedKeywords,
  onOpenResource,
  onToggleFavorite,
  externalQuery,
  onPreviewChange,
}: GoogleSheetsGlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [indexedFileCount, setIndexedFileCount] = useState(0);
  const [results, setResults] = useState<SpreadsheetSearchMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SearchSortOption>('relevance');
  const [isRefreshing, startRefresh] = useTransition();
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setQuery(externalQuery ?? '');
  }, [externalQuery]);

  useEffect(() => {
    const normalized = deferredQuery.trim();
    if (!normalized) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();

    async function runSearch() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ query: normalized });
        const response = await fetch(`/api/google/spreadsheets/search?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });

        const payload = (await response.json()) as SearchPayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? '통합 검색을 불러오지 못했습니다.');
        }

        setIndexedFileCount(payload.indexedFileCount);
        setResults(payload.results ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : '통합 검색을 불러오지 못했습니다.');
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void runSearch();

    return () => controller.abort();
  }, [deferredQuery]);

  const sortedResults = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    const collator = new Intl.Collator('ko-KR');

    return [...results].sort((left, right) => {
      if (sortBy === 'recent') {
        return getTimeValue(right.modifiedTime) - getTimeValue(left.modifiedTime);
      }

      if (sortBy === 'file-name') {
        return collator.compare(left.fileName, right.fileName);
      }

      const scoreGap = scoreResult(right, normalized) - scoreResult(left, normalized);
      if (scoreGap !== 0) return scoreGap;

      return getTimeValue(right.modifiedTime) - getTimeValue(left.modifiedTime);
    });
  }, [results, deferredQuery, sortBy]);

  const visibleSuggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return suggestedKeywords
      .filter((keyword) => keyword.toLowerCase() !== normalized)
      .slice(0, 8);
  }, [suggestedKeywords, query]);

  useEffect(() => {
    onPreviewChange?.({
      query: deferredQuery.trim(),
      loading,
      error,
      indexedFileCount,
      results: sortedResults.slice(0, 5),
    });
  }, [deferredQuery, loading, error, indexedFileCount, sortedResults, onPreviewChange]);

  function handleRefresh() {
    if (!deferredQuery.trim()) return;

    startRefresh(async () => {
      setError(null);
      try {
        const params = new URLSearchParams({ query: deferredQuery.trim(), refresh: '1' });
        const response = await fetch(`/api/google/spreadsheets/search?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as SearchPayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? '인덱스를 새로 고치지 못했습니다.');
        }

        setIndexedFileCount(payload.indexedFileCount);
        setResults(payload.results ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '인덱스를 새로 고치지 못했습니다.');
      }
    });
  }

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Google Sheets 통합 검색</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              내가 만든 여러 스프레드시트의 셀 내용을 한 번에 검색하고, 자주 찾는 키워드로 바로
              진입할 수 있습니다.
            </p>
          </div>
          <SearchCheck className="h-5 w-5 text-primary" />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="예: 운영, 지표, 대시보드, 주간"
              className="h-11 w-full rounded-2xl border border-border/70 bg-background/70 pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SearchSortOption)}
            className="h-11 rounded-2xl border border-border/70 bg-background/70 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            <option value="relevance">관련도순</option>
            <option value="recent">최근 수정순</option>
            <option value="file-name">파일명순</option>
          </select>

          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            disabled={!deferredQuery.trim() || isRefreshing}
            onClick={handleRefresh}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            인덱스 새로고침
          </Button>
        </div>

        {visibleSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              추천 키워드
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleSuggestions.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => setQuery(keyword)}
                  className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm text-foreground transition hover:border-primary/40 hover:bg-background"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {!deferredQuery.trim() && (
          <div className="rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">
            검색어를 입력하면 내가 만든 여러 Google Sheets의 셀 내용과 문맥을 한 번에
            찾아줍니다.
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            통합 검색 인덱스를 확인하는 중입니다.
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-700 dark:text-amber-300">
            <p>{error}</p>
            {error.includes('Google 인증') && (
              <a
                href="/login?callbackUrl=%2Fwork-history"
                className="mt-3 inline-flex rounded-full border border-amber-500/30 px-3 py-1.5 text-xs font-semibold transition hover:bg-amber-500/10"
              >
                다시 로그인
              </a>
            )}
          </div>
        )}

        {!loading && !error && deferredQuery.trim() && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Indexed {indexedFileCount} files
            </p>
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              {sortBy === 'relevance' && <Search className="h-3.5 w-3.5" />}
              {sortBy === 'recent' && <CalendarClock className="h-3.5 w-3.5" />}
              {sortBy === 'file-name' && <ArrowDownAZ className="h-3.5 w-3.5" />}
              {sortLabelMap[sortBy]} 정렬
            </div>
          </div>
        )}

        {!loading && !error && deferredQuery.trim() && sortedResults.length === 0 && (
          <div className="rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">
            검색어와 일치하는 시트 내용이 없습니다. 추천 키워드로 다시 시도해 보세요.
          </div>
        )}

        {!loading &&
          !error &&
          sortedResults.map((result) => {
            const resource = toResource(result);
            const isFavorite = favorites.some((favorite) => favorite.id === resource.id);

            return (
              <div
                key={`${result.fileId}-${result.sheetName}-${result.rowNumber}`}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/65 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{result.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.sheetName} · {result.rowNumber}행 · 최근 수정{' '}
                      {formatDate(result.modifiedTime)}
                    </p>
                    {result.ownerName && (
                      <p className="mt-1 text-xs text-muted-foreground">소유자: {result.ownerName}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => onToggleFavorite(resource)}
                    >
                      <Star
                        className={`mr-2 h-4 w-4 ${isFavorite ? 'fill-current text-amber-500' : ''}`}
                      />
                      {isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                    </Button>
                    <Button asChild variant="outline" className="rounded-2xl">
                      <a
                        href={result.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => onOpenResource(resource)}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        위치 열기
                      </a>
                    </Button>
                  </div>
                </div>

                <p className="text-sm leading-6 text-foreground">{result.snippet}</p>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}

const sortLabelMap: Record<SearchSortOption, string> = {
  relevance: '관련도순',
  recent: '최근 수정순',
  'file-name': '파일명순',
};

function toResource(result: SpreadsheetSearchMatch): WorkspaceResource {
  return {
    id: `search-${result.fileId}-${result.sheetName}-${result.rowNumber}`,
    title: result.fileName,
    href: result.webViewLink,
    subtitle: `${result.sheetName} · ${result.rowNumber}행`,
    description: result.snippet,
    source: 'sheets-search',
  };
}

function formatDate(value?: string): string {
  if (!value) return '정보 없음';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function getTimeValue(value?: string): number {
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function scoreResult(result: SpreadsheetSearchMatch, query: string): number {
  if (!query) return 0;

  const fileName = result.fileName.toLowerCase();
  const sheetName = result.sheetName.toLowerCase();
  const snippet = result.snippet.toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);

  let score = 0;

  for (const token of tokens) {
    if (fileName.includes(token)) score += 6;
    if (sheetName.includes(token)) score += 4;
    if (snippet.includes(token)) score += 2;
    if (fileName.startsWith(token)) score += 2;
  }

  if (fileName.includes(query)) score += 8;
  if (sheetName.includes(query)) score += 5;
  if (snippet.includes(query)) score += 3;

  return score;
}
