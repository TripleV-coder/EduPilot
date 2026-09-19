/**
 * Garde-fou « argent réel » sur les paiements.
 *
 * Une école qui bascule en production le fait sciemment : mettre en circulation
 * de l'argent réel ne doit jamais être la conséquence d'une variable
 * d'environnement recopiée par inadvertance. Tant que `PAYMENTS_LIVE_ENABLED`
 * n'est pas explicitement à « true », toute configuration qui vise la
 * production est refusée **avant** le moindre appel au fournisseur : rien
 * n'est envoyé, aucun paiement n'est créé chez FedaPay ou MTN.
 *
 * Le bac à sable, lui, n'est jamais bloqué : le parcours complet (initiation →
 * webhook signé → VERIFIED) reste éprouvable sans rien activer.
 *
 * Variables :
 *   PAYMENTS_LIVE_ENABLED — "true" pour autoriser une configuration de
 *                           production. Toute autre valeur vaut refus.
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export interface LiveIndicator {
    /** Nom de la variable qui trahit une configuration de production. */
    variable: string;
    /** Valeur affichable — jamais le contenu d'un secret. */
    value: string;
}

/**
 * Indices d'une configuration qui viserait de l'argent réel.
 *
 * La détection ne se fie pas au seul `FEDAPAY_ENVIRONMENT` : une clé
 * `sk_live_…` laissée dans le fichier d'environnement suffit, même si
 * l'environnement déclaré dit « sandbox ».
 */
export function detectLiveIndicators(env: NodeJS.ProcessEnv = process.env): LiveIndicator[] {
    const indicators: LiveIndicator[] = [];

    if ((env.FEDAPAY_ENVIRONMENT ?? "").toLowerCase() === "live") {
        indicators.push({ variable: "FEDAPAY_ENVIRONMENT", value: "live" });
    }

    // La valeur n'est jamais reproduite : seul le préfixe est affiché.
    if ((env.FEDAPAY_SECRET_KEY ?? "").startsWith("sk_live")) {
        indicators.push({ variable: "FEDAPAY_SECRET_KEY", value: "sk_live_…" });
    }

    const momoTarget = env.MOMO_TARGET_ENVIRONMENT ?? "";
    if (momoTarget && momoTarget.toLowerCase() !== "sandbox") {
        indicators.push({ variable: "MOMO_TARGET_ENVIRONMENT", value: momoTarget });
    }

    const momoBase = env.MOMO_BASE_URL ?? "";
    if (momoBase && !momoBase.toLowerCase().includes("sandbox")) {
        indicators.push({ variable: "MOMO_BASE_URL", value: momoBase });
    }

    return indicators;
}

/** L'exploitant a-t-il explicitement autorisé l'argent réel ? */
export function isLivePaymentsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.PAYMENTS_LIVE_ENABLED === "true";
}

/** Dernière configuration déjà signalée : un seul journal par configuration. */
let lastWarned: string | null = null;

/**
 * À appeler en tête de toute route qui déclenche un paiement chez un
 * fournisseur. Renvoie `null` si l'initiation peut avoir lieu, sinon la
 * réponse 503 à retourner telle quelle.
 */
export function livePaymentsGuard(env: NodeJS.ProcessEnv = process.env): NextResponse | null {
    if (isLivePaymentsEnabled(env)) return null;

    const indicators = detectLiveIndicators(env);
    if (indicators.length === 0) return null;

    const signature = indicators.map((i) => i.variable).join(",");
    if (lastWarned !== signature) {
        lastWarned = signature;
        logger.warn("Paiements : configuration de production refusée (PAYMENTS_LIVE_ENABLED absent)", {
            indicators: indicators.map((i) => `${i.variable}=${i.value}`),
        });
    }

    return NextResponse.json(
        {
            error:
                "Les paiements en argent réel ne sont pas activés sur cette installation. " +
                "Définissez PAYMENTS_LIVE_ENABLED=true pour les autoriser.",
            code: "PAYMENTS_LIVE_DISABLED",
            indicators: indicators.map((i) => i.variable),
        },
        { status: 503 },
    );
}

/** Remet le journal à zéro (tests). */
export function resetLivePaymentsWarning(): void {
    lastWarned = null;
}
