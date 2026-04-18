'use client';

// components/dashboard/charts/usage-duration-section.tsx
// 이용시간 구간 분석 섹션 — 연령×이용시간 매트릭스 (전폭, 셀 내부 증감 표시)

import type { UsageMatrixRow } from '@/types/dashboard';
import { UsageMatrix } from './usage-matrix';

interface UsageDurationSectionProps {
  matrixCurrent: UsageMatrixRow[];
  matrixPrevious: UsageMatrixRow[];
}

export function UsageDurationSection({ matrixCurrent, matrixPrevious }: UsageDurationSectionProps) {
  return <UsageMatrix current={matrixCurrent} previous={matrixPrevious} />;
}
