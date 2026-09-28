"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Permission } from "@/lib/rbac/permissions";
import { Banknote, Plus, Save, AlertCircle, CheckCircle, ArrowLeft, Trash2, Pencil } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils/error-message";
import type { AcademicYear, ClassLevel } from "@prisma/client";
import { Spinner } from "@/components/edu";

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
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    // Frais en cours de modification (le formulaire d'ajout sert aussi à l'édition).
    const [editingFee, setEditingFee] = useState<Fee | null>(null);
    const [feeToDelete, setFeeToDelete] = useState<Fee | null>(null);
    const [deleting, setDeleting] = useState(false);

    const openCreate = () => {
        setEditingFee(null);
        setIsAdding(true);
    };
    const openEdit = (fee: Fee) => {
        setEditingFee(fee);
        setIsAdding(true);
        document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
    };
    const closeForm = () => {
        setIsAdding(false);
        setEditingFee(null);
    };

    const confirmDelete = async () => {
        if (!feeToDelete) return;
        setDeleting(true);
        setError(null);
        try {
            const res = await fetch(`/api/fees/${feeToDelete.id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Suppression impossible");
            showSuccess(`« ${feeToDelete.name} » retiré de la grille`);
            fetchData();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setDeleting(false);
            setFeeToDelete(null);
        }
    };

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
        } catch (err) {
            setError(getErrorMessage(err) || "Erreur de chargement");
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
            const res = await fetch(editingFee ? `/api/fees/${editingFee.id}` : "/api/fees", {
                method: editingFee ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement");
            }

            showSuccess(editingFee ? "Frais modifié" : "Frais configuré avec succès");
            closeForm();
            fetchData();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageGuard permission={Permission.FINANCE_CREATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <PageShell>
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/finance">
                        <Button aria-label="Retour aux finances" variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <PageHeader
                        title="Configuration des frais"
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
                    <div className="p-4 rounded-lg bg-success/10 border border-success/30 text-success flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{successMsg}</p>
                    </div>
                )}

                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-warning/10 text-warning">
                            <Banknote className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">Lignes tarifaires</h2>
                            <p className="text-sm text-muted-foreground">Gérez les montants par niveau d'étude ou généraux.</p>
                        </div>
                    </div>
                    {!isAdding && (
                        <Button onClick={openCreate} className="gap-2">
                            <Plus className="h-4 w-4" />
                            {t("common.new")} Frais
                        </Button>
                    )}
                </div>

                {isAdding && (
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg">{editingFee ? `Modifier « ${editingFee.name} »` : "Ajouter une ligne de frais"}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* key : les valeurs par défaut suivent le frais édité */}
                            <form key={editingFee?.id ?? "new"} onSubmit={handleCreateFee} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="space-y-2 lg:col-span-2">
                                        <Label htmlFor="name">Intitulé détaillé <span className="text-destructive">*</span></Label>
                                        <Input id="name" name="name" aria-label="Intitulé du frais" placeholder="Ex: Frais de scolarité trimestre 1" defaultValue={editingFee?.name} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="amount">Montant (FCFA) <span className="text-destructive">*</span></Label>
                                        <Input id="amount" name="amount" aria-label="Montant du frais" placeholder="Ex: 25000" type="number" min="0" defaultValue={editingFee ? Number(editingFee.amount) : undefined} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="academicYearId">Année Académique</Label>
                                        <select id="academicYearId" name="academicYearId" aria-label="Année académique" defaultValue={editingFee?.academicYearId ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                            <option value="">(Toutes les années)</option>
                                            {academicYears.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="classLevelCode">Niveau d'Étude Cible</Label>
                                        <select id="classLevelCode" name="classLevelCode" aria-label="Niveau d'étude cible" defaultValue={editingFee?.classLevelCode ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                            <option value="">(Général / Tous les niveaux)</option>
                                            {classLevels.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="dueDate">Date d'échéance exigée (Pénalités)</Label>
                                        <Input id="dueDate" name="dueDate" type="date" defaultValue={editingFee?.dueDate ? editingFee.dueDate.slice(0, 10) : undefined} />
                                    </div>
                                    <div className="space-y-2 lg:col-span-3">
                                        <Label htmlFor="description">Notes internes (Optionnel)</Label>
                                        <Input id="description" name="description" aria-label="Notes internes" placeholder="Commentaires internes sur ce frais" defaultValue={editingFee?.description ?? undefined} />
                                    </div>
                                    <div className="space-y-2 flex items-center justify-between p-3 rounded-lg border bg-background/50 lg:col-span-3">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-medium">Ce frais est-il obligatoire pour tout étudiant ?</Label>
                                            <p className="text-xs text-muted-foreground">Si oui, le système facturera automatiquement lors de l'inscription.</p>
                                        </div>
                                        <Switch aria-label="Frais obligatoire pour tous les élèves" name="isRequired" defaultChecked={editingFee ? editingFee.isRequired : true} />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
                                    <Button type="button" variant="outline" onClick={closeForm}>{t("common.cancel")}</Button>
                                    <Button type="submit" disabled={saving} className="gap-2">
                                        {saving ? <Spinner size={16} /> : <Save className="h-4 w-4" />}
                                        {t("common.save")}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {loading ? (
                        <div className="col-span-full py-12 flex justify-center"><span role="status" aria-label="Chargement…" className="inline-flex text-primary"><Spinner size={28} /></span></div>
                    ) : fees.length === 0 ? (
                        <div className="col-span-full text-center py-16 border border-dashed rounded-xl bg-muted/30">
                            <Banknote className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium">Aucun frais configuré</h3>
                            <p className="text-sm text-muted-foreground mt-1">Créez votre grille tarifaire pour commencer à facturer.</p>
                        </div>
                    ) : (
                        fees.map((fee) => (
                            <Card key={fee.id} className="border-border hover:shadow-md transition-shadow relative overflow-hidden group">
                                {!fee.isRequired && (
                                    <div className="absolute top-0 right-0 bg-secondary/10 text-secondary text-[11px] font-bold px-2 py-1 rounded-bl-lg">
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
                                                    <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                        Niv: {fee.classLevel?.name || fee.classLevelCode}
                                                    </span>
                                                )}
                                                {fee.academicYearId && (
                                                    <span className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                                        {fee.academicYear?.name || "Année spécifique"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-end">
                                            <div>
                                                <span className="text-[11px] text-muted-foreground block mb-0.5">Montant unitaire</span>
                                                <span className="font-bold text-xl text-primary">{formatCurrency(fee.amount)}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button aria-label={`Modifier le frais ${fee.name}`} variant="ghost" size="icon" onClick={() => openEdit(fee)} className="h-8 w-8 text-muted-foreground hover:text-primary max-md:h-11 max-md:w-11">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button aria-label={`Supprimer le frais ${fee.name}`} variant="ghost" size="icon" onClick={() => setFeeToDelete(fee)} className="h-8 w-8 text-muted-foreground hover:text-destructive max-md:h-11 max-md:w-11">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
                <ConfirmActionDialog
                    open={feeToDelete !== null}
                    onOpenChange={(open) => !open && setFeeToDelete(null)}
                    title="Retirer ce frais de la grille ?"
                    description={feeToDelete ? `« ${feeToDelete.name} » ne sera plus proposé. Impossible s'il a déjà été encaissé.` : ""}
                    confirmLabel="Retirer"
                    cancelLabel={t("common.cancel")}
                    variant="destructive"
                    isConfirmLoading={deleting}
                    onConfirm={confirmDelete}
                />
            </PageShell>
        </PageGuard>
    );
}
