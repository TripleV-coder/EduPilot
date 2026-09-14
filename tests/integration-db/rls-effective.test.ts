import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { runAsSystem, runWithDbContext, tenantContext } from "@/lib/db/db-context";
import { assertRlsEnforcedAtStartup, inspectRlsRole } from "@/lib/db/rls-guard";
import ownerDb from "./owner-db";
import { seedTenantGraph } from "./fixtures/tenant-graph";

/**
 * Audit M2 — RLS effective, sur un vrai PostgreSQL.
 *
 * `@/lib/prisma` est connecté avec le rôle applicatif (ni superutilisateur ni
 * BYPASSRLS, voir global-setup.ts) : c'est la base elle-même qui isole les
 * établissements, indépendamment des filtres écrits dans le code. Décisions
 * du propriétaire : fermée par défaut, périmètre « données sensibles ».
 */

const TABLES = [
  "student_profiles", "grades", "payments", "attendances", "behavior_incidents", "sanctions",
  "medical_records", "allergies", "vaccinations", "emergency_contacts", "evaluations",
] as const;
type Table = (typeof TABLES)[number];
type TableIds = Record<Table, string>;

let schoolA: string;
let schoolB: string;
let a: TableIds;
let b: TableIds;
let classA: string;
let studentA: string;
let studentB: string;

async function seedSchool(prefix: string) {
  const graph = await seedTenantGraph(prefix);
  const { ids } = graph;
  const grade = await ownerDb.grade.findUniqueOrThrow({ where: { id: ids.grade }, select: { evaluationId: true } });
  const attendance = await ownerDb.attendance.create({
    data: { studentId: ids.student, classId: ids.class, date: new Date("2025-10-06T08:00:00.000Z"), status: "ABSENT" },
  });
  const sanction = await ownerDb.sanction.create({
    data: { incidentId: ids.incident, type: "WARNING", startDate: new Date("2025-11-04T08:00:00.000Z") },
  });
  const tableIds: TableIds = {
    student_profiles: ids.student,
    grades: ids.grade,
    payments: ids.payment,
    attendances: attendance.id,
    behavior_incidents: ids.incident,
    sanctions: sanction.id,
    medical_records: ids.medicalRecord,
    allergies: ids.allergy,
    vaccinations: ids.vaccination,
    emergency_contacts: ids.emergencyContact,
    evaluations: grade.evaluationId,
  };
  return { graph, tableIds };
}

