"use client";

import useSWR from "swr";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { incidentSeverityLabel, incidentTypeLabel, sanctionTypeLabel } from "@/lib/labels/incidents";
import { formatDateShort } from "@/lib/utils/formatters";

type Incident = {
  id: string;
  incidentType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  date: string;
  description: string;
  isResolved: boolean;
  sanctions: Array<{ id: string; type: string; isServed: boolean }>;
};

const SEVERITY_TONE: Record<Incident["severity"], string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

/**
 * Incidents de l'élève (lecture réelle de /api/incidents). L'onglet affichait
 * en dur « Aucun incident disciplinaire signalé », même pour un élève sanctionné.
 */
export function StudentDisciplineTab({ studentId }: { studentId: string }) {
  const { data, error, isLoading } = useSWR<{ data?: Incident[] }>(
    `/api/incidents?studentId=${encodeURIComponent(studentId)}&limit=50`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label="Chargement des incidents">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Impossible de charger les incidents : {error.message}
      </div>
    );
  }

  const incidents = data?.data ?? [];
  if (incidents.length === 0) {
    return (
      <Card className="border-none bg-muted/20 shadow-none">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ShieldCheck className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-bold text-muted-foreground">Aucun incident enregistré pour cet élève.</p>
        </CardContent>
      </Card>
    );
  }

  const open = incidents.filter((i) => !i.isResolved).length;

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        {incidents.length} incident{incidents.length > 1 ? "s" : ""} · {open} en cours de traitement
      </p>
      <ul className="m-0 list-none space-y-2 p-0">
        {incidents.map((incident) => (
          <li key={incident.id}>
            <Card className="border-border/60 shadow-none">
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="text-sm font-semibold">{incidentTypeLabel(incident.incidentType)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SEVERITY_TONE[incident.severity]}`}>
                      {incidentSeverityLabel(incident.severity)}
                    </span>
                  </div>
                  <span className="text-[12px] text-muted-foreground">{formatDateShort(incident.date)}</span>
                </div>
                <p className="text-[13px] leading-relaxed text-foreground/80">{incident.description}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[11px]">
                    {incident.isResolved ? "Clôturé" : "En cours"}
                  </Badge>
                  {incident.sanctions.map((sanction) => (
                    <Badge key={sanction.id} variant="secondary" className="text-[11px]">
                      {sanctionTypeLabel(sanction.type)}
                      {sanction.isServed ? " · effectuée" : ""}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
