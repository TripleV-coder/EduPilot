import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { GET as GET_MEDICAL } from "@/app/api/health/medical-records/route";
import { GET as GET_CLASSES } from "@/app/api/classes/route";
import { GET as GET_MODULES, PATCH as PATCH_MODULES } from "@/app/api/schools/[id]/modules/route";
import { createSchoolWithDefaults } from "@/lib/schools/provisioning";
import { DEFAULT_ENABLED_MODULES, ALL_MODULE_IDS } from "@/lib/modules/catalog";
import { invalidateSchoolModulesCache } from "@/lib/modules/school-modules";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 6 — minimisation : un module éteint n'est pas seulement masqué dans la
 * navigation, son API répond 403. Une école sans infirmerie ne détient aucune
 * donnée de santé.
 */
let school: string;
const users: Partial<Record<"ADMIN" | "STUDENT", string>> = {};

async function user(key: keyof typeof users, role: UserRole, schoolId: string) {
  users[key] = (
    await ownerDb.user.create({
      data: { email: `${uniqueCode(key)}@integration.test`.toLowerCase(), password: "x", firstName: key, lastName: "Modules", role, schoolId },
    })
  ).id;
}

beforeAll(async () => {
  school = (await createSchool("IT-MOD")).id;
  await user("ADMIN", "SCHOOL_ADMIN", school);
  await user("STUDENT", "STUDENT", school);
  // Une école existante : tous les modules (ce que pose la migration).
  await ownerDb.school.update({ where: { id: school }, data: { enabledModules: ALL_MODULE_IDS } });
  invalidateSchoolModulesCache();
});

const asAdmin = () => actAs(sessionFor("SCHOOL_ADMIN", school, users.ADMIN));
const medical = () => callRoute(GET_MEDICAL, { method: "GET", path: "/api/health/medical-records" });
const classes = () => callRoute(GET_CLASSES, { method: "GET", path: "/api/classes" });
const getModules = () => callRoute(GET_MODULES, { method: "GET", path: `/api/schools/${school}/modules`, params: { id: school } });
const patchModules = (enabledModules: string[]) =>
  callRoute(PATCH_MODULES, { method: "PATCH", path: `/api/schools/${school}/modules`, params: { id: school }, body: { enabledModules } });

describe("Lot 6 — modules activés par établissement", () => {
  it("une école créée aujourd'hui n'a que le socle actif", async () => {
    const created = await ownerDb.$transaction((tx) =>
      createSchoolWithDefaults(tx, { name: `Modules ${uniqueCode("NEW")}`, level: "PRIMARY" }),
    );
    const fresh = await ownerDb.school.findUniqueOrThrow({ where: { id: created.id }, select: { enabledModules: true } });
    expect([...fresh.enabledModules].sort()).toEqual([...DEFAULT_ENABLED_MODULES].sort());
    expect(fresh.enabledModules).not.toContain("health");
  });

  it("module actif : la route de santé répond normalement", async () => {
    asAdmin();
    expect((await medical()).status).toBe(200);
  });

  it("module éteint : la route de santé répond 403 MODULE_DISABLED, le socle reste joignable", async () => {
    asAdmin();
    expect((await patchModules(ALL_MODULE_IDS.filter((m) => m !== "health"))).status).toBe(200);

    const refused = await medical();
    expect(refused.status).toBe(403);
    expect((refused.body as { code?: string }).code).toBe("MODULE_DISABLED");

    expect((await classes()).status).toBe(200);
  });

  it("l'école rallume le module et la route répond de nouveau", async () => {
    asAdmin();
    expect((await patchModules([...ALL_MODULE_IDS])).status).toBe(200);
    expect((await medical()).status).toBe(200);
  });

  it("un module indispensable ne peut pas être éteint", async () => {
    asAdmin();
    const res = await patchModules(["grades"]);
    expect(res.status).toBe(200);
    const after = await ownerDb.school.findUniqueOrThrow({ where: { id: school }, select: { enabledModules: true } });
    expect(after.enabledModules).toContain("students");
    expect(after.enabledModules).toContain("classes");
    expect((await classes()).status).toBe(200);
  });

  it("un élève consulte la liste mais ne règle pas les modules", async () => {
    actAs(sessionFor("STUDENT", school, users.STUDENT));
    expect((await patchModules([...ALL_MODULE_IDS])).status).toBe(403);
  });

  it("l'aperçu indique l'état de chaque module du catalogue", async () => {
    asAdmin();
    await patchModules([...ALL_MODULE_IDS]);
    const res = await getModules();
    expect(res.status).toBe(200);
    const items = (res.body as { data: { id: string; enabled: boolean; required: boolean; label: string }[] }).data;
    expect(items.map((i) => i.id)).toEqual([...ALL_MODULE_IDS]);
    expect(items.every((i) => i.enabled && i.label)).toBe(true);
    expect(items.find((i) => i.id === "students")?.required).toBe(true);
  });
});
