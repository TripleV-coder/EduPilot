import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { GET as GET_SCHOOLS } from "@/app/api/explorer/schools/route";
import { GET as GET_OVERVIEW } from "@/app/api/explorer/overview/route";
import { actAs, callRoute, createSchool, uniqueCode } from "./helpers";

/**
 * Explorateur public (/explorer, accueil) : sans session, seules les écoles
 * publiées sont visibles, et leurs effectifs — tables sous RLS — sont comptés
 * au titre du système (sinon 0). Les écoles non publiées n'apparaissent pas.
 */
let publishedId: string;
let privateId: string;

async function students(schoolId: string, n: number) {
  const tag = uniqueCode("exp");
  const users = await prisma.user.createManyAndReturn({
    data: Array.from({ length: n }, (_, i) => ({ email: `${tag}-${i}@integration.test`, password: "x", firstName: "E", lastName: `${i}`, role: "STUDENT" as const, schoolId })),
    select: { id: true },
  });
  await prisma.studentProfile.createMany({ data: users.map((u, i) => ({ userId: u.id, matricule: `${tag}-${i}`, schoolId })) });
}

beforeAll(async () => {
  publishedId = (await createSchool("IT-EXP-PUB")).id;
  privateId = (await createSchool("IT-EXP-PRIV")).id;
  await prisma.school.update({ where: { id: publishedId }, data: { isPublic: true } });
  await students(publishedId, 3);
  await students(privateId, 5);
});

describe("explorateur public, sans session", () => {
  it("liste les écoles publiées avec leurs effectifs, jamais les autres", async () => {
    actAs(null);
    const res = await callRoute(GET_SCHOOLS, { path: "/api/explorer/schools" });
    expect(res.status).toBe(200);
    const schools = (res.body as { schools: Array<{ id: string; studentsCount: number }> }).schools;
    const ids = schools.map((s) => s.id);
    expect(ids).toContain(publishedId);
    expect(ids).not.toContain(privateId);
    expect(schools.find((s) => s.id === publishedId)?.studentsCount).toBe(3);
  });

  it("les statistiques ne comptent que les écoles publiées", async () => {
    actAs(null);
    const res = await callRoute(GET_OVERVIEW, { path: "/api/explorer/overview" });
    expect(res.status).toBe(200);
    const body = res.body as { schools: number; students: number };
    const publishedStudents = await prisma.studentProfile.count({ where: { deletedAt: null, school: { isActive: true, isPublic: true } } });
    expect(body.students).toBe(publishedStudents);
    expect(body.students).toBeGreaterThanOrEqual(3);
    expect(body.schools).toBe(await prisma.school.count({ where: { isActive: true, isPublic: true } }));
  });
});
