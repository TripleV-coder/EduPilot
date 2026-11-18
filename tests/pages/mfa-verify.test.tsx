// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
const auth = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => nav,
    useSearchParams: () => new URLSearchParams("callbackUrl=%2Fdashboard%2Fgrades"),
}));
vi.mock("next-auth/react", () => ({
    useSession: () => ({
        data: { user: { isTwoFactorEnabled: true, isTwoFactorAuthenticated: false } },
        status: "authenticated",
        update: auth.update,
    }),
}));
vi.mock("@/lib/pwa/sign-out", () => ({ signOutAndPurge: vi.fn() }));

import MfaVerifyPage from "@/app/(auth)/mfa-verify/page";

const locationReplace = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("location", { ...window.location, replace: locationReplace });
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

async function typeCode(code: string) {
    render(<MfaVerifyPage />);
    const first = (await screen.findAllByRole("textbox"))[0] as HTMLInputElement;
    fireEvent.paste(first, { clipboardData: { getData: () => code } });
}

describe("page /mfa-verify", () => {
    it("code accepté : navigation COMPLÈTE vers la page demandée (pas le routeur client et son cache)", async () => {
        auth.update.mockResolvedValue({ user: { isTwoFactorAuthenticated: true } });
        await typeCode("123456");
        await waitFor(() => expect(locationReplace).toHaveBeenCalledWith("/dashboard/grades"));
        expect(auth.update).toHaveBeenCalledWith({ twoFactorCode: "123456" });
        expect(nav.replace).not.toHaveBeenCalled();
    });

    it("code refusé : message d'erreur, aucune navigation", async () => {
        auth.update.mockResolvedValue({ user: { isTwoFactorAuthenticated: false } });
        await typeCode("654321");
        expect(await screen.findByText(/code incorrect ou expiré/i)).toBeTruthy();
        expect(locationReplace).not.toHaveBeenCalled();
    });
});
