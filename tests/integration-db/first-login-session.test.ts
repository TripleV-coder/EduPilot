import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { POST } from "@/app/api/auth/first-login/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * M1 — un compte créé par un tiers se connecte avec son mot de passe
 * provisoire ; le middleware le confine alors à /first-login. Cet écran doit
 * donc fonctionner avec la SESSION (sans lien à jeton, que la plupart des
 * comptes importés ne reçoivent jamais), lever `mustChangePassword` et
 * invalider le jeton de session (reconnexion avec le nouveau mot de passe).
 *
 * Trois appels au plus dans ce fichier : la route est limitée à 3 tentatives
 * par adresse et par quart d'heure.
 */
const TEMP = "Provisoire1";
const NEW_PASSWORD = "Nouveau!Pass2026";

let schoolId: string;

async function createUser(mustChangePassword: boolean) {
  return prisma.user.create({
    data: {
      email: `${uniqueCode("m1")}@integration.test`,
      password: await bcrypt.hash(TEMP, 4),
      firstName: "Titulaire",
      lastName: "Provisoire",
      role: "TEACHER",
      schoolId,
      mustChangePassword,
    },
  });
}

beforeAll(async () => {
  schoolId = (await createSchool("IT-M1")).id;
});

describe("M1 — changement du mot de passe provisoire depuis la session", () => {
  it("mot de passe provisoire erroné → 401, rien ne change", async () => {
    const user = await createUser(true);
    actAs(sessionFor("TEACHER", schoolId, user.id));

    const res = await callRoute(POST, {
      method: "POST",
      path: "/api/auth/first-login",
      body: { currentPassword: "PasLeBon1", newPassword: NEW_PASSWORD },
    });

    expect(res.status).toBe(401);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(TEMP, after.password)).toBe(true);
  });

  it("session tenue de changer : 200, nouveau mot de passe, indicateur levé, session invalidée", async () => {
    const user = await createUser(true);
    actAs(sessionFor("TEACHER", schoolId, user.id));

    const res = await callRoute(POST, {
      method: "POST",
      path: "/api/auth/first-login",
      body: { currentPassword: TEMP, newPassword: NEW_PASSWORD },
    });

    expect(res.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare(NEW_PASSWORD, after.password)).toBe(true);
    expect(after.mustChangePassword).toBe(false);
    // passwordChangedAt invalide le JWT en cours (reconnexion obligatoire).
    expect(after.passwordChangedAt).not.toBeNull();
  });

  it("sans jeton ni obligation de changement → 400 (pas de contournement de l'ancien mot de passe)", async () => {
    const user = await createUser(false);
    actAs(sessionFor("TEACHER", schoolId, user.id));

    const res = await callRoute(POST, {
      method: "POST",
      path: "/api/auth/first-login",
      body: { currentPassword: TEMP, newPassword: NEW_PASSWORD },
    });

    expect(res.status).toBe(400);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare(TEMP, after.password)).toBe(true);
  });
});
