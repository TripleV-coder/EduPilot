"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    const { data, isLoading, error, mutate } = useSWR<ClassLevel[]>("/api/class-levels", fetcher);
    const { toast } = useToast();
    // Cycle dans lequel on ajoute un niveau (null = fenêtre fermée).
    const [addingTo, setAddingTo] = useState<string | null>(null);
    const [form, setForm] = useState({ name: "", code: "", sequence: "1" });
    const [saving, setSaving] = useState(false);

    const openAddLevel = (group: string, groupLevels: ClassLevel[]) => {
        const nextSequence = groupLevels.reduce((max, l) => Math.max(max, l.sequence), 0) + 1;
        setForm({ name: "", code: "", sequence: String(nextSequence) });
        setAddingTo(group);
    };

    const saveLevel = async () => {
        if (!addingTo) return;
        setSaving(true);
        try {
            const res = await fetch("/api/class-levels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    code: form.code.trim().toUpperCase(),
                    level: addingTo,
                    sequence: Number(form.sequence),
                }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Le niveau n'a pas été créé.");
            toast({ title: "Niveau ajouté", description: `${form.name.trim()} est disponible pour créer des classes.` });
            setAddingTo(null);
            await mutate();
        } catch (err) {
            toast({ title: "Niveau refusé", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const levels = data || [];

    // Group levels by their 'level' field (e.g. "COLLEGE", "LYCEE")
    const grouped: Record<string, ClassLevel[]> = {};
    for (const lvl of levels) {
        const group = lvl.level || "AUTRE";
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(lvl);
    }

    const groupLabels: Record<string, { label: string; icon: typeof Layers; color: string }> = {
        PRIMARY: { label: "Primaire", icon: Network, color: "text-secondary" },
        SECONDARY_COLLEGE: { label: "Collège (premier cycle)", icon: Layers, color: "text-primary" },
        SECONDARY_LYCEE: { label: "Lycée (second cycle)", icon: Boxes, color: "text-warning" },
        AUTRE: { label: "Autres", icon: Layers, color: "text-muted-foreground" },
    };

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <PageShell>
                <PageHeader
                    title="Cycles, niveaux et séries"
                    description="Structurez l'arborescence académique de votre établissement, essentielle pour le module 'Classes'."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Structure académique" },
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
                                    <h2 className="font-semibold">Construction</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Un cycle comporte des Niveaux (ex: Lycée {'>'} Seconde).
                                        Certains niveaux ont des Séries (ex: Terminale {'>'} Terminale C).
                                        Ces paramètres permettront de créer des &quot;Classes&quot; (ex: Terminale C1).
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Les cycles offerts (Primaire, Collège, Lycée) se choisissent sur leur page dédiée. */}
                            <Button asChild className="w-full gap-2" variant="outline">
                                <Link href="/dashboard/settings/cycles">
                                    <Plus className="w-4 h-4" />
                                    Ajouter un cycle
                                </Link>
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
                                                            <h3 className="font-medium text-foreground">{lvl.name}</h3>
                                                            <p className="text-xs text-muted-foreground mt-1">Code: {lvl.code}</p>
                                                        </div>
                                                        <Badge variant="secondary" className="group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                            {lvl._count?.classes ?? 0} Classe(s)
                                                        </Badge>
                                                    </div>
                                                ))}
                                                <div className="p-4 hover:bg-muted/10 flex justify-between items-center bg-muted/5">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-full justify-start text-primary hover:text-primary hover:bg-primary/10 gap-2"
                                                        onClick={() => openAddLevel(group, groupLevels)}
                                                        disabled={group === "AUTRE"}
                                                    >
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
                <Dialog open={addingTo !== null} onOpenChange={(open) => !open && setAddingTo(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Nouveau niveau · {addingTo ? (groupLabels[addingTo] ?? groupLabels.AUTRE).label : ""}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="level-name">Nom du niveau</Label>
                                <Input id="level-name" placeholder="Ex : Seconde" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="level-code">Code</Label>
                                    <Input id="level-code" placeholder="Ex : 2NDE" maxLength={10} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="level-sequence">Ordre dans le cycle</Label>
                                    <Input id="level-sequence" type="number" min={1} value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setAddingTo(null)}>Annuler</Button>
                            <Button onClick={() => void saveLevel()} disabled={saving || form.name.trim().length < 2 || !form.code.trim()}>
                                Créer le niveau
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </PageShell>
        </PageGuard>
    );
}
