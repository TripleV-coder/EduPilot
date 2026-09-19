import bcrypt from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as firstLogin } from "@/app/api/auth/first-login/route";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Démarrage à vide (Lot 5, N41) — activation des comptes derrière une seule
 * adresse (salle de formation, NAT d'un établissement, réseau mobile) :
 * /api/auth/first-login comptait TOUTES les tentatives par adresse, 3 par
 * 15 minutes, réussites comprises. Au 4e compte activé, 429 pour 15 minutes.
 * Seuls les échecs (mot de passe provisoire faux) doivent compter.
 *
 * Toutes les requêtes de ce fichier partagent la même adresse client.
 */
const PROVISIONAL = "ABCD-1234";
let schoolId: string;

async function provisionalAccount() {
  const user = await ownerDb.user.create({
    data: {
      email: `${uniqueCode("activation")}@integration.test`,
      password: await bcrypt.hash(PROVISIONAL, 4),
      firstName: "Compte",
      lastName: "Provisoire",
      role: "TEACHER",
      schoolId,
      mustChangePassword: true,
    },
  });
  return user.id;
}

async function activate(userId: string, currentPassword: string) {
  actAs(sessionFor("TEACHER", schoolId, userId));
  return callRoute(firstLogin, {
    method: "POST",
    path: "/api/auth/first-login",
    body: { currentPassword, newPassword: "Nouveau!2026ab" },
  });
}

beforeAll(async () => {
  schoolId = (await createSchool("IT-N41")).id;
});

describe("N41 — activation des comptes derrière une même adresse", () => {
  it("cinq comptes s'activent d'affilée depuis la même adresse", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await activate(await provisionalAccount(), PROVISIONAL)).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
  });

  it("les échecs répétés restent limités (devinette d'un mot de passe provisoire)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await activate(await provisionalAccount(), "FAUX-0000")).status);
    }
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});
