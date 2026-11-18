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

type FieldValue = string | number | boolean | null | undefined;

export type EditField =
    | { name: string; label: string; type: "text" | "textarea"; required?: boolean; maxLength?: number; nullable?: boolean }
    | { name: string; label: string; type: "number"; required?: boolean; min?: number; max?: number; integer?: boolean }
    | { name: string; label: string; type: "date" | "time"; required?: boolean }
    | { name: string; label: string; type: "select"; options: { value: string; label: string }[] }
    | { name: string; label: string; type: "checkbox" };

function toInput(field: EditField, value: FieldValue): string | boolean {
    if (field.type === "checkbox") return Boolean(value);
    if (value === null || value === undefined) return "";
    if (field.type === "date") {
        const d = new Date(String(value));
        return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    return String(value);
}

/**
 * Modifier / Supprimer une ressource par son adresse d'API (PATCH et DELETE).
 * N'envoie que les champs changés ; un refus du serveur (409 : données
 * rattachées, année clôturée…) est affiché tel quel, car il dit quoi faire.
 */
export function ResourceActions({
    endpoint,
    resourceLabel,
    fields,
    initial,
    onChanged,
    canDelete = true,
    deleteDescription,
    onDeleted,
}: {
    /** Adresse de la ressource, ex. /api/library/books/abc. */
    endpoint: string;
    /** Libellé lisible, ex. « l'ouvrage Le Petit Prince ». */
    resourceLabel: string;
    fields: EditField[];
    initial: Record<string, FieldValue>;
    onChanged: () => void;
    canDelete?: boolean;
    deleteDescription?: string;
    /** Après une suppression (ex. revenir à la liste) ; sinon onChanged. */
    onDeleted?: () => void;
}) {
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [values, setValues] = useState<Record<string, string | boolean>>({});

    const openEdit = () => {
        setValues(Object.fromEntries(fields.map((f) => [f.name, toInput(f, initial[f.name])])));
        setEditOpen(true);
    };

    const errors = fields.flatMap((f) => {
        const v = values[f.name];
        if (f.type === "checkbox" || f.type === "select") return [];
        const text = typeof v === "string" ? v.trim() : "";
        if ("required" in f && f.required && !text) return [`${f.label} : obligatoire.`];
        if (f.type === "number" && text) {
            const n = Number(text.replace(",", "."));
            if (Number.isNaN(n)) return [`${f.label} : nombre attendu.`];
            if (f.integer && !Number.isInteger(n)) return [`${f.label} : nombre entier attendu.`];
            if (f.min !== undefined && n < f.min) return [`${f.label} : au moins ${f.min}.`];
            if (f.max !== undefined && n > f.max) return [`${f.label} : au plus ${f.max}.`];
        }
        return [];
    });

    const changes = () => {
        const out: Record<string, FieldValue> = {};
        for (const f of fields) {
            const v = values[f.name];
            if (v === toInput(f, initial[f.name])) continue;
            if (f.type === "checkbox") out[f.name] = Boolean(v);
            else if (f.type === "number") out[f.name] = String(v).trim() ? Number(String(v).replace(",", ".")) : null;
            else {
                const text = String(v).trim();
                out[f.name] = text ? text : f.type === "text" || f.type === "textarea" ? (f.nullable === false ? "" : null) : null;
            }
        }
        return out;
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (errors.length) return;
        const body = changes();
        if (Object.keys(body).length === 0) {
            setEditOpen(false);
            return;
        }
        setBusy(true);
        try {
            const res = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const data = (await res.json().catch(() => ({}))) as { error?: unknown };
            if (!res.ok) {
                toast.error(typeof data.error === "string" ? data.error : "La modification n'a pas été enregistrée.");
                return;
            }
            toast.success("Modification enregistrée.");
            setEditOpen(false);
            onChanged();
        } catch {
            toast.error("Connexion impossible : la modification n'a pas été enregistrée.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            const res = await fetch(endpoint, { method: "DELETE" });
            const data = (await res.json().catch(() => ({}))) as { error?: unknown };
            if (!res.ok) {
                toast.error(typeof data.error === "string" ? data.error : "La suppression n'a pas eu lieu.");
                return;
            }
            toast.success("Supprimé.");
            setDeleteOpen(false);
            (onDeleted ?? onChanged)();
        } catch {
            toast.error("Connexion impossible : la suppression n'a pas eu lieu.");
        } finally {
            setBusy(false);
        }
    };

    const idFor = (name: string) => `ra-${endpoint.replace(/[^a-z0-9]/gi, "-")}-${name}`;

    return (
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            <Button type="button" variant="outline" size="sm" onClick={openEdit}>Modifier</Button>
            {canDelete ? (
                <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
                    Supprimer
                </Button>
            ) : null}

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <form onSubmit={save} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Modifier</DialogTitle>
                            <DialogDescription>{resourceLabel}</DialogDescription>
                        </DialogHeader>
                        {fields.map((f) => {
                            const v = values[f.name];
                            if (f.type === "checkbox") {
                                return (
                                    <label key={f.name} className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={Boolean(v)} onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.checked }))} />
                                        {f.label}
                                    </label>
                                );
                            }
                            return (
                                <div key={f.name} className="space-y-1.5">
                                    <Label htmlFor={idFor(f.name)}>{f.label}</Label>
                                    {f.type === "select" ? (
                                        <select
                                            id={idFor(f.name)}
                                            value={String(v ?? "")}
                                            onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        >
                                            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    ) : f.type === "textarea" ? (
                                        <textarea
                                            id={idFor(f.name)}
                                            value={String(v ?? "")}
                                            maxLength={f.maxLength}
                                            onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                                            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        />
                                    ) : (
                                        <Input
                                            id={idFor(f.name)}
                                            type={f.type === "number" ? "text" : f.type}
                                            inputMode={f.type === "number" ? "decimal" : undefined}
                                            value={String(v ?? "")}
                                            maxLength={f.type === "text" ? f.maxLength : undefined}
                                            onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                                        />
                                    )}
                                </div>
                            );
                        })}
                        {errors.length ? <p className="text-xs text-destructive" role="alert">{errors[0]}</p> : null}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>Annuler</Button>
                            <Button type="submit" disabled={busy || errors.length > 0}>
                                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                                Enregistrer
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {canDelete ? (
                <ConfirmActionDialog
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                    title="Confirmer la suppression"
                    description={deleteDescription ?? `${resourceLabel} sera supprimé(e). Si des données y sont rattachées, la suppression sera refusée et le motif affiché.`}
                    confirmLabel="Supprimer"
                    variant="destructive"
                    isConfirmLoading={busy}
                    onConfirm={remove}
                />
            ) : null}
        </div>
    );
}
