'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { MemoItem } from '@/types/workspace-state';
import { sortMemos, parseMemoTags } from '../utils/workspace-todo-utils';

export function useWorkspaceMemos(initialMemos: MemoItem[], workspaceOwnerKey: string) {
  const [memos, setMemos] = useState<MemoItem[]>(initialMemos);
  const [memoTitle, setMemoTitle] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [memoTags, setMemoTags] = useState('');
  const [memoQuery, setMemoQuery] = useState('');

  const handleAddMemo = useCallback(() => {
    const title = memoTitle.trim();
    const content = memoContent.trim();
    if (!title || !content) return;
    setMemos((current) => {
      const now = new Date().toISOString();
      return sortMemos([
        {
          id: `memo-${workspaceOwnerKey}-${crypto.randomUUID()}`,
          title,
          content,
          tags: parseMemoTags(memoTags),
          pinned: false,
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ]);
    });
    setMemoTitle('');
    setMemoContent('');
    setMemoTags('');
    toast('메모를 저장했습니다.');
  }, [memoTitle, memoContent, memoTags, workspaceOwnerKey]);

  const handleToggleMemoPinned = useCallback((memoId: string) => {
    setMemos((current) =>
      sortMemos(
        current.map((memo) =>
          memo.id === memoId
            ? { ...memo, pinned: !memo.pinned, updatedAt: new Date().toISOString() }
            : memo,
        ),
      ),
    );
  }, []);

  const handleRemoveMemo = useCallback((memoId: string) => {
    setMemos((current) => current.filter((memo) => memo.id !== memoId));
    toast('메모를 삭제했습니다.');
  }, []);

  const getVisibleMemos = useCallback(
    (deferredQuery: string) => {
      const normalized = (memoQuery.trim() || deferredQuery.trim()).toLowerCase();
      return sortMemos(
        memos.filter((memo) => {
          const haystack = [memo.title, memo.content, ...memo.tags].join(' ').toLowerCase();
          return normalized.length === 0 || haystack.includes(normalized);
        }),
      );
    },
    [memos, memoQuery],
  );

  return {
    memos,
    setMemos,
    memoTitle,
    setMemoTitle,
    memoContent,
    setMemoContent,
    memoTags,
    setMemoTags,
    memoQuery,
    setMemoQuery,
    handleAddMemo,
    handleToggleMemoPinned,
    handleRemoveMemo,
    getVisibleMemos,
  };
}
