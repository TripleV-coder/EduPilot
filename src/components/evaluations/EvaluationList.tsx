"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, Calendar, Users, Target, ArrowRight, 
  MoreVertical, Edit, Trash2, CheckCircle2, Clock, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
  grades: any[];
}

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
    <div className="space-y-4">
      {evaluations.map((ev) => {
        const gradeCount = ev.grades?.length || 0;
        // Logic for status
        const status = gradeCount === 0 ? "Brouillon" : "Clôturée"; // Simplified for now
        const statusColor = gradeCount === 0 ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-600";
        const statusIcon = gradeCount === 0 ? Clock : CheckCircle2;

        return (
          <Card key={ev.id} className="border-none shadow-none bg-muted/20 hover:bg-muted/30 transition-colors group">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border/50">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-foreground truncate">
                        {ev.title || `${ev.type.name} - ${ev.classSubject.subject.name}`}
                      </h4>
                      <Badge className={cn("text-[9px] font-bold uppercase py-0 px-1.5", statusColor)}>
                        {status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-bold text-foreground">
                        {ev.classSubject.class.name}
                      </span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(ev.date).toLocaleDateString('fr-FR')}
                      </span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-1">
                        {ev.period.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Notes</p>
                      <p className="text-sm font-bold mt-1">{gradeCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Coef</p>
                      <p className="text-sm font-bold mt-1">{Number(ev.coefficient)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/grades/entry?evaluationId=${ev.id}`} className="flex-1 md:flex-none">
                      <Button size="sm" className="h-8 text-[11px] font-bold uppercase gap-2">
                        Saisir Notes
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
