"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";
import { useDebounce } from "@/hooks/use-debounce";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Assigned = { id: string; matricule: string | null; name: string; direction: "OUTBOUND" | "RETURN" | "BOTH" };
type Candidate = { id: string; matricule: string | null; user: { firstName: string; lastName: string } };

const DIRECTION_LABEL: Record<Assigned["direction"], string> = { OUTBOUND: "Aller", RETURN: "Retour", BOTH: "Aller et retour" };

/**
 * Élèves d'une ligne de transport : liste, inscription (recherche par nom ou
 * matricule) et retrait. Aucune inscription n'était possible jusqu'ici.
 */
export function LineStudentsDialog({
    lineId,
    lineNumber,
    open,
    onOpenChange,
    onChanged,
}: {
    lineId: string;
    lineNumber: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChanged: () => void;
}) {
    const { data, error, mutate } = useSWR<{ students: Assigned[] }>(open ? `/api/transport/lines/${lineId}/students` : null, fetcher);
    const [search, setSearch] = useState("");
    const debounced = useDebounce(search, 300);
    const { data: candidates } = useSWR<{ data: Candidate[] }>(
        open && debounced.trim().length >= 2 ? `/api/students?search=${encodeURIComponent(debounced.trim())}&limit=8` : null,
        fetcher,
    );
    const [direction, setDirection] = useState<Assigned["direction"]>("BOTH");
    const [busy, setBusy] = useState<string | null>(null);

    useEffect(() => {
        if (!open) setSearch("");
    }, [open]);

    const assignedIds = new Set((data?.students ?? []).map((s) => s.id));

    const call = async (method: "POST" | "DELETE", studentId: string) => {
        setBusy(studentId);
        try {
            const res = method === "POST"
                ? await fetch(`/api/transport/lines/${lineId}/students`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ studentId, direction }),
                  })
                : await fetch(`/api/transport/lines/${lineId}/students?studentId=${encodeURIComponent(studentId)}`, { method: "DELETE" });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error || "La ligne n'a pas été mise à jour.");
                return;
            }
            toast.success(method === "POST" ? "Élève inscrit sur la ligne." : "Élève retiré de la ligne.");
            await mutate();
            onChanged();
        } catch {
            toast.error("Connexion impossible : la ligne n'a pas été mise à jour.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Élèves de la ligne {lineNumber}</DialogTitle>
                    <DialogDescription>Inscrivez les élèves transportés et le sens du trajet.</DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <Input
                            aria-label="Rechercher un élève par nom ou matricule"
                            placeholder="Nom ou matricule (2 lettres minimum)"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 min-w-[200px]"
                        />
                        <select
                            aria-label="Sens du trajet"
                            value={direction}
                            onChange={(e) => setDirection(e.target.value as Assigned["direction"])}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="BOTH">Aller et retour</option>
                            <option value="OUTBOUND">Aller</option>
                            <option value="RETURN">Retour</option>
                        </select>
                    </div>
                    {(candidates?.data ?? []).filter((c) => !assignedIds.has(c.id)).map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                            <span>{c.user.firstName} {c.user.lastName}{c.matricule ? ` · ${c.matricule}` : ""}</span>
                            <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => void call("POST", c.id)}>Inscrire</Button>
                        </div>
                    ))}
                </div>

                <div className="mt-2 space-y-2">
                    <p className="text-sm font-semibold">Inscrits ({data?.students.length ?? 0})</p>
                    {error ? <p className="text-sm text-destructive" role="alert">Liste indisponible : réessayez.</p> : null}
                    {data && data.students.length === 0 ? <p className="text-sm text-muted-foreground">Aucun élève inscrit sur cette ligne.</p> : null}
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                        {(data?.students ?? []).map((s) => (
                            <li key={s.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                                <span>{s.name}{s.matricule ? ` · ${s.matricule}` : ""} — {DIRECTION_LABEL[s.direction]}</span>
                                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === s.id} onClick={() => void call("DELETE", s.id)}>
                                    Retirer
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            </DialogContent>
        </Dialog>
    );
}
