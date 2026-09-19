import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "./owner-db";
import { POST } from "@/app/api/auth/first-login/route";
import { actAs, callRoute, createSchool, uniqueCode } from "./helpers";

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
      data: { userId: user.id, token, tempPassword: null, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
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
});
