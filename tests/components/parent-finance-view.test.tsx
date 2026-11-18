// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SWRConfig } from "swr";

/**
 * Vue parent « Scolarité et paiements » : un enfant affiché directement,
 * plusieurs enfants séparés, « Payer » transmet une INTENTION (jamais un
 * montant calculé par le navigateur pour l'échéance ou le solde), et seul un
 * lien https renvoyé par le serveur est suivi.
 */
let search = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
    useSearchParams: () => search,
    useRouter: () => ({ replace }),
    usePathname: () => "/dashboard/finance",
}));

import { ParentFinanceView } from "@/components/dashboard/finance/parent-finance-view";

const child = (id: string, school: string, remaining = 100000) => ({
    studentId: id, firstName: `Enfant${id}`, lastName: "Kora", schoolId: school, schoolName: `École ${school}`,
    className: "CM1 — A", academicYearName: "2026-2027", remaining, reserved: 0,
});
const fee = (overrides: Record<string, unknown> = {}) => ({
    feeId: "fee1", name: "Scolarité", description: null, dueDate: null, isRequired: true,
    billed: 90000, settled: 10000, reserved: 0, remaining: 80000, available: 80000,
    installments: [
        { id: "i1", amount: 30000, dueDate: "2026-10-01T00:00:00.000Z", status: "PENDING", covered: 10000, outstanding: 20000, payable: true },
        { id: "i2", amount: 30000, dueDate: "2026-11-01T00:00:00.000Z", status: "PENDING", covered: 0, outstanding: 30000, payable: false },
    ],
    options: { nextInstallment: { installmentId: "i1", dueDate: "2026-10-01T00:00:00.000Z", amount: 20000 }, fullBalance: 80000, maxAmount: 80000, blockedByPending: false },
    ...overrides,
});
const detail = (id: string, online = true, fees = [fee()]) => ({
    child: { ...child(id, "A"), matricule: "MAT-1" },
    totals: { billed: 90000, settled: 10000, reserved: 0, remaining: 80000, available: 80000 },
    fees,
    payments: [
        { id: "p1", reference: "PAY-1", feeName: "Scolarité", amount: 10000, status: "CONFIRMED", method: "CASH", online: false, date: "2026-09-01T00:00:00.000Z", paidAt: "2026-09-01T00:00:00.000Z", receiptAvailable: true },
        { id: "p2", reference: "PAY-2", feeName: "Scolarité", amount: 5000, status: "PENDING", method: "MOBILE_MONEY_MTN", online: true, date: "2026-09-02T00:00:00.000Z", paidAt: null, receiptAvailable: false },
    ],
    online: { available: online, message: online ? "Paiement en ligne disponible." : "Le paiement en ligne n'est pas disponible pour cet établissement." },
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let routes: Record<string, () => Response>;
let posts: Array<{ url: string; body: Record<string, unknown> }>;
const assign = vi.fn();

beforeEach(() => {
    search = new URLSearchParams();
    posts = [];
    replace.mockReset();
    assign.mockReset();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
            posts.push({ url, body: JSON.parse(String(init.body)) });
            return routes[`POST ${url}`]();
        }
        return routes[url]();
    }));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const view = () =>
    render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <ParentFinanceView />
        </SWRConfig>,
    );

