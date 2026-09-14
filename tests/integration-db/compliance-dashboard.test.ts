import { beforeAll, describe, expect, it } from "vitest";
import { GET as complianceDashboard } from "@/app/api/compliance/dashboard/route";
import { DEFAULT_RETENTION_POLICIES } from "@/lib/security/retention-defaults";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * N59 (Lot 6) — la page Conformité lisait des champs que l'API ne renvoyait
 * pas (overallScore, consentRate, pendingPolicies, dataRequestsSummary,
 * retentionStatus) et affichait donc toujours ses valeurs de repli : 85 % de
 * conformité, 100 % de consentements, 0 demande. L'API renvoie désormais ces
 * indicateurs, calculés ; le taux de consentement est `null` (« non mesuré »)
 * tant qu'il n'est pas réellement calculé.
 */
let schoolId: string;
let adminId: string;

type Dashboard = {
  overallScore: number;
  consentRate: number | null;
  pendingPolicies: number;
  dataRequestsSummary: { pending: number; completed: number; total: number };
  summary: { complianceScore: number };
};

beforeAll(async () => {
  schoolId = (await createSchool("IT-N59")).id;
  adminId = (
    await ownerDb.user.create({
      data: { email: `${uniqueCode("admin")}@integration.test`.toLowerCase(), password: "x", firstName: "Admin", lastName: "N59", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;
  const parent = await ownerDb.user.create({
    data: { email: `${uniqueCode("parent")}@integration.test`.toLowerCase(), password: "x", firstName: "Parent", lastName: "N59", role: "PARENT", schoolId },
  });
  await ownerDb.dataAccessRequest.createMany({
    data: [
      { userId: parent.id, requestType: "EXPORT", status: "PENDING" },
      { userId: parent.id, requestType: "DELETION", status: "PENDING" },
      { userId: parent.id, requestType: "RECTIFICATION", status: "COMPLETED" },
    ],
  });
  // Règles posées inactives (écoles existantes, migration du Lot 6) : à revoir.
  await ownerDb.dataRetentionPolicy.createMany({
    data: DEFAULT_RETENTION_POLICIES.map((p) => ({ schoolId, dataType: p.dataType, retentionPeriod: p.months, isActive: false })),
  });
});

describe("N59 — indicateurs de conformité réels", () => {
  it("score, règles à revoir et demandes calculés ; consentement non mesuré plutôt qu'inventé", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(complianceDashboard, { method: "GET", path: "/api/compliance/dashboard" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = res.body as Dashboard;
    expect(body.overallScore).toBe(body.summary.complianceScore);
    expect(body.pendingPolicies).toBe(DEFAULT_RETENTION_POLICIES.length);
    expect(body.dataRequestsSummary).toEqual({ pending: 2, completed: 1, total: 3 });
    expect(body.consentRate).toBeNull();
  });
});
