import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "./owner-db";
import { GET as CHECK, POST } from "@/app/api/auth/first-login/route";
import { POST as ISSUE } from "@/app/api/users/[id]/activation-link/route";
import { hashActivationToken } from "@/lib/auth/activation-link";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * M1 — le parcours historique par lien (/first-login?token=…) changeait le mot
 * de passe sans lever `mustChangePassword` : une fois l'obligation imposée par
 * le middleware, le titulaire serait resté confiné malgré un mot de passe
 * définitif.
 */
describe("M1 — premier login par lien", () => {
  it("lève mustChangePassword et invalide la session en cours", async () => {
    const schoolId = (await createSchool("IT-M1T")).id;
    const user = await prisma.user.create({
      data: {
        email: `${uniqueCode("m1t")}@integration.test`,
        password: await bcrypt.hash("Provisoire1", 4),
        firstName: "Titulaire",
        lastName: "Lien",
        role: "PARENT",
        schoolId,
        mustChangePassword: true,
      },
    });
    const token = uniqueCode("tok");
    await prisma.firstLoginToken.create({
      data: { userId: user.id, token: hashActivationToken(token), tempPassword: null, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    actAs(null);

    const res = await callRoute(POST, {
      method: "POST",
      path: "/api/auth/first-login",
      body: { token, newPassword: "Nouveau!Pass2026" },
    });

    expect(res.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.mustChangePassword).toBe(false);
    expect(after.passwordChangedAt).not.toBeNull();
  });

  it("la direction émet le lien, le titulaire active son compte, le lien ne resert pas", async () => {
    const schoolId = (await createSchool("IT-ACT")).id;
    const otherSchoolId = (await createSchool("IT-ACT2")).id;
    const user = await prisma.user.create({
      data: {
        email: `${uniqueCode("act")}@integration.test`,
        password: await bcrypt.hash("Provisoire1", 4),
        firstName: "Parent",
        lastName: "Lien",
        role: "PARENT",
        schoolId,
        mustChangePassword: true,
      },
    });

    // Une autre école ne voit pas le compte (souveraineté).
    actAs(sessionFor("SCHOOL_ADMIN", otherSchoolId));
    const foreign = await callRoute(ISSUE, { method: "POST", path: `/api/users/${user.id}/activation-link`, params: { id: user.id } });
    expect(foreign.status).toBe(404);

    actAs(sessionFor("SCHOOL_ADMIN", schoolId));
    const issued = await callRoute(ISSUE, { method: "POST", path: `/api/users/${user.id}/activation-link`, params: { id: user.id } });
    expect(issued.status).toBe(200);
    const { link } = issued.body as { link: string };
    const token = new URL(link).searchParams.get("token")!;
    const stored = await prisma.firstLoginToken.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].token).toBe(hashActivationToken(token));

    // Un second envoi annule le premier lien.
    const reissued = await callRoute(ISSUE, { method: "POST", path: `/api/users/${user.id}/activation-link`, params: { id: user.id } });
    const second = new URL((reissued.body as { link: string }).link).searchParams.get("token")!;
    expect(await prisma.firstLoginToken.count({ where: { userId: user.id } })).toBe(1);

    actAs(null);
    const stale = await callRoute(CHECK, { method: "GET", path: `/api/auth/first-login?token=${encodeURIComponent(token)}` });
    expect(stale.status).toBe(404);
    const fresh = await callRoute(CHECK, { method: "GET", path: `/api/auth/first-login?token=${encodeURIComponent(second)}` });
    expect(fresh.status).toBe(200);
    expect((fresh.body as { requiresTempPassword: boolean }).requiresTempPassword).toBe(false);

    const activated = await callRoute(POST, {
      method: "POST",
      path: "/api/auth/first-login",
      body: { token: second, newPassword: "Nouveau!Pass2026" },
    });
    expect(activated.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(false);

    const reuse = await callRoute(POST, {
      method: "POST",
      path: "/api/auth/first-login",
      body: { token: second, newPassword: "Autre!Pass2026" },
    });
    expect(reuse.status).toBe(400);

    // Compte activé : plus aucun lien ne peut être émis.
    actAs(sessionFor("SCHOOL_ADMIN", schoolId));
    const afterActivation = await callRoute(ISSUE, { method: "POST", path: `/api/users/${user.id}/activation-link`, params: { id: user.id } });
    expect(afterActivation.status).toBe(409);
  });
});
