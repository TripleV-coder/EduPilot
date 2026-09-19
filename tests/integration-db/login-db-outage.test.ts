import { afterAll, describe, expect, inject, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
// Même classe que celle réexportée par next-auth (qui exige le runtime Next).
import { CredentialsSignin } from "@auth/core/errors";
import { isInfrastructureError, toSigninError } from "@/lib/auth/login-failure";

/**
 * M10 — pendant une panne de base, NextAuth répondait 302 sans session et
 * l'écran affichait « Email ou mot de passe incorrect » : le support était
 * trompé. On classe ici de VRAIES erreurs Prisma (aucun mock) :
 *  - base injoignable → CredentialsSignin code « service_unavailable » ;
 *  - erreur métier (contrainte d'unicité) → inchangée.
 */
const unreachable = new PrismaClient({
  datasourceUrl: "postgresql://edupilot:edupilot@127.0.0.1:1/injoignable_it?connect_timeout=2",
});
const reachable = new PrismaClient({ datasourceUrl: inject("databaseUrl") });

afterAll(async () => {
  await Promise.allSettled([unreachable.$disconnect(), reachable.$disconnect()]);
});

async function captured(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("une erreur était attendue");
}

describe("M10 — classement des échecs de connexion", () => {
  it("reconnaît une base injoignable comme une panne d'infrastructure", async () => {
    const error = await captured(() => unreachable.user.findUnique({ where: { email: "x@ecole.bj" } }));

    expect(isInfrastructureError(error)).toBe(true);
    const signin = toSigninError(error);
    expect(signin).toBeInstanceOf(CredentialsSignin);
    expect((signin as CredentialsSignin).code).toBe("service_unavailable");
  });

  it("ne confond pas une erreur métier avec une panne", async () => {
    const code = `IT-M10-${Date.now()}`;
    await reachable.school.create({ data: { name: "École M10", code, level: "PRIMARY" } });
    const error = await captured(() =>
      reachable.school.create({ data: { name: "Doublon", code, level: "PRIMARY" } }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(isInfrastructureError(error)).toBe(false);
    expect(toSigninError(error)).toBe(error);
  });

  it("laisse passer tel quel un refus d'identifiants déjà typé", () => {
    const refusal = new CredentialsSignin();
    expect(toSigninError(refusal)).toBe(refusal);
  });
});
