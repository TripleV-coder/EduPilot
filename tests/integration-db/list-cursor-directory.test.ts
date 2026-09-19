import { beforeAll, describe, expect, it, vi } from "vitest";

// Console root : l'e-mail de la session doit figurer dans ROOT_USER_EMAILS, lu au
// chargement de lib/security/root-access — défini avant l'import des routes.
vi.hoisted(() => {
  process.env.ROOT_USER_EMAILS = "super_admin@integration.test";
});

import type { Session } from "next-auth";
import prisma from "./owner-db";
import { GET as organizations } from "@/app/api/organizations/route";
import { GET as rootOrganizations } from "@/app/api/root/organizations/route";
import { GET as rootSchools } from "@/app/api/root/schools/route";
import { GET as rootUsers } from "@/app/api/root/users/route";
import { GET as schools } from "@/app/api/schools/route";
import { GET as classes } from "@/app/api/classes/route";
import { GET as payments } from "@/app/api/payments/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 3 — fin de la migration vers le curseur (format unique du projet) :
 * organisations, écoles et utilisateurs (console root comprise), classes
 * (tri composé → curseur positionnel), paiements (date d'encaissement nullable
 * → curseur positionnel). Parcours complet sans doublon ni trou, dans l'ordre
 * de la route, total sur la première page seulement. Lot 8 : `?page=` n'est plus lu.
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
    pages.push(res.body as CursorBody);
    cursor = (res.body as CursorBody).pagination.nextCursor;
  } while (cursor && pages.length < 10);
  return pages;
}

const ids = (pages: CursorBody[]) => pages.flatMap((page) => page.data.map((row) => row.id));
const at = (iso: string) => new Date(`${iso}T08:00:00.000Z`);
const ROOT = sessionFor("SUPER_ADMIN", null);

let tag: string;
let schoolId: string;
let adminId: string;
const orgIds: Record<"A" | "B" | "C", string> = { A: "", B: "", C: "" };
const networkSchoolIds: string[] = [];
const rootUserIds: string[] = [];
const classIds: Record<"sixA" | "sixB" | "fiveA", string> = { sixA: "", sixB: "", fiveA: "" };
const paymentIds: Record<"unpaid" | "recent" | "older", string> = { unpaid: "", recent: "", older: "" };

beforeAll(async () => {
  tag = uniqueCode("ANNU");
  for (const suffix of ["C", "A", "B"] as const) {
    orgIds[suffix] = (await prisma.organization.create({ data: { name: `${tag} ${suffix}`, code: uniqueCode(`ORG${suffix}`) } })).id;
  }
  for (const createdAt of ["2026-01-01", "2026-01-03", "2026-01-02"]) {
    networkSchoolIds.push(
      (await prisma.school.create({ data: { name: `${tag} École ${createdAt}`, code: uniqueCode("SCH"), level: "PRIMARY", createdAt: at(createdAt) } })).id,
    );
  }
  for (const createdAt of ["2026-02-01", "2026-02-03", "2026-02-02"]) {
    rootUserIds.push(
      (await prisma.user.create({
        data: { email: `${uniqueCode(tag.toLowerCase())}@integration.test`, password: "x", firstName: tag, lastName: "Admin", role: "SCHOOL_ADMIN", schoolId: networkSchoolIds[0], createdAt: at(createdAt) },
      })).id,
    );
  }

  schoolId = (await createSchool("IT-DIRECTORY")).id;
  const user = (first: string, role: "SCHOOL_ADMIN" | "STUDENT") =>
    prisma.user.create({ data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: "Test", role, schoolId } });
  adminId = (await user("admin", "SCHOOL_ADMIN")).id;
  const sixth = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
  const fifth = await prisma.classLevel.create({ data: { schoolId, name: "5e", code: uniqueCode("5E"), level: "SECONDARY_COLLEGE", sequence: 2 } });
  classIds.fiveA = (await prisma.class.create({ data: { schoolId, classLevelId: fifth.id, name: "5e A" } })).id;
  classIds.sixB = (await prisma.class.create({ data: { schoolId, classLevelId: sixth.id, name: "6e B" } })).id;
  classIds.sixA = (await prisma.class.create({ data: { schoolId, classLevelId: sixth.id, name: "6e A" } })).id;

  const student = await prisma.studentProfile.create({ data: { userId: (await user("eleve", "STUDENT")).id, matricule: uniqueCode("MAT"), schoolId } });
  const fee = await prisma.fee.create({ data: { schoolId, name: "Scolarité", amount: 100000 } });
  const pay = async (paidAt: Date | null) =>
    (await prisma.payment.create({ data: { studentId: student.id, feeId: fee.id, amount: 10000, method: "CASH", status: paidAt ? "VERIFIED" : "PENDING", paidAt } })).id;
  paymentIds.older = await pay(at("2026-01-10"));
  paymentIds.unpaid = await pay(null);
  paymentIds.recent = await pay(at("2026-01-12"));
});

