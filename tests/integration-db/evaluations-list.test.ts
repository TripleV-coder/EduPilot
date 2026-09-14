import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { GET } from "@/app/api/evaluations/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * C3 / N1 / N9 — `GET /api/evaluations` contre une vraie base.
 *
 * Avant : aucune pagination, toutes les notes de chaque évaluation incluses
 * (≈100 Mo, 14,9 s au p95 sur la base de l'audit), et un parent ou un élève
 * recevait les évaluations de toute l'école AVEC les notes nominatives des
 * autres élèves (N9).
 * Attendu : pagination par curseur (format unique du projet), aucun détail de
 * note dans la liste (seulement leur nombre), filtres type/dates côté serveur,
 * et un périmètre par rôle.
 */
type Item = { id: string; date: string; gradeCount: number; grades?: unknown; classSubject: { class: { name: string } } };
type Page = { data: Item[]; pagination: { limit: number; nextCursor: string | null; hasNextPage: boolean; total?: number } };

const IN_A = 45;
const IN_B = 5;

let schoolId: string;
let adminId: string;
let teacherUserId: string;
let parentUserId: string;
let studentBUserId: string;
let compoTypeId: string;

async function user(role: UserRole, prefix: string) {
  return prisma.user.create({
    data: {
      email: `${uniqueCode(prefix)}@integration.test`,
      password: "non-utilise",
      firstName: prefix,
      lastName: "Test",
      role,
      schoolId,
    },
  });
}

beforeAll(async () => {
  schoolId = (await createSchool("IT-C3-EVAL")).id;
  adminId = (await user("SCHOOL_ADMIN", "admin")).id;

  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const period = await prisma.period.create({
    data: { academicYearId: year.id, name: "Trimestre 1", type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 },
  });
  const level = await prisma.classLevel.create({
    data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 },
  });
  const classA = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "6e A" } });
  const classB = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "6e B" } });
  const subject = await prisma.subject.create({ data: { schoolId, name: "Mathématiques", code: uniqueCode("MATH") } });

  const teacherUser = await user("TEACHER", "prof");
  teacherUserId = teacherUser.id;
  const teacher = await prisma.teacherProfile.create({ data: { userId: teacherUser.id, schoolId } });

  const csA = await prisma.classSubject.create({ data: { classId: classA.id, subjectId: subject.id, teacherId: teacher.id } });
  const csB = await prisma.classSubject.create({ data: { classId: classB.id, subjectId: subject.id } });

  const devoir = await prisma.evaluationType.create({ data: { schoolId, name: "Devoir", code: "DEVOIR" } });
  const compo = await prisma.evaluationType.create({ data: { schoolId, name: "Composition", code: "COMPO" } });
  compoTypeId = compo.id;

  const studentAUser = await user("STUDENT", "eleveA");
  const studentA = await prisma.studentProfile.create({ data: { userId: studentAUser.id, matricule: uniqueCode("A"), schoolId } });
  const studentBUser = await user("STUDENT", "eleveB");
  studentBUserId = studentBUser.id;
  const studentB = await prisma.studentProfile.create({ data: { userId: studentBUser.id, matricule: uniqueCode("B"), schoolId } });
  await prisma.enrollment.createMany({
    data: [
      { studentId: studentA.id, classId: classA.id, academicYearId: year.id },
      { studentId: studentB.id, classId: classB.id, academicYearId: year.id },
    ],
  });

  const parentUser = await user("PARENT", "parent");
  parentUserId = parentUser.id;
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  await prisma.parentStudent.create({ data: { parentId: parent.id, studentId: studentA.id, relationship: "PERE" } });

  // 45 évaluations en 6e A (dont 10 compositions), 5 en 6e B ; une note par évaluation.
  for (let i = 0; i < IN_A; i++) {
    const evaluation = await prisma.evaluation.create({
      data: {
        classSubjectId: csA.id,
        periodId: period.id,
        typeId: i < 10 ? compo.id : devoir.id,
        title: `Éval A${i}`,
        // Plusieurs évaluations le même jour : le curseur doit départager par id.
        date: new Date(Date.UTC(2025, 9, 1 + Math.floor(i / 3))),
      },
    });
    await prisma.grade.create({ data: { evaluationId: evaluation.id, studentId: studentA.id, value: 12 } });
  }
  for (let i = 0; i < IN_B; i++) {
    const evaluation = await prisma.evaluation.create({
      data: { classSubjectId: csB.id, periodId: period.id, typeId: devoir.id, title: `Éval B${i}`, date: new Date(Date.UTC(2025, 10, 1 + i)) },
    });
    await prisma.grade.create({ data: { evaluationId: evaluation.id, studentId: studentB.id, value: 9 } });
  }
});

