import { describe, expect, it } from "vitest";
import { listFrom } from "@/lib/api/list-payload";

/**
 * N25 — `/api/classes` renvoie `{ data, pagination }` ; des écrans lisaient
 * `classes` ou traitaient la réponse comme un tableau (liste vide, `.map` sur un objet).
 */
const row = { id: "c1", name: "6e A" };

describe("listFrom", () => {
  it("lit la clé data du format paginé (curseur ou ?page=)", () => {
    expect(listFrom({ data: [row], pagination: { limit: 200, nextCursor: null, hasNextPage: false } })).toEqual([row]);
    expect(listFrom({ data: [row], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } })).toEqual([row]);
  });

  it("accepte un tableau brut, renvoie une liste vide sinon (jamais un objet)", () => {
    expect(listFrom([row])).toEqual([row]);
    expect(listFrom({ classes: [row] })).toEqual([]);
    expect(listFrom(undefined)).toEqual([]);
    expect(listFrom(null)).toEqual([]);
  });
});
