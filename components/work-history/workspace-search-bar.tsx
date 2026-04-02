'use client';

import { ExternalLink, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface AutocompleteItem {
  id: string;
  title: string;
  subtitle: string;
  href: string | undefined;
  external: boolean;
  sectionTitle: string;
  onOpen: () => void;
}

interface WorkspaceSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  normalizedQuery: string;
  autocompleteItems: AutocompleteItem[];
  autocompleteLoading: boolean;
  autocompleteHasResults: boolean;
  keywordSuggestions: string[];
}

export function WorkspaceSearchBar({
  query,
  onQueryChange,
  normalizedQuery,
  autocompleteItems,
  autocompleteLoading,
  autocompleteHasResults,
  keywordSuggestions,
}: WorkspaceSearchBarProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            role="combobox"
            aria-expanded={!!normalizedQuery}
            aria-controls="workspace-autocomplete"
            aria-autocomplete="list"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="업무명, 프로젝트, 태그, 결과로 검색"
            className="h-13 w-full rounded-[1.4rem] pl-11 pr-4"
          />
        </label>
        {normalizedQuery && (
          <div
            id="workspace-autocomplete"
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-20 overflow-hidden rounded-[1.75rem] border border-border/60 bg-popover shadow-[0_26px_70px_-34px_rgba(20,26,36,0.24)] backdrop-blur"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Quick Results
              </p>
              <span className="text-xs text-muted-foreground">
                {autocompleteHasResults
                  ? `${autocompleteItems.length}개 미리보기`
                  : '검색 중'}
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {autocompleteItems.map((item) => (
                <a
                  key={item.id}
                  role="option"
                  aria-selected={false}
                  href={item.href ?? '#'}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noreferrer' : undefined}
                  onClick={item.onOpen}
                  className="flex items-start justify-between gap-3 rounded-2xl px-3 py-3 transition hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {item.sectionTitle}
                      </span>
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {item.subtitle}
                    </p>
                  </div>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
              {!autocompleteHasResults && autocompleteLoading && (
                <div className="rounded-2xl px-3 py-4 text-sm text-muted-foreground">
                  검색 결과를 불러오는 중입니다.
                </div>
              )}
              {!autocompleteHasResults && !autocompleteLoading && (
                <div className="rounded-2xl px-3 py-4 text-sm text-muted-foreground">
                  일치하는 결과가 없습니다. 다른 키워드로 다시 검색해보세요.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {keywordSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywordSuggestions.map((keyword) => (
            <button
              key={keyword}
              type="button"
              onClick={() => onQueryChange(keyword)}
              className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-sm text-foreground transition hover:border-foreground/30 hover:bg-background/80"
            >
              {keyword}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
