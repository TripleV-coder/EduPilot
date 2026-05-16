"use client";

import { CHART_COLORS } from "./chart-theme";
import { BasePieChart } from "./BasePieChart";

interface RiskPieChartProps {
  data: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

const SEGMENTS: { key: keyof RiskPieChartProps["data"]; label: string; color: string }[] = [
  { key: "low", label: "Faible", color: CHART_COLORS.riskLow },
  { key: "medium", label: "Moyen", color: CHART_COLORS.riskMedium },
  { key: "high", label: "Élevé", color: CHART_COLORS.riskHigh },
  { key: "critical", label: "Critique", color: CHART_COLORS.riskCritical },
];

export function RiskPieChart({ data }: RiskPieChartProps) {
  const chartData = data
    ? SEGMENTS.map(({ key, label, color }) => ({ name: label, value: data[key], color }))
    : [];

  return <BasePieChart data={chartData} emptyMessage="Aucune donnée" />;
}
