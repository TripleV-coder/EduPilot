import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface RiskData {
  name: string;
  value: number;
  color: string;
}

interface InteractiveRiskPieChartProps {
  data: RiskData[];
  title?: string;
  description?: string;
  onRiskClick?: (riskLevel: string) => void;
  filterRiskLevel?: string;
}

const RISK_COLORS = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#7f1d1d",
};

export function InteractiveRiskPieChart({
  data,
  title = "Distribution du risque",
  description,
  onRiskClick,
  filterRiskLevel,
}: InteractiveRiskPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!data || !Array.isArray(data)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
          Aucune donnée disponible
        </CardContent>
      </Card>
    );
  }

  const handlePieClick = (entry: any, index: number) => {
    setActiveIndex(index);
    if (onRiskClick) {
      onRiskClick(entry.name);
    }
  };

  const chartData = data.map((item) => ({
    ...item,
    fill: filterRiskLevel === item.name ? "#8b5cf6" : (RISK_COLORS[item.name as keyof typeof RISK_COLORS] || item.color),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              onClick={(entry, index) => handlePieClick(entry, index)}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.fill}
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                  cursor="pointer"
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>

        {filterRiskLevel && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveIndex(null);
              onRiskClick?.("");
            }}
          >
            Réinitialiser le filtre
          </Button>
        )}

        {/* Risk Level Legend */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: item.fill }}
              />
              <span>{item.name}: {item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
