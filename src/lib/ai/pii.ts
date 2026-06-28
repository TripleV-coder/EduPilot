/**
 * Pseudonymisation des données personnelles avant envoi à un LLM externe / n8n.
 *
 * Règle RGPD + politique IA EduPilot : aucune donnée nominative ne quitte le
 * système vers un service tiers (n8n, fournisseur LLM). On remplace le nom
 * réel de l'élève par ses initiales — suffisant pour une phrase de prompt
 * grammaticalement correcte, mais non ré-identifiant hors contexte interne.
 *
 * Le nom réel reste utilisé côté EduPilot (réponses, bulletins, UI) ; seules
 * les charges utiles sortantes sont pseudonymisées.
 */

function initial(value: string | null | undefined): string {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return "";
    // Première lettre alphabétique (gère les prénoms composés « Jean-Marc »)
    const match = trimmed.match(/\p{L}/u);
    return match ? match[0].toUpperCase() : "";
}

/**
 * Alias pseudonyme d'un élève à partir de son prénom/nom.
 * Ex. ("Koffi", "Adjovi") → "K. A." · noms manquants → "l'élève".
 */
export function studentAlias(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
): string {
    const f = initial(firstName);
    const l = initial(lastName);
    if (!f && !l) return "l'élève";
    return [f, l].filter(Boolean).map((c) => `${c}.`).join(" ");
}

/**
 * Variante acceptant un objet `user` (forme renvoyée par Prisma).
 */
export function studentAliasFromUser(student: {
    user?: { firstName?: string | null; lastName?: string | null } | null;
} | null | undefined): string {
    return studentAlias(student?.user?.firstName, student?.user?.lastName);
}