describe("Lot 3 — organisations : curseur sur le nom", () => {
  it("parcourt les organisations par nom (super-admin)", async () => {
    actAs(ROOT);
    const pages = await collect(organizations, `/api/organizations?search=${encodeURIComponent(tag)}&limit=2`);

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([orgIds.A, orgIds.B, orgIds.C]);
  });

  it("console root : même parcours, et ?page= n'est plus lu (Lot 8)", async () => {
    actAs(ROOT);
    const pages = await collect(rootOrganizations, `/api/root/organizations?search=${encodeURIComponent(tag)}&limit=2`);
    expect(ids(pages)).toEqual([orgIds.A, orgIds.B, orgIds.C]);

    const res = await callRoute(rootOrganizations, { path: `/api/root/organizations?search=${encodeURIComponent(tag)}&page=1&limit=2` });
    const body = res.body as { data?: unknown[]; pagination?: Record<string, unknown> };

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({ limit: expect.any(Number), hasNextPage: expect.any(Boolean) });
    // Les clés de l'ancien format ont disparu.
    expect(body.pagination?.page).toBeUndefined();
    expect(body.pagination?.totalPages).toBeUndefined();
  });
});

describe("Lot 3 — écoles et utilisateurs : curseur sur la date de création", () => {
  it("console root : écoles, plus récentes d'abord", async () => {
    actAs(ROOT);
    const pages = await collect(rootSchools, `/api/root/schools?search=${encodeURIComponent(tag)}&limit=2`);

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([networkSchoolIds[1], networkSchoolIds[2], networkSchoolIds[0]]);
  });

  it("console root : utilisateurs, plus récents d'abord", async () => {
    actAs(ROOT);
    const pages = await collect(rootUsers, `/api/root/users?search=${encodeURIComponent(tag)}&limit=2`);

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([rootUserIds[1], rootUserIds[2], rootUserIds[0]]);
  });

  it("écoles accessibles d'un compte réseau, plus récentes d'abord, et ?page= n'est plus lu (Lot 8)", async () => {
    const network = sessionFor("SCHOOL_ADMIN", networkSchoolIds[0]);
    (network.user as Session["user"] & { accessibleSchoolIds: string[] }).accessibleSchoolIds = [...networkSchoolIds];
    actAs(network);
    const pages = await collect(schools, "/api/schools?limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([networkSchoolIds[1], networkSchoolIds[2], networkSchoolIds[0]]);

    actAs(network);
    const res = await callRoute(schools, { path: "/api/schools?page=2&limit=2" });
    const body = res.body as { data?: unknown[]; pagination?: Record<string, unknown> };

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({ limit: expect.any(Number), hasNextPage: expect.any(Boolean) });
    // Les clés de l'ancien format ont disparu.
    expect(body.pagination?.page).toBeUndefined();
    expect(body.pagination?.totalPages).toBeUndefined();
  });
});

describe("Lot 3 — classes : curseur positionnel (niveau puis nom)", () => {
  it("parcourt les classes par niveau puis par nom", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(classes, "/api/classes?limit=2");

    expect(pages).toHaveLength(2);
    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([classIds.sixA, classIds.sixB, classIds.fiveA]);
  });

  it("sans limite : toutes les classes de l'établissement en une réponse (défaut 200)", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(classes, { path: "/api/classes" });
    const body = res.body as CursorBody;

    expect(body.pagination).toMatchObject({ limit: 200, hasNextPage: false, total: 3 });
    expect(body.data).toHaveLength(3);
  });
});

describe("Lot 3 — paiements : curseur positionnel (date d'encaissement nullable)", () => {
  it("parcourt tous les paiements sans en perdre (non encaissé compris)", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(payments, "/api/payments?limit=2");

    expect(pages[0].pagination.total).toBe(3);
    // Ordre de la route : paidAt décroissant, non encaissé en tête (NULLS FIRST de PostgreSQL)
    expect(ids(pages)).toEqual([paymentIds.unpaid, paymentIds.recent, paymentIds.older]);
  });

  it("?page= n'est plus lu : la route répond au format unique (Lot 8)", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(payments, { path: "/api/payments?page=1&limit=2" });
    const body = res.body as { data?: unknown[]; pagination?: Record<string, unknown> };

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({ limit: expect.any(Number), hasNextPage: expect.any(Boolean) });
    // Les clés de l'ancien format ont disparu.
    expect(body.pagination?.page).toBeUndefined();
    expect(body.pagination?.totalPages).toBeUndefined();
  });
});
