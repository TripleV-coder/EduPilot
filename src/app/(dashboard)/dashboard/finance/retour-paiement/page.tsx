"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Block } from "@/components/edu-homes/home-kit";

/**
 * Retour après paiement en ligne (S4, 2026-10-18).
 *
 * Le fournisseur renvoie ici le navigateur. Ce retour ne prouve rien : seule
 * la référence est lue dans l'adresse, jamais un statut ; l'état affiché vient
 * de /api/payments/status, qui lit la base (confirmée par le webhook signé ou
 * la réconciliation). Tant que rien n'est confirmé, la page dit « en cours ».
 */
type PaymentStatus = {
    reference: string;
    status: "CONFIRMED" | "PENDING" | "FAILED" | "UNDER_REVIEW";
    amount: number;
    feeName: string;
    paidAt: string | null;
};

const MESSAGES: Record<PaymentStatus["status"], { title: string; text: string }> = {
    CONFIRMED: { title: "Paiement confirmé", text: "Le fournisseur a confirmé votre paiement. Il est enregistré sur le compte de votre enfant." },
    PENDING: { title: "Paiement en cours de traitement", text: "Nous attendons la confirmation du fournisseur. Cette page se met à jour toute seule. Ne relancez pas le paiement." },
    UNDER_REVIEW: { title: "Paiement en cours de vérification", text: "Le résultat n'est pas encore certain. L'établissement le vérifie. Ne relancez pas le paiement : vous seriez prélevé deux fois." },
    FAILED: { title: "Paiement non abouti", text: "Ce paiement n'a pas été effectué. Aucun montant n'a été enregistré. Vous pouvez réessayer ou régler à l'économat." },
};

const formatFcfa = (amount: number) =>
    new Intl.NumberFormat("fr-BJ", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(amount);

function PaymentReturn() {
    const reference = useSearchParams().get("ref");
    const { data, error } = useSWR<PaymentStatus>(
        reference ? `/api/payments/status?ref=${encodeURIComponent(reference)}` : null,
        fetcher,
        // Tant que ce n'est pas terminé, relecture toutes les 5 s
        { refreshInterval: (latest) => (latest && (latest.status === "CONFIRMED" || latest.status === "FAILED") ? 0 : 5000) },
    );

    if (!reference) return <p>Référence de paiement absente. Consultez vos paiements dans « Scolarité et paiements ».</p>;
    if (error) return <p>Ce paiement est introuvable ou ne vous concerne pas.</p>;
    if (!data) return <p role="status">Vérification du paiement…</p>;

    const message = MESSAGES[data.status];
    return (
        <div role="status" aria-live="polite" className="space-y-2">
            <h2 className="text-lg font-semibold">{message.title}</h2>
            <p>{message.text}</p>
            <p className="text-sm text-muted-foreground">
                {data.feeName} · {formatFcfa(data.amount)} · référence {data.reference}
            </p>
        </div>
    );
}

export default function PaymentReturnPage() {
    return (
        <PageShell>
            <PageHeader
                title="Retour de paiement"
                description="État de votre paiement, tel qu'enregistré par l'établissement."
                breadcrumbs={[{ label: "Scolarité et paiements", href: "/dashboard/finance" }, { label: "Retour de paiement" }]}
            />
            <Block id="payment-return" title="Votre paiement">
                <Suspense fallback={<p role="status">Vérification du paiement…</p>}>
                    <PaymentReturn />
                </Suspense>
                <Link href="/dashboard/finance" className="mt-4 inline-block underline">
                    Revenir à mes paiements
                </Link>
            </Block>
        </PageShell>
    );
}
