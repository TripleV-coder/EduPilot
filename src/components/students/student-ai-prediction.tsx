"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BrainCircuit, Sparkles, AlertTriangle, TrendingUp } from "lucide-react";

type Prediction = {
  recommendedSeries?: string;
  strengths?: string[];
  weaknesses?: string[];
  confidenceScore?: number;
  summary?: string;
};

type PredictionResponse = {
  data?: Prediction;
  prediction?: Prediction;
};

export function StudentAiPrediction({ studentId }: { studentId: string }) {
  const { data, error, isLoading } = useSWR<PredictionResponse>(
    `/api/ai/predictions/student?studentId=${studentId}`,
    fetcher,
    {
      // Don't retry aggressively since this API may not exist yet
      shouldRetryOnError: false,
      revalidateOnFocus: false,
    }
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

  const prediction: Prediction | undefined = data?.data ?? data?.prediction;

  if (!prediction) {
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

  const confidencePercent = prediction.confidenceScore
    ? (prediction.confidenceScore * 100).toFixed(0)
    : null;

  return (
    <div className="space-y-6">
      {/* Main prediction card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            Prédiction IA
            {confidencePercent && (
              <Badge variant="secondary" className="ml-auto text-xs">
                Confiance : {confidencePercent}%
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recommended series */}
          {prediction.recommendedSeries && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-primary">Série recommandée post-BEPC</p>
              </div>
              <p className="text-xl font-bold">{prediction.recommendedSeries}</p>
            </div>
          )}

          {prediction.summary && (
            <p className="text-sm text-muted-foreground">{prediction.summary}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Strengths */}
            {prediction.strengths && prediction.strengths.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium">Points forts</p>
                </div>
                <ul className="space-y-1">
                  {prediction.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weaknesses */}
            {prediction.weaknesses && prediction.weaknesses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm font-medium">Points faibles</p>
                </div>
                <ul className="space-y-1">
                  {prediction.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-yellow-600 mt-0.5">-</span>
                      {w}
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
