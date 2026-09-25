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
  data: Array<{ month: string; received: number; pending?: number }>;
  /** Hauteur du graphique (px). */
  height?: number;
}

export function PaymentBarChart({ data, height = 300 }: PaymentBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucun encaissement validé sur cette période.
      </p>
    );
  }

  // La série « en attente » n'est tracée que si elle porte des montants réels.
  const hasPending = data.some((d) => (d.pending ?? 0) > 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip {...FR_TOOLTIP_STYLE} />
          {hasPending ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          <Bar
            name="Reçu"
            dataKey="received"
            stackId="a"
            fill={CHART_COLORS.excellent}
            radius={hasPending ? [0, 0, 0, 0] : [4, 4, 0, 0]}
          />
          {hasPending ? (
            <Bar
              name="En attente"
              dataKey="pending"
              stackId="a"
              fill={CHART_COLORS.average}
              radius={[4, 4, 0, 0]}
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
