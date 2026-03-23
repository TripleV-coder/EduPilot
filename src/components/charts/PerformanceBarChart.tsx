"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CHART_COLORS, FR_TOOLTIP_STYLE } from "./chart-theme";

interface PerformanceBarChartProps {
  data: {
    excellent: number;
    veryGood: number;
    good: number;
    average: number;
    insufficient: number;
    weak: number;
  };
}

const LABELS: { key: keyof PerformanceBarChartProps["data"]; label: string; color: string }[] = [
  { key: "excellent", label: "Excellent", color: CHART_COLORS.excellent },
  { key: "veryGood", label: "Très bien", color: CHART_COLORS.veryGood },
  { key: "good", label: "Bien", color: CHART_COLORS.good },
  { key: "average", label: "Moyen", color: CHART_COLORS.average },
  { key: "insufficient", label: "Insuffisant", color: CHART_COLORS.insufficient },
  { key: "weak", label: "Faible", color: CHART_COLORS.weak },
];

export function PerformanceBarChart({ data }: PerformanceBarChartProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        Aucune donnée disponible
      </div>
    );
  }

  const chartData = LABELS.map(({ key, label, color }) => ({
    name: label,
    value: data[key],
    fill: color,
  }));

  const isEmpty = chartData.every((d) => d.value === 0);

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        Aucune donnée
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} />
          <Tooltip {...FR_TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
