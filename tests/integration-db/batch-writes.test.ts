import { describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { POST as batchAssign } from "@/app/api/class-subjects/batch/route";
import { PUT as importSubjects } from "@/app/api/admin/subjects/route";
import { POST as regenerateBadges } from "@/app/api/access-control/badges/regenerate/route";
import { primarySubjects } from "@/lib/benin/config";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * M5 — écritures par lots relevées par l'audit (requêtes N+1) :
 *   - class-subjects/batch : 3 à 5 requêtes par affectation, écrites classe par
 *     classe — une affectation refusée dans une classe suivante laissait les
 *     classes précédentes déjà modifiées ;
 *   - admin/subjects (import du référentiel) : une lecture + une création par matière ;
 *   - access-control/badges/regenerate : un upsert par élève hors transaction.
 * Comportement vérifié sur PostgreSQL ; le nombre de requêtes l'est dans les
 * tests unitaires des routes.
 */
async function seedSchool(prefix: string) {
  const school = await createSchool(prefix);
  const user = (first: string, role: "SCHOOL_ADMIN" | "DIRECTOR" | "STUDENT") =>
    prisma.user.create({
      data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: "Test", role, schoolId: school.id },
    });
  const level = await prisma.classLevel.create({
    data: { schoolId: school.id, name: "CP", code: uniqueCode("CP"), level: "PRIMARY", sequence: 1 },
  });
  const newClass = (name: string) => prisma.class.create({ data: { schoolId: school.id, classLevelId: level.id, name } });
  const newSubject = (name: string) => prisma.subject.create({ data: { schoolId: school.id, name, code: uniqueCode(name) } });
  return { school, user, newClass, newSubject };
}

describe("M5 — POST /api/class-subjects/batch", () => {
  it("applique puis resynchronise les affectations de plusieurs classes", async () => {
    const { school, user, newClass, newSubject } = await seedSchool("IT-BATCH");
    const director = await user("dir", "DIRECTOR");
    const [classA, classB] = [await newClass("A"), await newClass("B")];
    const [math, french] = [await newSubject("MATH"), await newSubject("FR")];
    actAs(sessionFor("DIRECTOR", school.id, director.id));

    const first = await callRoute(batchAssign, {
      method: "POST",
      path: "/api/class-subjects/batch",
      body: {
        assignments: [
          { classId: classA.id, subjectId: math.id, coefficient: 3, weeklyHours: 4 },
          { classId: classA.id, subjectId: french.id, coefficient: 2 },
          { classId: classB.id, subjectId: math.id, coefficient: 4 },
        ],
      },
    });
    expect(first).toEqual({ status: 200, body: { ok: true, processedClassCount: 2 } });

    // Seconde passe sur la classe A : Maths modifiée, Français retiré ; B intacte.
    const second = await callRoute(batchAssign, {
      method: "POST",
      path: "/api/class-subjects/batch",
      body: { assignments: [{ classId: classA.id, subjectId: math.id, coefficient: 5 }] },
    });
    expect(second).toEqual({ status: 200, body: { ok: true, processedClassCount: 1 } });

    const rows = await prisma.classSubject.findMany({
      where: { classId: { in: [classA.id, classB.id] } },
      select: { classId: true, subjectId: true, coefficient: true, weeklyHours: true },
    });
    // coefficient est un Decimal : comparé en nombre
    const plain = rows.map((row) => ({ ...row, coefficient: Number(row.coefficient) }));
    expect(plain).toHaveLength(2);
    expect(plain.find((row) => row.classId === classA.id)).toMatchObject({ subjectId: math.id, coefficient: 5, weeklyHours: null });
    expect(plain.find((row) => row.classId === classB.id)).toMatchObject({ subjectId: math.id, coefficient: 4 });
  });

  it("n'écrit rien quand une affectation du lot est refusée (atomicité)", async () => {
    const { school, user, newClass, newSubject } = await seedSchool("IT-BATCH-ATOM");
    const director = await user("dir", "DIRECTOR");
    const [classA, classB] = [await newClass("A"), await newClass("B")];
    const math = await newSubject("MATH");
    const other = await createSchool("IT-BATCH-OTHER");
    const foreignSubject = await prisma.subject.create({ data: { schoolId: other.id, name: "Étrangère", code: uniqueCode("X") } });
    actAs(sessionFor("DIRECTOR", school.id, director.id));

    const res = await callRoute(batchAssign, {
      method: "POST",
      path: "/api/class-subjects/batch",
      body: {
        assignments: [
          { classId: classA.id, subjectId: math.id, coefficient: 3 },
          { classId: classB.id, subjectId: foreignSubject.id, coefficient: 2 },
        ],
      },
    });

    expect(res.status).toBe(403);
    expect(await prisma.classSubject.count({ where: { classId: { in: [classA.id, classB.id] } } })).toBe(0);
  });
});

