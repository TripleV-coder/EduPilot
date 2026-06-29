"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { IdCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils/error-message";

type ClassItem = { id: string; name: string };

/** Dialogue de (re)génération des badges de tous les élèves d'une classe. */
export function BadgeRegenerateDialog() {
    const [open, setOpen] = useState(false);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [classId, setClassId] = useState("");
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!open) return;
        fetch("/api/classes?limit=200", { credentials: "include", cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (!d) return;
                const list: ClassItem[] = Array.isArray(d) ? d : d.data ?? d.classes ?? [];
                setClasses(list);
            })
            .catch(() => { /* ignore */ });
    }, [open]);

    const submit = async () => {
        if (!classId) {
            toast({ title: "Classe requise", description: "Sélectionne une classe.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/access-control/badges/regenerate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ classId }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Échec de la régénération");
            toast({ title: "Badges régénérés", description: `${body.regenerated} badge(s) émis pour la classe.` });
            setOpen(false);
            setClassId("");
        } catch (err) {
            toast({ title: "Erreur", description: getErrorMessage(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-2"><IdCard className="h-4 w-4" /> Régénérer badges classe</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Régénérer les badges d'une classe</DialogTitle>
                    <DialogDescription>
                        Émet un nouveau badge unique pour chaque élève actif de la classe. Les anciens codes sont remplacés.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                    <Label>Classe</Label>
                    <select
                        aria-label="Classe"
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                        <option value="">— Sélectionner —</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <DialogFooter>
                    <Button onClick={submit} disabled={saving || !classId} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
                        Régénérer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
