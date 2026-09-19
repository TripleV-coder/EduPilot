/**
 * Données sensibles à tracer (Lot 6 — traçabilité).
 *
 * Toute **modification** et toute **consultation** de notes, de santé, de
 * paiements ou de rôles laisse une trace dans `AuditLog`. La trace est posée
 * une seule fois, au passage central (`createApiHandler`) : aucune route ne
 * peut l'oublier.
 *
 * Les consultations sont dédupliquées sur une courte fenêtre : sans cela, la
 * revalidation automatique des écrans (SWR) écrirait des centaines de lignes
 * identiques par heure et par personne, et le journal deviendrait illisible.
 *
 * Module sans dépendance : testable seul.
 */

export type SensitiveCategory = "grades" | "health" | "payments" | "roles";

interface SensitiveArea {
    category: SensitiveCategory;
    /** Entité écrite dans le journal. */
    entity: string;
    /** Chemins couverts, relatifs à `/api/`, comparés segment par segment. */
    prefixes: string[];
}

const AREAS: ReadonlyArray<SensitiveArea> = [
    {
        category: "grades",
        entity: "Grade",
        prefixes: ["grades", "bulletins", "competences"],
    },
    {
        category: "health",
        entity: "MedicalRecord",
        // Jamais "health" seul : /api/health est le contrôle de santé du serveur (H1).
        prefixes: ["health/medical-records", "health/vaccinations", "health/emergency-contacts", "medical-records", "wellbeing"],
    },
    {
        category: "payments",
        entity: "Payment",
        prefixes: ["payments", "payment-plans"],
    },
    {
        category: "roles",
        entity: "User",
        prefixes: ["users", "root/users"],
    },
];

function segments(pathname: string): string[] {
    const normalized = pathname.split("?")[0].replace(/\/+$/, "");
    if (normalized !== "/api" && !normalized.startsWith("/api/")) return [];
    const rest = normalized.slice("/api".length).replace(/^\/+/, "");
    return rest ? rest.split("/") : [];
}

function covers(prefix: string, parts: string[]): boolean {
    const wanted = prefix.split("/");
    if (wanted.length > parts.length) return false;
    return wanted.every((segment, i) => segment === parts[i]);
}

/** Zone sensible d'une route d'API, ou `null`. */
export function sensitiveAreaForPath(pathname: string): SensitiveArea | null {
    const parts = segments(pathname);
    if (parts.length === 0) return null;
    return AREAS.find((area) => area.prefixes.some((prefix) => covers(prefix, parts))) ?? null;
}

/** Dernier segment ressemblant à un identifiant, pour situer la trace. */
export function entityIdFromPath(pathname: string): string | undefined {
    const parts = segments(pathname);
    for (let i = parts.length - 1; i >= 0; i -= 1) {
        const part = parts[i];
        if (/^[a-z0-9]{20,}$/i.test(part)) return part;
    }
    return undefined;
}

/** Fenêtre de déduplication des consultations (ms). */
export const READ_DEDUP_MS = 5 * 60_000;

const recentReads = new Map<string, number>();

/**
 * Faut-il écrire une trace pour cette consultation ? Vrai une fois par
 * personne, par chemin et par fenêtre.
 */
export function shouldLogRead(key: string, now = Date.now()): boolean {
    const last = recentReads.get(key);
    if (last !== undefined && now - last < READ_DEDUP_MS) return false;

    // Ménage : la table ne grandit pas indéfiniment.
    if (recentReads.size > 5_000) {
        for (const [k, at] of recentReads) {
            if (now - at >= READ_DEDUP_MS) recentReads.delete(k);
        }
    }
    recentReads.set(key, now);
    return true;
}

export function resetReadDedup(): void {
    recentReads.clear();
}
