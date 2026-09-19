// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const useSessionMock = vi.fn();
const signOutMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next-auth/react", () => ({
    useSession: () => useSessionMock(),
    signOut: (...args: unknown[]) => signOutMock(...args),
}));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

import { useFirstLogin } from "@/hooks/use-first-login";

/**
 * M1 — l'écran /first-login ne fonctionnait qu'avec un lien à jeton. Une
 * session confinée par le middleware (mot de passe provisoire à changer)
 * voyait « Lien invalide » : le titulaire restait bloqué.
 */
function mockFetch(status: number, body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

const VALUES = { currentPassword: "Provisoire1", newPassword: "Nouveau!Pass2026" };

describe("useFirstLogin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("mode « token » quand l'écran est ouvert par un lien", () => {
        useSessionMock.mockReturnValue({ status: "unauthenticated", data: null });
        const { result } = renderHook(() => useFirstLogin({ token: "abc" }));
        expect(result.current.mode).toBe("token");
    });

    it("mode « session » pour un compte tenu de changer son mot de passe provisoire", () => {
        useSessionMock.mockReturnValue({ status: "authenticated", data: { user: { mustChangePassword: true } } });
        const { result } = renderHook(() => useFirstLogin({ token: null }));
        expect(result.current.mode).toBe("session");
    });

    it("mode « invalid » sans lien ni obligation, « loading » tant que la session se charge", () => {
        useSessionMock.mockReturnValue({ status: "authenticated", data: { user: { mustChangePassword: false } } });
        expect(renderHook(() => useFirstLogin({ token: null })).result.current.mode).toBe("invalid");

        useSessionMock.mockReturnValue({ status: "loading", data: null });
        expect(renderHook(() => useFirstLogin({ token: null })).result.current.mode).toBe("loading");
    });

    it("mode session : envoie sans jeton, déconnecte puis renvoie vers la connexion", async () => {
        useSessionMock.mockReturnValue({ status: "authenticated", data: { user: { mustChangePassword: true } } });
        const fetchMock = mockFetch(200, { success: true });
        const { result } = renderHook(() => useFirstLogin({ token: null, redirectDelayMs: 0 }));

        await act(() => result.current.submit(VALUES));

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body).toEqual({ currentPassword: VALUES.currentPassword, newPassword: VALUES.newPassword });
        expect(signOutMock).toHaveBeenCalledWith({ redirect: false });
        expect(result.current.isSuccess).toBe(true);
        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login?firstLogin=1"));
    });

    it("mode token : envoie le jeton, sans déconnexion (aucune session ouverte)", async () => {
        useSessionMock.mockReturnValue({ status: "unauthenticated", data: null });
        const fetchMock = mockFetch(200, { success: true });
        const { result } = renderHook(() => useFirstLogin({ token: "abc", redirectDelayMs: 0 }));

        await act(() => result.current.submit(VALUES));

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ token: "abc" });
        expect(signOutMock).not.toHaveBeenCalled();
    });

    it("affiche le message d'erreur de l'API et reste sur l'écran", async () => {
        useSessionMock.mockReturnValue({ status: "authenticated", data: { user: { mustChangePassword: true } } });
        mockFetch(401, { error: "Mot de passe temporaire incorrect" });
        const { result } = renderHook(() => useFirstLogin({ token: null, redirectDelayMs: 0 }));

        await act(() => result.current.submit(VALUES));

        expect(result.current.error).toBe("Mot de passe temporaire incorrect");
        expect(result.current.isSuccess).toBe(false);
        expect(signOutMock).not.toHaveBeenCalled();
        expect(pushMock).not.toHaveBeenCalled();
    });
});
