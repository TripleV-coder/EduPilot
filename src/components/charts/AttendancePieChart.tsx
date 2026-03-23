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

interface AttendancePieChartProps {
  data: {
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
}

const SEGMENTS: { key: keyof AttendancePieChartProps["data"]; label: string; color: string }[] = [
  { key: "present", label: "Présent", color: CHART_COLORS.present },
  { key: "absent", label: "Absent", color: CHART_COLORS.absent },
  { key: "late", label: "En retard", color: CHART_COLORS.late },
  { key: "excused", label: "Excusé", color: CHART_COLORS.excused },
];

export function AttendancePieChart({ data }: AttendancePieChartProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
        Aucune donnée de présence
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
