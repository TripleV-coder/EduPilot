import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { DELETE, GET, PATCH } from "@/app/api/subjects/categories/[id]/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * H5 / N3 — `subjects/categories/[id]` ne filtrait que sur `id` : l'admin
 * d'une école lisait (200), modifiait (200, persisté) et désactivait (200)
 * les catégories d'une autre école. Vérifié ici contre une vraie base.
 */
const REFUSED = [403, 404];

let schoolA: { id: string };
let schoolB: { id: string };
let categoryOfB: { id: string; name: string };
let globalCategory: { id: string; name: string };

beforeAll(async () => {
  schoolA = await createSchool("IT-H5-A");
  schoolB = await createSchool("IT-H5-B");
  categoryOfB = await prisma.subjectCategory.create({
    data: { schoolId: schoolB.id, name: "Sciences (école B)", code: uniqueCode("SCI") },
  });
  globalCategory = await prisma.subjectCategory.create({
    data: { schoolId: null, name: "Tronc commun", code: uniqueCode("GLOBAL") },
  });
});

function pathOf(id: string) {
  return `/api/subjects/categories/${id}`;
}

describe("H5 — isolation inter-établissement de subjects/categories/[id]", () => {
  it("refuse la lecture d'une catégorie d'une autre école", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolA.id));
    const res = await callRoute(GET, { path: pathOf(categoryOfB.id), params: { id: categoryOfB.id } });

    expect(REFUSED).toContain(res.status);
  });

  it("refuse la modification d'une catégorie d'une autre école et ne persiste rien", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolA.id));
    const res = await callRoute(PATCH, {
      method: "PATCH",
      path: pathOf(categoryOfB.id),
      params: { id: categoryOfB.id },
      body: { name: "Piratée" },
    });

    expect(REFUSED).toContain(res.status);
    const stored = await prisma.subjectCategory.findUniqueOrThrow({ where: { id: categoryOfB.id } });
    expect(stored.name).toBe(categoryOfB.name);
  });

  it("N3 — refuse la désactivation d'une catégorie d'une autre école", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolA.id));
    const res = await callRoute(DELETE, {
      method: "DELETE",
      path: pathOf(categoryOfB.id),
      params: { id: categoryOfB.id },
    });

    expect(REFUSED).toContain(res.status);
    const stored = await prisma.subjectCategory.findUniqueOrThrow({ where: { id: categoryOfB.id } });
    expect(stored.isActive).toBe(true);
  });

  it("laisse l'admin de l'école propriétaire modifier sa catégorie", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolB.id));
    const res = await callRoute(PATCH, {
      method: "PATCH",
      path: pathOf(categoryOfB.id),
      params: { id: categoryOfB.id },
      body: { description: "Mise à jour légitime" },
    });

    expect(res.status).toBe(200);
    const stored = await prisma.subjectCategory.findUniqueOrThrow({ where: { id: categoryOfB.id } });
    expect(stored.description).toBe("Mise à jour légitime");
  });

  it("laisse un admin d'école lire une catégorie globale", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolA.id));
    const res = await callRoute(GET, { path: pathOf(globalCategory.id), params: { id: globalCategory.id } });

    expect(res.status).toBe(200);
  });

  it("réserve la modification d'une catégorie globale au super-administrateur", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolA.id));
    const refused = await callRoute(PATCH, {
      method: "PATCH",
      path: pathOf(globalCategory.id),
      params: { id: globalCategory.id },
      body: { name: "Modifiée par une école" },
    });
    expect(REFUSED).toContain(refused.status);

    actAs(sessionFor("SUPER_ADMIN", null));
    const allowed = await callRoute(PATCH, {
      method: "PATCH",
      path: pathOf(globalCategory.id),
      params: { id: globalCategory.id },
      body: { description: "Référentiel commun" },
    });
    expect(allowed.status).toBe(200);
    const stored = await prisma.subjectCategory.findUniqueOrThrow({ where: { id: globalCategory.id } });
    expect(stored.name).toBe(globalCategory.name);
  });

  it("répond 404 pour une catégorie inexistante", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolA.id));
    const res = await callRoute(GET, { path: pathOf("c000000000000000000000000"), params: { id: "c000000000000000000000000" } });

    expect(res.status).toBe(404);
  });
});
