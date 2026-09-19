import type { PrismaClient } from "@prisma/client";
import { getDbContext, rlsSettings, type DbContext } from "./db-context";

/**
 * Pose le contexte de la requête pour la transaction courante uniquement
 * (`set_config(…, true)` = portée transaction) : une connexion rendue au pool
 * ne garde aucun établissement.
 */
const SET_CONTEXT_SQL =
    "SELECT set_config('app.school_ids', $1, true), set_config('app.rls_bypass', $2, true)";

type RawExecutor = Pick<PrismaClient, "$executeRawUnsafe">;

function setContext(client: RawExecutor, context: DbContext) {
    return client.$executeRawUnsafe(SET_CONTEXT_SQL, ...rlsSettings(context));
}

/**
 * Paramètres internes transmis par Prisma aux extensions de requête : la
 * présence de `transaction` signale une opération déjà comprise dans une
 * transaction (interactive ou par lot) dont le contexte a été posé à
 * l'ouverture. Vérifié par `tests/integration-db/rls-effective.test.ts`, qui
 * échouerait si une version de Prisma cessait de le fournir.
 */
interface QueryParamsWithInternals {
    __internalParams?: { transaction?: unknown };
}

type TransactionArg = Parameters<PrismaClient["$transaction"]>[0];

/**
 * Client Prisma dont chaque opération s'exécute avec le contexte de la
 * requête (audit M2) :
 *
 * - opération isolée → transaction par lot `[set_config, opération]` ;
 * - `$transaction` (interactive ou par lot) → `set_config` en tête, les
 *   opérations qu'elle contient s'exécutent telles quelles ;
 * - aucun contexte → opération exécutée telle quelle : les politiques RLS
 *   masquent alors les tables sensibles.
 *
 * L'extension ne touche qu'au déroulement des requêtes, pas à l'API des
 * modèles : le type `PrismaClient` est conservé pour tout le code existant.
 */
export function createScopedClient(base: PrismaClient): PrismaClient {
    const extended = base.$extends({
        query: {
            async $allOperations(params) {
                const { args, query } = params;
                const inTransaction = Boolean((params as QueryParamsWithInternals).__internalParams?.transaction);
                const context = getDbContext();
                if (inTransaction || !context) return query(args);

                const [, result] = await base.$transaction([setContext(base, context), query(args)]);
                return result;
            },
        },
    });

    function scopedTransaction(arg: TransactionArg, options?: Parameters<PrismaClient["$transaction"]>[1]) {
        const context = getDbContext();

        if (typeof arg === "function") {
            return extended.$transaction(async (tx) => {
                if (context) await setContext(tx, context);
                return (arg as (client: unknown) => Promise<unknown>)(tx);
            }, options);
        }

        if (!context) return extended.$transaction(arg, options);

        return extended
            .$transaction([setContext(extended, context), ...arg], options)
            .then((results) => results.slice(1));
    }

    return new Proxy(extended, {
        get(target, property) {
            if (property === "$transaction") return scopedTransaction;
            return Reflect.get(target, property);
        },
    }) as unknown as PrismaClient;
}
