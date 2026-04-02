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

  // Inline editing state (Item #10)
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editingMemoTitle, setEditingMemoTitle] = useState('');
  const [editingMemoContent, setEditingMemoContent] = useState('');
  const [editingMemoTags, setEditingMemoTags] = useState('');

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
    let removedMemo: MemoItem | undefined;
    setMemos((current) => {
      removedMemo = current.find((memo) => memo.id === memoId);
      return current.filter((memo) => memo.id !== memoId);
    });
    // Undo toast (Item #4)
    toast('메모를 삭제했습니다.', {
      action: {
        label: '되돌리기',
        onClick: () => {
          if (removedMemo) {
            setMemos((current) => sortMemos([removedMemo!, ...current]));
            toast('메모를 복원했습니다.');
          }
        },
      },
    });
  }, []);

  // Item #10: Inline editing handlers
  const handleStartEditingMemo = useCallback((memo: MemoItem) => {
    setEditingMemoId(memo.id);
    setEditingMemoTitle(memo.title);
    setEditingMemoContent(memo.content);
    setEditingMemoTags(memo.tags.join(', '));
  }, []);

  const handleCancelEditingMemo = useCallback(() => {
    setEditingMemoId(null);
    setEditingMemoTitle('');
    setEditingMemoContent('');
    setEditingMemoTags('');
  }, []);

  const handleSaveEditedMemo = useCallback(() => {
    const title = editingMemoTitle.trim();
    const content = editingMemoContent.trim();
    if (!editingMemoId || !title || !content) return;
    setMemos((current) =>
      sortMemos(
        current.map((memo) =>
          memo.id === editingMemoId
            ? {
                ...memo,
                title,
                content,
                tags: parseMemoTags(editingMemoTags),
                updatedAt: new Date().toISOString(),
              }
            : memo,
        ),
      ),
    );
    handleCancelEditingMemo();
    toast('메모를 수정했습니다.');
  }, [editingMemoId, editingMemoTitle, editingMemoContent, editingMemoTags, handleCancelEditingMemo]);

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
    // Inline editing (Item #10)
    editingMemoId,
    editingMemoTitle,
    setEditingMemoTitle,
    editingMemoContent,
    setEditingMemoContent,
    editingMemoTags,
    setEditingMemoTags,
    handleStartEditingMemo,
    handleCancelEditingMemo,
    handleSaveEditedMemo,
  };
}
