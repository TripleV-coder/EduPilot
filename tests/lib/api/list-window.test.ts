import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { getListWindow } from "@/lib/api/list-window";
import { decodeCursor, encodeCursor } from "@/lib/api/pagination";

/**
 * Lot 3 — fenêtre de liste commune aux routes migrées vers le curseur :
 * curseur par défaut, ancien mode `?page=` toléré jusqu'au Lot 8.
 */
const request = (query: string) => ({ url: `http://localhost/api/x?${query}` }) as unknown as NextRequest;
const sort = { sortField: "createdAt", direction: "desc" as const };

describe("getListWindow — mode curseur (défaut)", () => {
  it("lit une ligne de plus que la limite, sans skip, total sur la première page", () => {
    const list = getListWindow(request("limit=10"), sort);

    expect(list.offset).toBeNull();
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

describe("getListWindow — ancien mode ?page= (toléré jusqu'au Lot 8)", () => {
  it("offset classique, filtre inchangé, count() toujours exécuté", () => {
    const list = getListWindow(request("page=3&limit=10"), sort);

    expect(list.offset).toEqual({ page: 3, limit: 10, skip: 20 });
    expect(list).toMatchObject({ limit: 10, take: 10, skip: 20, needsTotal: true });
    expect(list.where({ schoolId: "s1" })).toEqual({ schoolId: "s1" });
  });

  it("respecte le nom de paramètre de taille de la route (pageSize)", () => {
    const list = getListWindow(request("page=1&pageSize=5"), { ...sort, limitParam: "pageSize" });
    expect(list.offset).toEqual({ page: 1, limit: 5, skip: 0 });
  });
});
