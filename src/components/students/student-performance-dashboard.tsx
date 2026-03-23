"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Grade = {
  id: string;
  value: number;
  maxValue: number;
  date?: string;
  subject?: { name: string };
  classAverage?: number;
};

type GradesResponse = {
  data?: Grade[];
  grades?: Grade[];
};

export function StudentPerformanceDashboard({ studentId }: { studentId: string }) {
  const { data, error, isLoading } = useSWR<GradesResponse>(
    `/api/grades?studentId=${studentId}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive">
        Impossible de charger les données de performance : {error.message}
      </div>
    );
  }

  const grades: Grade[] = data?.data ?? data?.grades ?? [];

  if (grades.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Aucune donnée de performance disponible.</p>
        </CardContent>
      </Card>
    );
  }

  // --- Bar chart data: average per subject ---
  const subjectMap = new Map<string, { total: number; count: number; classAvgTotal: number; classAvgCount: number }>();
  for (const g of grades) {
    const subjectName = g.subject?.name ?? "Sans matière";
    const entry = subjectMap.get(subjectName) ?? { total: 0, count: 0, classAvgTotal: 0, classAvgCount: 0 };
    // Normalize to /20 scale
    const normalized = g.maxValue > 0 ? (g.value / g.maxValue) * 20 : g.value;
    entry.total += normalized;
    entry.count += 1;
    if (g.classAverage != null) {
      entry.classAvgTotal += g.classAverage;
      entry.classAvgCount += 1;
    }
    subjectMap.set(subjectName, entry);
  }

  const barData = Array.from(subjectMap.entries()).map(([subject, stats]) => ({
    subject,
    "Moyenne élève": parseFloat((stats.total / stats.count).toFixed(1)),
    ...(stats.classAvgCount > 0
      ? { "Moyenne classe": parseFloat((stats.classAvgTotal / stats.classAvgCount).toFixed(1)) }
      : {}),
  }));

  // --- Line chart data: grades over time ---
  const sortedGrades = [...grades]
    .filter((g) => g.date)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

  const lineData = sortedGrades.map((g) => ({
    date: new Date(g.date!).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    note: g.maxValue > 0 ? parseFloat(((g.value / g.maxValue) * 20).toFixed(1)) : g.value,
  }));

  // --- Radar chart data: subject profile ---
  const radarData = Array.from(subjectMap.entries()).map(([subject, stats]) => ({
    subject,
    note: parseFloat((stats.total / stats.count).toFixed(1)),
    fullMark: 20,
  }));

  const hasClassAvg = barData.some((d) => "Moyenne classe" in d);

  return (
    <div className="space-y-6">
      {/* Bar chart: subject averages */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Moyenne par matière (/20)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="subject" className="text-xs" angle={-20} textAnchor="end" height={60} />
                <YAxis domain={[0, 20]} className="text-xs" />
                <Tooltip />
                <Bar dataKey="Moyenne élève" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                {hasClassAvg && (
                  <Bar dataKey="Moyenne classe" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Line chart: grades over time */}
        {lineData.length > 1 && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Évolution des notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, 20]} className="text-xs" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="note"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Note (/20)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Radar chart: competency profile */}
        {radarData.length >= 3 && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Profil de compétences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" className="text-xs" />
                    <PolarRadiusAxis domain={[0, 20]} tick={false} />
                    <Tooltip />
                    <Radar
                      name="Note moyenne"
                      dataKey="note"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
