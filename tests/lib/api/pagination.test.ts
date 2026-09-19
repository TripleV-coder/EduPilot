import { describe, expect, it } from "vitest";
import {
    buildCursorPage,
    decodeCursor,
    encodeCursor,
    getCursorParams,
    InvalidCursorError,
    keysetOrderBy,
    keysetWhere,
} from "@/lib/api/pagination";

/**
 * Lot 3 — format de pagination unique validé par le propriétaire :
 *   GET ?limit=20&cursor=<opaque>&total=0
 *   { data, pagination: { limit, nextCursor, hasNextPage, total? } }
 * Keyset sur (clé de tri, id) : ni OFFSET, ni surcoût ; `total` seulement sur
 * la première page (aucun count() sur les pages suivantes).
 */
function params(query: string) {
    return getCursorParams(new URL(`http://localhost/api/x?${query}`).searchParams);
}

describe("curseur opaque", () => {
    it("restitue une date et l'identifiant", () => {
        const date = new Date("2026-03-14T08:00:00.000Z");
        const decoded = decodeCursor(encodeCursor({ value: date, id: "cev1" }));

        expect(decoded.value).toBeInstanceOf(Date);
        expect((decoded.value as Date).toISOString()).toBe(date.toISOString());
        expect(decoded.id).toBe("cev1");
    });

    it("restitue une chaîne ou un nombre", () => {
        expect(decodeCursor(encodeCursor({ value: "Dossou", id: "c1" })).value).toBe("Dossou");
        expect(decodeCursor(encodeCursor({ value: 42, id: "c1" })).value).toBe(42);
    });

    it("est sûr dans une URL", () => {
        expect(encodeCursor({ value: "é/+=?&", id: "c1" })).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("rejette un curseur forgé ou corrompu", () => {
        expect(() => decodeCursor("pas-un-curseur")).toThrow(InvalidCursorError);
        expect(() => decodeCursor(Buffer.from('{"id":1}').toString("base64url"))).toThrow(InvalidCursorError);
    });
});

describe("getCursorParams", () => {
    it("applique la limite par défaut et le plafond", () => {
        expect(params("").limit).toBe(20);
        expect(params("limit=500").limit).toBe(100);
        expect(params("limit=0").limit).toBe(1);
        expect(params("limit=abc").limit).toBe(20);
    });

    it("calcule le total sur la première page seulement", () => {
        expect(params("").withTotal).toBe(true);
        const next = encodeCursor({ value: "x", id: "c1" });
        expect(params(`cursor=${next}`).withTotal).toBe(false);
    });

    it("permet de renoncer au total", () => {
        expect(params("total=0").withTotal).toBe(false);
    });

    it("signale un curseur invalide", () => {
        expect(() => params("cursor=%%%")).toThrow(InvalidCursorError);
    });
});

describe("keyset", () => {
    const cursor = { value: new Date("2026-03-14T00:00:00.000Z"), id: "cev5" };

    it("ordonne de façon stable par (clé, id)", () => {
        expect(keysetOrderBy("date", "desc")).toEqual([{ date: "desc" }, { id: "desc" }]);
    });

    it("reprend strictement après le dernier élément (ordre décroissant)", () => {
        expect(keysetWhere("date", "desc", cursor)).toEqual({
            OR: [{ date: { lt: cursor.value } }, { date: cursor.value, id: { lt: "cev5" } }],
        });
    });

    it("reprend strictement après le dernier élément (ordre croissant)", () => {
        expect(keysetWhere("date", "asc", cursor)).toEqual({
            OR: [{ date: { gt: cursor.value } }, { date: cursor.value, id: { gt: "cev5" } }],
        });
    });

    it("n'ajoute aucune condition sur la première page", () => {
        expect(keysetWhere("date", "desc", null)).toEqual({});
    });

    // Migration des listes par offset : tri sur un champ d'une relation (élèves par nom).
    it("accepte une clé de tri portée par une relation (chemin pointé)", () => {
        const name = { value: "Dossou", id: "stu7" };

        expect(keysetOrderBy("user.lastName", "asc")).toEqual([{ user: { lastName: "asc" } }, { id: "asc" }]);
        expect(keysetWhere("user.lastName", "asc", name)).toEqual({
            OR: [
                { user: { lastName: { gt: "Dossou" } } },
                { user: { lastName: "Dossou" }, id: { gt: "stu7" } },
            ],
        });
    });
});

describe("buildCursorPage", () => {
    const rows = [1, 2, 3].map((n) => ({ id: `c${n}`, date: new Date(2026, 0, n) }));

    it("détecte la page suivante grâce à l'élément supplémentaire (take: limit + 1)", () => {
        const page = buildCursorPage(rows, 2, (row) => row.date);

        expect(page.data.map((r) => r.id)).toEqual(["c1", "c2"]);
        expect(page.pagination.hasNextPage).toBe(true);
        expect(decodeCursor(page.pagination.nextCursor!).id).toBe("c2");
    });

    it("n'annonce pas de page suivante sur la dernière page", () => {
        const page = buildCursorPage(rows, 5, (row) => row.date);

        expect(page.data).toHaveLength(3);
        expect(page.pagination).toEqual({ limit: 5, hasNextPage: false, nextCursor: null });
    });
});
