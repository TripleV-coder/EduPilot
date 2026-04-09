"use client";

import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, 
    ResponsiveContainer, Cell 
} from "recharts";
import { CHART_COLORS, FR_TOOLTIP_STYLE } from "./chart-theme";

interface DebtAgingData {
    range: string; // "0-30j", "30-60j", etc.
    amount: number;
}

interface DebtAgingChartProps {
    data: DebtAgingData[];
}

export function DebtAgingChart({ data }: DebtAgingChartProps) {
    const COLORS = [
        "hsl(var(--warning))",
        "hsl(37 87% 40%)",
        "hsl(var(--destructive) / 0.7)",
        "hsl(var(--destructive))"
    ];

    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-[300px] text-muted-foreground text-xs uppercase font-bold italic">Aucune donnée disponible</div>;
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="range" type="category" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip {...FR_TOOLTIP_STYLE} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={32}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
