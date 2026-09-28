"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type StudentHit = { id: string; matricule?: string | null; user: { firstName: string; lastName: string } };

const TYPES: { value: string; label: string }[] = [
    { value: "MERIT", label: "Mérite" },
    { value: "NEED_BASED", label: "Aide sociale" },
    { value: "ATHLETIC", label: "Sportive" },
    { value: "PARTIAL", label: "Partielle" },
    { value: "FULL", label: "Totale" },
    { value: "OTHER", label: "Autre" },
];

const today = () => new Date().toISOString().slice(0, 10);

/** Attribution d'une bourse à un élève (POST /api/scholarships). */
export function NewScholarshipDialog({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void | Promise<unknown>;
}) {
    const { toast } = useToast();
    const [search, setSearch] = useState("");
    const [hits, setHits] = useState<StudentHit[]>([]);
    const [student, setStudent] = useState<StudentHit | null>(null);
    const [name, setName] = useState("");
    const [type, setType] = useState("NEED_BASED");
    const [mode, setMode] = useState<"percentage" | "amount">("percentage");
    const [value, setValue] = useState("");
    const [startDate, setStartDate] = useState(today());
    const [endDate, setEndDate] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) {
            setSearch("");
            setHits([]);
            setStudent(null);
            setName("");
            setType("NEED_BASED");
            setMode("percentage");
            setValue("");
            setStartDate(today());
            setEndDate("");
            setNotes("");
        }
    }, [open]);

    useEffect(() => {
        if (student || search.trim().length < 2) {
            setHits([]);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            fetch(`/api/students?search=${encodeURIComponent(search.trim())}&limit=8`, { signal: controller.signal })
                .then((res) => (res.ok ? res.json() : { data: [] }))
                .then((body) => setHits(Array.isArray(body) ? body : body.data ?? []))
                .catch(() => undefined);
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [search, student]);

    const numeric = Number(value);
    const valid =
        student !== null &&
        name.trim().length >= 3 &&
        Number.isFinite(numeric) &&
        numeric > 0 &&
        (mode === "amount" || (Number.isInteger(numeric) && numeric <= 100)) &&
        (!endDate || endDate >= startDate);

    const submit = async () => {
        if (!student) return;
        setSaving(true);
        try {
            const res = await fetch("/api/scholarships", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: student.id,
                    name: name.trim(),
                    type,
                    ...(mode === "amount" ? { amount: numeric } : { percentage: numeric }),
                    startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
                    ...(endDate && { endDate: new Date(`${endDate}T00:00:00.000Z`).toISOString() }),
                    ...(notes.trim() && { notes: notes.trim() }),
                }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "La bourse n'a pas été enregistrée.");
            toast({ title: "Bourse attribuée", description: `${student.user.firstName} ${student.user.lastName} et sa famille sont notifiés.` });
            onOpenChange(false);
            await onCreated();
        } catch (err) {
            toast({ title: "Bourse refusée", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Nouvelle bourse</DialogTitle>
                    <DialogDescription>L&apos;élève et ses parents reçoivent une notification.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="scholarship-student">Élève</Label>
                        {student ? (
                            <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                                <span>
                                    {student.user.firstName} {student.user.lastName}
                                    {student.matricule ? ` · ${student.matricule}` : ""}
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => setStudent(null)}>Changer</Button>
                            </div>
                        ) : (
                            <>
                                <Input
                                    id="scholarship-student"
                                    placeholder="Nom ou matricule (2 lettres minimum)"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    autoComplete="off"
                                />
                                {hits.length > 0 && (
                                    <ul className="max-h-40 overflow-y-auto rounded-md border border-border" role="listbox" aria-label="Élèves trouvés">
                                        {hits.map((hit) => (
                                            <li key={hit.id}>
                                                <button
                                                    type="button"
                                                    role="option"
                                                    aria-selected={false}
                                                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                                                    onClick={() => setStudent(hit)}
                                                >
                                                    {hit.user.firstName} {hit.user.lastName}
                                                    {hit.matricule ? <span className="text-muted-foreground"> · {hit.matricule}</span> : null}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="scholarship-name">Intitulé</Label>
                        <Input id="scholarship-name" placeholder="Ex : Bourse d'excellence 2026-2027" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="scholarship-type">Type</Label>
                            <select
                                id="scholarship-type"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                {TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="scholarship-mode">Prise en charge</Label>
                            <select
                                id="scholarship-mode"
                                value={mode}
                                onChange={(e) => setMode(e.target.value as "percentage" | "amount")}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="percentage">Pourcentage des frais</option>
                                <option value="amount">Montant fixe (FCFA)</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="scholarship-value">{mode === "amount" ? "Montant (FCFA)" : "Pourcentage (1 à 100)"}</Label>
                        <Input id="scholarship-value" type="number" min={1} max={mode === "amount" ? undefined : 100} value={value} onChange={(e) => setValue(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="scholarship-start">Début</Label>
                            <Input id="scholarship-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="scholarship-end">Fin (facultatif)</Label>
                            <Input id="scholarship-end" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="scholarship-notes">Observations (facultatif)</Label>
                        <Textarea id="scholarship-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
                    <Button onClick={() => void submit()} disabled={!valid || saving}>Attribuer la bourse</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
