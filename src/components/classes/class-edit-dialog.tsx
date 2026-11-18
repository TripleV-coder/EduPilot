"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface EditableClass {
    id: string;
    name: string;
    classLevelId: string;
    capacity: number | null;
    mainTeacherId: string | null;
}

type Level = { id: string; name: string };
type TeacherOption = { id: string; user: { firstName: string; lastName: string } };

const NO_TEACHER = "__none__";

/**
 * Modification d'une classe (nom, niveau, capacité, professeur principal) via
 * PATCH /api/classes/[id]. Le serveur refuse une capacité inférieure au nombre
 * d'inscrits ou un nom déjà pris : son message est affiché tel quel.
 */
export function ClassEditDialog({
    value,
    teachers,
    open,
    onOpenChange,
    onSaved,
}: {
    value: EditableClass;
    teachers: TeacherOption[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (updated: Record<string, unknown>) => void;
}) {
    const { data: levels, error: levelsError } = useSWR<Level[]>(open ? "/api/class-levels" : null, fetcher);
    const [name, setName] = useState(value.name);
    const [levelId, setLevelId] = useState(value.classLevelId);
    const [capacity, setCapacity] = useState(value.capacity ? String(value.capacity) : "");
    const [teacherId, setTeacherId] = useState(value.mainTeacherId ?? NO_TEACHER);
    const [saving, setSaving] = useState(false);

    // Valeurs fraîches à chaque ouverture (la classe a pu changer entre-temps)
    useEffect(() => {
        if (!open) return;
        setName(value.name);
        setLevelId(value.classLevelId);
        setCapacity(value.capacity ? String(value.capacity) : "");
        setTeacherId(value.mainTeacherId ?? NO_TEACHER);
    }, [open, value]);

    const capacityNumber = capacity.trim() ? Number(capacity) : null;
    const capacityInvalid = capacityNumber !== null && (!Number.isInteger(capacityNumber) || capacityNumber < 1);
    const canSave = name.trim().length > 0 && !capacityInvalid && !saving;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSave) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/classes/${value.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    classLevelId: levelId,
                    ...(capacityNumber !== null ? { capacity: capacityNumber } : {}),
                    mainTeacherId: teacherId === NO_TEACHER ? null : teacherId,
                }),
            });
            const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
            if (!res.ok) {
                toast.error(body.error || "La classe n'a pas été modifiée.");
                return;
            }
            toast.success("Classe modifiée.");
            onSaved(body);
            onOpenChange(false);
        } catch {
            toast.error("Connexion impossible : la classe n'a pas été modifiée.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Modifier la classe</DialogTitle>
                        <DialogDescription>Nom, niveau, capacité et professeur principal.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-1.5">
                        <Label htmlFor="class-name">Nom</Label>
                        <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="class-level">Niveau</Label>
                        <Select value={levelId} onValueChange={setLevelId}>
                            <SelectTrigger id="class-level"><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
                            <SelectContent>
                                {(levels ?? []).map((level) => (
                                    <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {levelsError ? <p className="text-xs text-destructive">Niveaux indisponibles : le niveau actuel est conservé.</p> : null}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="class-capacity">Capacité (facultatif)</Label>
                        <Input
                            id="class-capacity"
                            inputMode="numeric"
                            value={capacity}
                            onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ""))}
                            aria-invalid={capacityInvalid}
                        />
                        {capacityInvalid ? <p className="text-xs text-destructive">Indiquez un nombre entier supérieur à zéro.</p> : null}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="class-teacher">Professeur principal</Label>
                        <Select value={teacherId} onValueChange={setTeacherId}>
                            <SelectTrigger id="class-teacher"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_TEACHER}>Aucun</SelectItem>
                                {teachers.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Annuler
                        </Button>
                        <Button type="submit" disabled={!canSave}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
