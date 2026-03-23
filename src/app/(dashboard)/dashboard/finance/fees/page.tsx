"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Permission } from "@/lib/rbac/permissions";
import { DollarSign, Plus, Save, AlertCircle, CheckCircle, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";

type Fee = {
    id: string;
    name: string;
    description: string | null;
    amount: number;
    isRequired: boolean;
    dueDate: string | null;
    academicYearId: string | null;
    classLevelCode: string | null;
    academicYear?: { name: string };
    classLevel?: { name: string };
};

export default function FeesManagementPage() {
    const [fees, setFees] = useState<Fee[]>([]);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [classLevels, setClassLevels] = useState<any[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [fRes, ayRes, clRes] = await Promise.all([
                fetch("/api/fees"),
                fetch("/api/academic-years"),
                fetch("/api/class-levels")
            ]);

            if (fRes.ok) {
                const data = await fRes.json();
                setFees(Array.isArray(data) ? data : data.data || []);
            }
            if (ayRes.ok) {
                const data = await ayRes.json();
                setAcademicYears(Array.isArray(data) ? data : data.data || []);
            }
            if (clRes.ok) {
                const data = await clRes.json();
                setClassLevels(Array.isArray(data) ? data : data.data || []);
            }
        } catch (err: any) {
            setError(err.message || "Erreur de chargement");
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-BJ', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount);
    };

    const handleCreateFee = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const formData = new FormData(e.currentTarget);

        const payload = {
            name: formData.get("name"),
            description: formData.get("description") || undefined,
            amount: parseFloat(formData.get("amount") as string),
            academicYearId: formData.get("academicYearId") || undefined,
            classLevelCode: formData.get("classLevelCode") || undefined,
            dueDate: formData.get("dueDate") ? new Date(formData.get("dueDate") as string).toISOString() : undefined,
            isRequired: formData.get("isRequired") === "on",
        };

        try {
            const res = await fetch("/api/fees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erreur lors de la création");
            }

            showSuccess("Frais configuré avec succès");
            setIsAdding(false);
            fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageGuard permission={Permission.FINANCE_CREATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <div className="space-y-6 max-w-5xl mx-auto">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/finance">
                        <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <PageHeader
                        title="Configuration des Frais"
                        description="Définissez les frais de scolarité, d'inscription et autres lignes tarifaires."
                    />
                </div>

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {successMsg && (
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{successMsg}</p>
                    </div>
                )}

                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/20 text-orange-600">
                            <DollarSign className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">Lignes Tarifaires</h2>
                            <p className="text-sm text-muted-foreground">Gérez les montants par niveau d'étude ou généraux.</p>
                        </div>
                    </div>
                    {!isAdding && (
                        <Button onClick={() => setIsAdding(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            {t("common.new")} Frais
                        </Button>
                    )}
                </div>

                {isAdding && (
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg">Ajouter une ligne de frais</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateFee} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="space-y-2 lg:col-span-2">
                                        <Label htmlFor="name">Intitulé détaillé <span className="text-destructive">*</span></Label>
                                        <Input id="name" name="name" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="amount">Montant (FCFA) <span className="text-destructive">*</span></Label>
                                        <Input id="amount" name="amount" type="number" min="0" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="academicYearId">Année Académique</Label>
                                        <select id="academicYearId" name="academicYearId" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                            <option value="">(Toutes les années)</option>
                                            {academicYears.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="classLevelCode">Niveau d'Étude Cible</Label>
                                        <select id="classLevelCode" name="classLevelCode" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                            <option value="">(Général / Tous les niveaux)</option>
                                            {classLevels.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="dueDate">Date d'échéance exigée (Pénalités)</Label>
                                        <Input id="dueDate" name="dueDate" type="date" />
                                    </div>
                                    <div className="space-y-2 lg:col-span-3">
                                        <Label htmlFor="description">Notes internes (Optionnel)</Label>
                                        <Input id="description" name="description" />
                                    </div>
                                    <div className="space-y-2 flex items-center justify-between p-3 rounded-lg border bg-background/50 lg:col-span-3">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-medium">Ce frais est-il obligatoire pour tout étudiant ?</Label>
                                            <p className="text-xs text-muted-foreground">Si oui, le système facturera automatiquement lors de l'inscription.</p>
                                        </div>
                                        <Switch name="isRequired" defaultChecked />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>{t("common.cancel")}</Button>
                                    <Button type="submit" disabled={saving} className="gap-2">
                                        {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" /> : <Save className="h-4 w-4" />}
                                        {t("common.save")}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {loading ? (
                        <div className="col-span-full py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                    ) : fees.length === 0 ? (
                        <div className="col-span-full text-center py-16 border border-dashed rounded-xl bg-muted/30">
                            <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium">Aucun Frais Configuré</h3>
                            <p className="text-sm text-muted-foreground mt-1">Créez votre grille tarifaire pour commencer à facturer.</p>
                        </div>
                    ) : (
                        fees.map((fee) => (
                            <Card key={fee.id} className="border-border hover:shadow-md transition-shadow relative overflow-hidden group">
                                {!fee.isRequired && (
                                    <div className="absolute top-0 right-0 bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                        Optionnel
                                    </div>
                                )}
                                <CardContent className="p-5">
                                    <div className="flex flex-col h-full justify-between">
                                        <div>
                                            <h3 className="font-bold text-base leading-tight pr-12">{fee.name}</h3>
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{fee.description || "—"}</p>

                                            <div className="flex gap-2 flex-wrap mt-3">
                                                {fee.classLevelCode && (
                                                    <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                                        Niv: {fee.classLevel?.name || fee.classLevelCode}
                                                    </span>
                                                )}
                                                {fee.academicYearId && (
                                                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                                        {fee.academicYear?.name || "Année spécifique"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-end">
                                            <div>
                                                <span className="text-[10px] text-muted-foreground block mb-0.5">Montant unitaire</span>
                                                <span className="font-bold text-xl text-primary">{formatCurrency(fee.amount)}</span>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
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
