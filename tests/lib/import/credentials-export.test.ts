import { describe, expect, it } from "vitest";
import { buildCredentialsExport, readImportCredentials } from "@/lib/import/credentials-export";

/**
 * M1 — chaque compte importé reçoit un mot de passe provisoire unique ; la
 * réponse de l'import les renvoie une seule fois, et l'écran propose de les
 * télécharger (CSV) pour les transmettre aux titulaires.
 */
const CREDENTIALS = [
  { row: 2, email: "awa@ecole.bj", firstName: "Awa", lastName: "Dossou", provisionalPassword: "HKMP-4728" },
  { row: 3, email: "kofi@ecole.bj", firstName: "Kofi", lastName: "Adjovi", provisionalPassword: "TRZW-5932" },
];

describe("identifiants provisoires d'un import", () => {
  it("lit les identifiants à la racine de la réponse (imports élèves, enseignants, parents, générique, groupé)", () => {
    expect(readImportCredentials({ created: 2, credentials: CREDENTIALS })).toEqual(CREDENTIALS);
  });

  it("ignore une réponse sans identifiants ou mal formée", () => {
    expect(readImportCredentials({ created: 0 })).toEqual([]);
    expect(readImportCredentials(null)).toEqual([]);
    expect(readImportCredentials({ credentials: [{ email: "x@y.bj" }] })).toEqual([]);
  });

  it("construit un export CSV : une ligne par compte, avec le mot de passe provisoire", () => {
    const data = buildCredentialsExport(CREDENTIALS, "élèves");

    expect(data.title).toBe("identifiants-provisoires-eleves");
    expect(data.headers).toEqual(["Ligne du fichier", "Nom", "Prénom", "Email", "Mot de passe provisoire"]);
    expect(data.rows).toEqual([
      [2, "Dossou", "Awa", "awa@ecole.bj", "HKMP-4728"],
      [3, "Adjovi", "Kofi", "kofi@ecole.bj", "TRZW-5932"],
    ]);
  });
});
