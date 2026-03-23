"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, FR_TOOLTIP_STYLE } from "./chart-theme";

interface PaymentBarChartProps {
  data: Array<{ month: string; received: number; pending: number }>;
}

export function PaymentBarChart({ data }: PaymentBarChartProps) {
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
        <BarChart data={data}>
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip {...FR_TOOLTIP_STYLE} />
          <Legend />
          <Bar
            name="Reçu"
            dataKey="received"
            stackId="a"
            fill={CHART_COLORS.excellent}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            name="En attente"
            dataKey="pending"
            stackId="a"
            fill={CHART_COLORS.average}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
