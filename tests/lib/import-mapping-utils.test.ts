import { describe, it, expect } from "vitest";
import {
  suggestMapping,
  applyMapping,
  ignoredColumnNotices,
  PARENT_EMAIL_NOTICE,
  STUDENT_FIELDS,
  TEACHER_FIELDS,
  CLASS_FIELDS,
  PARENT_FIELDS,
} from "@/lib/import/mapping-utils";

/**
 * N50 — la colonne « Email parent » de l'import des élèves était proposée,
 * acceptée, puis jamais utilisée (aucun rattachement, aucun avertissement).
 * Le rattachement passe par l'import « Parents » (matricule de l'enfant).
 */
describe("N50 — colonne « Email parent » à l'import des élèves", () => {
  it("n'est plus proposée comme champ des élèves", () => {
    expect(STUDENT_FIELDS.map((f) => f.key)).not.toContain("parentEmail");
  });

  it("n'est jamais rattachée à l'email de l'élève", () => {
    const headers = ["Email", "Email parent", "Parent email", "Email du parent", "Courriel tuteur"];
    const mapping = suggestMapping(headers, STUDENT_FIELDS);
    expect(mapping["Email"]).toBe("email");
    for (const header of headers.slice(1)) expect(mapping[header]).toBeUndefined();
  });

  it("est signalée à l'utilisateur, avec le chemin vers l'import des parents", () => {
    expect(ignoredColumnNotices(["Nom", "Prénom", "E-mail du Parent"], "STUDENTS")).toEqual([PARENT_EMAIL_NOTICE]);
    expect(PARENT_EMAIL_NOTICE).toMatch(/import « Parents »/);
  });

  it("reste l'email du parent lui-même dans l'import « Parents »", () => {
    expect(suggestMapping(["Email parent"], PARENT_FIELDS)["Email parent"]).toBe("email");
  });

  it("n'est pas non plus rattachée à l'email d'un enseignant ou d'un professeur principal", () => {
    expect(suggestMapping(["Email parent"], TEACHER_FIELDS)["Email parent"]).toBeUndefined();
    expect(suggestMapping(["Email parent"], CLASS_FIELDS)["Email parent"]).toBeUndefined();
  });

  it("ne signale rien pour un fichier sans cette colonne ni pour les autres imports", () => {
    expect(ignoredColumnNotices(["Nom", "Prénom", "Email"], "STUDENTS")).toEqual([]);
    expect(ignoredColumnNotices(["Nom", "Email parent"], "PARENTS")).toEqual([]);
  });
});

describe("suggestMapping", () => {
  it("mappe les correspondances exactes (clé ou label)", () => {
    const mapping = suggestMapping(["firstName", "Nom"], STUDENT_FIELDS);
    expect(mapping["firstName"]).toBe("firstName");
    expect(mapping["Nom"]).toBe("lastName");
  });

  it("reconnaît les alias français usuels", () => {
    const mapping = suggestMapping(
      ["Prénom", "nom de famille", "courriel", "né le", "sexe"],
      STUDENT_FIELDS
    );
    expect(mapping["Prénom"]).toBe("firstName");
    expect(mapping["nom de famille"]).toBe("lastName");
    expect(mapping["courriel"]).toBe("email");
    expect(mapping["né le"]).toBe("dateOfBirth");
    expect(mapping["sexe"]).toBe("gender");
  });

  it("tolère les fautes proches (similarité > 0.6)", () => {
    const mapping = suggestMapping(["telefone"], TEACHER_FIELDS);
    expect(mapping["telefone"]).toBe("phone");
  });

  it("n'invente pas de mapping pour un en-tête sans rapport", () => {
    const mapping = suggestMapping(["zzz_xyz_42"], STUDENT_FIELDS);
    expect(mapping["zzz_xyz_42"]).toBeUndefined();
  });

  it("fonctionne pour les classes et les parents", () => {
    expect(suggestMapping(["Niveau"], CLASS_FIELDS)["Niveau"]).toBe("level");
    expect(suggestMapping(["capacite"], CLASS_FIELDS)["capacite"]).toBe("capacity");
    expect(suggestMapping(["profession"], PARENT_FIELDS)["profession"]).toBe("job");
  });
});

describe("applyMapping", () => {
  it("renomme les colonnes selon le mapping et ignore les colonnes absentes", () => {
    const data = [
      { "Prénom": "Awa", "Nom": "Dossou", inutile: "x" },
      { "Prénom": "Bio" },
    ];
    const result = applyMapping(data, { "Prénom": "firstName", "Nom": "lastName" });

    expect(result[0]).toEqual({ firstName: "Awa", lastName: "Dossou" });
    expect(result[1]).toEqual({ firstName: "Bio" });
  });
});
