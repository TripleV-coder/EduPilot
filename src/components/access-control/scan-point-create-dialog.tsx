"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils/error-message";

const TYPES: Array<{ value: string; label: string }> = [
    { value: "GATE", label: "Portail / entrée" },
    { value: "CANTEEN", label: "Cantine" },
    { value: "TRANSPORT", label: "Transport" },
    { value: "LIBRARY", label: "Bibliothèque" },
    { value: "INFIRMARY", label: "Infirmerie" },
];

/** Dialogue de création d'un point de scan. */
export function ScanPointCreateDialog({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [type, setType] = useState("GATE");
    const [location, setLocation] = useState("");
    const { toast } = useToast();

    const reset = () => { setName(""); setType("GATE"); setLocation(""); };

    const submit = async () => {
        if (!name.trim()) {
            toast({ title: "Nom requis", description: "Donne un nom au point de scan.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/access-control/scan-points", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name: name.trim(), type, location: location.trim() || undefined }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Échec de la création");
            toast({ title: "Point de scan créé", description: name.trim() });
            reset();
            setOpen(false);
            onCreated();
        } catch (err) {
            toast({ title: "Erreur", description: getErrorMessage(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nouveau point de scan</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nouveau point de scan</DialogTitle>
                    <DialogDescription>Portail, cantine, transport, bibliothèque ou infirmerie.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label>Nom *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Portail principal" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Type</Label>
                        <select
                            aria-label="Type de point de scan"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Emplacement (optionnel)</Label>
                        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bâtiment A, RDC" />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={submit} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Créer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
