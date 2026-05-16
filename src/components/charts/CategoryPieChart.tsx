"use client";

import { CHART_COLORS } from "./chart-theme";
import { BasePieChart } from "./BasePieChart";

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
    return (
        <div>
            <BasePieChart data={data} colors={COLORS} emptyMessage="Aucune donnée" />
        </div>
    );
}
