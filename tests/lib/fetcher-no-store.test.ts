import { afterEach, describe, expect, it, vi } from "vitest";
import { fetcher } from "@/lib/fetcher";

/**
 * Audit MS-03 : le fetcher des écrans (SWR) ne lit jamais le cache HTTP du
 * navigateur. `Cache-Control: private, no-store` côté serveur n'efface pas
 * les réponses déjà stockées avant son déploiement (`private, max-age`).
 */
afterEach(() => {
    vi.unstubAllGlobals();
});

describe("fetcher", () => {
    it("demande toujours une réponse fraîche (cache: no-store)", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(fetcher("/api/classes")).resolves.toEqual({ ok: true });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    });
});
