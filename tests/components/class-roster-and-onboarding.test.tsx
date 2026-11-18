// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SWRConfig } from "swr";

import { ClassRoster } from "@/components/classes/class-roster";
import { FallbackOnboarding } from "@/components/onboarding/fallback-onboarding";

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function serve(body: unknown, status = 200) {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));
}
const fresh = (ui: React.ReactElement) => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>);

describe("effectif de la classe", () => {
    it("liste les élèves inscrits par ordre alphabétique, avec un lien vers chaque fiche", async () => {
        serve({
            data: [
                { id: "s2", matricule: "M-002", user: { firstName: "Awa", lastName: "Zinsou", isActive: true } },
                { id: "s1", matricule: "M-001", user: { firstName: "Koffi", lastName: "Adjovi", isActive: true } },
            ],
        });
        fresh(<ClassRoster classId="c1" canEnroll />);
        const links = await screen.findAllByRole("link", { name: /Adjovi|Zinsou/ });
        expect(links.map((l) => l.textContent)).toEqual(["Adjovi Koffi", "Zinsou Awa"]);
        expect(links[0]).toHaveAttribute("href", "/dashboard/students/s1");
        expect(screen.getByText("2 élèves inscrits")).toBeInTheDocument();
    });

    it("classe vide : le dit ; l'enseignant n'a pas le bouton d'inscription", async () => {
        serve({ data: [] });
        fresh(<ClassRoster classId="c2" canEnroll={false} />);
        expect(await screen.findByText("Aucun élève inscrit dans cette classe")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Inscrire/ })).not.toBeInTheDocument();
    });
});

describe("visite de départ par rôle", () => {
    const hrefs = () => screen.getAllByRole("link").map((a) => a.getAttribute("href"));

    it("comptable : écrans de caisse, aucun écran d'administration", () => {
        render(<FallbackOnboarding role="ACCOUNTANT" user="Compta" />);
        expect(hrefs()).toEqual(expect.arrayContaining(["/dashboard/finance/payments/new", "/dashboard/finance/reconciliation"]));
        expect(hrefs()).not.toContain("/dashboard/import");
        expect(hrefs()).not.toContain("/dashboard/settings/academic-config");
        expect(screen.queryByText(/arrive bientôt/)).not.toBeInTheDocument();
    });

    it("personnel : vie scolaire, pas de finance", () => {
        render(<FallbackOnboarding role="STAFF" user="Surveillant" />);
        expect(hrefs()).toEqual(expect.arrayContaining(["/dashboard/attendance", "/dashboard/incidents/new"]));
        expect(hrefs().some((h) => h?.startsWith("/dashboard/finance"))).toBe(false);
    });
});