describe("M5 — PUT /api/admin/subjects (import du référentiel)", () => {
  it("crée les matières manquantes, ignore les existantes et reste idempotent", async () => {
    const { school, user } = await seedSchool("IT-IMPORT");
    const admin = await user("admin", "SCHOOL_ADMIN");
    const codes = new Set(primarySubjects.map((subject) => subject.code));
    const total = primarySubjects.length;
    await prisma.subject.create({ data: { schoolId: school.id, name: "Existante", code: primarySubjects[0].code } });
    actAs(sessionFor("SCHOOL_ADMIN", school.id, admin.id));

    const first = await callRoute(importSubjects, { method: "PUT", path: "/api/admin/subjects", body: { type: "primary" } });
    expect(first).toEqual({ status: 200, body: { created: codes.size - 1, skipped: total - (codes.size - 1), total } });

    const second = await callRoute(importSubjects, { method: "PUT", path: "/api/admin/subjects", body: { type: "primary" } });
    expect(second).toEqual({ status: 200, body: { created: 0, skipped: total, total } });

    expect(await prisma.subject.count({ where: { schoolId: school.id } })).toBe(codes.size);
    const kept = await prisma.subject.findUnique({ where: { schoolId_code: { schoolId: school.id, code: primarySubjects[0].code } } });
    expect(kept?.name).toBe("Existante");
  });
});

describe("M5 — POST /api/access-control/badges/regenerate", () => {
  it("émet un badge par élève actif, renouvelle le code et lève la révocation", async () => {
    const { school, user, newClass } = await seedSchool("IT-BADGE");
    const admin = await user("admin", "SCHOOL_ADMIN");
    const klass = await newClass("A");
    const year = await prisma.academicYear.create({
      data: { schoolId: school.id, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
    });
    const student = async (key: string, status: "ACTIVE" | "DROPPED") => {
      const u = await user(key, "STUDENT");
      const profile = await prisma.studentProfile.create({ data: { userId: u.id, matricule: uniqueCode(key), schoolId: school.id } });
      await prisma.enrollment.create({ data: { studentId: profile.id, classId: klass.id, academicYearId: year.id, status } });
      return profile.id;
    };
    const [s1, s2, s3] = [await student("s1", "ACTIVE"), await student("s2", "ACTIVE"), await student("s3", "DROPPED")];
    await prisma.badge.create({ data: { schoolId: school.id, studentId: s2, code: uniqueCode("OLD"), revokedAt: new Date() } });
    const oldCode = (await prisma.badge.findUnique({ where: { studentId: s2 } }))!.code;
    actAs(sessionFor("SCHOOL_ADMIN", school.id, admin.id));

    const res = await callRoute(regenerateBadges, { method: "POST", path: "/api/access-control/badges/regenerate", body: { classId: klass.id } });
    expect(res).toEqual({ status: 200, body: { regenerated: 2 } });

    const badges = await prisma.badge.findMany({ where: { studentId: { in: [s1, s2, s3] } }, select: { studentId: true, code: true, revokedAt: true } });
    expect(badges.map((badge) => badge.studentId).sort()).toEqual([s1, s2].sort());
    const renewed = badges.find((badge) => badge.studentId === s2)!;
    expect(renewed.code).not.toBe(oldCode);
    expect(renewed.revokedAt).toBeNull();
  });
});
