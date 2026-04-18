export interface ChartColorMode {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
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
    chart1: "#0078ff",
    chart2: "#005aff",
    chart3: "#0a1491",
    chart4: "#3d94ff",
    chart5: "#7ebfff",
    chart6: "#002a66",
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
