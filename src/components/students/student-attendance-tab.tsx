"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CalendarCheck } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type AttendanceRecord = {
  id: string;
  status: string; // PRESENT, ABSENT, LATE, EXCUSED...
  date?: string;
};

type AttendanceResponse = {
  data?: AttendanceRecord[];
  records?: AttendanceRecord[];
};

const MONTH_NAMES = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

export function StudentAttendanceTab({ studentId }: { studentId: string }) {
  const { data, error, isLoading } = useSWR<AttendanceResponse>(
    `/api/attendance?studentId=${studentId}`,
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
        Impossible de charger l&apos;assiduité : {error.message}
      </div>
    );
  }

  const records: AttendanceRecord[] = data?.data ?? data?.records ?? [];

  if (records.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CalendarCheck className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Aucune donnée d&apos;assiduité disponible.</p>
        </CardContent>
      </Card>
    );
  }

  // Compute summary
  const total = records.length;
  const present = records.filter((r) => r.status === "PRESENT").length;
  const absent = records.filter((r) => r.status === "ABSENT" || r.status === "EXCUSED").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const presenceRate = total > 0 ? ((present / total) * 100).toFixed(1) : "—";

  // Compute monthly data for chart
  const monthlyMap = new Map<string, { present: number; absent: number; late: number }>();
  for (const r of records) {
    if (!r.date) continue;
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const entry = monthlyMap.get(key) ?? { present: 0, absent: 0, late: 0 };
    if (r.status === "PRESENT") entry.present += 1;
    else if (r.status === "ABSENT" || r.status === "EXCUSED") entry.absent += 1;
    else if (r.status === "LATE") entry.late += 1;
    monthlyMap.set(key, entry);
  }

  const chartData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const monthIndex = parseInt(key.split("-")[1], 10);
      return {
        month: MONTH_NAMES[monthIndex],
        Présences: val.present,
        Absences: val.absent,
        Retards: val.late,
      };
    });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-primary">{presenceRate}%</p>
            <p className="text-sm text-muted-foreground mt-1">Taux de présence</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-destructive">{absent}</p>
            <p className="text-sm text-muted-foreground mt-1">Absences</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-yellow-600">{late}</p>
            <p className="text-sm text-muted-foreground mt-1">Retards</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly bar chart */}
      {chartData.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Assiduité par mois</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="Présences" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Absences" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Retards" fill="#ca8a04" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
