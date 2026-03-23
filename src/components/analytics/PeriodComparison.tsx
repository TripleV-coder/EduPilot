import React, { useState, useMemo } from "react";
import useSWR from "swr";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PeriodComparison {
  periodId: string;
  periodName: string;
  studentCount: number;
  averageGrade: number;
  passRate: number;
  performanceDistribution: {
    excellent: number;
    veryGood: number;
    good: number;
    average: number;
    insufficient: number;
    weak: number;
  };
}

interface PeriodComparisonProps {
  academicYearId: string;
  classId: string;
  periods: Array<{ id: string; name: string }>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function PeriodComparison({
  academicYearId,
  classId,
  periods,
}: PeriodComparisonProps) {
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(
    periods.slice(0, 3).map((p) => p.id)
  );

  const queryParams = new URLSearchParams({
    academicYearId,
    classId,
  });

  selectedPeriods.forEach((id) => queryParams.append("periodIds", id));

  const { data: comparisons = [], isLoading } = useSWR<PeriodComparison[]>(
    `/api/analytics/period-comparison?${queryParams.toString()}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const chartData = useMemo(() => {
    return comparisons.map((comp) => ({
      period: comp.periodName,
      "Moyenne": comp.averageGrade,
      "Taux réussite": comp.passRate,
      "Effectif": comp.studentCount,
    }));
  }, [comparisons]);

  const togglePeriod = (periodId: string) => {
    setSelectedPeriods((prev) =>
      prev.includes(periodId)
        ? prev.filter((id) => id !== periodId)
        : [...prev, periodId]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparaison inter-périodes</CardTitle>
        <CardDescription>Evolution des performances sur plusieurs périodes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Selection */}
        <div className="flex flex-wrap gap-2">
          {periods.map((period) => (
            <Badge
              key={period.id}
              variant={selectedPeriods.includes(period.id) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => togglePeriod(period.id)}
            >
              {period.name}
            </Badge>
          ))}
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            Chargement...
          </div>
        ) : comparisons.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            Sélectionnez au moins une période
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis yAxisId="left" label={{ value: "Moyenne / Taux (%)", angle: -90, position: "insideLeft" }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: "Effectif", angle: 90, position: "insideRight" }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="Moyenne" fill="#3b82f6" />
              <Bar yAxisId="left" dataKey="Taux réussite" fill="#10b981" />
              <Line yAxisId="right" type="monotone" dataKey="Effectif" stroke="#f59e0b" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {/* Summary Stats */}
        {comparisons.length > 0 && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            {comparisons.map((comp) => (
              <div key={comp.periodId} className="space-y-1">
                <p className="text-sm font-medium">{comp.periodName}</p>
                <p className="text-xs text-muted-foreground">
                  Moy: {comp.averageGrade}/20 | Réussite: {comp.passRate}%
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
