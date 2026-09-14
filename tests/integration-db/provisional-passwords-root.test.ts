import { beforeAll, describe, expect, it, vi } from "vitest";

// La console root n'est ouverte qu'aux emails déclarés (lus au chargement du module).
const ROOT_EMAIL = vi.hoisted(() => {
  const email = "super_admin@integration.test"; // email de sessionFor("SUPER_ADMIN", …)
  process.env.ROOT_USER_EMAILS = email;
  return email;
});

import bcrypt from "bcryptjs";
import prisma from "./owner-db";
import { POST as deploySchool } from "@/app/api/root/schools/route";
import { actAs, callRoute, sessionFor, uniqueCode } from "./helpers";

/**
 * N31 — la console root pré-remplissait le mot de passe de l'administrateur
 * d'une nouvelle école à "00000000" (refusé par la validation forte, donc
 * déploiement impossible sans le remplacer ; et valeur connue de tous si elle
 * avait été acceptée). Sans mot de passe saisi, le serveur génère désormais un
 * mot de passe provisoire unique, renvoyé une seule fois, à changer (M1).
 */
beforeAll(async () => {
  // upsert : la base de CI peut être réutilisée d'une exécution à l'autre.
  const root = await prisma.user.upsert({
    where: { email: ROOT_EMAIL },
    update: {},
    create: { email: ROOT_EMAIL, password: "x", firstName: "Root", lastName: "N31", role: "SUPER_ADMIN" },
  });
  actAs(sessionFor("SUPER_ADMIN", null, root.id));
});

describe("N31 — déploiement d'une école depuis la console root", () => {
  it("sans mot de passe saisi : administrateur créé avec un mot de passe provisoire unique à changer", async () => {
    const adminEmail = `${uniqueCode("admin-ecole")}@integration.test`;
    const res = await callRoute(deploySchool, {
      method: "POST",
      path: "/api/root/schools",
      body: {
        name: `École ${uniqueCode("N31")}`,
        adminFirstName: "Mireille",
        adminLastName: "Akpovi",
        adminEmail,
      },
    });

    expect(res.status).toBe(201);
    const { provisionalPassword } = (res.body as { admin: { provisionalPassword: string } }).admin;
    expect(typeof provisionalPassword).toBe("string");
    expect(provisionalPassword).not.toBe("00000000");

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
    expect(admin.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(provisionalPassword, admin.password)).toBe(true);
  });

  it("mot de passe saisi par le super-administrateur : accepté s'il est fort, changement exigé, rien renvoyé", async () => {
    const adminEmail = `${uniqueCode("admin-ecole2")}@integration.test`;
    const res = await callRoute(deploySchool, {
      method: "POST",
      path: "/api/root/schools",
      body: {
        name: `École ${uniqueCode("N31b")}`,
        adminFirstName: "Serge",
        adminLastName: "Hounkpè",
        adminEmail,
        adminPassword: "Choisi!Root2026",
      },
    });

    expect(res.status).toBe(201);
    expect((res.body as { admin: { provisionalPassword?: string } }).admin.provisionalPassword).toBeUndefined();
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
    expect(admin.mustChangePassword).toBe(true);
  });
});
