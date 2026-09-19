/**
 * Verrou des scripts dangereux (règle 6 de la remédiation, constat N17).
 *
 * Seeds de démonstration, réinitialisations de comptes, préparation des E2E :
 * tout script qui efface ou injecte des données refuse de s'exécuter sur une
 * base qui ne porte pas le MARQUEUR de base jetable. Le marqueur est posé sur
 * la base elle-même — un commentaire PostgreSQL, invisible pour Prisma et
 * pour `prisma migrate diff` :
 *
 *   COMMENT ON DATABASE "<nom>" IS 'edupilot:disposable'
 *
 * Une base réelle ne le porte jamais : elle est refusée par défaut, quel que
 * soit NODE_ENV, le port ou le nom de la base. Le marqueur ne se pose que par
 * `scripts/db/mark-disposable.mjs` (ou l'outillage des bases jetables), qui
 * refuse une base contenant déjà des comptes sauf déclaration explicite.
 */

export const DISPOSABLE_MARKER = "edupilot:disposable";

/**
 * @typedef {{ $queryRawUnsafe: (sql: string, ...values: unknown[]) => Promise<any>, $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<any> }} RawClient
 */

/** Commentaire de la base courante (null si absent). @param {RawClient} client */
export async function readDatabaseMarker(client) {
  const rows = await client.$queryRawUnsafe(
    "SELECT current_database() AS name, shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = current_database()",
  );
  return { name: rows[0]?.name ?? "?", marker: rows[0]?.marker ?? null };
}

/**
 * Refuse de continuer si la base n'est pas marquée jetable.
 * @param {RawClient} client
 * @param {string} script nom du script, pour le message
 */
export async function assertDisposableDatabase(client, script) {
  const { name, marker } = await readDatabaseMarker(client);
  if (marker !== DISPOSABLE_MARKER) {
    throw new Error(
      `Refus (${script}) : la base « ${name} » n'est pas marquée jetable. Ce script efface ou injecte des données ` +
        `et ne s'exécute jamais sur une base réelle. Pour une base de test UNIQUEMENT : ` +
        `node scripts/db/mark-disposable.mjs (voir scripts/quality/README.md).`,
    );
  }
  return name;
}

/**
 * Pose le marqueur. Refuse une base qui contient déjà des comptes, sauf
 * `allowNonEmpty` (base de test déjà peuplée, déclarée comme telle).
 * @param {RawClient} client
 * @param {{ allowNonEmpty?: boolean }} [options]
 */
export async function markDatabaseDisposable(client, options = {}) {
  const { name } = await readDatabaseMarker(client);
  const [{ exists }] = await client.$queryRawUnsafe(
    "SELECT to_regclass('public.users') IS NOT NULL AS exists",
  );
  if (exists && !options.allowNonEmpty) {
    const [{ count }] = await client.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "users"');
    if (count > 0) {
      throw new Error(
        `Refus : la base « ${name} » contient déjà ${count} compte(s). Une base peuplée n'est marquée jetable ` +
          `que par déclaration explicite (--allow-non-empty), jamais une base réelle.`,
      );
    }
  }
  const [{ sql }] = await client.$queryRawUnsafe(
    "SELECT format('COMMENT ON DATABASE %I IS %L', current_database(), $1::text) AS sql",
    DISPOSABLE_MARKER,
  );
  await client.$executeRawUnsafe(sql);
  return name;
}
