// components/dashboard/charts/chart-colors.ts
// Recharts SVG 속성(fill/stroke)에는 CSS 변수가 직접 불가 — 테마별 색상 상수로 관리

/** 차트 테마 색상 모드 타입 */
export interface ChartColorMode {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  profitPositive: string;
  profitNegative: string;
  utilizationLine: string;
  referenceOrange: string;
  axis: string;
  grid: string;
  tooltip: { bg: string; border: string };
}

export const CHART_COLORS = {
  light: {
    chart1: 'oklch(0.646 0.222 41.116)',   // --chart-1 라이트 (globals.css)
    chart2: 'oklch(0.6 0.118 184.704)',    // --chart-2 라이트
    chart3: 'oklch(0.398 0.07 227.392)',   // --chart-3 라이트
    chart4: 'oklch(0.828 0.189 84.429)',   // --chart-4 라이트
    chart5: 'oklch(0.769 0.188 70.08)',    // --chart-5 라이트
    profitPositive: '#16a34a',             // green-600 (KPI 카드 델타와 동일)
    profitNegative: '#dc2626',             // red-600
    utilizationLine: 'oklch(0.6 0.118 184.704)', // --chart-2
    referenceOrange: '#f97316',            // orange-500 임계선
    axis: '#71717a',                       // zinc-500
    grid: '#e4e4e7',                       // zinc-200
    tooltip: { bg: '#ffffff', border: '#e4e4e7' },
  } satisfies ChartColorMode,
  dark: {
    chart1: 'oklch(0.488 0.243 264.376)', // --chart-1 다크 (globals.css)
    chart2: 'oklch(0.696 0.17 162.48)',   // --chart-2 다크
    chart3: 'oklch(0.769 0.188 70.08)',   // --chart-3 다크
    chart4: 'oklch(0.627 0.265 303.9)',   // --chart-4 다크
    chart5: 'oklch(0.645 0.246 16.439)',  // --chart-5 다크
    profitPositive: '#4ade80',             // green-400
    profitNegative: '#f87171',             // red-400
    utilizationLine: 'oklch(0.696 0.17 162.48)',
    referenceOrange: '#fb923c',            // orange-400
    axis: '#a1a1aa',                       // zinc-400
    grid: '#3f3f46',                       // zinc-700
    tooltip: { bg: '#1c1c1e', border: '#3f3f46' },
  } satisfies ChartColorMode,
} as const;

export function getChartColors(isDark: boolean): ChartColorMode {
  return isDark ? CHART_COLORS.dark : CHART_COLORS.light;
}
