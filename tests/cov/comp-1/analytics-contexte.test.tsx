// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { screen, cleanup, fireEvent, waitFor, within, render, renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", async () => (await import("../../pages/harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("../../pages/harness")).schoolMock);

import { asRole, mockApi, renderPage, resetHarness, school } from "../../pages/harness";
import { installDomPolyfills, chooseSelectOption } from "./helpers";
import { AnalyticsProvider, useAnalytics, StudentSegment } from "@/components/analytics/AnalyticsContext";
import { AnalyticsContextBar } from "@/components/analytics/AnalyticsContextBar";
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState";

beforeAll(installDomPolyfills);
afterEach(() => {
    cleanup();
    resetHarness();
});

/** Sonde qui affiche l'état du contexte analytique. */
function Sonde() {
    const a = useAnalytics();
    return (
        <pre data-testid="etat">
            {JSON.stringify({
                annee: a.academicYearId,
                periode: a.periodId,
                niveaux: a.levelIds,
                classes: a.classIds,
                matieres: a.subjectIds,
                segment: a.studentSegment,
                etab: a.establishmentId,
                du: a.dateRange.from ? "defini" : null,
            })}
        </pre>
    );
}

function etat() {
    return JSON.parse(screen.getByTestId("etat").textContent || "{}");
}

describe("AnalyticsContext", () => {
    it("refuse d'être utilisé hors du fournisseur", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => renderHook(() => useAnalytics())).toThrow("useAnalytics must be used within an AnalyticsProvider");
        spy.mockRestore();
    });

    it("part des valeurs initiales puis les restaure à la réinitialisation", () => {
        const { result } = renderHook(() => useAnalytics(), {
            wrapper: ({ children }) => (
                <AnalyticsProvider initialAcademicYearId="y1" initialPeriodId="p1">{children}</AnalyticsProvider>
            ),
        });
        expect(result.current.academicYearId).toBe("y1");
        expect(result.current.periodId).toBe("p1");
        expect(result.current.establishmentId).toBe("ALL");

        act(() => {
            result.current.setAcademicYearId("y2");
            result.current.setPeriodId("p2");
            result.current.setEstablishmentId("school-b");
            result.current.setDateRange({ from: new Date("2026-01-01"), to: undefined });
            result.current.setLevelIds(["6e"]);
            result.current.setClassIds(["c1"]);
            result.current.setSubjectIds(["s1"]);
            result.current.setStudentSegment(StudentSegment.AT_RISK);
        });
        expect(result.current.academicYearId).toBe("y2");
        expect(result.current.dateRange.from).toBeInstanceOf(Date);
        expect(result.current.studentSegment).toBe("AT_RISK");

        act(() => result.current.resetFilters());
        expect(result.current.academicYearId).toBe("y1");
        expect(result.current.periodId).toBe("p1");
        expect(result.current.establishmentId).toBe("ALL");
        expect(result.current.levelIds).toEqual([]);
        expect(result.current.classIds).toEqual([]);
        expect(result.current.subjectIds).toEqual([]);
        expect(result.current.studentSegment).toBe("ALL");
        expect(result.current.dateRange).toEqual({ from: undefined, to: undefined });
    });

    it("sans valeurs initiales, la réinitialisation revient à « ALL »", () => {
        const { result } = renderHook(() => useAnalytics(), {
            wrapper: ({ children }) => <AnalyticsProvider>{children}</AnalyticsProvider>,
        });
        act(() => result.current.setAcademicYearId("y9"));
        act(() => result.current.resetFilters());
        expect(result.current.academicYearId).toBe("ALL");
        expect(result.current.periodId).toBe("ALL");
    });
});

