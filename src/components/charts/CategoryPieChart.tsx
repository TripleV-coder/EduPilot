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

interface CategoryPieChartProps {
    data: Array<{ name: string; value: number }>;
}

const COLORS = [
    CHART_COLORS.primary,
    CHART_COLORS.excellent,
    CHART_COLORS.average,
    CHART_COLORS.riskHigh,
    CHART_COLORS.riskMedium,
    CHART_COLORS.secondary,
];

export function CategoryPieChart({ data }: CategoryPieChartProps) {
    if (!data || data.length === 0) {
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
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={3}
                    >
                        {data.map((entry, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip {...FR_TOOLTIP_STYLE} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
