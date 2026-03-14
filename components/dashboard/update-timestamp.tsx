"use client";

// UpdateTimestamp — 마지막 데이터 업데이트 타임스탬프를 상대+절대 형식으로 표시하는 Client Component
// hydration 불일치 방지: 서버에서 null, 클라이언트 마운트 후 실제 시간 표시
import { useState, useEffect } from "react";

interface UpdateTimestampProps {
  fetchedAt: string; // ISO 8601 타임스탬프 문자열 (예: "2026-02-24T14:30:00.000Z")
}

/**
 * 상대 시간 계산 — ISO 문자열을 "방금 전", "N분 전", "N시간 전", "N일 전"으로 변환
 */
function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();

  if (diffMs < 60000) {
    // 1분 미만
    return "방금 전";
  }
  if (diffMs < 3600000) {
    // 1시간 미만
    return `${Math.floor(diffMs / 60000)}분 전`;
  }
  if (diffMs < 86400000) {
    // 24시간 미만
    return `${Math.floor(diffMs / 3600000)}시간 전`;
  }
  // 24시간 이상
  return `${Math.floor(diffMs / 86400000)}일 전`;
}

/**
 * 절대 시간 포맷 — ISO 문자열을 "YYYY. MM. DD. HH:mm" 형식으로 변환
 * 예시: "2026. 02. 24. 14:30"
 */
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
  // hydration 안전 패턴: 마운트 전에는 null 반환, 마운트 후 실제 시간 표시
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const relativeTime = getRelativeTime(fetchedAt);
  const absoluteTime = getAbsoluteTime(fetchedAt);

  return (
    <p className="text-sm text-muted-foreground">
      마지막 업데이트: {relativeTime} ({absoluteTime})
    </p>
  );
}
