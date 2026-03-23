"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen } from "lucide-react";

type Grade = {
  id: string;
  value: number;
  maxValue: number;
  date?: string;
  subject?: { name: string };
  evaluationType?: { name: string };
  period?: { name: string };
};

type GradesResponse = {
  data?: Grade[];
  grades?: Grade[];
};

export function StudentGradesTab({ studentId }: { studentId: string }) {
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
        Impossible de charger les notes : {error.message}
      </div>
    );
  }

  const grades: Grade[] = data?.data ?? data?.grades ?? [];

  if (grades.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Aucune note enregistrée pour cet élève.</p>
        </CardContent>
      </Card>
    );
  }

  // Compute averages per subject
  const subjectMap = new Map<string, { total: number; maxTotal: number; count: number }>();
  for (const g of grades) {
    const subjectName = g.subject?.name ?? "Sans matière";
    const entry = subjectMap.get(subjectName) ?? { total: 0, maxTotal: 0, count: 0 };
    entry.total += g.value;
    entry.maxTotal += g.maxValue;
    entry.count += 1;
    subjectMap.set(subjectName, entry);
  }

  return (
    <div className="space-y-6">
      {/* Averages per subject */}
      {subjectMap.size > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Moyennes par matière</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Array.from(subjectMap.entries()).map(([subject, stats]) => {
                const avg = stats.count > 0 ? (stats.total / stats.count).toFixed(1) : "—";
                return (
                  <Badge key={subject} variant="secondary" className="text-sm px-3 py-1.5">
                    {subject} : {avg}/{stats.maxTotal > 0 ? (stats.maxTotal / stats.count).toFixed(0) : 20}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grades table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Détail des notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Matière</th>
                  <th className="pb-2 pr-4 font-medium">Note</th>
                  <th className="pb-2 pr-4 font-medium">Max</th>
                  <th className="pb-2 pr-4 font-medium">Évaluation</th>
                  <th className="pb-2 pr-4 font-medium">Période</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g) => (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{g.subject?.name ?? "—"}</td>
                    <td className="py-2 pr-4">{g.value}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{g.maxValue}</td>
                    <td className="py-2 pr-4">{g.evaluationType?.name ?? "—"}</td>
                    <td className="py-2 pr-4">{g.period?.name ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">
                      {g.date ? new Date(g.date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
