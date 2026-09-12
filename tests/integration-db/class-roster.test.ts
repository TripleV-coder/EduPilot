import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/students/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * N19 — effectif d'une classe tronqué à 100 élèves.
 *
 * `/api/students?classId=…` était plafonné à 100 comme les listes de
 * l'établissement. L'appel, la saisie de notes, les bulletins et la promotion
 * chargent l'effectif d'une classe : au-delà de 100 élèves (courant dans le
 * public au Bénin), les suivants disparaissaient sans erreur — pas d'appel,
 * pas de note, pas de bulletin pour eux.
 */
const CLASS_SIZE = 120;
let schoolId: string;
let adminId: string;
let classId: string;

beforeAll(async () => {
  schoolId = (await createSchool("IT-ROSTER")).id;
  adminId = (
    await prisma.user.create({
      data: { email: `${uniqueCode("admin")}@integration.test`, password: "x", firstName: "Admin", lastName: "Test", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;
  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const level = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
  classId = (await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "6e A" } })).id;

  const tag = uniqueCode("roster");
  const users = await prisma.user.createManyAndReturn({
    data: Array.from({ length: CLASS_SIZE }, (_, i) => ({
      email: `${tag}-${i}@integration.test`, password: "x", firstName: `E${i}`, lastName: `Nom${String(i).padStart(3, "0")}`, role: "STUDENT" as const, schoolId,
    })),
    select: { id: true },
  });
  const profiles = await prisma.studentProfile.createManyAndReturn({
    data: users.map((u, i) => ({ userId: u.id, matricule: `${tag}-${i}`, schoolId })),
    select: { id: true },
  });
  await prisma.enrollment.createMany({
    data: profiles.map((p) => ({ studentId: p.id, classId, academicYearId: year.id })),
  });
});

type ListBody = { data: Array<{ id: string }>; pagination: { limit: number; hasNextPage: boolean; total?: number } };

describe("N19 — effectif complet d'une classe", () => {
  it("?classId=…&limit=1000 renvoie les 120 élèves de la classe en une réponse", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(GET, { path: `/api/students?classId=${classId}&limit=1000` });

    expect(res.status).toBe(200);
    const body = res.body as ListBody;
    expect(body.data).toHaveLength(CLASS_SIZE);
    expect(new Set(body.data.map((s) => s.id)).size).toBe(CLASS_SIZE);
    expect(body.pagination).toMatchObject({ hasNextPage: false, total: CLASS_SIZE });
  });

  it("les listes de l'établissement (sans classId) restent plafonnées à 100", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(GET, { path: "/api/students?limit=1000" });

    expect(res.status).toBe(200);
    const body = res.body as ListBody;
    expect(body.data).toHaveLength(100);
    expect(body.pagination).toMatchObject({ limit: 100, hasNextPage: true });
  });
});