async function page(query = ""): Promise<{ status: number; body: Page }> {
  const res = await callRoute(GET, { path: `/api/evaluations${query ? `?${query}` : ""}` });
  return { status: res.status, body: res.body as Page };
}

async function all(query = "limit=20"): Promise<Item[]> {
  const items: Item[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 20; guard++) {
    const { body } = await page(cursor ? `${query}&cursor=${cursor}` : query);
    items.push(...body.data);
    cursor = body.pagination.nextCursor;
    if (!cursor) break;
  }
  return items;
}

describe("C3 — pagination de GET /api/evaluations", () => {
  it("renvoie une première page bornée avec le total", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const { status, body } = await page("limit=20");

    expect(status).toBe(200);
    expect(body.data).toHaveLength(20);
    expect(body.pagination).toMatchObject({ limit: 20, hasNextPage: true, total: IN_A + IN_B });
  });

  it("parcourt toutes les évaluations sans doublon ni trou, en ordre de date décroissante", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const items = await all("limit=20");

    expect(items).toHaveLength(IN_A + IN_B);
    expect(new Set(items.map((i) => i.id)).size).toBe(IN_A + IN_B);
    const dates = items.map((i) => new Date(i.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("ne recalcule pas le total sur les pages suivantes", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const first = await page("limit=20");
    const second = await page(`limit=20&cursor=${first.body.pagination.nextCursor}`);

    expect(second.body.pagination.total).toBeUndefined();
  });

  it("n'inclut plus le détail des notes, seulement leur nombre", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const { body } = await page("limit=20");

    expect(body.data.every((i) => i.grades === undefined && i.gradeCount === 1)).toBe(true);
    expect(JSON.stringify(body).length).toBeLessThan(40_000);
  });

  it("refuse un curseur invalide (400)", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const { status } = await page("cursor=forge");

    expect(status).toBe(400);
  });

  it("filtre par type d'évaluation (code) côté serveur", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const items = await all("limit=20&type=COMPO");

    expect(items).toHaveLength(10);
    const stored = await prisma.evaluation.findMany({ where: { id: { in: items.map((i) => i.id) } }, select: { typeId: true } });
    expect(stored.every((e) => e.typeId === compoTypeId)).toBe(true);
  });

  it("filtre par période de dates côté serveur (planning hebdomadaire)", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const items = await all("limit=20&from=2025-11-01&to=2025-11-03");

    expect(items.map((i) => i.date.slice(0, 10)).sort()).toEqual(["2025-11-01", "2025-11-02", "2025-11-03"]);
  });
});

describe("N9 — périmètre par rôle", () => {
  it("un parent ne voit que les évaluations de la classe de son enfant", async () => {
    actAs(sessionFor("PARENT", schoolId, parentUserId));
    const items = await all();

    expect(items).toHaveLength(IN_A);
    expect(items.every((i) => i.classSubject.class.name === "6e A")).toBe(true);
  });

  it("un élève ne voit que les évaluations de sa classe", async () => {
    actAs(sessionFor("STUDENT", schoolId, studentBUserId));
    const items = await all();

    expect(items).toHaveLength(IN_B);
    expect(items.every((i) => i.classSubject.class.name === "6e B")).toBe(true);
  });

  it("un enseignant ne voit que ses propres matières", async () => {
    actAs(sessionFor("TEACHER", schoolId, teacherUserId));
    const items = await all();

    expect(items).toHaveLength(IN_A);
  });
});