describe("AnalyticsContextBar", () => {
    const YEARS = [
        { id: "y1", name: "2025-2026", periods: [{ id: "p1", name: "Trimestre 1" }, { id: "p2", name: "Trimestre 2" }] },
        { id: "y0", name: "2024-2025" },
    ];
    const CLASSES = {
        data: [
            { id: "c1", name: "6e A", level: "6e" },
            { id: "c2", name: "5e B", classLevel: { name: "5e" } },
            { id: "c3", name: "Sans niveau" },
        ],
    };
    const SUBJECTS = { data: [{ id: "s1", name: "Mathématiques" }] };

    function montage() {
        return renderPage(
            <AnalyticsProvider>
                <AnalyticsContextBar />
                <Sonde />
            </AnalyticsProvider>,
        );
    }

    it("charge années, classes et matières de l'école active et compte les filtres", async () => {
        asRole("SCHOOL_ADMIN");
        const api = mockApi({
            "GET /api/academic-years": YEARS,
            "GET /api/classes": CLASSES,
            "GET /api/subjects": SUBJECTS,
        });
        montage();
        expect(screen.getByText("0 filtre actif")).toBeInTheDocument();
        await waitFor(() => expect(api.calls("GET /api/subjects")).toHaveLength(1));
        expect(api.calls("GET /api/academic-years")[0].url).toBe("/api/academic-years?schoolId=school-a");
        expect(api.calls("GET /api/classes")[0].url).toBe("/api/classes?schoolId=school-a&limit=100");

        // Année puis période de cette année
        await waitFor(() => expect(api.calls().length).toBeGreaterThanOrEqual(3));
        await chooseSelectOption("Année scolaire", "2025-2026");
        expect(etat().annee).toBe("y1");
        await chooseSelectOption("Période", "Trimestre 2");
        expect(etat().periode).toBe("p2");

        // Segment
        await chooseSelectOption("Segment d'élèves", "Boursiers");
        expect(etat().segment).toBe("SCHOLARSHIP");
        expect(screen.getByText("3 filtres actifs")).toBeInTheDocument();

        // Réinitialiser
        fireEvent.click(screen.getByRole("button", { name: /Reinitialiser/ }));
        expect(etat().annee).toBe("ALL");
        expect(screen.getByText("0 filtre actif")).toBeInTheDocument();
    });

    it("sélectionne et désélectionne niveaux, classes et matières via les listes à cocher", async () => {
        asRole("SCHOOL_ADMIN");
        mockApi({
            "GET /api/academic-years": { data: YEARS },
            "GET /api/classes": CLASSES,
            "GET /api/subjects": SUBJECTS,
        });
        montage();

        // Niveaux déduits des classes : 6e (level) et 5e (classLevel.name), sans doublon
        fireEvent.click(screen.getByRole("button", { name: /Niveaux/ }));
        const niveaux = await screen.findByRole("dialog");
        await within(niveaux).findByText("6e");
        expect(within(niveaux).getAllByRole("checkbox")).toHaveLength(2);
        fireEvent.click(within(niveaux).getByRole("checkbox", { name: "6e" }));
        expect(etat().niveaux).toEqual(["6e"]);
        fireEvent.click(within(niveaux).getByRole("checkbox", { name: "6e" }));
        expect(etat().niveaux).toEqual([]);
        fireEvent.keyDown(niveaux, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: /Classes/ }));
        const classes = await screen.findByRole("dialog");
        fireEvent.click(within(classes).getByRole("checkbox", { name: "5e B" }));
        expect(etat().classes).toEqual(["c2"]);
        fireEvent.keyDown(classes, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        // Le badge de compte apparaît sur le déclencheur
        expect(screen.getByRole("button", { name: /Classes\s*1/ })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Matières/ }));
        const matieres = await screen.findByRole("dialog");
        fireEvent.click(within(matieres).getByRole("checkbox", { name: "Mathématiques" }));
        expect(etat().matieres).toEqual(["s1"]);
        expect(screen.getByText("2 filtres actifs")).toBeInTheDocument();
    });

    it("affiche « Aucune option » quand rien n'est chargé (école non choisie)", async () => {
        asRole("SUPER_ADMIN");
        school.schoolId = null;
        const api = mockApi({ "GET /api/academic-years": [] });
        montage();
        await waitFor(() => expect(api.calls("GET /api/academic-years")).toHaveLength(1));
        expect(api.calls("GET /api/academic-years")[0].url).toBe("/api/academic-years");
        expect(api.calls("GET /api/classes")).toHaveLength(0);
        fireEvent.click(screen.getByRole("button", { name: /Niveaux/ }));
        expect(await screen.findByText("Aucune option")).toBeInTheDocument();
        // Une seule école : pas de sélecteur d'établissement
        expect(screen.queryByRole("combobox", { name: "Établissement" })).not.toBeInTheDocument();
    });

    it("propose de changer d'établissement quand plusieurs écoles sont accessibles", async () => {
        asRole("NETWORK_ADMIN");
        school.accessibleSchools = [
            { id: "school-a", name: "Collège Saint-Michel", code: "CSM", isActive: true },
            { id: "school-b", name: "Lycée Béhanzin", code: "LB", isActive: true },
        ];
        mockApi({ "GET /api/academic-years": [], "GET /api/classes": [], "GET /api/subjects": [] });
        montage();
        await chooseSelectOption("Établissement", "Lycée Béhanzin");
        expect(school.setActiveSchoolId).toHaveBeenCalledWith("school-b");
        await chooseSelectOption("Établissement", "Tous les établissements");
        expect(school.setActiveSchoolId).toHaveBeenCalledWith(null);
    });

    it("quand l'école active est nulle, le sélecteur d'établissement affiche « Tous »", async () => {
        asRole("NETWORK_ADMIN");
        school.schoolId = null;
        school.accessibleSchools = [
            { id: "school-a", name: "Collège Saint-Michel", code: "CSM", isActive: true },
            { id: "school-b", name: "Lycée Béhanzin", code: "LB", isActive: true },
        ];
        mockApi({ "GET /api/academic-years": { data: undefined } });
        montage();
        expect(screen.getByRole("combobox", { name: "Établissement" })).toHaveTextContent("Tous les établissements");
    });
});

describe("AnalyticsEmptyState", () => {
    it("affiche titre, description et deux liens d'action", () => {
        render(
            <AnalyticsEmptyState
                title="Rien à afficher"
                description="Ajoutez des données"
                primaryLabel="Créer"
                primaryHref="/dashboard/x"
                secondaryLabel="Réglages"
                secondaryHref="/dashboard/y"
            />,
        );
        expect(screen.getByRole("heading", { name: "Rien à afficher" })).toBeInTheDocument();
        expect(screen.getByText("Ajoutez des données")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Créer" })).toHaveAttribute("href", "/dashboard/x");
        expect(screen.getByRole("link", { name: "Réglages" })).toHaveAttribute("href", "/dashboard/y");
    });

    it("n'affiche pas de lien secondaire incomplet", () => {
        render(
            <AnalyticsEmptyState title="T" description="D" primaryLabel="Créer" primaryHref="/a" secondaryLabel="Seul" />,
        );
        expect(screen.getAllByRole("link")).toHaveLength(1);
    });
});
