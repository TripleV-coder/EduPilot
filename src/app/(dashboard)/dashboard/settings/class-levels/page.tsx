"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Permission } from "@/lib/rbac/permissions";
import { GraduationCap, Plus, Save, AlertCircle, CheckCircle, Trash2, Edit2, Layers } from "lucide-react";
import { t } from "@/lib/i18n";

type ClassLevel = {
    id: string;
    name: string;
    code: string;
    level: string;
    sequence: number;
    _count?: { classes: number };
};

export default function ClassLevelsSettingsPage() {
    const [levels, setLevels] = useState<ClassLevel[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [isAdding, setIsAdding] = useState(false);

    const fetchLevels = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/class-levels");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors du chargement");
            setLevels(Array.isArray(data) ? data : data.data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLevels();
    }, []);

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    const handleCreateLevel = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const sequenceStr = formData.get("sequence") as string;

        const payload = {
            name: formData.get("name"),
            code: formData.get("code"),
            level: formData.get("level"),
            sequence: sequenceStr ? parseInt(sequenceStr, 10) : 0,
        };

        try {
            const res = await fetch("/api/class-levels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Une erreur est survenue");
            }

            setIsAdding(false);
            showSuccess("Niveau d'étude créé avec succès");
            fetchLevels();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE}>
            <div className="space-y-6 max-w-5xl mx-auto">
                <PageHeader
                    title="Niveaux d'Étude"
                    description="Gérer la hiérarchie des classes (Primaire, Collège, Lycée...)"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Niveaux d'Étude" },
                    ]}
                />

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {successMsg && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success))] flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{successMsg}</p>
                    </div>
                )}

                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-secondary/10 dark:bg-secondary/20 text-secondary">
                            <Layers className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">Structure de l'Établissement</h2>
                            <p className="text-sm text-muted-foreground">Création de la progression logique des classes.</p>
                        </div>
                    </div>
                    {!isAdding && (
                        <Button onClick={() => setIsAdding(true)} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Plus className="h-4 w-4" />
                            {t("common.new")} Niveau
                        </Button>
                    )}
                </div>

                {isAdding && (
                    <Card className="border-secondary/20 bg-secondary/5">
                        <CardHeader>
                            <CardTitle className="text-lg">Ajouter un Niveau</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateLevel} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nom complet <span className="text-destructive">*</span></Label>
                                        <Input id="name" name="name" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="code">Code <span className="text-destructive">*</span></Label>
                                        <Input id="code" name="code" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="level">Cycle (Niveau) <span className="text-destructive">*</span></Label>
                                        <select
                                            id="level"
                                            name="level"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            required
                                        >
                                            <option value="">Sélectionner...</option>
                                            <option value="PRIMARY">Primaire</option>
                                            <option value="MIDDLE">Collège</option>
                                            <option value="HIGH">Lycée</option>
                                            <option value="UNIVERSITY">Supérieur</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sequence">Séquence (Ordre)</Label>
                                        <Input id="sequence" name="sequence" type="number" min="1" required />
                                        <p className="text-[10px] text-muted-foreground">Détermine l'affichage (1 d'abord).</p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>{t("common.cancel")}</Button>
                                    <Button type="submit" disabled={saving} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                                        {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" /> : <Save className="h-4 w-4" />}
                                        {t("common.save")}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-3">
                {loading ? (
                    <div className="py-12 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                ) : levels.length === 0 ? (
                        <div className="text-center py-16 border border-dashed rounded-xl bg-muted/30">
                            <Layers className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium">Aucun Niveau Configurè</h3>
                            <p className="text-sm text-muted-foreground mt-1">Cliquez sur Ajouter pour créer la structure de l'établissement.</p>
                        </div>
                    ) : (
                        levels.map((level) => (
                            <Card key={level.id} className="border-border hover:border-secondary/30 hover:shadow-sm transition-all">
                                <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex max-sm:w-full items-center gap-4">
                                        <div className="w-10 h-10 rounded bg-muted/50 border font-mono text-xs flex items-center justify-center shrink-0">
                                            #{level.sequence}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-base flex items-center gap-2">
                                                {level.name}
                                                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{level.code}</span>
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Cycle : {level.level === 'PRIMARY' ? 'Primaire' : level.level === 'MIDDLE' ? 'Collège' : level.level === 'HIGH' ? 'Lycée' : level.level}
                                                &nbsp;&bull;&nbsp; {level._count?.classes || 0} classes
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button variant="ghost" size="icon" title="Modifier">
                                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="hover:text-destructive hover:bg-destructive/10" title={t("common.delete")}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </PageGuard>
    );
}
