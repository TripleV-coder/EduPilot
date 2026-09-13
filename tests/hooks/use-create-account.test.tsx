// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mutateMock = vi.fn();
vi.mock("swr", () => ({
    useSWRConfig: () => ({ mutate: mutateMock }),
}));

import { useCreateAccount } from "@/hooks/use-create-account";

/**
 * N31 — les écrans « Ajouter un enseignant » et « Nouvel utilisateur »
 * envoyaient le mot de passe "00000000" (refusé par la validation : création
 * impossible) et l'affichaient comme identifiant à transmettre. Le serveur
 * génère désormais un mot de passe provisoire unique ; l'écran affiche celui
 * qu'il reçoit.
 */
function mockFetch(status: number, body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

const OPTIONS = { endpoint: "/api/teachers", revalidatePrefix: "/api/teachers" };

describe("useCreateAccount", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("expose le mot de passe provisoire renvoyé par le serveur et revalide la liste", async () => {
        const fetchMock = mockFetch(201, { id: "u1", provisionalPassword: "HKMP-4728" });
        const { result } = renderHook(() => useCreateAccount(OPTIONS));

        let outcome: unknown;
        await act(async () => {
            outcome = await result.current.submit({ email: "a@b.bj" });
        });

        expect(outcome).toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledWith("/api/teachers", expect.objectContaining({ method: "POST" }));
        expect(result.current.success).toBe(true);
        expect(result.current.provisionalPassword).toBe("HKMP-4728");
        expect(mutateMock).toHaveBeenCalledTimes(1);
        const matcher = mutateMock.mock.calls[0][0] as (key: unknown) => boolean;
        expect(matcher("/api/teachers?limit=20")).toBe(true);
        expect(matcher("/api/students")).toBe(false);
    });

    it("aucun mot de passe affiché quand le serveur n'en a pas généré", async () => {
        mockFetch(201, { id: "u1" });
        const { result } = renderHook(() => useCreateAccount(OPTIONS));
        await act(async () => {
            await result.current.submit({});
        });
        expect(result.current.success).toBe(true);
        expect(result.current.provisionalPassword).toBeNull();
    });

    it("formate la première erreur de validation (champ : message)", async () => {
        mockFetch(400, { error: "Données invalides", details: [{ path: ["email"], message: "Email invalide" }] });
        const { result } = renderHook(() => useCreateAccount(OPTIONS));

        let outcome: unknown;
        await act(async () => {
            outcome = await result.current.submit({});
        });

        expect(outcome).toEqual({ ok: false, error: "email: Email invalide" });
        expect(result.current.error).toBe("email: Email invalide");
        expect(result.current.success).toBe(false);
        expect(mutateMock).not.toHaveBeenCalled();
    });

    it("reprend le message d'erreur du serveur, puis reset efface l'état", async () => {
        mockFetch(403, { error: "Quota d'enseignants atteint (5)" });
        const { result } = renderHook(() => useCreateAccount(OPTIONS));
        await act(async () => {
            await result.current.submit({});
        });
        expect(result.current.error).toBe("Quota d'enseignants atteint (5)");

        act(() => result.current.reset());
        expect(result.current.error).toBeNull();
        expect(result.current.success).toBe(false);
        expect(result.current.provisionalPassword).toBeNull();
    });

    it("fail() affiche une erreur de saisie détectée par l'écran", () => {
        const { result } = renderHook(() => useCreateAccount(OPTIONS));
        act(() => result.current.fail("Veuillez sélectionner un établissement."));
        expect(result.current.error).toBe("Veuillez sélectionner un établissement.");
    });
});
