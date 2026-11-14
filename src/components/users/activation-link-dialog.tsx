"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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

export interface ActivationTarget {
    id: string;
    name: string;
    email: string;
}

interface IssuedLink {
    link: string;
    expiresAt: string;
    emailSent: boolean;
    email: string;
}

/**
 * Émission du lien d'activation d'un compte pas encore activé
 * (POST /api/users/[id]/activation-link). Le lien est affiché après l'envoi :
 * la direction peut le transmettre elle-même si l'e-mail n'est pas parti ou
 * n'est pas consulté.
 */
export function ActivationLinkDialog({
    target,
    onOpenChange,
}: {
    target: ActivationTarget | null;
    onOpenChange: (open: boolean) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [issued, setIssued] = useState<IssuedLink | null>(null);
    const [copied, setCopied] = useState(false);

    const close = (open: boolean) => {
        if (open) return;
        setIssued(null);
        setCopied(false);
        onOpenChange(false);
    };

    const issue = async () => {
        if (!target) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/users/${target.id}/activation-link`, { method: "POST" });
            const body = (await res.json().catch(() => ({}))) as Partial<IssuedLink> & { error?: string };
            if (!res.ok || !body.link || !body.expiresAt) {
                toast.error(body.error || "Le lien d'activation n'a pas été émis.");
                return;
            }
            setIssued({ link: body.link, expiresAt: body.expiresAt, emailSent: body.emailSent === true, email: body.email ?? target.email });
            if (body.emailSent) toast.success("Lien d'activation envoyé.");
        } catch {
            toast.error("Connexion impossible : le lien n'a pas été émis.");
        } finally {
            setBusy(false);
        }
    };

    const copy = async () => {
        if (!issued) return;
        try {
            await navigator.clipboard.writeText(issued.link);
            setCopied(true);
            toast.success("Lien copié.");
        } catch {
            toast.error("Copie impossible : sélectionnez le lien et copiez-le à la main.");
        }
    };

    return (
        <Dialog open={target !== null} onOpenChange={close}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Lien d&apos;activation</DialogTitle>
                    <DialogDescription>
                        {target ? `${target.name} · ${target.email}` : null}
                    </DialogDescription>
                </DialogHeader>

                {issued ? (
                    <div className="space-y-4">
                        <p
                            role="status"
                            className={
                                issued.emailSent
                                    ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                                    : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
                            }
                        >
                            {issued.emailSent
                                ? `Le lien a été envoyé par e-mail à ${issued.email}.`
                                : "L'e-mail n'a pas pu partir. Transmettez ce lien vous-même (SMS, WhatsApp…) à la personne concernée uniquement."}
                        </p>
                        <div className="space-y-1.5">
                            <Label htmlFor="activation-link">Lien à usage unique</Label>
                            <div className="flex gap-2">
                                <Input id="activation-link" value={issued.link} readOnly onFocus={(e) => e.currentTarget.select()} />
                                <Button type="button" variant="outline" onClick={copy} aria-label="Copier le lien">
                                    {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Valable jusqu&apos;au {format(new Date(issued.expiresAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}. Il
                                permet de choisir le mot de passe du compte : ne le partagez avec personne d&apos;autre.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button type="button" onClick={() => close(false)}>Terminé</Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Ce compte n&apos;est pas encore activé. Un lien valable 72 heures sera envoyé à son adresse
                            e-mail : la personne y choisit directement son mot de passe. Les liens envoyés auparavant
                            et non utilisés ne fonctionneront plus.
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>Annuler</Button>
                            <Button type="button" onClick={issue} disabled={busy}>
                                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                                Envoyer le lien
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
