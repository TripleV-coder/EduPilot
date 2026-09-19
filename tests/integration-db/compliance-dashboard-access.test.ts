import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { GET as complianceDashboard } from "@/app/api/compliance/dashboard/route";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * N60 (Lot 6) — /api/compliance/dashboard n'avait aucune restriction de rôle
 * (seule la page l'était) : tout compte connecté de l'école lisait les
 * compteurs de conformité et les demandes RGPD récentes, avec le nom et
 * l'email de chaque demandeur.
 */
let schoolId: string;
const users: Partial<Record<UserRole, string>> = {};

beforeAll(async () => {
  schoolId = (await createSchool("IT-N60")).id;
  for (const role of ["SCHOOL_ADMIN", "STUDENT", "PARENT", "TEACHER"] as const) {
    users[role] = (
      await ownerDb.user.create({
        data: { email: `${uniqueCode(role)}@integration.test`.toLowerCase(), password: "x", firstName: role, lastName: "N60", role, schoolId },
      })
    ).id;
  }
  // Une demande RGPD d'un parent : son nom et son email ne doivent fuiter vers personne d'autre que l'administration.
  await ownerDb.dataAccessRequest.create({ data: { userId: users.PARENT!, requestType: "EXPORT" } });
});

async function get(role: UserRole) {
  actAs(sessionFor(role, schoolId, users[role]));
  return callRoute(complianceDashboard, { method: "GET", path: "/api/compliance/dashboard" });
}

describe("N60 — tableau de conformité réservé à l'administration", () => {
  it.each(["STUDENT", "PARENT", "TEACHER"] as const)("%s : refusé (403)", async (role) => {
    const res = await get(role);
    expect(res.status, JSON.stringify(res.body)).toBe(403);
  });

  it("SCHOOL_ADMIN : autorisé", async () => {
    expect((await get("SCHOOL_ADMIN")).status).toBe(200);
  });
});
