import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSchoolWithDefaults } from "@/lib/schools/provisioning";
import { DEFAULT_RETENTION_POLICIES } from "@/lib/security/retention";
import ownerDb from "./owner-db";
import { uniqueCode } from "./helpers";

/**
 * Lot 6 — durées de conservation par défaut (décision du propriétaire du
 * 2026-09-14) :
 * - une NOUVELLE école reçoit les durées décidées, actives ;
 * - les écoles EXISTANTES les reçoivent inactives, par migration : une
 *   migration ne doit jamais déclencher d'elle-même des effacements sur une
 *   base réelle (règle 5) ; l'école les active après avoir vu l'aperçu.
 */
const MIGRATION = path.resolve("prisma/migrations/20260914170000_default_retention_policies/migration.sql");
const expected = DEFAULT_RETENTION_POLICIES.map((p) => [p.dataType, p.months]).sort();

async function policiesOf(schoolId: string) {
  return ownerDb.dataRetentionPolicy.findMany({ where: { schoolId }, orderBy: { dataType: "asc" } });
}

describe("Lot 6 — durées de conservation par défaut", () => {
  it("une nouvelle école reçoit les durées décidées, actives", async () => {
    const school = await ownerDb.$transaction((tx) => createSchoolWithDefaults(tx, { name: `École ${uniqueCode("RET-NEW")}` }));
    const policies = await policiesOf(school.id);
    expect(policies.map((p) => [p.dataType, p.retentionPeriod]).sort()).toEqual(expected);
    expect(policies.every((p) => p.isActive)).toBe(true);
  });

  it("la migration pose les durées inactives sur les écoles existantes, sans écraser un réglage, et une seule fois", async () => {
    const code = uniqueCode("RET-OLD");
    const school = await ownerDb.school.create({ data: { name: `École ${code}`, code, level: "PRIMARY" } });
    // Réglage déjà fait par l'école : conservé tel quel.
    await ownerDb.dataRetentionPolicy.create({ data: { schoolId: school.id, dataType: "BADGE_SCAN_LOGS", retentionPeriod: 1, isActive: true } });

    const sql = readFileSync(MIGRATION, "utf8");
    await ownerDb.$executeRawUnsafe(sql);
    await ownerDb.$executeRawUnsafe(sql);

    const policies = await policiesOf(school.id);
    expect(policies).toHaveLength(DEFAULT_RETENTION_POLICIES.length);
    const badges = policies.find((p) => p.dataType === "BADGE_SCAN_LOGS");
    expect(badges).toMatchObject({ retentionPeriod: 1, isActive: true });
    for (const policy of policies.filter((p) => p.dataType !== "BADGE_SCAN_LOGS")) {
      expect(policy.isActive, policy.dataType).toBe(false);
      expect(policy.retentionPeriod).toBe(DEFAULT_RETENTION_POLICIES.find((d) => d.dataType === policy.dataType)?.months);
      expect(policy.description).toBeTruthy();
    }
  });
});
