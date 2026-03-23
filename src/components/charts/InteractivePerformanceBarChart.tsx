import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PerformanceData {
  subject?: string;
  subjectId?: string;
  grade: number;
  passRate: number;
  studentCount?: number;
}

interface InteractivePerformanceBarChartProps {
  data: PerformanceData[];
  title?: string;
  description?: string;
  onSubjectClick?: (subjectId: string, subjectName: string) => void;
  filterSubjectId?: string;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

export function InteractivePerformanceBarChart({
  data,
  title = "Performance par matière",
  description,
  onSubjectClick,
  filterSubjectId,
}: InteractivePerformanceBarChartProps) {
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

  const chartData = data.map((item, index) => ({
    ...item,
    fill: filterSubjectId === item.subjectId ? "#8b5cf6" : COLORS[index % COLORS.length],
  }));

  const handleBarClick = (entry: any) => {
    if (onSubjectClick && entry.subjectId) {
      onSubjectClick(entry.subjectId, entry.subject);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="subject" />
            <YAxis label={{ value: "Moyenne / Taux (%)", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="grade" name="Moyenne" radius={[8, 8, 0, 0]} onClick={(entry) => handleBarClick(entry)}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} cursor="pointer" />
              ))}
            </Bar>
            <Bar dataKey="passRate" name="Taux réussite" fill="#10b981" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {filterSubjectId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSubjectClick?.("", "")}
          >
            Réinitialiser le filtre
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
