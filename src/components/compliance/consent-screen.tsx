"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getErrorMessage } from "@/lib/utils/error-message";
import type { PendingConsent } from "@/lib/security/consent";

/**
 * Acceptation des conditions et de la politique de confidentialité, demandée à
 * la première connexion et à chaque nouvelle version (Lot 6).
 *
 * Un parent répond en même temps pour chacun de ses enfants rattachés : le
 * choix qu'il fait pour lui est repris par défaut pour chaque enfant
 * (décision du propriétaire du 2026-09-14), et reste modifiable enfant par
 * enfant. Rien n'est enregistré tant qu'il n'a pas validé.
 */
export function ConsentScreen({ pending }: { pending: PendingConsent }) {
    const router = useRouter();
    const [accepted, setAccepted] = React.useState(false);
    const [children, setChildren] = React.useState<Record<string, boolean>>(() =>
        Object.fromEntries(pending.children.map((c) => [c.studentId, c.granted ?? false])),
    );
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Le choix fait pour soi est repris pour chaque enfant tant qu'il n'a pas
    // été modifié individuellement.
    const touched = React.useRef<Set<string>>(new Set());
    React.useEffect(() => {
        setChildren((prev) => {
            const next = { ...prev };
            for (const c of pending.children) {
                if (!touched.current.has(c.studentId) && c.granted === null) next[c.studentId] = accepted;
            }
            return next;
        });
    }, [accepted, pending.children]);

    async function submit() {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/compliance/consents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    acceptTerms: true,
                    ...(pending.children.length > 0 ? { children } : {}),
                }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Enregistrement impossible");
            router.refresh();
        } catch (e) {
            setError(getErrorMessage(e));
            setSaving(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h1 className="text-center text-xl font-semibold text-foreground">Avant de continuer</h1>
                <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
                    Merci de prendre connaissance des conditions d&apos;utilisation et de la politique de
                    confidentialité. Votre acceptation est enregistrée avec sa date et la version du document
                    (version {pending.termsVersion}).
                </p>

                <div className="mt-6 space-y-4">
                    <label className="flex items-start gap-3 text-sm">
                        <Checkbox
                            checked={accepted}
                            onCheckedChange={(v) => setAccepted(v === true)}
                            aria-label="J'accepte les conditions d'utilisation et la politique de confidentialité"
                        />
                        <span>
                            J&apos;ai lu et j&apos;accepte les{" "}
                            <Link href="/terms" target="_blank" className="underline">conditions d&apos;utilisation</Link> et la{" "}
                            <Link href="/privacy" target="_blank" className="underline">politique de confidentialité</Link>.
                        </span>
                    </label>

                    {pending.children.length > 0 && (
                        <div className="rounded-lg border border-border p-4">
                            <p className="text-sm font-medium">Données de vos enfants</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                En tant que parent, vous répondez pour chaque enfant qui vous est rattaché. Vous
                                pouvez revenir sur ce choix à tout moment depuis « Mes données ».
                            </p>
                            <div className="mt-3 space-y-3">
                                {pending.children.map((c) => (
                                    <label key={c.studentId} className="flex items-start gap-3 text-sm">
                                        <Checkbox
                                            checked={children[c.studentId] === true}
                                            onCheckedChange={(v) => {
                                                touched.current.add(c.studentId);
                                                setChildren((prev) => ({ ...prev, [c.studentId]: v === true }));
                                            }}
                                            aria-label={`Autoriser le traitement des données de ${c.firstName} ${c.lastName}`}
                                        />
                                        <span>
                                            J&apos;autorise le traitement des données scolaires de{" "}
                                            <strong>{c.firstName} {c.lastName}</strong>.
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>
                )}

                <Button className="mt-6 w-full" disabled={!accepted || saving} onClick={submit}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Continuer"}
                </Button>
            </div>
        </div>
    );
}
