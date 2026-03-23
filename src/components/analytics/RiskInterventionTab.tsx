"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    AlertTriangle, 
    ChevronRight, 
    BrainCircuit, 
    User, 
    ArrowRight, 
    BookOpen, 
    Clock, 
    CheckCircle2,
    Loader2,
    Calendar,
    Target
} from "lucide-react";
import { toast } from "sonner";

interface AtRiskStudent {
    student: {
        id: string;
        user: {
            firstName: string;
            lastName: string;
        };
        class: {
            name: string;
        };
    };
    generalAverage: number;
    period: {
        id: string;
        name: string;
    };
    riskLevel?: string;
}

interface RiskInterventionTabProps {
    atRiskStudents: AtRiskStudent[];
    academicYearId: string;
}

interface InterventionPlan {
    riskLevel: string;
    riskScore: number;
    factors: string[];
    recommendations: string[];
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    suggestedActions: {
        title: string;
        description: string;
        type: string;
    }[];
}

export function RiskInterventionTab({ atRiskStudents, academicYearId }: RiskInterventionTabProps) {
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<AtRiskStudent | null>(null);
    const [interventionPlan, setInterventionPlan] = useState<InterventionPlan | null>(null);

    const handleAnalyze = async (student: AtRiskStudent) => {
        setAnalyzingId(student.student.id);
        setSelectedStudent(student);
        setInterventionPlan(null);

        try {
            const response = await fetch("/api/ai/analyze-risk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: student.student.id,
                    academicYearId: academicYearId
                }),
            });

            const data = await response.json();

            if (data.success) {
                setInterventionPlan(data.analysis);
                toast.success("Analyse IA terminée avec succès");
            } else {
                toast.error(data.error || "Une erreur est survenue lors de l'analyse");
            }
        } catch (error) {
            toast.error("Erreur de connexion au service d'IA");
        } finally {
            setAnalyzingId(null);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Student List */}
            <div className="lg:col-span-1 space-y-4">
                <Card className="border-border bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Élèves à Risque
                        </CardTitle>
                        <CardDescription>
                            Top 10 des élèves nécessitant une attention immédiate
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {atRiskStudents.length > 0 ? (
                                atRiskStudents.map((item) => (
                                    <button
                                        key={item.student.id}
                                        onClick={() => handleAnalyze(item)}
                                        className={`w-full flex items-center justify-between p-4 text-left transition-all hover:bg-accent group ${
                                            selectedStudent?.student.id === item.student.id ? "bg-accent" : ""
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {item.student.user.firstName[0]}{item.student.user.lastName[0]}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {item.student.user.lastName} {item.student.user.firstName}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                                                        {item.student.class.name}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        Moy: {item.generalAverage.toFixed(2)}/20
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ${
                                            selectedStudent?.student.id === item.student.id ? "text-primary" : ""
                                        }`} />
                                    </button>
                                ))
                            ) : (
                                <div className="p-8 text-center text-muted-foreground italic text-sm">
                                    Aucun élève à risque identifié.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Analysis Detail */}
            <div className="lg:col-span-2 space-y-6">
                {!selectedStudent ? (
                    <Card className="h-full border-dashed flex flex-col items-center justify-center p-12 text-center bg-muted/20">
                        <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                            <BrainCircuit className="h-8 w-8 text-primary/40" />
                        </div>
                        <CardTitle className="text-muted-foreground">Sélectionnez un élève</CardTitle>
                        <CardDescription className="max-w-xs mt-2">
                            Choisissez un élève dans la liste pour lancer l'analyse IA des risques et générer un plan d'intervention personnalisé.
                        </CardDescription>
                    </Card>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* Student Info Bar */}
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold shadow-lg shadow-primary/20">
                                    {selectedStudent.student.user.firstName[0]}{selectedStudent.student.user.lastName[0]}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">
                                        {selectedStudent.student.user.firstName} {selectedStudent.student.user.lastName}
                                    </h2>
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <User className="h-3 w-3" />
                                        {selectedStudent.student.class.name} | Moyenne: {selectedStudent.generalAverage.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                            <Button 
                                onClick={() => handleAnalyze(selectedStudent)} 
                                disabled={analyzingId === selectedStudent.student.id}
                                className="gap-2 shadow-md"
                            >
                                {analyzingId === selectedStudent.student.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <BrainCircuit className="h-4 w-4" />
                                )}
                                Relancer l'IA
                            </Button>
                        </div>

                        {analyzingId === selectedStudent.student.id ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <span className="relative flex h-12 w-12">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-12 w-12 bg-primary flex items-center justify-center">
                                        <BrainCircuit className="h-6 w-6 text-white" />
                                    </span>
                                </span>
                                <div className="text-center">
                                    <h3 className="font-semibold text-lg">Analyse en cours...</h3>
                                    <p className="text-sm text-muted-foreground">Gemini traite les données de performance et de comportement.</p>
                                </div>
                            </div>
                        ) : interventionPlan ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Risk Assessment */}
                                <Card className="border-border overflow-hidden">
                                    <div className={`h-1.5 w-full ${
                                        interventionPlan.priority === 'CRITICAL' ? 'bg-red-600' : 
                                        interventionPlan.priority === 'HIGH' ? 'bg-orange-500' : 'bg-amber-400'
                                    }`} />
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Target className="h-4 w-4 text-primary" />
                                            Évaluation du Risque
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <span className="text-3xl font-bold">{Math.round(interventionPlan.riskScore)}%</span>
                                                <span className="text-xs text-muted-foreground ml-2">Score de Risque</span>
                                            </div>
                                            <Badge className={
                                                interventionPlan.priority === 'CRITICAL' ? 'bg-red-100 text-red-700 hover:bg-red-100 border-red-200' : 
                                                'bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200'
                                            }>
                                                {interventionPlan.priority}
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Facteurs Identifiés</p>
                                            <div className="space-y-1.5">
                                                {interventionPlan.factors.map((factor, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-sm">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                                                        {factor}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Quick Recommendations */}
                                <Card className="border-border">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            Recommandations IA
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {interventionPlan.recommendations.map((rec, i) => (
                                                <div key={i} className="flex gap-3 text-sm p-3 rounded-lg bg-green-50/50 border border-green-100/50">
                                                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                        <span className="text-[10px] font-bold text-green-700">{i+1}</span>
                                                    </div>
                                                    <p className="text-green-900/80 leading-snug">{rec}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Action Plan */}
                                <Card className="md:col-span-2 border-border bg-slate-50/30">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-primary" />
                                            Plan d'Action Proposé
                                        </CardTitle>
                                        <CardDescription>Actions concrètes à mettre en œuvre dans les 15 prochains jours</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {interventionPlan.suggestedActions.map((action, i) => (
                                                <div key={i} className="group relative bg-white border border-border p-4 rounded-xl hover:shadow-md transition-all">
                                                    <div className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary opacity-50 group-hover:opacity-100 transition-opacity">
                                                        {action.type === 'Pédagogique' ? <BookOpen className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                                    </div>
                                                    <Badge variant="secondary" className="mb-2 text-[10px] uppercase font-bold tracking-tighter">
                                                        {action.type}
                                                    </Badge>
                                                    <h4 className="font-bold text-sm mb-1">{action.title}</h4>
                                                    <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
                                                    <div className="mt-3 overflow-hidden rounded-full bg-muted h-1 w-full">
                                                        <div className="bg-primary h-full w-0 group-hover:w-full transition-all duration-700 delay-100" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <Card className="flex flex-col items-center justify-center p-20 text-center bg-muted/10 border-dashed">
                                <BrainCircuit className="h-10 w-10 text-muted-foreground/30 mb-4" />
                                <h3 className="font-medium text-muted-foreground">Aucune analyse disponible</h3>
                                <p className="text-sm text-muted-foreground/60 mt-1 mb-6">
                                    Cliquez sur "Relancer l'IA" pour générer un diagnostic complet.
                                </p>
                                <Button variant="outline" onClick={() => handleAnalyze(selectedStudent)}>
                                    Lancer l'Analyse Maintenant
                                </Button>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
