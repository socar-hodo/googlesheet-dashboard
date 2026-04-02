'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
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
    let removedResource: WorkspaceResource | undefined;
    setRecentResources((current) => {
      removedResource = current.find((item) => item.id === resourceId);
      return current.filter((item) => item.id !== resourceId);
    });
    toast('최근 문서에서 제거했습니다.', {
      action: {
        label: '되돌리기',
        onClick: () => {
          if (removedResource) {
            setRecentResources((current) => [removedResource!, ...current]);
            toast('문서를 복원했습니다.');
          }
        },
      },
    });
  }, []);

  const handleRemoveFavorite = useCallback((resourceId: string) => {
    let removedResource: WorkspaceResource | undefined;
    setFavoriteResources((current) => {
      removedResource = current.find((item) => item.id === resourceId);
      return current.filter((item) => item.id !== resourceId);
    });
    toast('즐겨찾기에서 제거했습니다.', {
      action: {
        label: '되돌리기',
        onClick: () => {
          if (removedResource) {
            setFavoriteResources((current) => [removedResource!, ...current]);
            toast('즐겨찾기를 복원했습니다.');
          }
        },
      },
    });
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
