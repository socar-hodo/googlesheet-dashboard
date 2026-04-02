'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownAZ,
  CalendarClock,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Search,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { GoogleSpreadsheetFile } from '@/types/google-drive';
import type { WorkspaceResource } from '@/types/workspace-resource';

type FileSortOption = 'recent' | 'name' | 'oldest';

interface GoogleSheetsFinderProps {
  favorites: WorkspaceResource[];
  suggestedKeywords: string[];
  onOpenResource: (resource: WorkspaceResource) => void;
  onToggleFavorite: (resource: WorkspaceResource) => void;
  externalQuery?: string;
  onPreviewChange?: (preview: {
    query: string;
    loading: boolean;
    error: string | null;
    files: GoogleSpreadsheetFile[];
  }) => void;
}

export function GoogleSheetsFinder({
  favorites,
  suggestedKeywords,
  onOpenResource,
  onToggleFavorite,
  externalQuery,
  onPreviewChange,
}: GoogleSheetsFinderProps) {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<GoogleSpreadsheetFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresGoogleReconnect, setRequiresGoogleReconnect] = useState(false);
  const [sortBy, setSortBy] = useState<FileSortOption>('recent');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setQuery(externalQuery ?? '');
  }, [externalQuery]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFiles() {
      setLoading(true);
      setError(null);
      setRequiresGoogleReconnect(false);

      try {
        const params = new URLSearchParams();
        if (deferredQuery.trim()) {
          params.set('query', deferredQuery.trim());
        }

        const response = await fetch(`/api/google/spreadsheets?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });

        const payload = (await response.json()) as {
          error?: string;
          files?: GoogleSpreadsheetFile[];
          requiresGoogleReconnect?: boolean;
        };

        if (!response.ok) {
          setRequiresGoogleReconnect(Boolean(payload.requiresGoogleReconnect));
          throw new Error(payload.error ?? '시트 목록을 불러오지 못했습니다.');
        }

        setFiles(payload.files ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : '시트 목록을 불러오지 못했습니다.');
        setFiles([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadFiles();

    return () => controller.abort();
  }, [deferredQuery]);

  const sortedFiles = useMemo(() => {
    const collator = new Intl.Collator('ko-KR');

    return [...files].sort((left, right) => {
      if (sortBy === 'name') {
        return collator.compare(left.name, right.name);
      }

      if (sortBy === 'oldest') {
        return getTimeValue(left.modifiedTime) - getTimeValue(right.modifiedTime);
      }

      return getTimeValue(right.modifiedTime) - getTimeValue(left.modifiedTime);
    });
  }, [files, sortBy]);

  const visibleSuggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return suggestedKeywords
      .filter((keyword) => keyword.toLowerCase() !== normalized)
      .slice(0, 6);
  }, [suggestedKeywords, query]);

  useEffect(() => {
    onPreviewChange?.({
      query: deferredQuery.trim(),
      loading,
      error,
      files: sortedFiles.slice(0, 5),
    });
  }, [deferredQuery, loading, error, sortedFiles, onPreviewChange]);

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">내 Google Sheets 목록</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              내가 소유한 스프레드시트를 빠르게 찾고, 최근 수정순이나 이름순으로 정렬해서 볼 수 있습니다.
            </p>
          </div>
          <FileSpreadsheet className="h-5 w-5 text-primary" />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="시트 이름으로 검색"
              className="h-11 w-full rounded-2xl pl-11 pr-4"
            />
          </label>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as FileSortOption)}>
            <SelectTrigger className="h-11 w-36 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">최근 수정순</SelectItem>
              <SelectItem value="name">파일명순</SelectItem>
              <SelectItem value="oldest">오래된 수정순</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {visibleSuggestions.length > 0 && (
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
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {!loading && !error && (
          <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            {sortBy === 'recent' && <CalendarClock className="h-3.5 w-3.5" />}
            {sortBy === 'name' && <ArrowDownAZ className="h-3.5 w-3.5" />}
            {sortBy === 'oldest' && <CalendarClock className="h-3.5 w-3.5" />}
            {fileSortLabelMap[sortBy]} 정렬
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            시트 목록을 불러오는 중입니다.
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-700 dark:text-amber-300">
            <p>{error}</p>
            {requiresGoogleReconnect && (
              <a
                href="/login?callbackUrl=%2Fwork-history"
                className="mt-3 inline-flex rounded-full border border-amber-500/30 px-3 py-1.5 text-xs font-semibold transition hover:bg-amber-500/10"
              >
                Google 다시 로그인
              </a>
            )}
          </div>
        )}

        {!loading && !error && sortedFiles.length === 0 && (
          <div className="rounded-2xl bg-background/65 px-4 py-6 text-sm text-muted-foreground">
            검색 조건과 맞는 Google Sheets가 없습니다.
          </div>
        )}

        {!loading &&
          !error &&
          sortedFiles.map((file) => {
            const resource = toResource(file);
            const isFavorite = favorites.some((favorite) => favorite.id === resource.id);

            return (
              <div
                key={file.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/65 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    최근 수정: {formatDate(file.modifiedTime)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    소유자 {file.owners?.[0]?.displayName ?? file.owners?.[0]?.emailAddress ?? 'Google Sheets 문서'}
                  </p>
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
                      href={file.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => onOpenResource(resource)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      시트 열기
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}

const fileSortLabelMap: Record<FileSortOption, string> = {
  recent: '최근 수정순',
  name: '파일명순',
  oldest: '오래된 수정순',
};

function toResource(file: GoogleSpreadsheetFile): WorkspaceResource {
  return {
    id: `sheet-${file.id}`,
    title: file.name,
    href: file.webViewLink,
    subtitle: 'Google Sheets',
    description: file.owners?.[0]?.displayName ?? file.owners?.[0]?.emailAddress ?? 'Google Sheets 문서',
    source: 'sheets-list',
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
