"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, FR_TOOLTIP_STYLE } from "./chart-theme";

interface TrendLineChartProps {
  data: Array<{ name: string; value: number }>;
  label?: string;
  color?: string;
  domain?: [number, number];
}

export function TrendLineChart({
  data,
  label = "Moyenne",
  color = CHART_COLORS.primary,
  domain = [0, 20],
}: TrendLineChartProps) {
  if (!data || data.length === 0) {
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
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis domain={domain} tick={{ fontSize: 12 }} />
          <Tooltip {...FR_TOOLTIP_STYLE} />
          <Line
            name={label}
            type="monotone"
            dataKey="value"
            stroke={color}
            dot
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
