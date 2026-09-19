/**
 * Garde-fou : la suite d'intégration écrit et efface des données. Elle refuse
 * toute base qui ne se déclare pas jetable.
 *
 * - port 5432 refusé (base locale du développeur, convention du projet) ;
 * - nom de base obligatoirement suffixé `_test` ou `_it`.
 */
export function assertDisposableDatabaseUrl(rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL invalide.");
  }

  const port = url.port || "5432";
  if (port === "5432") {
    throw new Error(
      "Refus : la suite d'intégration ne tourne jamais sur le port 5432 (base locale). Utilisez un PostgreSQL jetable sur un autre port.",
    );
  }

  const database = url.pathname.replace(/^\//, "");
  if (!/_(test|it)$/.test(database)) {
    throw new Error(
      `Refus : la base « ${database} » n'est pas marquée jetable (suffixe _test ou _it attendu).`,
    );
  }
}
