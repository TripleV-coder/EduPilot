import { describe, it, expect } from "vitest";
import {
  suggestMapping,
  applyMapping,
  STUDENT_FIELDS,
  TEACHER_FIELDS,
  CLASS_FIELDS,
  PARENT_FIELDS,
} from "@/lib/import/mapping-utils";

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
