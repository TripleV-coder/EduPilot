// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SWRConfig } from "swr";

/**
 * TD-025 (2026-10-25) : sur la page de rapprochement, un paiement EN LIGNE en
 * attente propose « Interroger le fournisseur » (motif obligatoire) ; une
 * déclaration au guichet n'a plus le bouton « Réconcilier », toujours refusé
 * par l'API (qui ne traite que des paiements déjà validés).
 */
const session = vi.hoisted(() => ({ role: "ACCOUNTANT" }));
vi.mock("next-auth/react", () => ({
    useSession: () => ({ data: { user: { id: "u", role: session.role, roles: [], schoolId: "s" } }, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/finance/reconciliation" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import FinanceReconciliationPage from "@/app/(dashboard)/dashboard/finance/reconciliation/page";

const payments = [
    { id: "p-online", amount: 25000, status: "PENDING", reference: "PAY-EN-LIGNE", provider: "FEDAPAY", createdAt: "2026-10-20T10:00:00.000Z", description: "Scolarité" },
    { id: "p-guichet", amount: 10000, status: "PENDING", reference: "PAY-GUICHET", provider: null, createdAt: "2026-10-21T10:00:00.000Z", description: "Cantine" },
];
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
        if (String(url).includes("/verify-provider")) {
            return new Response(JSON.stringify({ outcome: "STILL_PENDING", reason: "PROVIDER_PENDING", message: "toujours en attente" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ data: payments }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    session.role = "ACCOUNTANT";
});
const renderPage = () => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><FinanceReconciliationPage /></SWRConfig>);

describe("Rapprochement — paiements en attente (TD-025)", () => {
    it("en ligne : « Interroger le fournisseur » ; guichet : aucun bouton, mention explicite ; plus de « Réconcilier »", async () => {
        renderPage();
        expect(await screen.findByRole("button", { name: /Interroger le fournisseur/ })).toBeInTheDocument();
        expect(screen.getByText("Déclaré au guichet")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Réconcilier/ })).not.toBeInTheDocument();
    });

    it("motif obligatoire (10 caractères) puis appel de verify-provider pour CE paiement", async () => {
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: /Interroger le fournisseur/ }));
        const submit = screen.getByRole("button", { name: "Interroger" });
        expect(submit).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Motif/), { target: { value: "Débit présenté par la famille" } });
        expect(submit).toBeEnabled();
        fireEvent.click(submit);
        await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u) === "/api/payments/p-online/verify-provider")).toBe(true));
        const call = fetchMock.mock.calls.find(([u]) => String(u).includes("/verify-provider"))!;
        expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ justification: "Débit présenté par la famille" });
    });

    it("directeur : pas de bouton (l'API réserve l'action au comptable et à l'administration)", async () => {
        session.role = "DIRECTOR";
        renderPage();
        expect(await screen.findByText("Paiement en ligne en attente")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Interroger le fournisseur/ })).not.toBeInTheDocument();
    });
});
