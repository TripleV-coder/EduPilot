import { beforeAll, describe, expect, it } from "vitest";
import { POST as importStudents } from "@/app/api/import/students/route";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 5 (N46) — import CSV/Excel des élèves sur une vraie base :
 * - tout ou rien : une seule ligne en erreur → rien n'est écrit, rapport
 *   ligne par ligne (avant : les lignes valides étaient créées, les autres
 *   ignorées, et l'écran annonçait « Importation réussie ») ;
 * - doublons détectés DANS le fichier et en base ;
 * - classe introuvable signalée (avant : élève créé sans inscription, sans avertissement) ;
 * - date de naissance au format français JJ/MM/AAAA (avant : new Date("15/03/2012")) ;
 * - noms accentués conservés.
 */
let schoolId: string;
let adminId: string;
const CLASS_NAME = "6ème A";

type Report = { created: number; errors: Array<{ row: number; field?: string; message: string }> };

const email = (who: string) => `${uniqueCode(who)}@integration.test`.toLowerCase();
const row = (overrides: Record<string, unknown> = {}) => ({
  firstName: "Aïcha",
  lastName: "Hounsou",
  email: email("eleve"),
  className: CLASS_NAME,
  ...overrides,
});

async function post(data: unknown[]) {
  actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
  return callRoute(importStudents, { method: "POST", path: "/api/import/students", body: { data } });
}

async function countStudents() {
  return ownerDb.studentProfile.count({ where: { schoolId } });
}

beforeAll(async () => {
  schoolId = (await createSchool("IT-N46")).id;
  adminId = (
    await ownerDb.user.create({
      data: { email: email("admin"), password: "x", firstName: "Admin", lastName: "N46", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;
  const year = await ownerDb.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true },
  });
  const level = await ownerDb.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
  await ownerDb.class.create({ data: { schoolId, classLevelId: level.id, name: CLASS_NAME } });
  expect(year.id).toBeTruthy();
});

describe("N46 — import des élèves : tout ou rien, rapport ligne par ligne", () => {
  it("une ligne invalide : rien n'est importé, l'erreur est située (ligne, champ)", async () => {
    const before = await countStudents();
    const res = await post([row(), row({ email: "pas-un-email" }), row()]);
    expect(res.status).toBe(422);
    const report = res.body as Report;
    expect(report.created).toBe(0);
    expect(report.errors).toEqual([expect.objectContaining({ row: 2, field: "email" })]);
    expect(await countStudents()).toBe(before);
  });

  it("un email en double dans le fichier est signalé sur les deux lignes", async () => {
    const before = await countStudents();
    const shared = email("double");
    const res = await post([row({ email: shared }), row(), row({ email: shared.toUpperCase() })]);
    expect(res.status).toBe(422);
    const rows = (res.body as Report).errors.map((e) => e.row).sort();
    expect(rows).toEqual([1, 3]);
    expect(await countStudents()).toBe(before);
  });

  it("un matricule ou un email déjà présent en base est signalé", async () => {
    const matricule = uniqueCode("MAT");
    const existing = email("existant");
    expect((await post([row({ email: existing, matricule })])).status).toBe(200);
    const before = await countStudents();

    const res = await post([row({ email: existing }), row({ matricule })]);
    expect(res.status).toBe(422);
    expect((res.body as Report).errors).toEqual([
      expect.objectContaining({ row: 1, field: "email" }),
      expect.objectContaining({ row: 2, field: "matricule" }),
    ]);
    expect(await countStudents()).toBe(before);
  });

  it("une classe introuvable est signalée au lieu d'un élève inscrit nulle part", async () => {
    const before = await countStudents();
    const res = await post([row({ className: "Classe inconnue" })]);
    expect(res.status).toBe(422);
    expect((res.body as Report).errors).toEqual([expect.objectContaining({ row: 1, field: "className" })]);
    expect(await countStudents()).toBe(before);
  });

  it("un fichier valide est importé en entier : accents, date française, inscription", async () => {
    const before = await countStudents();
    const a = email("emile");
    const b = email("francois");
    const res = await post([
      row({ firstName: "Émile", lastName: "Dègbè", email: a, dateOfBirth: "15/03/2012", gender: "M" }),
      row({ firstName: "François", lastName: "N’Diaye", email: b, dateOfBirth: "2012-11-02" }),
    ]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((res.body as Report).created).toBe(2);
    expect(await countStudents()).toBe(before + 2);

    const emile = await ownerDb.user.findUniqueOrThrow({
      where: { email: a },
      include: { studentProfile: { include: { enrollments: true } } },
    });
    expect(emile).toMatchObject({ firstName: "Émile", lastName: "Dègbè", mustChangePassword: true });
    expect(emile.studentProfile?.dateOfBirth?.toISOString().slice(0, 10)).toBe("2012-03-15");
    expect(emile.studentProfile?.enrollments).toHaveLength(1);
    expect((await ownerDb.user.findUniqueOrThrow({ where: { email: b } })).lastName).toBe("N’Diaye");
  });

  it("une date de naissance impossible est signalée", async () => {
    const res = await post([row({ dateOfBirth: "31/02/2012" })]);
    expect(res.status).toBe(422);
    expect((res.body as Report).errors).toEqual([expect.objectContaining({ row: 1, field: "dateOfBirth" })]);
  });
});
