"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Calendar } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Grade } from "@/lib/types";

interface Evaluation {
  id: string;
  title: string | null;
  date: string;
  maxGrade: number;
  coefficient: number;
  type: { name: string };
  period: { name: string };
  classSubject: {
    class: { name: string };
    subject: { name: string };
  };
  /** Nombre de notes saisies (GET /api/evaluations ne renvoie plus le détail des notes). */
  gradeCount?: number;
  grades?: Grade[];
}

export type EvaluationListItem = Evaluation;

export function EvaluationList({ evaluations, isLoading }: { evaluations: Evaluation[], isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20">
        <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-sm font-bold text-muted-foreground">Aucune évaluation trouvée.</p>
        <p className="text-xs text-muted-foreground mt-1">Créez votre première évaluation pour commencer la saisie des notes.</p>
      </div>
    );
  }

  return (
    <ul className="m-0 list-none divide-y divide-[var(--eduflow-border-subtle)] overflow-hidden rounded-card border border-[var(--eduflow-border-subtle)] bg-card p-0">
      {evaluations.map((ev) => {
        const gradeCount = ev.gradeCount ?? ev.grades?.length ?? 0;
        // Seul fait connu ici : des notes ont-elles été saisies ? (pas de statut
        // de clôture côté API — ne pas en afficher un).
        const hasGrades = gradeCount > 0;
        const title = ev.title || `${ev.type.name} - ${ev.classSubject.subject.name}`;

        return (
          <li
            key={ev.id}
            className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5 [@media(hover:hover)]:hover:bg-[var(--eduflow-surface-sunken)]"
          >
            <div className="flex min-w-0 max-w-full items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--edu-module-green)] text-white" aria-hidden="true">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {/* h2 (M8, a11y) : la liste suit directement le h1 de la page Notes. */}
                  <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
                  <Badge
                    className={cn(
                      "px-2 py-0 text-[11px] font-semibold",
                      hasGrades
                        ? "bg-[var(--eduflow-success-50)] text-[var(--eduflow-success-700)]"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {hasGrades ? "Notes saisies" : "À saisir"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{ev.classSubject.class.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    {new Date(ev.date).toLocaleDateString("fr-FR")}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{ev.period.name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-5 md:justify-end">
              <dl className="m-0 flex items-center gap-5 text-center">
                <div>
                  <dt className="text-[12px] text-muted-foreground">Notes</dt>
                  <dd className="m-0 text-sm font-semibold tabular-nums">{gradeCount}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted-foreground">Coef.</dt>
                  <dd className="m-0 text-sm font-semibold tabular-nums">
                    {Number(ev.coefficient).toLocaleString("fr-FR")}
                  </dd>
                </div>
              </dl>
              <Button asChild size="sm" variant={hasGrades ? "outline" : "default"}>
                <Link
                  href={`/dashboard/grades/entry?evaluationId=${ev.id}`}
                  aria-label={`${hasGrades ? "Modifier les notes" : "Saisir les notes"} : ${title}`}
                >
                  {hasGrades ? "Modifier les notes" : "Saisir les notes"}
                </Link>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
