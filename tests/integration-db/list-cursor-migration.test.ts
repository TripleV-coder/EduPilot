import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { GET as listStudents } from "@/app/api/students/route";
import { GET as listUsers } from "@/app/api/users/route";
import { GET as listResources } from "@/app/api/resources/route";
import { GET as listPublicSchools } from "@/app/api/public/schools/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 3 — migration des listes paginées par offset vers le curseur (keyset),
 * format décidé par le propriétaire : { data, pagination: { limit, nextCursor,
 * hasNextPage, total? } }, total sur la première page seulement, aucun OFFSET.
 * Tolérance jusqu'au Lot 8 : une requête qui envoie encore ?page= reçoit
 * l'ancien format, inchangé (consommateurs non migrés).
 *
 * Les quatre routes ci-dessous sont celles dont un écran parcourt réellement
 * les pages (élèves, parents, ressources, annuaire public).
 */
type Handler = Parameters<typeof callRoute>[0];
type CursorBody = {
  data: Array<{ id: string }>;
  pagination: { limit: number; nextCursor: string | null; hasNextPage: boolean; total?: number };
};

async function collect(handler: Handler, path: string) {
  const pages: CursorBody[] = [];
  let cursor: string | null = null;
  do {
    const separator = path.includes("?") ? "&" : "?";
    const res = await callRoute(handler, { path: cursor ? `${path}${separator}cursor=${cursor}` : path });
    expect(res.status).toBe(200);
    const body = res.body as CursorBody;
    pages.push(body);
    cursor = body.pagination.nextCursor;
  } while (cursor && pages.length < 10);
  return pages;
}

const ids = (pages: CursorBody[]) => pages.flatMap((page) => page.data.map((row) => row.id));

let schoolId: string;
let adminId: string;
const studentNames = new Map<string, string>();
const parentIds: string[] = [];
const resourceIds: string[] = [];
let directoryPrefix: string;

beforeAll(async () => {
  const school = await createSchool("IT-CURSOR");
  schoolId = school.id;
  const user = (first: string, last: string, role: "SCHOOL_ADMIN" | "STUDENT" | "PARENT") =>
    prisma.user.create({
      data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: last, role, schoolId },
    });
  adminId = (await user("admin", "Test", "SCHOOL_ADMIN")).id;

  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const level = await prisma.classLevel.create({ data: { schoolId, name: "CP", code: uniqueCode("CP"), level: "PRIMARY", sequence: 1 } });
  const klass = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "A" } });

  // Deux homonymes : l'ordre doit rester stable (départage par identifiant).
  for (const lastName of ["Zinsou", "Bello", "Adjovi", "Bello", "Dossou"]) {
    const u = await user("Élève", lastName, "STUDENT");
    const student = await prisma.studentProfile.create({ data: { userId: u.id, matricule: uniqueCode("MAT"), schoolId } });
    await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, academicYearId: year.id } });
    studentNames.set(student.id, lastName);
  }

  for (const name of ["p1", "p2", "p3"]) parentIds.push((await user(name, "Parent", "PARENT")).id);

  for (const title of ["Fiche 1", "Fiche 2", "Fiche 3"]) {
    resourceIds.push(
      (await prisma.resource.create({ data: { schoolId, title, type: "DOCUMENT", fileUrl: "https://example.test/f.pdf", fileType: "pdf" } })).id,
    );
  }

  directoryPrefix = uniqueCode("Annuaire");
  for (const [suffix, region] of [["C", "Littoral"], ["A", "Borgou"], ["B", "Littoral"]] as const) {
    await prisma.school.create({
      data: { name: `${directoryPrefix} ${suffix}`, code: uniqueCode("PUB"), level: "PRIMARY", isPublic: true, region },
    });
  }
});

describe("Lot 3 — élèves : curseur sur le nom", () => {
  it("parcourt tous les élèves par nom, sans doublon, total sur la première page seulement", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(listStudents, "/api/students?limit=2");

    expect(pages).toHaveLength(3);
    expect(pages[0].pagination.total).toBe(5);
    expect(pages[1].pagination.total).toBeUndefined();
    const seen = ids(pages);
    expect(new Set(seen).size).toBe(5);
    expect(seen.map((id) => studentNames.get(id))).toEqual(["Adjovi", "Bello", "Bello", "Dossou", "Zinsou"]);
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(listStudents, { path: "/api/students?page=2&limit=2" });
    const body = res.body as { data: unknown[]; pagination: Record<string, unknown> };

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });
});

describe("Lot 3 — utilisateurs (écran Parents) : curseur sur la date de création", () => {
  it("parcourt tous les parents sans doublon", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(listUsers, "/api/users?role=PARENT&limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages).sort()).toEqual([...parentIds].sort());
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(listUsers, { path: "/api/users?role=PARENT&page=1&limit=2" });

    expect(res.status).toBe(200);
    expect((res.body as { pagination: Record<string, unknown> }).pagination).toMatchObject({ page: 1, total: 3, totalPages: 2 });
  });
});

describe("Lot 3 — ressources : curseur sur la date de création", () => {
  it("parcourt toutes les ressources sans doublon", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(listResources, "/api/resources?limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages).sort()).toEqual([...resourceIds].sort());
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(listResources, { path: "/api/resources?page=1&limit=2" });
    const body = res.body as { resources: unknown[]; pagination: Record<string, unknown> };

    expect(res.status).toBe(200);
    expect(body.resources).toHaveLength(2);
    expect(body.pagination).toMatchObject({ page: 1, total: 3, totalPages: 2 });
  });
});

describe("Lot 3 — annuaire public : curseur sur le nom", () => {
  it("parcourt les établissements publiés par nom et fournit les régions", async () => {
    actAs(null);
    const pages = await collect(listPublicSchools, `/api/public/schools?q=${encodeURIComponent(directoryPrefix)}&limit=2`);

    expect(pages[0].pagination.total).toBe(3);
    const names = pages.flatMap((page) => (page.data as unknown as Array<{ name: string }>).map((school) => school.name));
    expect(names).toEqual([`${directoryPrefix} A`, `${directoryPrefix} B`, `${directoryPrefix} C`]);
    expect((pages[0] as unknown as { regions: string[] }).regions).toEqual(expect.arrayContaining(["Borgou", "Littoral"]));
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(null);
    const res = await callRoute(listPublicSchools, { path: `/api/public/schools?q=${encodeURIComponent(directoryPrefix)}&page=1` });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 12, total: 3, totalPages: 1 });
    expect((res.body as { schools: unknown[] }).schools).toHaveLength(3);
  });
});
