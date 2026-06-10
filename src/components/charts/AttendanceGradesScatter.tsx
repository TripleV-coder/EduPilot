"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { fetcher } from "@/lib/fetcher";

interface ScatterDataPoint {
  studentId: string;
  studentName: string;
  attendance: number;  // 0-100 %
  averageGrade: number; // 0-20
  risk: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  fill: string;
}

const riskColors = {
  NONE: "#64748b",
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#7c2d12",
};

const riskLabels: Record<keyof typeof riskColors, string> = {
  NONE: "Aucun",
  LOW: "Faible",
  MEDIUM: "Moyen",
  HIGH: "Élevé",
  CRITICAL: "Critique",
};

export function AttendanceGradesScatter() {
  const router = useRouter();
  const { data: analyticsData = [], isLoading } = useSWR(
    "/api/analytics/students?limit=100",
    fetcher,
    { revalidateOnFocus: false }
  );

  const chartData = useMemo<ScatterDataPoint[]>(() => {
    if (!Array.isArray(analyticsData)) return [];

    return analyticsData
      .filter(item => item.averageGrade !== null && typeof item.attendanceRate === "number")
      .map((item) => {
        const risk = (item.riskLevel || "LOW") as keyof typeof riskColors;
        return {
          studentId: item.studentId,
          studentName: item.studentName || "Inconnu",
          attendance: item.attendanceRate,
          averageGrade: Number(item.averageGrade || 0),
          risk,
          fill: riskColors[risk] ?? riskColors.LOW,
        };
      });
  }, [analyticsData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Corrélation Assiduité & Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-80">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Corrélation Assiduité vs Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-80 text-muted-foreground">
            Pas de données disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corrélation Assiduité vs Notes</CardTitle>
        <CardDescription>Cliquez sur un élève pour ouvrir sa fiche détaillée</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }} data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="attendance" type="number" name="Assiduité (%)" />
            <YAxis dataKey="averageGrade" type="number" name="Moyenne (sur 20)" />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={(props: any) => {
              if (props.active && props.payload?.[0]) {
                const data = props.payload[0].payload as ScatterDataPoint;
                return (
                  <div className="bg-background border border-border rounded p-2 text-sm shadow-lg">
                    <p className="font-semibold">{data.studentName}</p>
                    <p className="text-muted-foreground">Assiduité : {data.attendance}%</p>
                    <p className="text-muted-foreground">Moyenne : {data.averageGrade}/20</p>
                    <p className="text-muted-foreground">Risque : {riskLabels[data.risk] ?? data.risk}</p>
                    <p className="text-xs text-primary mt-1">Cliquer pour voir la fiche élève</p>
                  </div>
                );
              }
              return null;
            }} />
            <Scatter
              dataKey="averageGrade"
              cursor="pointer"
              onClick={(point: any) => {
                const studentId = point?.payload?.studentId ?? point?.studentId;
                if (studentId) {
                  router.push(`/dashboard/students/${studentId}`);
                }
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="mt-4 flex gap-4 flex-wrap justify-center text-sm">
          {(Object.keys(riskColors) as Array<keyof typeof riskColors>).map((risk) => (
            <div key={risk} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: riskColors[risk] }} />
              <span>{riskLabels[risk]}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
