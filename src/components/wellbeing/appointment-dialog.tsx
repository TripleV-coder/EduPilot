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
import { APPOINTMENT_KIND_SUGGESTIONS } from "@/lib/wellbeing/appointments";

const pad = (n: number) => String(n).padStart(2, "0");
/** Valeur par défaut d'un <input type="datetime-local"> : demain 9 h, heure locale. */
function tomorrowNine(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

/** Planifier un rendez-vous de la cellule d'écoute (POST /api/wellbeing/appointments). */
export function AppointmentDialog({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
}) {
    const [startAt, setStartAt] = useState(tomorrowNine);
    const [duration, setDuration] = useState(30);
    const [kind, setKind] = useState<string>(APPOINTMENT_KIND_SUGGESTIONS[0]);
    const [label, setLabel] = useState("");
    const [urgent, setUrgent] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        try {
            const res = await fetch("/api/wellbeing/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    // datetime-local = heure locale du poste ; envoyée en ISO (UTC)
                    startAt: new Date(startAt).toISOString(),
                    durationMinutes: duration,
                    kind: kind.trim(),
                    anonymousLabel: label.trim() || null,
                    isUrgent: urgent,
                }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error || "Le rendez-vous n'a pas été planifié.");
                return;
            }
            toast.success("Rendez-vous planifié.");
            setLabel("");
            setUrgent(false);
            onCreated();
        } catch {
            toast.error("Connexion impossible : le rendez-vous n'a pas été planifié.");
        } finally {
            setBusy(false);
        }
    };

    const invalid = !startAt || Number.isNaN(new Date(startAt).getTime()) || kind.trim().length < 2;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Planifier un rendez-vous</DialogTitle>
                        <DialogDescription>
                            Anonyme par défaut : indiquez un libellé (« Anonyme · 3ᵉ A ») plutôt qu&apos;un nom.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px]">
                        <div className="space-y-1.5">
                            <Label htmlFor="appt-start">Date et heure</Label>
                            <Input id="appt-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="appt-duration">Durée (min)</Label>
                            <Input
                                id="appt-duration"
                                type="number"
                                min={10}
                                max={180}
                                step={5}
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="appt-kind">Type de rendez-vous</Label>
                        <Input id="appt-kind" list="appt-kind-options" value={kind} onChange={(e) => setKind(e.target.value)} maxLength={60} required />
                        <datalist id="appt-kind-options">
                            {APPOINTMENT_KIND_SUGGESTIONS.map((k) => <option key={k} value={k} />)}
                        </datalist>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="appt-label">Libellé (facultatif)</Label>
                        <Input id="appt-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Anonyme · 3ᵉ A" />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-4 w-4" />
                        Situation urgente (affichée en priorité)
                    </label>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
                        <Button type="submit" disabled={invalid || busy}>
                            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            Planifier
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
