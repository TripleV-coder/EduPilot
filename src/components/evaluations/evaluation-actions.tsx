"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";

export interface EditableEvaluation {
    id: string;
    title: string | null;
    /** Date ISO de l'évaluation. */
    date: string;
    maxGrade: number;
    coefficient: number;
    /** Notes déjà saisies (annoncées avant la suppression). */
    gradedCount: number;
}

function toDateInput(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * Corriger ou supprimer une évaluation depuis le cahier (enseignant de la
 * matière). Les verrous (année clôturée, conseil validé, barème sous une note
 * saisie) sont tenus par le serveur, dont le message est affiché tel quel.
 */
export function EvaluationActions({ evaluation, onChanged }: { evaluation: EditableEvaluation; onChanged: () => void }) {
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [title, setTitle] = useState(evaluation.title ?? "");
    const [date, setDate] = useState(toDateInput(evaluation.date));
    const [maxGrade, setMaxGrade] = useState(String(evaluation.maxGrade));
    const [coefficient, setCoefficient] = useState(String(evaluation.coefficient));

    const openEdit = () => {
        setTitle(evaluation.title ?? "");
        setDate(toDateInput(evaluation.date));
        setMaxGrade(String(evaluation.maxGrade));
        setCoefficient(String(evaluation.coefficient));
        setEditOpen(true);
    };

    const maxNumber = Number(maxGrade.replace(",", "."));
    const coefNumber = Number(coefficient.replace(",", "."));
    const invalid = !date || !(maxNumber >= 1 && maxNumber <= 100) || !(coefNumber >= 0.1 && coefNumber <= 10);

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (invalid) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/evaluations/${evaluation.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title.trim() || null, date, maxGrade: maxNumber, coefficient: coefNumber }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error || "L'évaluation n'a pas été modifiée.");
                return;
            }
            toast.success("Évaluation modifiée. Les moyennes sont recalculées si besoin.");
            setEditOpen(false);
            onChanged();
        } catch {
            toast.error("Connexion impossible : l'évaluation n'a pas été modifiée.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            // Confirmation déjà donnée dans la boîte : les notes partent avec l'évaluation
            const res = await fetch(`/api/evaluations/${evaluation.id}?confirm=true`, { method: "DELETE" });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error || "L'évaluation n'a pas été supprimée.");
                return;
            }
            toast.success("Évaluation supprimée.");
            setDeleteOpen(false);
            onChanged();
        } catch {
            toast.error("Connexion impossible : l'évaluation n'a pas été supprimée.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openEdit}>
                Modifier l&apos;évaluation
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
                Supprimer
            </Button>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <form onSubmit={save} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Modifier l&apos;évaluation</DialogTitle>
                            <DialogDescription>
                                Changer le barème ou le coefficient recalcule les moyennes de la classe.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-1.5">
                            <Label htmlFor={`ev-title-${evaluation.id}`}>Titre (facultatif)</Label>
                            <Input id={`ev-title-${evaluation.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`ev-date-${evaluation.id}`}>Date</Label>
                            <Input id={`ev-date-${evaluation.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor={`ev-max-${evaluation.id}`}>Noté sur</Label>
                                <Input id={`ev-max-${evaluation.id}`} inputMode="decimal" value={maxGrade} onChange={(e) => setMaxGrade(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={`ev-coef-${evaluation.id}`}>Coefficient</Label>
                                <Input id={`ev-coef-${evaluation.id}`} inputMode="decimal" value={coefficient} onChange={(e) => setCoefficient(e.target.value)} />
                            </div>
                        </div>
                        {invalid ? (
                            <p className="text-xs text-destructive">Barème entre 1 et 100, coefficient entre 0,1 et 10, date obligatoire.</p>
                        ) : null}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={invalid || busy}>
                                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                                Enregistrer
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Supprimer cette évaluation ?"
                description={
                    evaluation.gradedCount > 0
                        ? `Les ${evaluation.gradedCount} note(s) déjà saisie(s) seront supprimées avec elle et les moyennes recalculées. Cette action est tracée.`
                        : "Aucune note n'est encore saisie. Cette action est tracée."
                }
                confirmLabel="Supprimer"
                variant="destructive"
                isConfirmLoading={busy}
                onConfirm={remove}
            />
        </div>
    );
}
