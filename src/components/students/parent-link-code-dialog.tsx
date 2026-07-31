"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { KeyRound, Copy, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils/error-message";

interface GeneratedCode {
    code: string;
    studentName: string;
    expiresAt: string;
}

/**
 * Bouton + dialogue pour émettre un code de liaison parent-enfant.
 * Le code en clair n'est affiché qu'une fois (à la génération) : il est ensuite
 * stocké haché côté serveur. À remettre au parent (carnet de liaison / SMS).
 */
export function ParentLinkCodeDialog({ studentId }: { studentId: string }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState<GeneratedCode | null>(null);
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    const generate = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/students/${studentId}/link-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                cache: "no-store",
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Échec de la génération du code");
            setGenerated(body);
            setCopied(false);
        } catch (err) {
            toast({ title: "Erreur", description: getErrorMessage(err), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const copy = async () => {
        if (!generated) return;
        try {
            await navigator.clipboard.writeText(generated.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard indisponible : le code reste lisible à l'écran */
        }
    };

    const onOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) setGenerated(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase gap-2">
                    <KeyRound className="h-3.5 w-3.5" />
                    Code parent
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Code de liaison parent</DialogTitle>
                    <DialogDescription>
                        Émet un code à usage unique (valable 14 jours) que le parent saisira pour
                        rattacher cet élève à son compte. Tout code précédent non utilisé est annulé.
                    </DialogDescription>
                </DialogHeader>

                {generated ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
                            <span className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground">
                                {generated.code}
                            </span>
                            <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5">
                                {copied ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                                {copied ? "Copié" : "Copier"}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Pour {generated.studentName} · expire le{" "}
                            {new Date(generated.expiresAt).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                            })}
                            . Notez-le : il ne sera plus affiché.
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Cliquez sur « Générer » pour créer un nouveau code de liaison.
                    </p>
                )}

                <DialogFooter>
                    <Button onClick={generate} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        {generated ? "Régénérer un code" : "Générer le code"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
