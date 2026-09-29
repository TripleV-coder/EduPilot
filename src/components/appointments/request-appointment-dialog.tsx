"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Options = {
    parentId: string;
    children: {
        studentId: string;
        name: string;
        className: string | null;
        teachers: { teacherId: string; name: string; subjects: string[]; isMainTeacher: boolean }[];
    }[];
};

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

/** Demande de rendez-vous d'un parent avec un enseignant de son enfant. */
export function RequestAppointmentDialog({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void | Promise<unknown>;
}) {
    const { toast } = useToast();
    const { data, error } = useSWR<Options>(open ? "/api/appointments/options" : null, fetcher);
    const [studentId, setStudentId] = useState("");
    const [teacherId, setTeacherId] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("16:00");
    const [type, setType] = useState("IN_PERSON");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    const child = useMemo(() => data?.children.find((c) => c.studentId === studentId) ?? data?.children[0], [data, studentId]);

    useEffect(() => {
        if (!child) return;
        setStudentId(child.studentId);
        if (!child.teachers.some((t) => t.teacherId === teacherId)) setTeacherId(child.teachers[0]?.teacherId ?? "");
    }, [child, teacherId]);

    const scheduledAt = date && time ? new Date(`${date}T${time}:00`) : null;
    const inFuture = scheduledAt !== null && scheduledAt.getTime() > Date.now();
    const valid = Boolean(data && child && teacherId && inFuture);

    const submit = async () => {
        if (!data || !child || !scheduledAt) return;
        setSaving(true);
        try {
            const res = await fetch("/api/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    teacherId,
                    parentId: data.parentId,
                    studentId: child.studentId,
                    scheduledAt: scheduledAt.toISOString(),
                    duration: 30,
                    type,
                    ...(notes.trim() && { notes: notes.trim() }),
                }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "La demande n'a pas été envoyée.");
            toast({ title: "Demande envoyée", description: "L'enseignant va confirmer le rendez-vous." });
            onOpenChange(false);
            setNotes("");
            await onCreated();
        } catch (err) {
            toast({ title: "Demande refusée", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Demander un rendez-vous</DialogTitle>
                    <DialogDescription>Rencontre de 30 minutes avec un enseignant de votre enfant.</DialogDescription>
                </DialogHeader>

                {error ? <p className="text-sm text-destructive">Impossible de charger vos enfants et leurs enseignants.</p> : null}
                {data && data.children.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun enfant n&apos;est rattaché à votre compte.</p>
                ) : null}

                {data && child ? (
                    <div className="space-y-4">
                        {data.children.length > 1 ? (
                            <div className="space-y-2">
                                <Label htmlFor="appointment-child">Enfant</Label>
                                <select id="appointment-child" className={selectClass} value={child.studentId} onChange={(e) => setStudentId(e.target.value)}>
                                    {data.children.map((c) => (
                                        <option key={c.studentId} value={c.studentId}>
                                            {c.name}{c.className ? ` · ${c.className}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                        <div className="space-y-2">
                            <Label htmlFor="appointment-teacher">Enseignant</Label>
                            <select id="appointment-teacher" className={selectClass} value={teacherId} onChange={(e) => setTeacherId(e.target.value)} disabled={child.teachers.length === 0}>
                                {child.teachers.length === 0 ? <option value="">Aucun enseignant affecté à la classe</option> : null}
                                {child.teachers.map((t) => (
                                    <option key={t.teacherId} value={t.teacherId}>
                                        {t.name}
                                        {t.isMainTeacher ? " · professeur principal" : ""}
                                        {t.subjects.length ? ` · ${t.subjects.join(", ")}` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="appointment-date">Date</Label>
                                <Input id="appointment-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="appointment-time">Heure</Label>
                                <Input id="appointment-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                            </div>
                        </div>
                        {date && !inFuture ? <p className="text-xs text-destructive">Choisissez une date et une heure à venir.</p> : null}
                        <div className="space-y-2">
                            <Label htmlFor="appointment-type">Format</Label>
                            <select id="appointment-type" className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
                                <option value="IN_PERSON">À l&apos;école</option>
                                <option value="PHONE_CALL">Par téléphone</option>
                                <option value="VIDEO_CALL">En visioconférence</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="appointment-notes">Objet (facultatif)</Label>
                            <Textarea id="appointment-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
                    <Button onClick={() => void submit()} disabled={!valid || saving}>Envoyer la demande</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
