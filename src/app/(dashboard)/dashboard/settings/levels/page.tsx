"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Layers, Network, Boxes, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

 

type ClassLevel = {
    id: string;
    name: string;
    code: string;
    level: string;
    sequence: number;
    _count?: { classes: number };
};

export default function AcademicLevelsPage() {
    const { data, isLoading, error } = useSWR<ClassLevel[]>("/api/class-levels", fetcher);

    const levels = data || [];

    // Group levels by their 'level' field (e.g. "COLLEGE", "LYCEE")
    const grouped: Record<string, ClassLevel[]> = {};
    for (const lvl of levels) {
        const group = lvl.level || "AUTRE";
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(lvl);
    }

    const groupLabels: Record<string, { label: string; icon: typeof Layers; color: string }> = {
        PRIMARY: { label: "Cycle Primaire", icon: Network, color: "text-secondary" },
        COLLEGE: { label: "Cycle Collège", icon: Layers, color: "text-primary" },
        LYCEE: { label: "Cycle Lycée", icon: Boxes, color: "text-warning" },
        AUTRE: { label: "Autres", icon: Layers, color: "text-muted-foreground" },
    };

    return (
        <PageGuard permission={["*" as Permission]}>
            <div className="space-y-6 max-w-6xl mx-auto">
                <PageHeader
                    title="Cycles, Niveaux & Séries"
                    description="Structurez l'arborescence académique de votre établissement, essentielle pour le module 'Classes'."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres" },
                        { label: "Structure Académique" },
                    ]}
                />

                {isLoading && (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="animate-spin h-8 w-8 text-primary" />
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive text-sm">
                        Erreur lors du chargement des niveaux académiques.
                    </div>
                )}

                {!isLoading && !error && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="space-y-6">
                            <Card className="border-border shadow-sm border-dashed">
                                <CardContent className="pt-6 text-center space-y-3">
                                    <Network className="w-10 h-10 text-primary mx-auto opacity-80" />
                                    <h3 className="font-semibold">Construction</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Un cycle comporte des Niveaux (ex: Lycée {'>'} Seconde).
                                        Certains niveaux ont des Séries (ex: Terminale {'>'} Terminale C).
                                        Ces paramètres permettront de créer des &quot;Classes&quot; (ex: Terminale C1).
                                    </p>
                                </CardContent>
                            </Card>

                            <Button className="w-full gap-2" variant="outline">
                                <Plus className="w-4 h-4" />
                                Ajouter un Cycle
                            </Button>
                        </div>

                        <div className="lg:col-span-2 space-y-6">
                            {levels.length === 0 && (
                                <Card className="border-border shadow-sm border-dashed">
                                    <CardContent className="py-12 text-center text-muted-foreground">
                                        <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p className="text-sm">Aucun niveau académique configuré.</p>
                                        <p className="text-xs mt-1">Ajoutez un cycle et des niveaux pour commencer.</p>
                                    </CardContent>
                                </Card>
                            )}

                            {Object.entries(grouped).map(([group, groupLevels]) => {
                                const config = groupLabels[group] || groupLabels.AUTRE;
                                const GroupIcon = config.icon;
                                return (
                                    <Card key={group} className="border-border shadow-sm">
                                        <CardHeader className="bg-muted/30 border-b border-border py-4">
                                            <CardTitle className="flex items-center justify-between text-base">
                                                <span className="flex items-center gap-2">
                                                    <GroupIcon className={`w-5 h-5 ${config.color}`} />
                                                    {config.label}
                                                </span>
                                                <Badge variant="secondary">{groupLevels.length} niveau(x)</Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="divide-y divide-border">
                                                {groupLevels.map((lvl) => (
                                                    <div key={lvl.id} className="p-4 hover:bg-muted/10 flex justify-between items-center group">
                                                        <div>
                                                            <h4 className="font-medium text-foreground">{lvl.name}</h4>
                                                            <p className="text-xs text-muted-foreground mt-1">Code: {lvl.code}</p>
                                                        </div>
                                                        <Badge variant="secondary" className="group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                            {lvl._count?.classes ?? 0} Classe(s)
                                                        </Badge>
                                                    </div>
                                                ))}
                                                <div className="p-4 hover:bg-muted/10 flex justify-between items-center bg-muted/5 border-l-4 border-l-primary">
                                                    <Button variant="ghost" size="sm" className="h-8 w-full justify-start text-primary hover:text-primary hover:bg-primary/10 gap-2">
                                                        <Plus className="w-4 h-4" />
                                                        Ajouter un niveau
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </PageGuard>
    );
}
