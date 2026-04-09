"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Permission } from "@/lib/rbac/permissions";
import { Calendar, Plus, Save, AlertCircle, CheckCircle, Trash2, Edit2 } from "lucide-react";
import { t } from "@/lib/i18n";

type AcademicYear = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
};

export default function AcademicSettingsPage() {
    const [years, setYears] = useState<AcademicYear[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [isAdding, setIsAdding] = useState(false);

    const fetchYears = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/academic-years");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors du chargement");
            setYears(Array.isArray(data) ? data : data.data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchYears();
    }, []);

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    const handleCreateYear = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const payload = {
            name: formData.get("name"),
            startDate: formData.get("startDate") ? new Date(formData.get("startDate") as string).toISOString() : undefined,
            endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string).toISOString() : undefined,
            isCurrent: formData.get("isCurrent") === "on",
        };

        try {
            const res = await fetch("/api/academic-years", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Une erreur est survenue");
            }

            setIsAdding(false);
            showSuccess("Année académique créée avec succès");
            fetchYears();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE}>
            <div className="space-y-6 max-w-5xl mx-auto pb-24">
                <PageHeader
                    title="Années Académiques"
                    description="Gérer le calendrier scolaire (années, trimestres, semestres)"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Années Académiques" },
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
                        <div className="p-3 rounded-xl bg-accent/10 dark:bg-accent/20 text-accent">
                            <Calendar className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">Configuration du Calendrier</h2>
                            <p className="text-sm text-muted-foreground">Création de la chronologie de votre établissement.</p>
                        </div>
                    </div>
                    {!isAdding && (
                        <Button onClick={() => setIsAdding(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nouvelle Année
                        </Button>
                    )}
                </div>

                {isAdding && (
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg">Ajouter une Année Scolaire</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateYear} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="name">Nom de l'année <span className="text-destructive">*</span></Label>
                                        <Input id="name" name="name" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="startDate">Date de Début <span className="text-destructive">*</span></Label>
                                        <Input id="startDate" name="startDate" type="date" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="endDate">Date de Fin <span className="text-destructive">*</span></Label>
                                        <Input id="endDate" name="endDate" type="date" required />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <input type="checkbox" id="isCurrent" name="isCurrent" className="rounded border-border text-primary focus:ring-primary" />
                                    <Label htmlFor="isCurrent" className="font-normal cursor-pointer">Définir comme l'année académique active actuelle (Clôturera automatiquement la précédente)</Label>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>{t("common.cancel")}</Button>
                                    <Button type="submit" disabled={saving} className="gap-2">
                                        {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" /> : <Save className="h-4 w-4" />}
                                        {t("common.create")}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4">
                    {loading ? (
                        <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                    ) : years.length === 0 ? (
                        <div className="text-center py-16 border border-dashed rounded-xl bg-muted/30">
                            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium">Aucune année académique</h3>
                            <p className="text-sm text-muted-foreground mt-1">Commencez par créer l'année en cours.</p>
                        </div>
                    ) : (
                        years.map((year) => (
                            <Card key={year.id} className={`transition-all ${year.isCurrent ? "border-secondary/50 shadow-sm ring-1 ring-secondary/20" : "border-border opacity-70"}`}>
                                <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-bold text-lg">{year.name}</h3>
                                            {year.isCurrent && (
                                                <span className="bg-secondary/10 text-secondary dark:bg-secondary/20 text-xs px-2 py-0.5 rounded-full font-medium">
                                                    Année Active Actuelle
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Du {new Date(year.startDate).toLocaleDateString()} au {new Date(year.endDate).toLocaleDateString()}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {!year.isCurrent && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled
                                                title="Le backend actuel n'expose aucune route de mise à jour pour une année académique existante."
                                            >
                                                Activation indisponible
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled
                                            title="Le backend actuel n'expose aucune route d'édition pour une année académique existante."
                                        >
                                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled
                                            className="hover:text-destructive hover:bg-destructive/10"
                                            title="Le backend actuel n'expose aucune route d'archivage ou suppression pour une année académique."
                                        >
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
