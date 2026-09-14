import { beforeAll, describe, expect, it, vi } from "vitest";

// Console root : l'e-mail de la session doit figurer dans ROOT_USER_EMAILS, lu au
// chargement de lib/security/root-access — défini avant l'import des routes.
vi.hoisted(() => {
  process.env.ROOT_USER_EMAILS = "super_admin@integration.test";
});

import prisma from "./owner-db";
import { GET as auditLogs } from "@/app/api/audit-logs/route";
import { GET as events } from "@/app/api/events/route";
import { GET as dataRequests } from "@/app/api/compliance/data-requests/route";
import { GET as rootLogs } from "@/app/api/root/logs/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 3 — migration vers le curseur (format unique du projet) des journaux et
 * listes qui grossissent avec l'usage : journal d'audit (école et console root),
 * événements, demandes relatives aux données personnelles.
 * Attendu : parcours complet sans doublon ni trou, dans l'ordre de la route,
 * total sur la première page seulement ; `?page=` renvoie encore l'ancien format.
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

let schoolId: string;
let adminId: string;
let rootId: string;
let tag: string;
const logIds: string[] = [];
const eventIds: string[] = [];
const requestIds: string[] = [];

beforeAll(async () => {
  schoolId = (await createSchool("IT-JOURNAL")).id;
  tag = uniqueCode("journal");
  const user = (first: string, role: "SCHOOL_ADMIN" | "SUPER_ADMIN" | "PARENT", school: string | null = schoolId) =>
    prisma.user.create({ data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: "Test", role, schoolId: school } });
  adminId = (await user("admin", "SCHOOL_ADMIN")).id;
  rootId = (await user("root", "SUPER_ADMIN", null)).id;
  const parentId = (await user("parent", "PARENT")).id;

  // Même horodatage pour deux entrées : l'ordre doit rester stable (départage par id).
  const at = (iso: string) => new Date(`${iso}T08:00:00.000Z`);
  for (const [i, createdAt] of ["2026-03-01", "2026-03-02", "2026-03-02", "2026-03-04", "2026-03-05"].entries()) {
    logIds.push(
      (await prisma.auditLog.create({ data: { userId: adminId, schoolId, action: `${tag}-${i}`, entity: "Test", createdAt: at(createdAt) } })).id,
    );
  }
  for (const [i, startDate] of ["2026-05-03", "2026-05-01", "2026-05-02"].entries()) {
    eventIds.push(
      (await prisma.schoolEvent.create({ data: { schoolId, title: `Événement ${i}`, type: "GENERAL", startDate: at(startDate), isPublished: true } })).id,
    );
  }
  for (const [i, requestedAt] of ["2026-04-01", "2026-04-03", "2026-04-02"].entries()) {
    requestIds.push(
      (await prisma.dataAccessRequest.create({ data: { userId: parentId, requestType: i === 0 ? "EXPORT" : "DELETION", requestedAt: at(requestedAt) } })).id,
    );
  }
});

describe("Lot 3 — journal d'audit de l'établissement : curseur sur la date", () => {
  it("parcourt toutes les entrées, plus récentes d'abord, total sur la première page seulement", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(auditLogs, `/api/audit-logs?search=${tag}&limit=2`);

    expect(pages).toHaveLength(3);
    expect(pages[0].pagination.total).toBe(5);
    expect(pages[1].pagination.total).toBeUndefined();
    const seen = ids(pages);
    expect(new Set(seen).size).toBe(5);
    // Plus récentes d'abord ; les deux entrées du 2 mars départagées par id décroissant.
    const sameDay = [logIds[1], logIds[2]].sort().reverse();
    expect(seen).toEqual([logIds[4], logIds[3], ...sameDay, logIds[0]]);
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(auditLogs, { path: `/api/audit-logs?search=${tag}&page=2&limit=2` });

    expect(res.status).toBe(200);
    expect((res.body as { logs: unknown[] }).logs).toHaveLength(2);
    expect((res.body as { pagination: Record<string, unknown> }).pagination).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });
});

describe("Lot 3 — journal de la console root : curseur sur la date", () => {
  it("parcourt toutes les entrées de l'établissement sans doublon", async () => {
    actAs(sessionFor("SUPER_ADMIN", null, rootId));
    const pages = await collect(rootLogs, `/api/root/logs?schoolId=${schoolId}&limit=2`);

    expect(pages[0].pagination.total).toBe(5);
    expect(ids(pages).sort()).toEqual([...logIds].sort());
  });
});

describe("Lot 3 — événements : curseur sur la date de début", () => {
  it("parcourt les événements publiés dans l'ordre chronologique", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(events, "/api/events?limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([eventIds[1], eventIds[2], eventIds[0]]);
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(events, { path: "/api/events?page=1&limit=2" });

    expect(res.status).toBe(200);
    expect((res.body as { events: unknown[] }).events).toHaveLength(2);
    expect((res.body as { pagination: Record<string, unknown> }).pagination).toMatchObject({ page: 1, total: 3, totalPages: 2 });
  });
});

describe("Lot 3 — demandes relatives aux données personnelles : curseur sur la date de demande", () => {
  it("parcourt toutes les demandes de l'établissement, plus récentes d'abord", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(dataRequests, "/api/compliance/data-requests?limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([requestIds[1], requestIds[2], requestIds[0]]);
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(dataRequests, { path: "/api/compliance/data-requests?page=1&limit=2" });

    expect(res.status).toBe(200);
    expect((res.body as { requests: unknown[] }).requests).toHaveLength(2);
    expect((res.body as { pagination: Record<string, unknown> }).pagination).toMatchObject({ page: 1, total: 3, totalPages: 2 });
  });
});
