import { beforeAll, describe, expect, it } from "vitest";
import { GET as complianceDashboard } from "@/app/api/compliance/dashboard/route";
import { DEFAULT_RETENTION_POLICIES } from "@/lib/security/retention-defaults";
import { CONSENT_TERMS, LEGAL_TERMS_VERSION, recordConsent } from "@/lib/security/consent";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * N59 (Lot 6) — la page Conformité lisait des champs que l'API ne renvoyait
 * pas (overallScore, consentRate, pendingPolicies, dataRequestsSummary,
 * retentionStatus) et affichait donc toujours ses valeurs de repli : 85 % de
 * conformité, 100 % de consentements, 0 demande. L'API renvoie désormais ces
 * indicateurs, calculés. Le taux de consentement était `null` (« non mesuré »)
 * tant que le mécanisme n'existait pas ; il est mesuré depuis le Lot 6 : part
 * des comptes ayant accepté la version courante des conditions.
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
  it("score, règles à revoir et demandes calculés ; aucun chiffre inventé", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(complianceDashboard, { method: "GET", path: "/api/compliance/dashboard" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = res.body as Dashboard;
    expect(body.overallScore).toBe(body.summary.complianceScore);
    expect(body.pendingPolicies).toBe(DEFAULT_RETENTION_POLICIES.length);
    expect(body.dataRequestsSummary).toEqual({ pending: 2, completed: 1, total: 3 });
    // 2 comptes, aucune acceptation : 0 %, et surtout pas les 100 % de repli.
    expect(body.consentRate).toBe(0);
  });

  it("le taux suit les acceptations réelles", async () => {
    await recordConsent({
      userId: adminId,
      consentType: CONSENT_TERMS,
      subjectUserId: adminId,
      isGranted: true,
      version: LEGAL_TERMS_VERSION,
    });
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(complianceDashboard, { method: "GET", path: "/api/compliance/dashboard" });
    expect((res.body as Dashboard).consentRate).toBe(50);
  });
});
