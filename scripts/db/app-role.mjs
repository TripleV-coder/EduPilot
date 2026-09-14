/**
 * Rôle PostgreSQL applicatif pour la RLS effective (audit M2).
 *
 * Source unique des instructions, utilisée par :
 *  - scripts/db/setup-app-role.mjs (exécuté par l'exploitant sur la base réelle) ;
 *  - tests/integration-db/global-setup.ts (base jetable).
 *
 * Résultat :
 *  - rôle applicatif : LOGIN, ni superutilisateur ni BYPASSRLS, ni propriétaire
 *    des tables → soumis aux politiques RLS ; droits de lecture/écriture sur
 *    les données, aucun sur l'historique des migrations ;
 *  - rôle propriétaire (migrations, sauvegardes, scripts de maintenance) :
 *    BYPASSRLS, sans quoi `pg_dump` échoue sur les tables sous FORCE RLS.
 *
 * Idempotent : peut être rejoué après chaque migration.
 */

/** Identifiant SQL simple : lettres minuscules, chiffres, souligné. */
export function assertRoleName(name, label) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(`${label} invalide : « ${name} » (lettres minuscules, chiffres et _ uniquement).`);
  }
}

/**
 * @param {{ $executeRawUnsafe: Function, $queryRawUnsafe: Function }} admin client connecté en superutilisateur
 * @param {{ appRole: string, appPassword: string, ownerRole: string }} options
 */
export async function setupAppRole(admin, { appRole, appPassword, ownerRole }) {
  assertRoleName(appRole, "Nom du rôle applicatif");
  assertRoleName(ownerRole, "Nom du rôle propriétaire");
  if (appRole === ownerRole) {
    throw new Error("Le rôle applicatif doit être distinct du propriétaire des tables.");
  }
  if (!appPassword || appPassword.length < 16) {
    throw new Error("Mot de passe du rôle applicatif absent ou trop court (16 caractères minimum).");
  }

  const [{ exists }] = await admin.$queryRawUnsafe(
    "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists",
    appRole,
  );
  if (!exists) await admin.$executeRawUnsafe(`CREATE ROLE ${appRole} LOGIN`);

  // Mot de passe passé en littéral échappé par PostgreSQL (format %L).
  const [{ sql }] = await admin.$queryRawUnsafe(
    "SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD %L', $1::text, $2::text) AS sql",
    appRole,
    appPassword,
  );
  await admin.$executeRawUnsafe(sql);

  const [{ db }] = await admin.$queryRawUnsafe("SELECT current_database() AS db");
  const statements = [
    `GRANT CONNECT ON DATABASE "${db}" TO ${appRole}`,
    `GRANT USAGE ON SCHEMA public TO ${appRole}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${appRole}`,
    `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${appRole}`,
    `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${appRole}`,
    `REVOKE ALL ON TABLE "_prisma_migrations" FROM ${appRole}`,
    // Tables créées plus tard par les migrations (propriétaire) : mêmes droits.
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${appRole}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${appRole}`,
    `ALTER ROLE ${ownerRole} BYPASSRLS`,
  ];
  for (const statement of statements) await admin.$executeRawUnsafe(statement);
}

/**
 * Vérification : le rôle applicatif est bien soumis à la RLS.
 * @returns {Promise<{ role: string, superuser: boolean, bypassRls: boolean }>}
 */
export async function describeRole(client, role) {
  const rows = await client.$queryRawUnsafe(
    "SELECT rolname AS role, rolsuper AS superuser, rolbypassrls AS \"bypassRls\" FROM pg_roles WHERE rolname = $1",
    role,
  );
  return rows[0];
}
