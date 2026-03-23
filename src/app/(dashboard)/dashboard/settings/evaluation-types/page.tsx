"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { BookOpen, Plus, Settings2, Trash2, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { t } from "@/lib/i18n";

 

type EvaluationType = {
    id: string;
    name: string;
    code: string;
    weight: number;
    maxCount: number | null;
    isActive: boolean;
};

type FormData = {
    name: string;
    code: string;
    weight: string;
    maxCount: string;
};

const EMPTY_FORM: FormData = { name: "", code: "", weight: "1", maxCount: "" };

export default function EvaluationTypesPage() {
    const { data: types, isLoading, error, mutate } = useSWR<EvaluationType[]>("/api/evaluation-types", fetcher);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    function openCreate() {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setFormErrors({});
        setDialogOpen(true);
    }

    function openEdit(t: EvaluationType) {
        setEditingId(t.id);
        setForm({
            name: t.name,
            code: t.code,
            weight: String(t.weight),
            maxCount: t.maxCount ? String(t.maxCount) : "",
        });
        setFormErrors({});
        setDialogOpen(true);
    }

    function validate(): boolean {
        const errs: Partial<Record<keyof FormData, string>> = {};
        if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Min. 2 caractères";
        if (!form.code.trim()) errs.code = "Le code est requis";
        if (form.code.trim().length > 10) errs.code = "Max. 10 caractères";
        const w = Number(form.weight);
        if (isNaN(w) || w < 0.1 || w > 10) errs.weight = "Entre 0.1 et 10";
        if (form.maxCount.trim()) {
            const mc = Number(form.maxCount);
            if (isNaN(mc) || mc < 1 || !Number.isInteger(mc)) errs.maxCount = "Entier positif requis";
        }
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function handleSave() {
        if (!validate()) return;
        setSaving(true);
        try {
            const payload: any = {
                name: form.name.trim(),
                code: form.code.trim(),
                weight: Number(form.weight),
            };
            if (form.maxCount.trim()) {
                payload.maxCount = Number(form.maxCount);
            }

            if (editingId) {
                await fetch(`/api/evaluation-types/${editingId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else {
                await fetch("/api/evaluation-types", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }
            await mutate();
            setDialogOpen(false);
        } catch (err) {
            console.error("Failed to save evaluation type:", err);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        setDeleteTargetId(id);
        setDeleteDialogOpen(true);
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;
        setDeleting(deleteTargetId);
        try {
            await fetch(`/api/evaluation-types/${deleteTargetId}`, { method: "DELETE" });
            await mutate();
        } catch (err) {
            console.error("Failed to delete evaluation type:", err);
        } finally {
            setDeleting(null);
            setDeleteDialogOpen(false);
            setDeleteTargetId(null);
        }
    }

    return (
        <PageGuard permission={[Permission.EVALUATION_CREATE]}>
            <div className="space-y-6 max-w-5xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Types d'évaluation"
                        description="Personnalisez les types de notes et leurs coefficients par défaut"
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Paramètres" },
                            { label: "Évaluations" },
                        ]}
                    />
                    <div className="flex gap-3 shrink-0">
                        <Button className="gap-2 shadow-sm" onClick={openCreate}>
                            <Plus className="w-4 h-4" />
                            {t("common.new")} type
                        </Button>
                    </div>
                </div>

                <ConfirmActionDialog
                    open={deleteDialogOpen}
                    onOpenChange={(open) => {
                        setDeleteDialogOpen(open);
                        if (!open) setDeleteTargetId(null);
                    }}
                    title="Supprimer ce type d'évaluation"
                    description={deleteTargetId ? "Cette action supprimera définitivement le type d'évaluation." : undefined}
                    confirmLabel={t("common.delete")}
                    cancelLabel={t("common.cancel")}
                    variant="destructive"
                    isConfirmLoading={!!deleting}
                    onConfirm={confirmDelete}
                />

                <Card className="border-border shadow-sm">
                    <CardContent className="p-0">
                        <div className="border-b border-border bg-muted/30 p-4 flex items-center gap-3 text-muted-foreground">
                            <Settings2 className="w-5 h-5" />
                            <p className="text-sm">
                                Ces types d'évaluation seront proposés aux enseignants lors de la création d'une nouvelle note.
                                Le &quot;Poids (Coefficient)&quot; est utilisé pour le calcul des moyennes pondérées.
                            </p>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : error ? (
                            <div className="p-6 text-center text-destructive">
                                Erreur lors du chargement des types d'évaluation.
                            </div>
                        ) : types && types.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                                {`Aucun type d'évaluation défini. Cliquez sur "${t("common.new")} type" pour commencer.`}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow>
                                        <TableHead className="w-[250px]">Libellé</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Poids (Coeff.)</TableHead>
                                        <TableHead>Nb max</TableHead>
                                        <TableHead>Statut</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(types || []).map((type) => (
                                        <TableRow key={type.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium text-foreground">
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                                                    {type.name}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono text-xs">{type.code}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-mono">x {Number(type.weight)}</Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {type.maxCount ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                {type.isActive ? (
                                                    <Badge variant="outline" className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))] font-normal">Actif</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-normal">Inactif</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(type)}>
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDelete(type.id)}
                                                        disabled={deleting === type.id}
                                                    >
                                                        {deleting === type.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Modifier le type" : `${t("common.new")} type d'évaluation`}</DialogTitle>
                        <DialogDescription>
                            {editingId
                                ? "Modifiez les informations du type d'évaluation."
                                : "Définissez un nouveau type d'évaluation pour votre établissement."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="eval-name">Nom</Label>
                            <Input
                                id="eval-name"
                                
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                            {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="eval-code">Code</Label>
                            <Input
                                id="eval-code"
                                
                                value={form.code}
                                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                maxLength={10}
                            />
                            {formErrors.code && <p className="text-xs text-destructive">{formErrors.code}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="eval-weight">Coefficient (poids)</Label>
                                <Input
                                    id="eval-weight"
                                    type="number"
                                    step="0.5"
                                    min="0.1"
                                    max="10"
                                    value={form.weight}
                                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                                />
                                {formErrors.weight && <p className="text-xs text-destructive">{formErrors.weight}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="eval-maxcount">Nb max (optionnel)</Label>
                                <Input
                                    id="eval-maxcount"
                                    type="number"
                                    min="1"
                                    
                                    value={form.maxCount}
                                    onChange={(e) => setForm({ ...form, maxCount: e.target.value })}
                                />
                                {formErrors.maxCount && <p className="text-xs text-destructive">{formErrors.maxCount}</p>}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                            {t("common.cancel")}
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {editingId ? t("common.save") : t("common.create")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageGuard>
    );
}
