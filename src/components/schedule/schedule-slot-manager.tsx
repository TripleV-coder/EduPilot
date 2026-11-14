"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { DAYS_OF_WEEK } from "@/lib/validations/schedule";
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

export interface ManagedSlot {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string | null;
    class?: { name: string } | null;
    classSubject?: { subject?: { name?: string } | null } | null;
}

const dayLabel = (day: number) => DAYS_OF_WEEK.find((d) => d.value === day)?.label ?? `Jour ${day}`;
// Lundi → dimanche (0 = dimanche, rangé en dernier)
const dayRank = (day: number) => (day === 0 ? 7 : day);

/**
 * Liste des créneaux affichés, avec modification et suppression (direction).
 * Les chevauchements (classe ou enseignant) sont refusés par le serveur, dont le
 * message est affiché tel quel.
 */
export function ScheduleSlotManager({ slots, onChanged }: { slots: ManagedSlot[]; onChanged: () => void }) {
    const [editing, setEditing] = useState<ManagedSlot | null>(null);
    const [deleting, setDeleting] = useState<ManagedSlot | null>(null);
    const [busy, setBusy] = useState(false);
    const [day, setDay] = useState(1);
    const [start, setStart] = useState("08:00");
    const [end, setEnd] = useState("09:00");
    const [room, setRoom] = useState("");

    const sorted = useMemo(
        () => [...slots].sort((a, b) => dayRank(a.dayOfWeek) - dayRank(b.dayOfWeek) || a.startTime.localeCompare(b.startTime)),
        [slots],
    );

    const openEdit = (slot: ManagedSlot) => {
        setDay(slot.dayOfWeek);
        setStart(slot.startTime);
        setEnd(slot.endTime);
        setRoom(slot.room ?? "");
        setEditing(slot);
    };

    const invalid = !start || !end || end <= start;

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!editing || invalid) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/schedules/${editing.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dayOfWeek: day, startTime: start, endTime: end, room: room.trim() || null }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error || "Le créneau n'a pas été modifié.");
                return;
            }
            toast.success("Créneau modifié.");
            setEditing(null);
            onChanged();
        } catch {
            toast.error("Connexion impossible : le créneau n'a pas été modifié.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!deleting) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/schedules/${deleting.id}`, { method: "DELETE" });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error || "Le créneau n'a pas été supprimé.");
                return;
            }
            toast.success("Créneau supprimé.");
            setDeleting(null);
            onChanged();
        } catch {
            toast.error("Connexion impossible : le créneau n'a pas été supprimé.");
        } finally {
            setBusy(false);
        }
    };

    if (sorted.length === 0) return null;

    return (
        <section aria-labelledby="slot-manager-title" className="space-y-2">
            <h2 id="slot-manager-title" className="text-sm font-semibold">Gérer les créneaux</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                        <tr>
                            <th scope="col" className="px-3 py-2 font-medium">Jour</th>
                            <th scope="col" className="px-3 py-2 font-medium">Horaire</th>
                            <th scope="col" className="px-3 py-2 font-medium">Classe</th>
                            <th scope="col" className="px-3 py-2 font-medium">Matière</th>
                            <th scope="col" className="px-3 py-2 font-medium">Salle</th>
                            <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((slot) => (
                            <tr key={slot.id} className="border-t border-border">
                                <td className="px-3 py-2">{dayLabel(slot.dayOfWeek)}</td>
                                <td className="px-3 py-2 tabular-nums">{slot.startTime} – {slot.endTime}</td>
                                <td className="px-3 py-2">{slot.class?.name ?? "—"}</td>
                                <td className="px-3 py-2">{slot.classSubject?.subject?.name ?? "—"}</td>
                                <td className="px-3 py-2">{slot.room || "—"}</td>
                                <td className="px-3 py-2">
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(slot)}>Modifier</Button>
                                        <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setDeleting(slot)}>Supprimer</Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Dialog open={editing !== null} onOpenChange={(open) => (open ? null : setEditing(null))}>
                <DialogContent className="sm:max-w-md">
                    <form onSubmit={save} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Modifier le créneau</DialogTitle>
                            <DialogDescription>
                                {editing ? `${editing.class?.name ?? "Classe"} · ${editing.classSubject?.subject?.name ?? "Sans matière"}` : null}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-1.5">
                            <Label htmlFor="slot-day">Jour</Label>
                            <select
                                id="slot-day"
                                value={day}
                                onChange={(e) => setDay(Number(e.target.value))}
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                                {DAYS_OF_WEEK.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="slot-start">Début</Label>
                                <Input id="slot-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="slot-end">Fin</Label>
                                <Input id="slot-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
                            </div>
                        </div>
                        {invalid ? <p className="text-xs text-destructive">L&apos;heure de fin doit être après l&apos;heure de début.</p> : null}
                        <div className="space-y-1.5">
                            <Label htmlFor="slot-room">Salle (facultatif)</Label>
                            <Input id="slot-room" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={50} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy}>Annuler</Button>
                            <Button type="submit" disabled={invalid || busy}>
                                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                                Enregistrer
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={deleting !== null}
                onOpenChange={(open) => (open ? null : setDeleting(null))}
                title="Supprimer ce créneau ?"
                description={deleting ? `${dayLabel(deleting.dayOfWeek)} ${deleting.startTime} – ${deleting.endTime} · ${deleting.class?.name ?? ""}` : undefined}
                confirmLabel="Supprimer"
                variant="destructive"
                isConfirmLoading={busy}
                onConfirm={remove}
            />
        </section>
    );
}
