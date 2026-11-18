// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * S6 : les pages financières n'affichent rien au super-administrateur tant
 * qu'aucune école n'est sélectionnée, ni pendant un changement d'école.
 */
const state = vi.hoisted(() => ({
    role: "SUPER_ADMIN" as string,
    schoolId: null as string | null,
    switching: false,
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { role: state.role } } }) }));
vi.mock("@/components/providers/school-provider", () => ({
    useSchool: () => ({
        schoolId: state.schoolId,
        isSwitchingSchool: state.switching,
        accessibleSchools: [{ id: "a", name: "École Alpha", code: "A", isActive: true }],
        setActiveSchoolId: vi.fn(),
    }),
}));

import { FinanceSchoolGate } from "@/components/finance/finance-school-gate";

const page = <FinanceSchoolGate><p>Chiffres de l&apos;école</p></FinanceSchoolGate>;

afterEach(() => {
    cleanup();
    Object.assign(state, { role: "SUPER_ADMIN", schoolId: null, switching: false });
});

describe("FinanceSchoolGate", () => {
    it("super-admin sans école : demande de sélection, aucun chiffre", () => {
        render(page);
        expect(screen.getByRole("heading", { name: "Choisissez un établissement" })).toBeInTheDocument();
        expect(screen.getByLabelText("Établissement")).toBeInTheDocument();
        expect(screen.queryByText("Chiffres de l'école")).not.toBeInTheDocument();
    });

    it("texte propre à la page (élèves) quand il est fourni", () => {
        render(<FinanceSchoolGate description="Les dossiers des élèves appartiennent à chaque école."><p>Élèves</p></FinanceSchoolGate>);
        expect(screen.getByText("Les dossiers des élèves appartiennent à chaque école.")).toBeInTheDocument();
        expect(screen.queryByText("Élèves")).not.toBeInTheDocument();
    });

    it("changement d'école en cours : les chiffres de l'école quittée disparaissent", () => {
        Object.assign(state, { schoolId: "a", switching: true });
        render(page);
        expect(screen.getByRole("status")).toHaveTextContent("Changement d'établissement");
        expect(screen.queryByText("Chiffres de l'école")).not.toBeInTheDocument();
    });

    it("super-admin avec une école sélectionnée : la page s'affiche", () => {
        state.schoolId = "a";
        render(page);
        expect(screen.getByText("Chiffres de l'école")).toBeInTheDocument();
    });

    it("comptable (école active) : la page s'affiche comme avant", () => {
        Object.assign(state, { role: "ACCOUNTANT", schoolId: "a" });
        render(page);
        expect(screen.getByText("Chiffres de l'école")).toBeInTheDocument();
    });
});

describe("FinanceSchoolGate — onglet BI des Analyses (2026-10-25)", () => {
    it("titre de niveau 2 dans une page qui a déjà son h1 ; le tableau BI n'est pas monté (aucun appel voué au refus)", () => {
        render(
            <FinanceSchoolGate headingLevel="h2" description="Les indicateurs BI sont calculés pour une seule école.">
                <p>Tableau BI</p>
            </FinanceSchoolGate>,
        );
        expect(screen.getByRole("heading", { level: 2, name: "Choisissez un établissement" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
        expect(screen.queryByText("Tableau BI")).not.toBeInTheDocument();
    });
});
