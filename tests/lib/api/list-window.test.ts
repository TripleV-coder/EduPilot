import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { getListWindow } from "@/lib/api/list-window";
import { decodeCursor, encodeCursor } from "@/lib/api/pagination";

/**
 * Lot 3 — fenêtre de liste commune aux routes paginées : curseur (keyset).
 * Lot 8 — l'ancien mode `?page=` a été retiré, tous les consommateurs étant
 * migrés ; le paramètre est désormais ignoré, sans erreur pour un client resté
 * en arrière (il reçoit la première page au format unique).
 */
const request = (query: string) => ({ url: `http://localhost/api/x?${query}` }) as unknown as NextRequest;
const sort = { sortField: "createdAt", direction: "desc" as const };

describe("getListWindow — mode curseur (défaut)", () => {
  it("lit une ligne de plus que la limite, sans skip, total sur la première page", () => {
    const list = getListWindow(request("limit=10"), sort);

    expect(list).toMatchObject({ limit: 10, take: 11, skip: undefined, needsTotal: true });
    expect(list.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("applique le plafond et la valeur par défaut de la route", () => {
    expect(getListWindow(request("limit=100000"), { ...sort, maxLimit: 500 }).limit).toBe(500);
    expect(getListWindow(request(""), { ...sort, defaultLimit: 50 }).limit).toBe(50);
  });

  it("après un curseur : condition keyset ajoutée au filtre, aucun count()", () => {
    const at = new Date("2026-03-01T10:00:00.000Z");
    const list = getListWindow(request(`limit=10&cursor=${encodeCursor({ value: at, id: "c9" })}`), sort);

    expect(list.needsTotal).toBe(false);
    expect(list.where({ schoolId: "s1" })).toEqual({
      AND: [{ schoolId: "s1" }, { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: "c9" } }] }],
    });
  });

  it("construit la page : ligne supplémentaire retirée, curseur suivant, total transmis", () => {
    const list = getListWindow(request("limit=2"), sort);
    const rows = [
      { id: "a", createdAt: new Date("2026-03-03T00:00:00.000Z") },
      { id: "b", createdAt: new Date("2026-03-02T00:00:00.000Z") },
      { id: "c", createdAt: new Date("2026-03-01T00:00:00.000Z") },
    ];
    const page = list.page(rows, (row) => row.createdAt, 3);

    expect(page.data.map((row) => row.id)).toEqual(["a", "b"]);
    expect(page.pagination).toMatchObject({ limit: 2, hasNextPage: true, total: 3 });
    expect(decodeCursor(page.pagination.nextCursor!)).toEqual({ value: rows[1].createdAt, id: "b" });
    expect("total" in list.page(rows.slice(0, 1), (row) => row.createdAt).pagination).toBe(false);
  });
});

describe("getListWindow — curseur positionnel (tri composé ou colonne nullable)", () => {
  const positional = { positional: true as const, orderBy: [{ priority: "desc" }, { publishedAt: "desc" }, { id: "desc" }] };

  it("première page : ordre de la route, aucune condition ajoutée, total demandé", () => {
    const list = getListWindow(request("limit=2"), positional);

    expect(list).toMatchObject({ limit: 2, skip: 0, take: 3, needsTotal: true });
    expect(list.orderBy).toEqual(positional.orderBy);
    expect(list.where({ schoolId: "s1" })).toEqual({ schoolId: "s1" });
  });

  it("le curseur suivant porte la position de la page suivante", () => {
    const first = getListWindow(request("limit=2"), positional);
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const page = first.page(rows, () => 0, 5);

    expect(page.data.map((row) => row.id)).toEqual(["a", "b"]);
    expect(page.pagination).toMatchObject({ hasNextPage: true, total: 5 });

    const second = getListWindow(request(`limit=2&cursor=${page.pagination.nextCursor}`), positional);
    expect(second).toMatchObject({ skip: 2, take: 3, needsTotal: false });
  });

  it("refuse un curseur de valeur (non positionnel) : 400 via InvalidCursorError", () => {
    const valueCursor = encodeCursor({ value: new Date("2026-03-01T00:00:00.000Z"), id: "c1" });
    expect(() => getListWindow(request(`cursor=${valueCursor}`), positional)).toThrow("Curseur de pagination invalide.");
    expect(() => getListWindow(request(`cursor=${encodeCursor({ value: -4, id: "c1" })}`), positional)).toThrow();
  });
});

describe("getListWindow — ancien mode ?page= retiré (Lot 8)", () => {
  it("?page= est ignoré : première page au format curseur, jamais d'erreur", () => {
    const list = getListWindow(request("page=3&limit=10"), sort);

    expect(list).toMatchObject({ limit: 10, take: 11, skip: undefined, needsTotal: true });
    expect(list.where({ schoolId: "s1" })).toEqual({ schoolId: "s1" });
  });

  it("?pageSize= n'est plus lu : seul ?limit= fixe la taille", () => {
    const list = getListWindow(request("page=1&pageSize=5"), { ...sort, defaultLimit: 20 });
    expect(list.limit).toBe(20);
  });
});
