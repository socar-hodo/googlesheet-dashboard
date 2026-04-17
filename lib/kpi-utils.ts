/**
 * KPI 계산/포맷팅 유틸리티
 *
 * 달성률 계산, 기간 비교 델타 계산, 색상 클래스 결정, 표시 문자열 포맷팅 함수 모음.
 * Phase 02-02의 KPI 카드 컴포넌트에서 import하여 사용한다.
 */

/**
 * 달성률(%) 계산. target이 0이면 0 반환.
 * Weekly 탭 전용 — DailyRecord에는 목표값이 없음.
 */
export function calcAchievementRate(actual: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(Math.round((actual / target) * 100), 999); // 999% 상한
}

/**
 * 현재값과 직전값의 델타를 계산한다.
 * previous가 0이면 percent=0으로 반환.
 */
export function calcDelta(
  current: number,
  previous: number
): { percent: number; absolute: number } {
  if (previous === 0) return { percent: 0, absolute: current };
  const absolute = current - previous;
  const percent = Math.round((absolute / Math.abs(previous)) * 100);
  return { percent, absolute };
}

/**
 * 달성률에 따른 텍스트 색상 Tailwind 클래스 반환.
 * KPI-05 기준: 80%+ 녹색, 60~80% 주황, 60% 미만 빨간.
 */
export function getAchievementColorClass(rate: number): string {
  if (rate >= 80) return 'text-green-600 dark:text-green-400';
  if (rate >= 60) return 'text-orange-500 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * 달성률에 따른 Progress 바 색상 Tailwind 클래스 반환.
 * KPI-05 기준: 80%+ 녹색, 60~80% 주황, 60% 미만 빨간.
 */
export function getProgressColorClass(rate: number): string {
  if (rate >= 80) return '[&>div]:bg-green-500';
  if (rate >= 60) return '[&>div]:bg-orange-400';
  return '[&>div]:bg-red-500';
}

/**
 * 델타 방향에 따른 텍스트 색상 Tailwind 클래스 반환.
 * 오르면 녹색, 내리면 빨간 (CONTEXT.md 결정).
 */
export function getDeltaColorClass(percent: number): string {
  return percent >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
}

/**
 * 델타를 "▲ +12% / ₩120만" 형식으로 포맷팅한다.
 * 금액이 아닌 KPI(이용건수, 가동률, 이용시간)는 unit 파라미터로 구분.
 * CONTEXT.md 결정에 따라 ▲/▼ 화살표 사용.
 */
export type KpiUnit = '원' | '건' | '%' | '시간' | '원/대' | '건/대' | '시간/대';

export function formatDelta(
  percent: number,
  absolute: number,
  unit: KpiUnit
): string {
  const arrow = percent >= 0 ? '▲' : '▼';
  const sign = percent >= 0 ? '+' : '';
  if (unit === '원') {
    const absWon = Math.abs(absolute);
    return `${arrow} ${sign}${percent}% / ₩${Math.round(absWon / 10000).toLocaleString()}만`;
  }
  if (unit === '원/대') {
    return `${arrow} ${sign}${percent}% / ₩${Math.round(Math.abs(absolute)).toLocaleString()}원`;
  }
  if (unit === '%') {
    return `${arrow} ${sign}${percent}% / ${Math.abs(absolute).toFixed(1)}%p`;
  }
  if (unit === '시간') {
    return `${arrow} ${sign}${percent}% / ${Math.abs(absolute).toLocaleString()}시간`;
  }
  if (unit === '시간/대') {
    return `${arrow} ${sign}${percent}% / ${Math.abs(absolute).toFixed(1)}시간`;
  }
  if (unit === '건/대') {
    return `${arrow} ${sign}${percent}% / ${Math.abs(absolute).toFixed(1)}건`;
  }
  // 건수
  return `${arrow} ${sign}${percent}% / ${Math.abs(absolute).toLocaleString()}건`;
}

/**
 * KPI 종류에 따라 표시 문자열 반환.
 * - 원:        ₩N만 (만원 단위)
 * - 원/대:     ₩N,NNN원 (대당 매출은 금액이 작아 원 단위)
 * - %:         N.N%
 * - 시간:      N시간 (정수)
 * - 시간/대:   N.N시간 (소수 1자리)
 * - 건:        N건 (정수)
 * - 건/대:     N.N건 (소수 1자리)
 */
export function formatKpiValue(
  value: number,
  unit: KpiUnit
): string {
  if (unit === '원') return `₩${Math.round(value / 10000).toLocaleString()}만`;
  if (unit === '원/대') return `₩${Math.round(value).toLocaleString()}원`;
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === '시간') return `${Math.round(value).toLocaleString()}시간`;
  if (unit === '시간/대') return `${value.toFixed(1)}시간`;
  if (unit === '건/대') return `${value.toFixed(1)}건`;
  return `${value.toLocaleString()}건`;
}
