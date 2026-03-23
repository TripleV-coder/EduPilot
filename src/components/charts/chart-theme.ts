export const CHART_COLORS = {
  primary: "#F97316", // Amber Gold
  secondary: "#2DD4BF", // Teal
  accent: "#FB375C", // Warm Rose
  destructive: "#EF4444", // Red
  muted: "#64748B", // Slate Gray
  excellent: "#22c55e",
  veryGood: "#3b82f6",
  good: "#06b6d4",
  average: "#f59e0b",
  insufficient: "#f97316",
  weak: "#ef4444",
  riskLow: "#22c55e",
  riskMedium: "#f59e0b",
  riskHigh: "#f97316",
  riskCritical: "#ef4444",
  present: "#22c55e",
  absent: "#ef4444",
  late: "#f59e0b",
  excused: "#3b82f6",
};

export const FR_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "13px",
    color: "hsl(var(--foreground))",
  },
};

export function formatNote(value: number): string {
  return `${value.toFixed(1)}/20`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
