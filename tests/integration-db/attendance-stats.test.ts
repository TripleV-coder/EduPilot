import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/attendance/stats/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * M5 — `GET /api/attendance/stats` : test de CARACTÉRISATION contre une vraie
 * base, écrit avant l'optimisation. La route chargeait TOUTES les présences de
 * l'établissement (statut + élève) pour les compter en mémoire — une ligne par
 * élève et par jour, soit ~180 000 lignes par an pour 1 000 élèves.
 * La réponse doit rester identique.
 *
 * Jeu de données : s1 = PRESENT ×2, LATE, ABSENT ; s2 = PRESENT, EXCUSED ;
 * s3 (compte désactivé) = ABSENT, exclu ; un élève d'une autre école, exclu.
 */
let schoolId: string;
let adminId: string;
const s: Record<"s1" | "s2" | "s3", string> = { s1: "", s2: "", s3: "" };

beforeAll(async () => {
  const school = await createSchool("IT-ATT");
  schoolId = school.id;
  const user = (first: string, role: "SCHOOL_ADMIN" | "STUDENT", school = schoolId, isActive = true) =>
    prisma.user.create({
      data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: "Test", role, schoolId: school, isActive },
    });
  adminId = (await user("admin", "SCHOOL_ADMIN")).id;
  const level = await prisma.classLevel.create({ data: { schoolId, name: "CP", code: uniqueCode("CP"), level: "PRIMARY", sequence: 1 } });
  const klass = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "A" } });

  const student = async (key: string, school = schoolId, isActive = true) => {
    const u = await user(key, "STUDENT", school, isActive);
    return (await prisma.studentProfile.create({ data: { userId: u.id, matricule: uniqueCode(key), schoolId: school } })).id;
  };
  s.s1 = await student("s1");
  s.s2 = await student("s2");
  s.s3 = await student("s3", schoolId, false);
  const other = await createSchool("IT-ATT-OTHER");
  const otherLevel = await prisma.classLevel.create({ data: { schoolId: other.id, name: "CP", code: uniqueCode("CP"), level: "PRIMARY", sequence: 1 } });
  const otherClass = await prisma.class.create({ data: { schoolId: other.id, classLevelId: otherLevel.id, name: "A" } });
  const foreign = await student("x1", other.id);

  const day = (d: number) => new Date(Date.UTC(2026, 2, d, 8));
  await prisma.attendance.createMany({
    data: [
      { studentId: s.s1, classId: klass.id, date: day(2), status: "PRESENT" },
      { studentId: s.s1, classId: klass.id, date: day(3), status: "PRESENT" },
      { studentId: s.s1, classId: klass.id, date: day(4), status: "LATE" },
      { studentId: s.s1, classId: klass.id, date: day(5), status: "ABSENT" },
      { studentId: s.s2, classId: klass.id, date: day(2), status: "PRESENT" },
      { studentId: s.s2, classId: klass.id, date: day(3), status: "EXCUSED" },
      { studentId: s.s3, classId: klass.id, date: day(2), status: "ABSENT" },
      { studentId: foreign, classId: otherClass.id, date: day(2), status: "ABSENT" },
    ],
  });
});

describe("M5 — statistiques de présence (caractérisation)", () => {
  it("établissement entier : totaux, taux et détail par élève actif de l'école", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(GET, { path: "/api/attendance/stats" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 6,
      present: 3,
      absent: 1,
      late: 1,
      excused: 1,
      presentRate: 66.67,
      absentRate: 16.67,
      byStudent: {
        [s.s1]: { total: 4, present: 2, absent: 1, late: 1, excused: 0, presentRate: "75.00" },
        [s.s2]: { total: 2, present: 1, absent: 0, late: 0, excused: 1, presentRate: "50.00" },
      },
    });
  });

  it("un élève : totaux sans détail par élève", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(GET, { path: `/api/attendance/stats?studentId=${s.s1}` });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 4,
      present: 2,
      absent: 1,
      late: 1,
      excused: 0,
      presentRate: 75,
      absentRate: 25,
      byStudent: null,
    });
  });
});
