// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SWRConfig } from "swr";

import { StudentDisciplineTab } from "@/components/students/student-discipline-tab";
import { StudentHealthTab } from "@/components/students/student-health-tab";
import { StudentFinanceTab } from "@/components/students/student-finance-tab";

/**
 * Fiche élève : les onglets Discipline, Santé et Finances affichaient des
 * textes figés (« Aucun incident disciplinaire signalé », « Dossier médical
 * vide », « État financier non disponible ») quelles que soient les données.
 * Ils lisent désormais leurs API.
 */
function respond(map: Record<string, { status?: number; body: unknown }>) {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const key = Object.keys(map).find((k) => url.includes(k));
            const hit = key ? map[key] : { status: 404, body: { error: "introuvable" } };
            return new Response(JSON.stringify(hit.body), { status: hit.status ?? 200, headers: { "content-type": "application/json" } });
        }),
    );
}
const renderFresh = (ui: React.ReactElement) =>
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>);

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("onglet Discipline", () => {
    it("liste les incidents réels avec gravité, statut et sanctions", async () => {
        respond({
            "/api/incidents?studentId=stu-1": {
                body: {
                    data: [
                        {
                            id: "inc-1", incidentType: "VIOLENCE", severity: "HIGH", date: "2026-10-12T08:00:00.000Z",
                            description: "Bagarre dans la cour", isResolved: false,
                            sanctions: [{ id: "s1", type: "DETENTION", isServed: true }],
                        },
                    ],
                },
            },
        });
        renderFresh(<StudentDisciplineTab studentId="stu-1" />);
        expect(await screen.findByText("Bagarre dans la cour")).toBeInTheDocument();
        expect(screen.getByText("Majeur")).toBeInTheDocument();
        expect(screen.getByText("En cours")).toBeInTheDocument();
        expect(screen.getByText(/Retenue · effectuée/)).toBeInTheDocument();
        expect(screen.queryByText(/Aucun incident/)).not.toBeInTheDocument();
    });

    it("n'affirme « aucun incident » que si l'API n'en renvoie aucun", async () => {
        respond({ "/api/incidents": { body: { data: [] } } });
        renderFresh(<StudentDisciplineTab studentId="stu-2" />);
        expect(await screen.findByText("Aucun incident enregistré pour cet élève.")).toBeInTheDocument();
    });

    it("signale une erreur au lieu d'un faux « aucun incident »", async () => {
        respond({ "/api/incidents": { status: 403, body: { error: "Accès refusé" } } });
        renderFresh(<StudentDisciplineTab studentId="stu-3" />);
        expect(await screen.findByRole("alert")).toHaveTextContent(/Impossible de charger les incidents/);
    });
});

describe("onglet Santé", () => {
    it("affiche allergies et contacts d'urgence du dossier", async () => {
        respond({
            "/api/medical-records": {
                body: {
                    bloodType: "O+", conditions: ["Asthme"], medications: [], notes: null,
                    allergies: [{ id: "a1", allergen: "Arachide", severity: "Sévère", reaction: "Œdème", treatment: null }],
                    vaccinations: [],
                    emergencyContacts: [{ id: "c1", name: "Rachida Gnanhoui", relationship: "Mère", phone: "+22997000000", isPrimary: true }],
                },
            },
        });
        renderFresh(<StudentHealthTab studentId="stu-1" />);
        expect(await screen.findByText("Arachide")).toBeInTheDocument();
        expect(screen.getByText(/Asthme/)).toBeInTheDocument();
        expect(screen.getByText("Rachida Gnanhoui")).toBeInTheDocument();
    });

    it("dossier absent (404) : le dit, sans erreur", async () => {
        respond({});
        renderFresh(<StudentHealthTab studentId="stu-9" />);
        expect(await screen.findByText("Aucun dossier médical ouvert pour cet élève.")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});

describe("onglet Finances", () => {
    it("totalise facturé, encaissé, en attente et reste à payer", async () => {
        respond({
            "/balances": {
                body: {
                    balances: [
                        { feeId: "f1", feeName: "Scolarité", billed: 90000, paid: 60000, pending: 5000, remaining: 30000, suggested: 25000 },
                        { feeId: "f2", feeName: "Cantine", billed: 20000, paid: 20000, pending: 0, remaining: 0, suggested: 0 },
                    ],
                },
            },
        });
        renderFresh(<StudentFinanceTab studentId="stu-1" />);
        expect(await screen.findByText("Scolarité")).toBeInTheDocument();
        // Reste total : 30 000 (espace insécable du format fr-FR)
        expect(screen.getAllByText(/30\s000 FCFA/).length).toBeGreaterThan(0);
        expect(screen.getByText(/110\s000 FCFA/)).toBeInTheDocument();
        expect(screen.queryByText(/non disponible/)).not.toBeInTheDocument();
    });
});
