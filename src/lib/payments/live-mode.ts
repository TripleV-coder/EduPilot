/**
 * Garde-fou « argent réel » sur les paiements.
 *
 * Une école qui bascule en production le fait sciemment : tant que
 * `PAYMENTS_LIVE_ENABLED` n'est pas explicitement à « true », seuls les
 * comptes marchands d'école en environnement SANDBOX sont utilisés
 * (school-accounts.collectingEnvironment) ; un compte LIVE n'est jamais
 * sollicité, et on ne peut pas en activer (school-account-admin).
 *
 * 2026-11-08 : les clés de paiement globales (FEDAPAY_*, MOMO_*) ont disparu
 * avec les comptes par école ; le contrôle de ces variables, qui ne pouvait
 * plus rien bloquer, est retiré avec elles.
 */
export function isLivePaymentsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.PAYMENTS_LIVE_ENABLED === "true";
}
