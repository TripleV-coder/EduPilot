import { afterAll, describe, expect, it } from "vitest";
import ownerDb from "./owner-db";
import { uniqueCode } from "./helpers";
import {
  DISPOSABLE_MARKER,
  assertDisposableDatabase,
  markDatabaseDisposable,
  readDatabaseMarker,
} from "../../scripts/lib/disposable-guard.mjs";

/**
 * Règle 6 / N17 — les scripts qui effacent ou injectent des données (seeds,
 * réinitialisations de comptes, préparation des E2E) refusent toute base qui
 * ne porte pas le marqueur de base jetable, posé sur la base elle-même.
 * Vérifié sur un vrai PostgreSQL : le marqueur est un commentaire de base.
 */
async function clearMarker() {
  const [{ sql }] = await ownerDb.$queryRawUnsafe<Array<{ sql: string }>>(
    "SELECT format('COMMENT ON DATABASE %I IS NULL', current_database()) AS sql",
  );
  await ownerDb.$executeRawUnsafe(sql);
}

afterAll(clearMarker);

describe("N17 — verrou des scripts dangereux", () => {
  it("une base sans marqueur est refusée", async () => {
    await clearMarker();
    expect((await readDatabaseMarker(ownerDb)).marker).toBeNull();
    await expect(assertDisposableDatabase(ownerDb, "seed")).rejects.toThrow(/n'est pas marquée jetable/);
  });

  it("une base qui contient des comptes n'est pas marquée sans déclaration explicite", async () => {
    await clearMarker();
    await ownerDb.user.create({
      data: { email: `${uniqueCode("compte")}@integration.test`, password: "x", firstName: "Compte", lastName: "Réel", role: "TEACHER" },
    });
    await expect(markDatabaseDisposable(ownerDb)).rejects.toThrow(/contient déjà \d+ compte/);
    expect((await readDatabaseMarker(ownerDb)).marker).toBeNull();
  });

  it("une base de test déclarée est marquée, puis acceptée", async () => {
    await clearMarker();
    await markDatabaseDisposable(ownerDb, { allowNonEmpty: true });
    expect((await readDatabaseMarker(ownerDb)).marker).toBe(DISPOSABLE_MARKER);
    await expect(assertDisposableDatabase(ownerDb, "seed")).resolves.toEqual(expect.any(String));
  });

  it("un autre commentaire de base ne vaut pas marqueur", async () => {
    const [{ sql }] = await ownerDb.$queryRawUnsafe<Array<{ sql: string }>>(
      "SELECT format('COMMENT ON DATABASE %I IS %L', current_database(), 'base de production') AS sql",
    );
    await ownerDb.$executeRawUnsafe(sql);
    await expect(assertDisposableDatabase(ownerDb, "reset-passwords")).rejects.toThrow(/n'est pas marquée jetable/);
  });
});
