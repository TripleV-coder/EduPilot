"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Clock, Save, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TeacherAvailabilityPage({ params }: { params: { teacherId: string } }) {
    const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const periods = [
        { id: "p1", name: "08h00 - 10h00" },
        { id: "p2", name: "10h00 - 12h00" },
        { id: "break", name: "12h00 - 13h00 (Pause)", isBreak: true },
        { id: "p3", name: "13h00 - 15h00" },
        { id: "p4", name: "15h00 - 17h00" },
    ];

    return (
        <PageGuard permission={["*" as Permission] /* Required: TEACHER_UPDATE or similar */} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6 max-w-5xl mx-auto">
                <PageHeader
                    title="Disponibilités Enseignant"
                    description="Créez la grille de disponibilité pour l'algorithme de génération d'emploi du temps."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Enseignants", href: "/dashboard/teachers" },
                        { label: "Disponibilités" },
                    ]}
                />

                <Card className="border-border shadow-sm border-t-4 border-t-primary">
                    <CardHeader className="bg-muted/10 border-b border-border">
                        <CardTitle className="flex items-center gap-2">
                            <CalendarCheck className="w-5 h-5 text-primary" />
                            Grille Hebdomadaire
                        </CardTitle>
                        <CardDescription>
                            Cliquez sur les créneaux pour basculer entre "Disponible" (Vert) et "Indisponible" (Rouge).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 overflow-x-auto">
                        <div className="min-w-[700px]">
                            <div className="grid grid-cols-7 gap-2 mb-2 font-medium text-sm text-center text-muted-foreground">
                                <div className="p-2 border border-transparent">Heures</div>
                                {days.map(d => <div key={d} className="p-2 bg-muted/50 rounded border border-border">{d}</div>)}
                            </div>

                            <div className="space-y-2">
                                {periods.map(period => (
                                    <div key={period.id} className={`grid grid-cols-7 gap-2 ${period.isBreak ? 'opacity-50' : ''}`}>
                                        <div className="p-2 flex items-center justify-center font-medium text-xs text-muted-foreground">
                                            <Clock className="w-3 h-3 mr-1" /> {period.name}
                                        </div>

                                        {period.isBreak ? (
                                            <div className="col-span-6 p-2 bg-muted/30 border border-dashed border-border rounded flex items-center justify-center text-xs text-muted-foreground">
                                                Pause Déjeuner
                                            </div>
                                        ) : (
                                            days.map(d => (
                                                <div
                                                    key={`${d}-${period.id}`}
                                                    className="p-3 border rounded transition-colors cursor-pointer flex items-center justify-center text-xs font-medium border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:brightness-95"
                                                >
                                                    Disponible
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end border-t border-border pt-4">
                            <Button className="gap-2">
                                <Save className="w-4 h-4" /> Enregistrer la grille
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageGuard>
    );
}
