"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BrainCircuit, Sparkles, AlertTriangle, TrendingUp } from "lucide-react";
import type { StudentPredictionResponse } from "@/lib/services/ai-predictive";

export function StudentAiPrediction({ studentId }: { studentId: string }) {
  const { data: response, error, isLoading } = useSWR<StudentPredictionResponse>(
    `/api/ai/predictions/student?studentId=${studentId}`,
    fetcher,
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
    }
  );

  const data = response?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BrainCircuit className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium mb-1">Prédiction IA indisponible</p>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Le service de prédiction IA n&apos;est pas encore disponible ou ne dispose pas
            de suffisamment de données pour cet élève. Revenez plus tard.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data?.predictions) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BrainCircuit className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium mb-1">Aucune prédiction disponible</p>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Pas encore assez de données pour générer une prédiction pour cet élève.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { orientationFit, failureRisk, nextPeriodGrade } = data.predictions;
  const recommendedSeries = orientationFit.series.length > 0
    ? orientationFit.series
        .map((series, i) => {
          const score = orientationFit.scores[i];
          return score != null ? `${series} (${score}%)` : series;
        })
        .join(", ")
    : null;

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            Prédiction IA
            <Badge variant="secondary" className="ml-auto text-xs">
              Confiance : {data.confidence}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {recommendedSeries && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-primary">Série(s) recommandée(s) post-BEPC</p>
              </div>
              <p className="text-xl font-bold">{recommendedSeries}</p>
            </div>
          )}

          {orientationFit.reasoning && (
            <p className="text-sm text-muted-foreground">{orientationFit.reasoning}</p>
          )}

          <div className="rounded-lg bg-muted/50 border border-border p-4">
            <p className="text-sm font-medium mb-1">Note prédite — prochaine période</p>
            <p className="text-2xl font-bold">
              {nextPeriodGrade.predicted.toFixed(1)}/20
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (fourchette {nextPeriodGrade.range.min.toFixed(1)}–{nextPeriodGrade.range.max.toFixed(1)})
              </span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {failureRisk.recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium">Recommandations</p>
                </div>
                <ul className="space-y-1">
                  {failureRisk.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">+</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {failureRisk.factors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm font-medium">Facteurs de risque ({failureRisk.level})</p>
                </div>
                <ul className="space-y-1">
                  {failureRisk.factors.map((factor, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-yellow-600 mt-0.5">-</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
