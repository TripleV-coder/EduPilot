"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button as EduButton } from "@/components/edu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type ReportTag = "ANONYME" | "PARENT" | "ENSEIGNANT" | "NOMINATIF";
type ReportSeverity = "P0" | "P1" | "P2";
type ReportStatus = "OPEN" | "IN_REVIEW" | "IN_FOLLOWUP" | "CLOSED";

const TAG_OPTIONS: { value: ReportTag; label: string }[] = [
    { value: "ENSEIGNANT", label: "Signalé par un enseignant" },
    { value: "PARENT", label: "Signalé par un parent" },
    { value: "NOMINATIF", label: "Nominatif (élève identifié)" },
    { value: "ANONYME", label: "Anonyme" },
];

const SEVERITY_OPTIONS: { value: ReportSeverity; label: string }[] = [
    { value: "P2", label: "P2 · Veille" },
    { value: "P1", label: "P1 · Suivi rapproché" },
    { value: "P0", label: "P0 · Urgence (CPS prévenu)" },
];

const STATUS_FLOW: { value: ReportStatus; label: string; next: ReportStatus | null }[] = [
    { value: "OPEN", label: "Ouvert", next: "IN_REVIEW" },
    { value: "IN_REVIEW", label: "En analyse", next: "IN_FOLLOWUP" },
    { value: "IN_FOLLOWUP", label: "Suivi en cours", next: "CLOSED" },
    { value: "CLOSED", label: "Clôturé", next: null },
];

/** Bouton + dialogue d'ouverture d'un dossier de signalement (P2.5). */
export function NewReportButton({ onCreated }: { onCreated: () => void }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tag, setTag] = useState<ReportTag>("ENSEIGNANT");
    const [severity, setSeverity] = useState<ReportSeverity>("P2");
    const [category, setCategory] = useState("");
    const [excerpt, setExcerpt] = useState("");

    const submit = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/wellbeing/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tag, severity, category, excerpt }),
            });
            const body = await res.json();
            if (!res.ok) {
                throw new Error(body.error || "Erreur lors de la création du dossier");
            }
            toast({ title: "Dossier ouvert", description: `Signalement « ${category} » enregistré.` });
            setOpen(false);
            setCategory("");
            setExcerpt("");
            onCreated();
        } catch (error) {
            toast({
                title: "Erreur",
                description: error instanceof Error ? error.message : "Erreur inattendue",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <EduButton icon="plus" onClick={() => setOpen(true)}>
                Nouveau dossier
            </EduButton>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Ouvrir un dossier de signalement</DialogTitle>
                        <DialogDescription>
                            Le dossier est enregistré au registre de la cellule d&apos;écoute et audité.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Source</label>
                                <Select value={tag} onValueChange={(value) => setTag(value as ReportTag)}>
                                    <SelectTrigger aria-label="Source du signalement">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TAG_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Gravité</label>
                                <Select
                                    value={severity}
                                    onValueChange={(value) => setSeverity(value as ReportSeverity)}
                                >
                                    <SelectTrigger aria-label="Gravité du signalement">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SEVERITY_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Catégorie</label>
                            <Input
                                value={category}
                                onChange={(event) => setCategory(event.target.value)}
                                placeholder="Ex : Harcèlement, Isolement, Conflit famille…"
                                aria-label="Catégorie du signalement"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Description courte</label>
                            <Textarea
                                value={excerpt}
                                onChange={(event) => setExcerpt(event.target.value)}
                                placeholder="Faits observés, sans données médicales (10 caractères minimum)"
                                rows={4}
                                aria-label="Description du signalement"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            type="button"
                            onClick={submit}
                            disabled={saving || category.trim().length < 2 || excerpt.trim().length < 10}
                        >
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Ouvrir le dossier
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

interface DossierReport {
    id: string;
    tag: string;
    category: string;
    excerpt: string;
    severity: ReportSeverity;
    severityLabel: string | null;
    status: ReportStatus;
    createdAt: string;
}

/** Bouton « Dossier » : détail du signalement + avancement du statut (P2.5). */
export function ReportDossierButton({
    report,
    onUpdated,
}: {
    report: DossierReport;
    onUpdated: () => void;
}) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const current = STATUS_FLOW.find((step) => step.value === report.status) ?? STATUS_FLOW[0];
    const next = STATUS_FLOW.find((step) => step.value === current.next) ?? null;

    const advance = async (status: ReportStatus) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/wellbeing/reports/${report.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            const body = await res.json();
            if (!res.ok) {
                throw new Error(body.error || "Erreur lors de la mise à jour");
            }
            toast({
                title: "Dossier mis à jour",
                description: `Statut : ${STATUS_FLOW.find((step) => step.value === status)?.label}.`,
            });
            setOpen(false);
            onUpdated();
        } catch (error) {
            toast({
                title: "Erreur",
                description: error instanceof Error ? error.message : "Erreur inattendue",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <EduButton variant="ghost" size="sm" iconRight="arrowRight" onClick={() => setOpen(true)}>
                Dossier
            </EduButton>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            Dossier · {report.category}
                        </DialogTitle>
                        <DialogDescription>
                            {report.severityLabel ?? report.severity} · {current.label} · ouvert le{" "}
                            {new Date(report.createdAt).toLocaleDateString("fr-FR")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-sm">
                        <p className="rounded-md border bg-muted/30 p-3 leading-relaxed">{report.excerpt}</p>
                        <p className="text-xs text-muted-foreground">
                            Source : {report.tag} — chaque changement de statut est consigné au journal
                            d&apos;audit.
                        </p>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Fermer
                        </Button>
                        {next ? (
                            <Button type="button" onClick={() => advance(next.value)} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Passer à « {next.label} »
                            </Button>
                        ) : null}
                        {report.status !== "CLOSED" && next?.value !== "CLOSED" ? (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => advance("CLOSED")}
                                disabled={saving}
                            >
                                Clôturer
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
