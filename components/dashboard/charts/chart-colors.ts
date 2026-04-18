export interface ChartColorMode {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  chart7: string;
  chart8: string;
  chart9: string;
  chart10: string;
  chart11: string;
  chart12: string;
  chart13: string;
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
    // 쏘카 블루 계열 (chart1-6)
    chart1: "#0078ff",
    chart2: "#005aff",
    chart3: "#0a1491",
    chart4: "#3d94ff",
    chart5: "#7ebfff",
    chart6: "#002a66",
    // 13 카테고리 확장용 보조 팔레트 (chart7-13) — 블루 계열과 시각적 구분
    chart7: "#14b8a6",   // teal
    chart8: "#f59e0b",   // amber
    chart9: "#a855f7",   // purple
    chart10: "#ef4444",  // red
    chart11: "#64748b",  // slate
    chart12: "#22c55e",  // green
    chart13: "#ec4899",  // pink
    profitPositive: "#0078ff",
    profitNegative: "#ef4444",
    utilizationLine: "#005aff",
    referenceOrange: "#4a5667",
    axis: "#354153",
    grid: "#c2ccda",
    tooltip: { bg: "#ffffff", border: "#c2ccda" },
  } satisfies ChartColorMode,
  dark: {
    chart1: "#66b0ff",
    chart2: "#3393ff",
    chart3: "#d6ebff",
    chart4: "#0078ff",
    chart5: "#a3d1ff",
    chart6: "#ebf5ff",
    chart7: "#2dd4bf",
    chart8: "#fbbf24",
    chart9: "#c084fc",
    chart10: "#fb7185",
    chart11: "#94a3b8",
    chart12: "#4ade80",
    chart13: "#f472b6",
    profitPositive: "#66b0ff",
    profitNegative: "#fb7185",
    utilizationLine: "#3393ff",
    referenceOrange: "#697387",
    axis: "#99a1b1",
    grid: "#354153",
    tooltip: { bg: "#1c2431", border: "#354153" },
  } satisfies ChartColorMode,
} as const;

export function getChartColors(isDark: boolean): ChartColorMode {
  return isDark ? CHART_COLORS.dark : CHART_COLORS.light;
}
