"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, FR_TOOLTIP_STYLE } from "./chart-theme";

const LINE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.excellent,
  CHART_COLORS.veryGood,
  CHART_COLORS.average,
  CHART_COLORS.accent,
  CHART_COLORS.destructive,
  CHART_COLORS.good,
  CHART_COLORS.insufficient,
  CHART_COLORS.secondary,
  CHART_COLORS.muted,
];

interface StudentGradesLineChartProps {
  data: Array<{ period: string; [subjectName: string]: string | number }>;
  subjects: string[];
}

export function StudentGradesLineChart({ data, subjects }: StudentGradesLineChartProps) {
  if (!data || data.length === 0 || !subjects || subjects.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        Aucune donnée
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} />
          <Tooltip {...FR_TOOLTIP_STYLE} />
          <Legend />
          {subjects.map((subject, index) => (
            <Line
              key={subject}
              name={subject}
              type="monotone"
              dataKey={subject}
              stroke={LINE_COLORS[index % LINE_COLORS.length]}
              dot
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
