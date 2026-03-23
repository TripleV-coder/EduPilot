import React, { useState, useMemo } from "react";
import useSWR from "swr";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ClassComparisonData {
  className: string;
  classId: string;
  studentCount: number;
  averageGrade: number;
  passRate: number;
  riskDistribution: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
}

interface MultiClassComparisonProps {
  classes: Array<{ id: string; name: string }>;
  academicYearId: string;
  initialSelectedClasses?: string[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function MultiClassComparison({
  classes,
  academicYearId,
  initialSelectedClasses = [],
}: MultiClassComparisonProps) {
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    initialSelectedClasses.length > 0 ? initialSelectedClasses : [classes[0]?.id || ""].filter(Boolean)
  );

  const queryParams = new URLSearchParams({ academicYearId });
  selectedClasses.forEach((id) => queryParams.append("classIds", id));

  const { data: comparisons = [], isLoading } = useSWR<ClassComparisonData[]>(
    selectedClasses.length > 0 ? `/api/analytics/class-comparison?${queryParams.toString()}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const chartData = useMemo(() => {
    if (!Array.isArray(comparisons)) return [];
    return comparisons.map((comp) => ({
      class: comp.className,
      "Moyenne": comp.averageGrade,
      "Taux réussite": comp.passRate,
      "Effectif": comp.studentCount,
    }));
  }, [comparisons]);

  const toggleClass = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId].slice(0, 4) // Max 4 classes
    );
  };

  const comparisonsArray = Array.isArray(comparisons) ? comparisons : [];

  const avgAcrossClasses =
    comparisonsArray.length > 0
      ? (
          comparisonsArray.reduce((sum, c) => sum + c.averageGrade, 0) /
          comparisonsArray.length
        ).toFixed(2)
      : "0";

  const overallPassRate =
    comparisonsArray.length > 0
      ? (
          comparisonsArray.reduce((sum, c) => sum + c.passRate, 0) /
          comparisonsArray.length
        ).toFixed(1)
      : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparaison inter-classes</CardTitle>
        <CardDescription>Analyse comparative des performances</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Class Selection */}
        <div className="flex flex-wrap gap-2">
          {classes.map((cls) => (
            <Button
              key={cls.id}
              variant={selectedClasses.includes(cls.id) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleClass(cls.id)}
            >
              {cls.name}
            </Button>
          ))}
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            Chargement...
          </div>
        ) : comparisonsArray.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            {Array.isArray(comparisons) ? "Sélectionnez au moins une classe" : "Erreur de chargement des données"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="class" />
              <YAxis label={{ value: "Moyennes / Taux (%)", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Moyenne" fill="#3b82f6" />
              <Bar dataKey="Taux réussite" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Overall Stats */}
        {comparisonsArray.length > 0 && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <p className="text-sm font-medium">Moyenne globale</p>
              <p className="text-2xl font-bold">{avgAcrossClasses}/20</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Taux réussite moyen</p>
              <p className="text-2xl font-bold">{overallPassRate}%</p>
            </div>
          </div>
        )}

        {/* Detailed Comparison Table */}
        {comparisonsArray.length > 0 && (
          <div className="pt-4 border-t">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-semibold">Classe</th>
                  <th className="text-center py-2 font-semibold">Effectif</th>
                  <th className="text-center py-2 font-semibold">Moyenne</th>
                  <th className="text-center py-2 font-semibold">Réussite</th>
                </tr>
              </thead>
              <tbody>
                {comparisonsArray.map((comp) => (
                  <tr key={comp.classId} className="border-b hover:bg-muted/50">
                    <td className="py-2">{comp.className}</td>
                    <td className="text-center">{comp.studentCount}</td>
                    <td className="text-center font-medium">{comp.averageGrade}/20</td>
                    <td className="text-center">{comp.passRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
