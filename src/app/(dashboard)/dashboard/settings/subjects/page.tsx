"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Permission } from "@/lib/rbac/permissions";
import { BookOpen, Plus, Save, AlertCircle, CheckCircle, Edit2, Bookmark, FileText } from "lucide-react";
import { t } from "@/lib/i18n";

type Subject = {
    id: string;
    name: string;
    code: string;
    category?: string;
    coefficient: number;
    isActive: boolean;
};

type EvalType = {
    id: string;
    name: string;
    code: string;
    weight: number;
    maxCount?: number;
};

export default function SubjectsSettingsPage() {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [evalTypes, setEvalTypes] = useState<EvalType[]>([]);
    const [subjectCategories, setSubjectCategories] = useState<Array<{ id: string; name: string; code: string }>>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [isAddingSubject, setIsAddingSubject] = useState(false);
    const [isAddingEvalType, setIsAddingEvalType] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [subjRes, evalRes, categoriesRes] = await Promise.all([
                fetch("/api/subjects"),
                fetch("/api/evaluation-types"),
                fetch("/api/subject-categories")
            ]);

            if (subjRes.ok) {
                const data = await subjRes.json();
                setSubjects(Array.isArray(data) ? data : data.data || []);
            }
            if (evalRes.ok) {
                const data = await evalRes.json();
                setEvalTypes(Array.isArray(data) ? data : data.data || []);
            }
            if (categoriesRes.ok) {
                const data = await categoriesRes.json();
                setSubjectCategories(Array.isArray(data) ? data : data.data || []);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    const handleCreateSubject = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const payload = {
            name: formData.get("name"),
            code: formData.get("code"),
            category: formData.get("category") || undefined,
            coefficient: parseFloat(formData.get("coefficient") as string || "1"),
            isActive: true,
        };

        try {
            const res = await fetch("/api/subjects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error((await res.json()).error || "Erreur lors de la création");

            setIsAddingSubject(false);
            showSuccess("Matière créée avec succès");
            fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateEvalType = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const payload = {
            name: formData.get("name"),
            code: formData.get("code"),
            weight: parseFloat(formData.get("weight") as string || "1"),
            maxCount: formData.get("maxCount") ? parseInt(formData.get("maxCount") as string) : undefined,
        };

        try {
            const res = await fetch("/api/evaluation-types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error((await res.json()).error || "Erreur lors de la création");

            setIsAddingEvalType(false);
            showSuccess("Type d'évaluation créé avec succès");
            fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageGuard permission={Permission.SUBJECT_CREATE}>
            <div className="space-y-6 max-w-5xl mx-auto">
                <PageHeader
                    title="Matières & Évaluations"
                    description="Gérer le catalogue des matières et les types d'évaluations (coefficients, catégories)."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Pédagogie" },
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

                <Tabs defaultValue="subjects" className="space-y-6">
                    <TabsList className="bg-muted/50 p-1 border border-border">
                        <TabsTrigger value="subjects" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            Catalogue des Matières
                        </TabsTrigger>
                        <TabsTrigger value="evaluations" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Types d'Évaluation
                        </TabsTrigger>
                    </TabsList>

                    {/* ONGLET MATIERES */}
                    <TabsContent value="subjects" className="space-y-6">
                        <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary">
                                    <BookOpen className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-lg">Matières Enseignées</h2>
                                    <p className="text-sm text-muted-foreground">Définissez les disciplines génériques de l'établissement.</p>
                                </div>
                            </div>
                            {!isAddingSubject && (
                                <div className="flex gap-2">
                                    <Button asChild variant="outline">
                                        <Link href="/dashboard/settings/subject-categories">
                                            Gérer les catégories
                                        </Link>
                                    </Button>
                                    <Button onClick={() => setIsAddingSubject(true)} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                                        <Plus className="h-4 w-4" />
                                        Nouvelle Matière
                                    </Button>
                                </div>
                            )}
                        </div>

                        {isAddingSubject && (
                            <Card className="border-primary/20 bg-primary/5">
                                <CardHeader>
                                    <CardTitle className="text-lg">Ajouter une Matière Centrale</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleCreateSubject} className="space-y-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="name">Nom de la matière <span className="text-destructive">*</span></Label>
                                                <Input id="name" name="name" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="code">Code (Abreégé) <span className="text-destructive">*</span></Label>
                                                <Input id="code" name="code" maxLength={10} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="category">Catégorie</Label>
                                                <select
                                                    id="category"
                                                    name="category"
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                >
                                                    <option value="">Sélectionner...</option>
                                                    {subjectCategories.map((category) => (
                                                        <option key={category.id} value={category.code}>
                                                            {category.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="coefficient">Coef. par défaut <span className="text-destructive">*</span></Label>
                                                <Input id="coefficient" name="coefficient" type="number" step="0.5" min="0.5" max="10" defaultValue="1" required />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-3 pt-2">
                                            <Button type="button" variant="outline" onClick={() => setIsAddingSubject(false)}>{t("common.cancel")}</Button>
                                            <Button type="submit" disabled={saving} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                                                {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" /> : <Save className="h-4 w-4" />}
                                                Sauvegarder
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {loading ? (
                                <div className="col-span-full py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                            ) : subjects.length === 0 ? (
                                <div className="col-span-full text-center py-16 border border-dashed rounded-xl bg-muted/30">
                                    <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                    <h3 className="text-lg font-medium">Aucune Matière</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Générez le catalogue pour pouvoir assigner des cours aux classes.</p>
                                </div>
                            ) : (
                                subjects.map((subject) => (
                                    <Card key={subject.id} className="border-border hover:border-primary/30 hover:shadow-sm transition-all group bg-card">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-base flex items-center gap-2">
                                                        {subject.name}
                                                        {!subject.isActive && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded uppercase">Inactif</span>}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{subject.code}</span>
                                                        {subject.category && (
                                                            <span className="text-[10px] bg-primary/10 text-primary dark:bg-primary/20 px-1.5 py-0.5 rounded">
                                                                {subject.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs text-muted-foreground">Coef.</span>
                                                    <span className="font-bold text-lg leading-none">{subject.coefficient}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    {/* ONGLET TYPES D'EVALUATION */}
                    <TabsContent value="evaluations" className="space-y-6">
                        <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-accent/10 dark:bg-accent/20 text-accent">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-lg">Types d'Évaluation</h2>
                                    <p className="text-sm text-muted-foreground">Définissez les devoirs de contrôle, compositions et leurs poids par défaut.</p>
                                </div>
                            </div>
                            {!isAddingEvalType && (
                                <Button onClick={() => setIsAddingEvalType(true)} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
                                    <Plus className="h-4 w-4" />
                                    {t("common.new")} Type
                                </Button>
                            )}
                        </div>

                        {isAddingEvalType && (
                            <Card className="border-accent/20 bg-accent/5">
                                <CardHeader>
                                    <CardTitle className="text-lg">Créer un Type d'Évaluation</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleCreateEvalType} className="space-y-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="evalName">Nom <span className="text-destructive">*</span></Label>
                                                <Input id="evalName" name="name" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="evalCode">Code <span className="text-destructive">*</span></Label>
                                                <Input id="evalCode" name="code" maxLength={10} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="weight">Poids / Coef. <span className="text-destructive">*</span></Label>
                                                <Input id="weight" name="weight" type="number" step="0.5" min="0.5" max="10" defaultValue="1" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="maxCount">Nb max (Optionnel)</Label>
                                                <Input id="maxCount" name="maxCount" type="number" min="1" />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-3 pt-2">
                                            <Button type="button" variant="outline" onClick={() => setIsAddingEvalType(false)}>{t("common.cancel")}</Button>
                                            <Button type="submit" disabled={saving} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
                                                {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" /> : <Save className="h-4 w-4" />}
                                                Sauvegarder
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {loading ? (
                                <div className="col-span-full py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
                            ) : evalTypes.length === 0 ? (
                                <div className="col-span-full text-center py-16 border border-dashed rounded-xl bg-muted/30">
                                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                    <h3 className="text-lg font-medium">Aucun Type d'Évaluation</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Créez des types d'évaluation (Ex: Devoirs de synthèse).</p>
                                </div>
                            ) : (
                                evalTypes.map((type) => (
                                    <Card key={type.id} className="border-border hover:border-accent/30 hover:shadow-sm transition-all group bg-card">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-base flex items-center gap-2">
                                                        {type.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{type.code}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs text-muted-foreground">Poids</span>
                                                <span className="font-bold text-lg leading-none text-accent">{type.weight}</span>
                                                </div>
                                            </div>
                                            {type.maxCount && (
                                                <div className="mt-3 text-xs text-muted-foreground">
                                                    Limite: <span className="font-medium text-foreground">{type.maxCount} par période</span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </PageGuard>
    );
}
