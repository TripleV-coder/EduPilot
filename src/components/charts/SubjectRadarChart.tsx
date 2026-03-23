"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, FR_TOOLTIP_STYLE } from "./chart-theme";

interface SubjectRadarChartProps {
  data: Array<{ name: string; average: number }>;
}

export function SubjectRadarChart({ data }: SubjectRadarChartProps) {
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
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 20]} tick={{ fontSize: 10 }} />
          <Radar
            name="Moyenne"
            dataKey="average"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.3}
          />
          <Tooltip {...FR_TOOLTIP_STYLE} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
