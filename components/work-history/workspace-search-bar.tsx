'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Show dropdown when there's a query and user hasn't dismissed it
  const showDropdown = isDropdownOpen && !!normalizedQuery;

  // Open dropdown when query changes
  useEffect(() => {
    if (normalizedQuery) {
      setIsDropdownOpen(true);
      setActiveIndex(-1);
    }
  }, [normalizedQuery]);

  // Outside click detection (Item #2)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation handler (Item #1)
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown) return;

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          setActiveIndex((prev) =>
            prev < autocompleteItems.length - 1 ? prev + 1 : 0,
          );
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : autocompleteItems.length - 1,
          );
          break;
        }
        case 'Enter': {
          if (activeIndex >= 0 && activeIndex < autocompleteItems.length) {
            event.preventDefault();
            const item = autocompleteItems[activeIndex];
            item.onOpen();
            if (item.href && item.external) {
              window.open(item.href, '_blank', 'noreferrer');
            }
            setIsDropdownOpen(false);
            setActiveIndex(-1);
          }
          break;
        }
        case 'Escape': {
          event.preventDefault();
          setIsDropdownOpen(false);
          setActiveIndex(-1);
          inputRef.current?.blur();
          break;
        }
      }
    },
    [showDropdown, activeIndex, autocompleteItems],
  );

  // Focus handler to reopen dropdown
  const handleFocus = useCallback(() => {
    if (normalizedQuery) {
      setIsDropdownOpen(true);
    }
  }, [normalizedQuery]);

  const activeDescendantId =
    activeIndex >= 0 && activeIndex < autocompleteItems.length
      ? `autocomplete-item-${autocompleteItems[activeIndex].id}`
      : undefined;

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="relative">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="workspace-autocomplete"
            aria-autocomplete="list"
            aria-activedescendant={activeDescendantId}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder="업무명, 프로젝트, 태그, 결과로 검색"
            className="h-13 w-full rounded-[1.4rem] pl-11 pr-4"
          />
        </label>
        {showDropdown && (
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
              {autocompleteItems.map((item, index) => (
                <a
                  key={item.id}
                  id={`autocomplete-item-${item.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  href={item.href ?? '#'}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noreferrer' : undefined}
                  onClick={(event) => {
                    item.onOpen();
                    setIsDropdownOpen(false);
                    setActiveIndex(-1);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-2xl px-3 py-3 transition hover:bg-accent',
                    index === activeIndex && 'bg-accent',
                  )}
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
