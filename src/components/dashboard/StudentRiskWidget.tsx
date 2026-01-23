import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStudentRisk } from "@/hooks/useStudentRisk";
import { AlertTriangle, CheckCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudentRiskWidgetProps {
    studentId: string;
}

export function StudentRiskWidget({ studentId }: StudentRiskWidgetProps) {
    const { prediction, loading, error, refresh } = useStudentRisk(studentId);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Analyse IA</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
                        Analyse en cours...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || !prediction) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Analyse IA</CardTitle>
                    <Button variant="ghost" size="sm" onClick={refresh}><RefreshCcw className="h-4 w-4" /></Button>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-apogee-crimson">
                        {error ? "Erreur de chargement" : "Aucune donnée"}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const riskLevel = prediction.dropoutRisk > 50 ? "HIGH" : prediction.dropoutRisk > 20 ? "MEDIUM" : "LOW";
    const riskColor = riskLevel === "HIGH" ? "text-apogee-crimson" : riskLevel === "MEDIUM" ? "text-apogee-gold" : "text-apogee-emerald";
    const RiskIcon = riskLevel === "HIGH" ? AlertTriangle : CheckCircle;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Analyse de Risque</CardTitle>
                <RiskIcon className={`h-4 w-4 ${riskColor}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {prediction.dropoutRisk}% <span className="text-sm font-normal text-muted-foreground">risque d&apos;échec</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Confiance IA: {prediction.confidence}%
                </p>

                <div className="mt-4 space-y-2">
                    <div>
                        <span className="text-xs font-semibold">Matières à surveiller:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {prediction.potentialFailureSubjects.length > 0 ? (
                                prediction.potentialFailureSubjects.map((subject) => (
                                    <Badge key={subject} variant={riskLevel === "HIGH" ? "destructive" : "secondary"}>
                                        {subject}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-xs text-muted-foreground">Aucune alerte majeure</span>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-center text-sm pt-2 border-t">
                        <span>Moyenne Prédite:</span>
                        <span className="font-bold">{prediction.predictedAverage.toFixed(2)}/20</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
