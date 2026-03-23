"use client";

import { useSyncExternalStore } from "react";

interface UpdateTimestampProps {
  fetchedAt: string;
}

const subscribe = () => () => {};

function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();

  if (diffMs < 60000) {
    return "방금 전";
  }
  if (diffMs < 3600000) {
    return `${Math.floor(diffMs / 60000)}분 전`;
  }
  if (diffMs < 86400000) {
    return `${Math.floor(diffMs / 3600000)}시간 전`;
  }
  return `${Math.floor(diffMs / 86400000)}일 전`;
}

function getAbsoluteTime(isoString: string): string {
  const date = new Date(isoString);
  const datePart = date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timePart = date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
}

export function UpdateTimestamp({ fetchedAt }: UpdateTimestampProps) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!mounted) {
    return null;
  }

  return (
    <p className="text-sm text-muted-foreground">
      마지막 업데이트: {getRelativeTime(fetchedAt)} ({getAbsoluteTime(fetchedAt)})
    </p>
  );
}
