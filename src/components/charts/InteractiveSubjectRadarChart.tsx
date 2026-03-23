import React, { useState } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SubjectRadarData {
  subject: string;
  subjectId: string;
  grade: number;
  passRate: number;
}

interface InteractiveSubjectRadarChartProps {
  data: SubjectRadarData[];
  title?: string;
  description?: string;
  onSubjectClick?: (subjectId: string, subjectName: string) => void;
  filterSubjectId?: string;
}

export function InteractiveSubjectRadarChart({
  data,
  title = "Performance par matière (Radar)",
  description,
  onSubjectClick,
  filterSubjectId,
}: InteractiveSubjectRadarChartProps) {
  // Normalize data to handle both formats (API vs expected)
  const normalizedData = data.map((item, index) => ({
    subject: item.subject || (item as any).name || "N/A",
    subjectId: item.subjectId || (item as any).id || `subject-${index}`,
    grade: item.grade !== undefined ? item.grade : (item as any).average || 0,
    passRate: item.passRate !== undefined ? item.passRate : 0,
  }));

  const handleRadarClick = (entry: any, index: number) => {
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
          <RadarChart data={normalizedData}>
            <PolarGrid />
            <PolarAngleAxis
              dataKey="subject"
              onClick={(entry, index) => handleRadarClick(entry, index)}
              style={{ cursor: "pointer" }}
            />
            <PolarRadiusAxis angle={90} domain={[0, 20]} />
            <Radar
              name="Moyenne"
              dataKey="grade"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={filterSubjectId ? 0.25 : 0.6}
            />
            <Tooltip />
            <Legend />
          </RadarChart>
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

        {/* Subject List with Click Handler */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground">Cliquez sur une matière</p>
          <div className="grid grid-cols-2 gap-2">
            {normalizedData.map((item, index) => (
              <div
                key={`${item.subjectId}-${index}`}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  filterSubjectId === item.subjectId
                    ? "bg-purple-100 dark:bg-purple-950"
                    : "bg-muted hover:bg-muted/80"
                }`}
                onClick={() => handleRadarClick(item, index)}
              >
                <p className="text-xs font-medium">{item.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {item.grade}/20 • {item.passRate}%
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
