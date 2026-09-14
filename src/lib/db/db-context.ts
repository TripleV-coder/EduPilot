import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexte de base de données d'une unité de travail (requête HTTP, tâche de
 * fond, cron) — audit M2, RLS effective.
 *
 * Il est transmis à PostgreSQL au début de chaque transaction (voir
 * `scoped-client.ts`) et lu par les politiques RLS des tables sensibles :
 *
 * - `tenant` : seules les lignes des établissements listés sont visibles et
 *   modifiables ;
 * - `system` : contexte déclaré explicitement (connexion, crons, webhooks
 *   signés, super-administrateur), sans restriction d'établissement.
 *
 * Sans contexte, rien n'est transmis : les tables couvertes apparaissent
 * vides et toute écriture y est refusée (fermée par défaut).
 */
export type DbContext =
    | { kind: "tenant"; schoolIds: readonly string[] }
    | { kind: "system"; reason: string };

const storage = new AsyncLocalStorage<DbContext>();

export function getDbContext(): DbContext | undefined {
    return storage.getStore();
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return typeof value === "object" && value !== null && typeof (value as PromiseLike<unknown>).then === "function";
}

/**
 * Les requêtes Prisma sont paresseuses : `() => prisma.grade.findMany()`
 * renvoie une promesse qui ne part qu'au premier `then`, souvent appelé par un
 * `await` situé HORS de la portée du contexte — la requête s'exécuterait alors
 * sans contexte (tables sensibles fermées). Le `then` est donc appelé ici,
 * dans la portée, et la requête part avec le bon contexte.
 */
function withinScope<T>(fn: () => T): T {
    const result = fn();
    if (!isPromiseLike(result)) return result;
    return new Promise((resolve, reject) => {
        result.then(resolve, reject);
    }) as T;
}

export function runWithDbContext<T>(context: DbContext | null | undefined, fn: () => T): T {
    if (!context) return storage.exit(() => withinScope(fn));
    return storage.run(context, () => withinScope(fn));
}

export function tenantContext(schoolIds: Iterable<string | null | undefined>): DbContext {
    const ids = Array.from(new Set(Array.from(schoolIds).filter((id): id is string => typeof id === "string" && id.length > 0)));
    return { kind: "tenant", schoolIds: ids };
}

/**
 * Exécute `fn` sans restriction d'établissement. Réservé aux traitements qui
 * ne sont pas rattachés à une école par construction ; `reason` documente
 * l'usage et le rend recherchable (`runAsSystem("webhook:fedapay", …)`).
 */
export function runAsSystem<T>(reason: string, fn: () => T): T {
    return storage.run({ kind: "system", reason }, () => withinScope(fn));
}

/**
 * Valeurs transmises à PostgreSQL : `app.school_ids` (identifiants séparés
 * par des virgules — les cuid n'en contiennent pas) et `app.rls_bypass`.
 */
export function rlsSettings(context: DbContext): [schoolIds: string, bypass: "on" | "off"] {
    if (context.kind === "system") return ["", "on"];
    return [context.schoolIds.join(","), "off"];
}
