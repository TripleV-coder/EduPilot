import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "@/lib/api/fetch-all-pages";

/**
 * Lot 3 — « aucune troncature fonctionnelle » : l'export CSV et le planning des
 * examens ont besoin de TOUTE la sélection. Ils parcourent les pages du curseur
 * au lieu de recevoir une liste coupée à la première page.
 */
const fetchMock = vi.fn();

function respond(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("fetchAllPages", () => {
    it("enchaîne les pages jusqu'au dernier curseur, par lots de 100", async () => {
        fetchMock
            .mockResolvedValueOnce(respond({ data: [{ id: "a" }], pagination: { limit: 100, nextCursor: "C1", hasNextPage: true } }))
            .mockResolvedValueOnce(respond({ data: [{ id: "b" }], pagination: { limit: 100, nextCursor: null, hasNextPage: false } }));

        const rows = await fetchAllPages<{ id: string }>("/api/evaluations?type=COMPO");

        expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
        const urls = fetchMock.mock.calls.map(([url]) => new URL(String(url), "http://localhost"));
        expect(urls[0].searchParams.get("limit")).toBe("100");
        expect(urls[0].searchParams.get("type")).toBe("COMPO");
        expect(urls[0].searchParams.get("total")).toBe("0");
        expect(urls[1].searchParams.get("cursor")).toBe("C1");
    });

    it("signale une erreur de l'API au lieu de renvoyer une liste partielle", async () => {
        fetchMock.mockResolvedValueOnce(respond({ error: "Accès refusé" }, 403));

        await expect(fetchAllPages("/api/evaluations")).rejects.toThrow("Accès refusé");
    });

    it("s'arrête au-delà du plafond de pages plutôt que de boucler indéfiniment", async () => {
        fetchMock.mockImplementation(async () =>
            respond({ data: [{ id: "x" }], pagination: { limit: 100, nextCursor: "encore", hasNextPage: true } }),
        );

        await expect(fetchAllPages("/api/evaluations", { maxPages: 3 })).rejects.toThrow(/plafond/);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});
