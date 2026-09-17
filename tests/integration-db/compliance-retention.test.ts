import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { GET, PATCH } from "@/app/api/compliance/retention/route";
import { DEFAULT_RETENTION_POLICIES } from "@/lib/security/retention-defaults";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 6 — l'école consulte l'aperçu de la purge, ajuste ses durées et active
 * ses règles (décision du propriétaire du 2026-09-14 : durées modifiables ;
 * la purge affiche ce qu'elle va effacer avant d'agir). Chaque changement est
 * tracé dans le journal d'audit.
 */
let schoolA: string;
let schoolB: string;
const users: Partial<Record<"ADMIN_A" | "ADMIN_B" | "STUDENT_A", string>> = {};

type PlanItem = { dataType: string; months: number; isActive: boolean; affected: number; action: string; label: string };

async function user(key: keyof typeof users, role: UserRole, schoolId: string) {
  users[key] = (
    await ownerDb.user.create({
      data: { email: `${uniqueCode(key)}@integration.test`.toLowerCase(), password: "x", firstName: key, lastName: "Conservation", role, schoolId },
    })
  ).id;
}

beforeAll(async () => {
  schoolA = (await createSchool("IT-RETA")).id;
  schoolB = (await createSchool("IT-RETB")).id;
  await user("ADMIN_A", "SCHOOL_ADMIN", schoolA);
  await user("ADMIN_B", "SCHOOL_ADMIN", schoolB);
  await user("STUDENT_A", "STUDENT", schoolA);
  for (const schoolId of [schoolA, schoolB]) {
    await ownerDb.dataRetentionPolicy.createMany({
      data: DEFAULT_RETENTION_POLICIES.map((p) => ({ schoolId, dataType: p.dataType, retentionPeriod: p.months, isActive: false, description: p.description })),
    });
  }
});

const as = (key: keyof typeof users, role: UserRole, schoolId: string) => actAs(sessionFor(role, schoolId, users[key]));
const get = () => callRoute(GET, { method: "GET", path: "/api/compliance/retention" });
const patch = (body: unknown) => callRoute(PATCH, { method: "PATCH", path: "/api/compliance/retention", body });

describe("Lot 6 — réglage de la conservation par l'école", () => {
  it("l'administrateur voit l'aperçu de ses règles, dans l'ordre d'application", async () => {
    as("ADMIN_A", "SCHOOL_ADMIN", schoolA);
    const res = await get();
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const items = (res.body as { data: PlanItem[] }).data;
    expect(items.map((i) => i.dataType)).toEqual(DEFAULT_RETENTION_POLICIES.map((p) => p.dataType));
    expect(items.every((i) => i.isActive === false && typeof i.affected === "number" && i.label)).toBe(true);
  });

  it("il modifie une durée et active une règle ; le changement est tracé", async () => {
    as("ADMIN_A", "SCHOOL_ADMIN", schoolA);
    const res = await patch({ dataType: "BADGE_SCAN_LOGS", months: 6, isActive: true });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const policy = await ownerDb.dataRetentionPolicy.findUniqueOrThrow({ where: { schoolId_dataType: { schoolId: schoolA, dataType: "BADGE_SCAN_LOGS" } } });
    expect(policy).toMatchObject({ retentionPeriod: 6, isActive: true });

    const audit = await ownerDb.auditLog.findFirst({
      where: { userId: users.ADMIN_A, entity: "DataRetentionPolicy", entityId: policy.id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.oldValues).toMatchObject({ months: 3, isActive: false });
    expect(audit?.newValues).toMatchObject({ months: 6, isActive: true });
  });

  it("la comptabilité ne descend jamais sous 10 ans (OHADA) ; une durée hors bornes est refusée", async () => {
    as("ADMIN_A", "SCHOOL_ADMIN", schoolA);
    expect((await patch({ dataType: "ACCOUNTING", months: 60 })).status).toBe(400);
    expect((await patch({ dataType: "AUDIT_LOGS", months: 0 })).status).toBe(400);
    expect((await patch({ dataType: "AUDIT_LOGS", months: 1000 })).status).toBe(400);
    expect((await patch({ dataType: "INCONNU", months: 12 })).status).toBe(400);
  });

  it("un élève n'y a pas accès", async () => {
    as("STUDENT_A", "STUDENT", schoolA);
    expect((await get()).status).toBe(403);
    expect((await patch({ dataType: "AUDIT_LOGS", months: 12 })).status).toBe(403);
  });

  it("un administrateur ne modifie jamais les règles d'une autre école", async () => {
    as("ADMIN_B", "SCHOOL_ADMIN", schoolB);
    expect((await patch({ dataType: "AUDIT_LOGS", months: 24, isActive: true, schoolId: schoolA })).status).toBe(200);
    const inA = await ownerDb.dataRetentionPolicy.findUniqueOrThrow({ where: { schoolId_dataType: { schoolId: schoolA, dataType: "AUDIT_LOGS" } } });
    expect(inA).toMatchObject({ retentionPeriod: 60, isActive: false });
    const inB = await ownerDb.dataRetentionPolicy.findUniqueOrThrow({ where: { schoolId_dataType: { schoolId: schoolB, dataType: "AUDIT_LOGS" } } });
    expect(inB).toMatchObject({ retentionPeriod: 24, isActive: true });
  });
});
