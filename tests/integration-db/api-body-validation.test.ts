import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { POST } from "@/app/api/classes/route";
import { DEFAULT_MAX_BODY_BYTES } from "@/lib/api/api-helpers";
import { actAs, callRoute, createSchool, sessionFor } from "./helpers";

/**
 * M3 — contre une vraie base : `POST /api/classes` avec `{}` ou `{bad`
 * renvoyait 500 INTERNAL_ERROR. Attendu : 400 (erreur du client), 413 pour un
 * corps démesuré, et aucune écriture en base dans tous les cas.
 */
let school: { id: string };

beforeAll(async () => {
  school = await createSchool("IT-M3");
  actAs(sessionFor("SCHOOL_ADMIN", school.id));
});

async function classCount(): Promise<number> {
  return prisma.class.count({ where: { schoolId: school.id } });
}

describe("M3 — corps de requête invalides sur une route réelle", () => {
  it("JSON cassé → 400 INVALID_JSON, rien d'écrit", async () => {
    const before = await classCount();
    const res = await callRoute(POST, { method: "POST", path: "/api/classes", rawBody: "{bad" });

    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe("INVALID_JSON");
    expect(await classCount()).toBe(before);
  });

  it("objet vide → 400 VALIDATION_ERROR avec les champs manquants, rien d'écrit", async () => {
    const before = await classCount();
    const res = await callRoute(POST, { method: "POST", path: "/api/classes", body: {} });
    const body = res.body as { code: string; details: { path: string }[] };

    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details.length).toBeGreaterThan(0);
    expect(await classCount()).toBe(before);
  });

  it("corps au-delà de la limite → 413, rien d'écrit", async () => {
    const before = await classCount();
    const res = await callRoute(POST, {
      method: "POST",
      path: "/api/classes",
      rawBody: JSON.stringify({ name: "x".repeat(DEFAULT_MAX_BODY_BYTES) }),
    });

    expect(res.status).toBe(413);
    expect(await classCount()).toBe(before);
  });
});
