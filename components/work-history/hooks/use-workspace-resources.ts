'use client';

import { useCallback, useState } from 'react';
import type { WorkspaceResource } from '@/types/workspace-resource';
import type { GoogleSpreadsheetFile } from '@/types/google-drive';
import type { SpreadsheetSearchMatch } from '@/components/work-history/google-sheets-global-search';
import { dedupeResources } from '../utils/workspace-storage';

export interface SheetSearchPreview {
  query: string;
  loading: boolean;
  error: string | null;
  indexedFileCount: number;
  results: SpreadsheetSearchMatch[];
}

export interface SheetListPreview {
  query: string;
  loading: boolean;
  error: string | null;
  files: GoogleSpreadsheetFile[];
}

export function useWorkspaceResources(
  initialRecent: WorkspaceResource[],
  initialFavorites: WorkspaceResource[],
) {
  const [recentResources, setRecentResources] = useState<WorkspaceResource[]>(initialRecent);
  const [favoriteResources, setFavoriteResources] = useState<WorkspaceResource[]>(initialFavorites);
  const [sheetSearchPreview, setSheetSearchPreview] = useState<SheetSearchPreview>({
    query: '',
    loading: false,
    error: null,
    indexedFileCount: 0,
    results: [],
  });
  const [sheetListPreview, setSheetListPreview] = useState<SheetListPreview>({
    query: '',
    loading: false,
    error: null,
    files: [],
  });

  const handleOpenResource = useCallback((resource: WorkspaceResource) => {
    setRecentResources((current) => {
      const existing = current.find((item) => item.id === resource.id);
      return dedupeResources([
        {
          ...resource,
          openedAt: new Date().toISOString(),
          openedCount: (existing?.openedCount ?? resource.openedCount ?? 0) + 1,
        },
        ...current,
      ]).slice(0, 8);
    });
  }, []);

  const handleToggleFavorite = useCallback((resource: WorkspaceResource) => {
    setFavoriteResources((current) => {
      const exists = current.some((item) => item.id === resource.id);
      return exists
        ? current.filter((item) => item.id !== resource.id)
        : [{ ...resource, openedAt: resource.openedAt ?? new Date().toISOString() }, ...current].slice(0, 8);
    });
  }, []);

  const handleRemoveRecent = useCallback((resourceId: string) => {
    setRecentResources((current) => current.filter((item) => item.id !== resourceId));
  }, []);

  const handleRemoveFavorite = useCallback((resourceId: string) => {
    setFavoriteResources((current) => current.filter((item) => item.id !== resourceId));
  }, []);

  return {
    recentResources,
    setRecentResources,
    favoriteResources,
    setFavoriteResources,
    sheetSearchPreview,
    setSheetSearchPreview,
    sheetListPreview,
    setSheetListPreview,
    handleOpenResource,
    handleToggleFavorite,
    handleRemoveRecent,
    handleRemoveFavorite,
  };
}
