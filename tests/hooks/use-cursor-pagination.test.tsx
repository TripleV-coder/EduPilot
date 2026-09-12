// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";

/**
 * Lot 3 — pagination par curseur côté client : les écrans gardent « Page X / Y »
 * et leurs boutons précédent/suivant (design gelé) alors que l'API ne renvoie
 * le total qu'avec la première page (aucun count() sur les pages suivantes).
 */
type Row = { id: string };

function pageBody(ids: string[], nextCursor: string | null, total?: number) {
    return {
        data: ids.map((id) => ({ id })),
        pagination: { limit: 2, nextCursor, hasNextPage: nextCursor !== null, ...(total !== undefined ? { total } : {}) },
    };
}

const fetchMock = vi.fn();

function wrapper({ children }: { children: ReactNode }) {
    return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function requestedUrls(): URL[] {
    return fetchMock.mock.calls.map(([url]) => new URL(String(url), "http://localhost"));
}

beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
        const cursor = new URL(url, "http://localhost").searchParams.get("cursor");
        const body =
            cursor === null
                ? pageBody(["a", "b"], "C1", 5)
                : cursor === "C1"
                  ? pageBody(["c", "d"], "C2")
                  : pageBody(["e"], null);
        return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("useCursorPagination", () => {
    it("charge la première page et en déduit le nombre de pages", async () => {
        const { result } = renderHook(() => useCursorPagination<Row>("/api/evaluations", { limit: 2 }), { wrapper });

        await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(["a", "b"]));
        expect(result.current).toMatchObject({ page: 1, totalPages: 3, total: 5, hasNextPage: true, hasPreviousPage: false });
        expect(requestedUrls()[0].searchParams.get("limit")).toBe("2");
    });

    it("avance avec le curseur renvoyé et conserve le total", async () => {
        const { result } = renderHook(() => useCursorPagination<Row>("/api/evaluations", { limit: 2 }), { wrapper });
        await waitFor(() => expect(result.current.hasNextPage).toBe(true));

        act(() => result.current.next());

        await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(["c", "d"]));
        expect(result.current).toMatchObject({ page: 2, totalPages: 3, hasPreviousPage: true });
        expect(requestedUrls().at(-1)?.searchParams.get("cursor")).toBe("C1");
    });

    it("revient à la page précédente", async () => {
        const { result } = renderHook(() => useCursorPagination<Row>("/api/evaluations", { limit: 2 }), { wrapper });
        await waitFor(() => expect(result.current.hasNextPage).toBe(true));
        act(() => result.current.next());
        await waitFor(() => expect(result.current.page).toBe(2));

        act(() => result.current.prev());

        await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(["a", "b"]));
        expect(result.current).toMatchObject({ page: 1, totalPages: 3, hasPreviousPage: false });
    });

    // Annuaire public : la réponse porte aussi les régions du filtre.
    it("expose la réponse complète pour ses champs annexes", async () => {
        const { result } = renderHook(
            () => useCursorPagination<Row, { regions?: string[] }>("/api/public/schools", { limit: 2 }),
            { wrapper },
        );

        await waitFor(() => expect(result.current.response?.pagination.total).toBe(5));
        expect(result.current.response?.data).toHaveLength(2);
    });

    it("repart de la première page quand l'adresse de base change (filtre)", async () => {
        const { result, rerender } = renderHook(
            ({ url }) => useCursorPagination<Row>(url, { limit: 2 }),
            { wrapper, initialProps: { url: "/api/evaluations" } },
        );
        await waitFor(() => expect(result.current.hasNextPage).toBe(true));
        act(() => result.current.next());
        await waitFor(() => expect(result.current.page).toBe(2));

        rerender({ url: "/api/evaluations?type=COMPO" });

        await waitFor(() => expect(result.current.page).toBe(1));
        const last = requestedUrls().at(-1)!;
        expect(last.searchParams.get("type")).toBe("COMPO");
        expect(last.searchParams.get("cursor")).toBeNull();
    });
});