/** Identifiants visibles du rôle applicatif parmi `ids`, table par table (requête brute). */
async function visible(table: Table, ids: string[]): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "${table}" WHERE id = ANY($1::text[]) ORDER BY id`,
    ids,
  );
  return rows.map((row) => row.id).sort();
}

async function visibility() {
  const result: Record<string, { a: boolean; b: boolean }> = {};
  for (const table of TABLES) {
    const ids = await visible(table, [a[table], b[table]]);
    result[table] = { a: ids.includes(a[table]), b: ids.includes(b[table]) };
  }
  return result;
}

function expectEverywhere(result: Record<string, { a: boolean; b: boolean }>, expected: { a: boolean; b: boolean }) {
  expect(result).toEqual(Object.fromEntries(TABLES.map((table) => [table, expected])));
}

beforeAll(async () => {
  const seededA = await seedSchool("rlsA");
  const seededB = await seedSchool("rlsB");
  schoolA = seededA.graph.schoolId;
  schoolB = seededB.graph.schoolId;
  a = seededA.tableIds;
  b = seededB.tableIds;
  classA = seededA.graph.ids.class;
  studentA = seededA.graph.ids.student;
  studentB = seededB.graph.ids.student;
});

describe("M2 — rôle de connexion", () => {
  it("le rôle applicatif est soumis à la RLS, le propriétaire la contourne", async () => {
    await expect(inspectRlsRole(prisma)).resolves.toMatchObject({ status: "enforced" });
    await expect(inspectRlsRole(ownerDb)).resolves.toMatchObject({ status: "bypassed" });
  });

  it("le démarrage de production refuse un rôle qui contourne la RLS", async () => {
    await expect(assertRlsEnforcedAtStartup(ownerDb, () => undefined)).rejects.toThrow(/sécurité par ligne/);
    await expect(assertRlsEnforcedAtStartup(prisma, () => undefined)).resolves.toMatchObject({ status: "enforced" });
  });

  it("toutes les tables sensibles sont sous FORCE ROW LEVEL SECURITY", async () => {
    const rows = await ownerDb.$queryRawUnsafe<Array<{ table: string; enabled: boolean; forced: boolean }>>(
      `SELECT relname AS "table", relrowsecurity AS enabled, relforcerowsecurity AS forced
         FROM pg_class WHERE relname = ANY($1::text[]) ORDER BY relname`,
      [...TABLES],
    );
    expect(rows).toHaveLength(TABLES.length);
    for (const row of rows) expect(row, row.table).toMatchObject({ enabled: true, forced: true });
  });
});

describe("M2 — fermée par défaut (aucun contexte)", () => {
  it("les onze tables sensibles apparaissent vides", async () => {
    expectEverywhere(await runWithDbContext(null, visibility), { a: false, b: false });
  });

  it("aucune écriture n'est possible", async () => {
    await expect(
      runWithDbContext(null, () =>
        prisma.attendance.create({
          data: { studentId: studentA, classId: classA, date: new Date("2025-10-07T08:00:00.000Z"), status: "PRESENT" },
        }),
      ),
    ).rejects.toThrow(/row-level security/);
    const updated = await runWithDbContext(null, () =>
      prisma.grade.updateMany({ where: { id: a.grades }, data: { value: 0 } }),
    );
    expect(updated.count).toBe(0);
  });
});

describe("M2 — contexte d'établissement", () => {
  it("un établissement ne voit que ses lignes, sur les onze tables (requêtes brutes)", async () => {
    expectEverywhere(await runWithDbContext(tenantContext([schoolA]), visibility), { a: true, b: false });
    expectEverywhere(await runWithDbContext(tenantContext([schoolB]), visibility), { a: false, b: true });
  });

  it("une requête sans filtre d'établissement (oubli dans le code) reste isolée", async () => {
    const grades = await runWithDbContext(tenantContext([schoolA]), () =>
      prisma.grade.findMany({ where: { id: { in: [a.grades, b.grades] } }, select: { id: true } }),
    );
    expect(grades.map((grade) => grade.id)).toEqual([a.grades]);

    const withStudents = await runWithDbContext(tenantContext([schoolA]), () =>
      prisma.enrollment.findMany({
        where: { studentId: { in: [studentA, studentB] } },
        select: { studentId: true, student: { select: { id: true } } },
      }).catch((error: Error) => error),
    );
    // L'inscription de B (table non couverte) référence un élève masqué :
    // Prisma refuse la réponse plutôt que de révéler l'élève.
    expect(withStudents).toBeInstanceOf(Error);
  });

  it("un réseau voit exactement ses établissements", async () => {
    expectEverywhere(await runWithDbContext(tenantContext([schoolA, schoolB]), visibility), { a: true, b: true });
  });

  it("les écritures vers un autre établissement sont refusées ou sans effet", async () => {
    const before = await ownerDb.grade.findUniqueOrThrow({ where: { id: b.grades } });

    const updated = await runWithDbContext(tenantContext([schoolA]), () =>
      prisma.grade.updateMany({ where: { id: b.grades }, data: { value: 0 } }),
    );
    expect(updated.count).toBe(0);

    const deleted = await runWithDbContext(tenantContext([schoolA]), () =>
      prisma.medicalRecord.deleteMany({ where: { id: b.medical_records } }),
    );
    expect(deleted.count).toBe(0);

    // Rattacher une ligne à l'élève de B depuis A : refusé par WITH CHECK.
    await expect(
      runWithDbContext(tenantContext([schoolA]), () =>
        prisma.behaviorIncident.create({
          data: { studentId: studentB, incidentType: "LATE", date: new Date(), description: "Hors établissement" },
        }),
      ),
    ).rejects.toThrow(/row-level security/);

    // Déplacer un élève de A vers B depuis A : refusé.
    await expect(
      runWithDbContext(tenantContext([schoolA]), () =>
        prisma.studentProfile.update({ where: { id: studentA }, data: { schoolId: schoolB } }),
      ),
    ).rejects.toThrow(/row-level security/);

    expect(await ownerDb.grade.findUniqueOrThrow({ where: { id: b.grades } })).toEqual(before);
    expect(await ownerDb.medicalRecord.count({ where: { id: b.medical_records } })).toBe(1);
    expect(await ownerDb.studentProfile.findUniqueOrThrow({ where: { id: studentA }, select: { schoolId: true } }))
      .toEqual({ schoolId: schoolA });
  });
});

describe("M2 — contexte système déclaré", () => {
  it("voit tous les établissements", async () => {
    expectEverywhere(await runAsSystem("test", visibility), { a: true, b: true });
  });
});

describe("M2 — transactions", () => {
  it("une transaction interactive porte le contexte, y compris pour les appels hors transaction", async () => {
    const [inside, outside] = await runWithDbContext(tenantContext([schoolA]), () =>
      prisma.$transaction(async (tx) => [
        await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "grades" WHERE id = ANY($1::text[])`, [a.grades, b.grades]),
        await prisma.grade.findMany({ where: { id: { in: [a.grades, b.grades] } }, select: { id: true } }),
      ]),
    );
    expect(inside.map((row) => row.id)).toEqual([a.grades]);
    expect(outside.map((row) => row.id)).toEqual([a.grades]);
  });

  it("une transaction par lot porte le contexte", async () => {
    const [grades, payments] = await runWithDbContext(tenantContext([schoolB]), () =>
      prisma.$transaction([
        prisma.grade.findMany({ where: { id: { in: [a.grades, b.grades] } }, select: { id: true } }),
        prisma.payment.count({ where: { id: { in: [a.payments, b.payments] } } }),
      ]),
    );
    expect(grades.map((grade) => grade.id)).toEqual([b.grades]);
    expect(payments).toBe(1);
  });

  it("les opérations d'une transaction interactive restent dans la transaction (annulation)", async () => {
    // Si Prisma cessait de signaler la transaction à l'extension, chaque
    // opération serait rejouée dans sa propre transaction et survivrait à
    // l'annulation : ce test le détecterait.
    const date = new Date("2025-10-08T08:00:00.000Z");
    await expect(
      runWithDbContext(tenantContext([schoolA]), () =>
        prisma.$transaction(async (tx) => {
          await tx.attendance.create({ data: { studentId: studentA, classId: classA, date, status: "LATE" } });
          throw new Error("annulation voulue");
        }),
      ),
    ).rejects.toThrow("annulation voulue");
    expect(await ownerDb.attendance.count({ where: { studentId: studentA, date } })).toBe(0);
  });

  it("une connexion rendue au pool ne garde aucun établissement", async () => {
    await runWithDbContext(tenantContext([schoolA]), () => prisma.grade.count());
    const leftovers = await runWithDbContext(null, () =>
      prisma.$queryRawUnsafe<Array<{ ids: string | null; bypass: string | null }>>(
        "SELECT current_setting('app.school_ids', true) AS ids, current_setting('app.rls_bypass', true) AS bypass",
      ),
    );
    expect(leftovers[0].ids ?? "").toBe("");
    expect(leftovers[0].bypass ?? "").toBe("");
  });
});
