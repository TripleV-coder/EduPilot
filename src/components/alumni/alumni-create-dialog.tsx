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
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils/error-message";

const FIELDS = ["Médecine", "Tech", "Droit", "Business", "Énergie", "Autre"] as const;

/** Dialogue de création d'un ancien élève (annuaire alumni). */
export function AlumniCreateDialog({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [graduationYear, setGraduationYear] = useState(String(new Date().getFullYear()));
    const [series, setSeries] = useState("");
    const [field, setField] = useState<(typeof FIELDS)[number]>("Autre");
    const [currentRole, setCurrentRole] = useState("");
    const [company, setCompany] = useState("");
    const [isMentor, setIsMentor] = useState(false);
    const [mentorTopic, setMentorTopic] = useState("");

    const reset = () => {
        setFirstName(""); setLastName(""); setGraduationYear(String(new Date().getFullYear()));
        setSeries(""); setField("Autre"); setCurrentRole(""); setCompany("");
        setIsMentor(false); setMentorTopic("");
    };

    const submit = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            toast({ title: "Champs requis", description: "Prénom et nom sont obligatoires.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/alumni", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    graduationYear: Number(graduationYear),
                    series: series.trim() || undefined,
                    field,
                    currentRole: currentRole.trim() || undefined,
                    company: company.trim() || undefined,
                    isMentor,
                    mentorTopic: mentorTopic.trim() || undefined,
                }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Échec de l'enregistrement");
            toast({ title: "Ancien élève ajouté", description: `${firstName} ${lastName} · promo ${graduationYear}` });
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
                <Button size="sm" className="gap-2">
                    <UserPlus className="h-4 w-4" /> Nouvel alumni
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Ajouter un ancien élève</DialogTitle>
                    <DialogDescription>Renseigne le profil pour l'annuaire et le mentorat.</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label>Prénom *</Label>
                        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Nom *</Label>
                        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Année de sortie (BAC)</Label>
                        <Input type="number" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Série</Label>
                        <Input value={series} onChange={(e) => setSeries(e.target.value)} placeholder="D, C, A1…" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Domaine</Label>
                        <select
                            aria-label="Domaine"
                            value={field}
                            onChange={(e) => setField(e.target.value as (typeof FIELDS)[number])}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Employeur</Label>
                        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Orange Bénin…" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                        <Label>Poste actuel</Label>
                        <Input value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} placeholder="Tech Lead, Chirurgienne…" />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                        <input
                            id="alumni-mentor"
                            type="checkbox"
                            checked={isMentor}
                            onChange={(e) => setIsMentor(e.target.checked)}
                            className="h-4 w-4 rounded border-input"
                        />
                        <Label htmlFor="alumni-mentor" className="cursor-pointer">Disponible pour du mentorat</Label>
                    </div>
                    {isMentor && (
                        <div className="col-span-2 space-y-1.5">
                            <Label>Sujet de mentorat</Label>
                            <Input value={mentorTopic} onChange={(e) => setMentorTopic(e.target.value)} placeholder="Étudiants Série D, orientation tech…" />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={submit} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                        Enregistrer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