describe("ParentFinanceView", () => {
    it("un seul enfant : sa situation directement, sans sélection ; reçu seulement pour un paiement confirmé", async () => {
        routes = { "/api/finance/my-children": () => json({ children: [child("s1", "A")] }), "/api/finance/my-children/s1": () => json(detail("s1")) };
        view();
        expect(await screen.findByRole("heading", { name: "Enfants1 Kora" })).toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Choisissez un enfant" })).not.toBeInTheDocument();
        const history = screen.getByRole("region", { name: "Historique des paiements" });
        expect(within(history).getAllByRole("button", { name: "Reçu" })).toHaveLength(1);
        expect(within(history).getByText("En attente de confirmation")).toBeInTheDocument();
        expect(within(history).getByRole("link", { name: "Suivre" })).toHaveAttribute("href", "/dashboard/finance/retour-paiement?ref=PAY-2");
    });

    it("plusieurs enfants (deux écoles) : sélection avec l'école de chacun, aucune situation cumulée", async () => {
        routes = { "/api/finance/my-children": () => json({ children: [child("s1", "A", 1000), child("s2", "B", 2000)] }) };
        view();
        const picker = await screen.findByRole("region", { name: "Choisissez un enfant" });
        expect(within(picker).getByText(/École A/)).toBeInTheDocument();
        expect(within(picker).getByText(/École B/)).toBeInTheDocument();
        expect(screen.queryByText(/3\s?000/)).not.toBeInTheDocument();
        fireEvent.click(within(picker).getByRole("button", { name: /Enfants2/ }));
        expect(replace).toHaveBeenCalledWith("/dashboard/finance?enfant=s2", { scroll: false });
    });

    it("prochaine échéance : intention seule envoyée (pas de montant) ; redirection vers le lien https du serveur", async () => {
        search = new URLSearchParams("enfant=s1");
        routes = {
            "/api/finance/my-children": () => json({ children: [child("s1", "A")] }),
            "/api/finance/my-children/s1": () => json(detail("s1")),
            "POST /api/payments/initiate": () => json({ paymentUrl: "https://process.fedapay.com/pay", reference: "PAY-9", amount: 20000 }),
        };
        view();
        const pay = await screen.findByRole("button", { name: /Payer\s20\s?000/ });
        fireEvent.click(pay);
        await waitFor(() => expect(assign).toHaveBeenCalledWith("https://process.fedapay.com/pay"));
        expect(posts).toHaveLength(1);
        expect(posts[0].body).toEqual({ studentId: "s1", feeId: "fee1", provider: "FEDAPAY", mode: "NEXT_INSTALLMENT" });
    });

    it("lien non https : jamais suivi ; refus du serveur affiché tel quel", async () => {
        routes = {
            "/api/finance/my-children": () => json({ children: [child("s1", "A")] }),
            "/api/finance/my-children/s1": () => json(detail("s1")),
            "POST /api/payments/initiate": () => json({ paymentUrl: "javascript:alert(1)" }),
        };
        view();
        fireEvent.click(await screen.findByRole("button", { name: /Payer\s20\s?000/ }));
        expect(await screen.findByRole("alert")).toHaveTextContent("lien de paiement reçu n'est pas valide");
        expect(assign).not.toHaveBeenCalled();

        routes["POST /api/payments/initiate"] = () => json({ error: "Un paiement en ligne de 5000 FCFA attend…", code: "PAYMENT_IN_PROGRESS" }, 409);
        fireEvent.click(await screen.findByRole("button", { name: /Payer\s20\s?000/ }));
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Un paiement en ligne de 5000 FCFA attend"));
        expect(assign).not.toHaveBeenCalled();
    });

    it("montant libre : entier positif, plafonné au disponible, sinon bouton inactif", async () => {
        routes = { "/api/finance/my-children": () => json({ children: [child("s1", "A")] }), "/api/finance/my-children/s1": () => json(detail("s1")) };
        view();
        fireEvent.click(await screen.findByRole("radio", { name: "Autre montant" }));
        const field = screen.getByLabelText(/Montant en FCFA/);
        fireEvent.change(field, { target: { value: "90000" } });
        expect(field).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("button", { name: /^Payer/ })).toBeDisabled();
        fireEvent.change(field, { target: { value: "12,5" } });
        expect(screen.getByRole("button", { name: /^Payer/ })).toBeDisabled();
        fireEvent.change(field, { target: { value: "15000" } });
        expect(screen.getByRole("button", { name: /Payer\s15\s?000/ })).toBeEnabled();
    });

    it("école sans compte marchand : aucun bouton Payer, renvoi vers l'économat", async () => {
        routes = { "/api/finance/my-children": () => json({ children: [child("s1", "A")] }), "/api/finance/my-children/s1": () => json(detail("s1", false)) };
        view();
        expect(await screen.findByText(/réglez à l'économat/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Payer/ })).not.toBeInTheDocument();
    });
});
