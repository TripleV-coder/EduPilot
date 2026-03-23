"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, FR_TOOLTIP_STYLE } from "./chart-theme";

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
  if (!data) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
        Aucune donnée disponible
      </div>
    );
  }

  const chartData = SEGMENTS.map(({ key, label, color }) => ({
    name: label,
    value: data[key],
    color,
  }));

  const isEmpty = chartData.every((d) => d.value === 0);

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
        Aucune donnée
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={3}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip {...FR_TOOLTIP_STYLE} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
