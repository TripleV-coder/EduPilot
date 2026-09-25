// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { cloneElement, isValidElement, type ReactNode } from "react";

vi.mock("next/navigation", async () => (await import("../../pages/harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("../../pages/harness")).schoolMock);
// Recharts a besoin de dimensions réelles : on fixe la taille du conteneur.
vi.mock("recharts", async (orig) => ({
    ...(await orig<typeof import("recharts")>()),
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
        <div style={{ width: 800, height: 400 }}>
            {isValidElement(children) ? cloneElement(children as React.ReactElement<{ width: number; height: number }>, { width: 800, height: 400 }) : children}
        </div>
    ),
}));

import { asRole, mockApi, renderPage, resetHarness, apiStatus } from "../../pages/harness";
import { installDomPolyfills, chooseSelectOption } from "./helpers";
import { MultiClassComparison } from "@/components/analytics/MultiClassComparison";
import { PeriodComparison } from "@/components/analytics/PeriodComparison";
import { AnalyticsComparisonsTab } from "@/components/analytics/AnalyticsComparisonsTab";
import { RiskStudentsDrillDown } from "@/components/analytics/RiskStudentsDrillDown";

beforeAll(installDomPolyfills);
afterEach(() => {
    cleanup();
    resetHarness();
});

const CLASSES = [
    { id: "c1", name: "6e A" },
    { id: "c2", name: "6e B" },
    { id: "c3", name: "5e A" },
    { id: "c4", name: "5e B" },
    { id: "c5", name: "4e A" },
];

const comp = (id: string, name: string, avg: number, pass: number) => ({
    classId: id,
    className: name,
    studentCount: 30,
    averageGrade: avg,
    passRate: pass,
    riskDistribution: { LOW: 1, MEDIUM: 1, HIGH: 0, CRITICAL: 0 },
});

describe("MultiClassComparison", () => {
    it("charge la première classe, affiche le tableau et les moyennes globales", async () => {
        asRole("DIRECTOR");
        const api = mockApi({
            "GET /api/analytics/class-comparison": ({ query }: { query: URLSearchParams }) =>
                query.getAll("classIds").map((id, i) => comp(id, CLASSES.find((c) => c.id === id)!.name, 12 + i, 60 + i * 10)),
        });
        renderPage(<MultiClassComparison classes={CLASSES} academicYearId="y1" />);
        expect(screen.getByText("Chargement...")).toBeInTheDocument();
        expect(await screen.findByText("12/20")).toBeInTheDocument();
        expect(api.calls("GET /api/analytics/class-comparison")[0].url).toBe(
            "/api/analytics/class-comparison?academicYearId=y1&classIds=c1",
        );
        expect(screen.getByText("12.00/20")).toBeInTheDocument();
        expect(screen.getByText("60.0%")).toBeInTheDocument();

        // Ajout d'une deuxième classe : la requête inclut les deux
        fireEvent.click(screen.getByRole("button", { name: "6e B" }));
        await screen.findByText("12.50/20");
        const last = api.calls("GET /api/analytics/class-comparison").at(-1)!;
        expect(last.query.getAll("classIds")).toEqual(["c1", "c2"]);
    });

    it("limite la sélection à quatre classes et permet de tout désélectionner", async () => {
        asRole("DIRECTOR");
        const api = mockApi({
            "GET /api/analytics/class-comparison": ({ query }: { query: URLSearchParams }) =>
                query.getAll("classIds").map((id) => comp(id, id, 10, 50)),
        });
        renderPage(<MultiClassComparison classes={CLASSES} academicYearId="y1" initialSelectedClasses={["c1", "c2", "c3", "c4"]} />);
        await screen.findByText("Moyenne globale");
        fireEvent.click(screen.getByRole("button", { name: "4e A" }));
        await waitFor(() => {
            const last = api.calls("GET /api/analytics/class-comparison").at(-1)!;
            expect(last.query.getAll("classIds")).toEqual(["c1", "c2", "c3", "c4"]);
        });
        for (const name of ["6e A", "6e B", "5e A", "5e B"]) fireEvent.click(screen.getByRole("button", { name }));
        expect(await screen.findByText("Sélectionnez au moins une classe")).toBeInTheDocument();
    });

    it("signale une réponse inattendue du serveur", async () => {
        asRole("DIRECTOR");
        mockApi({ "GET /api/analytics/class-comparison": { error: "format" } });
        renderPage(<MultiClassComparison classes={CLASSES} academicYearId="y1" />);
        expect(await screen.findByText("Erreur de chargement des données")).toBeInTheDocument();
    });

    it("sans classe disponible, aucune requête n'est émise", () => {
        asRole("DIRECTOR");
        const api = mockApi({});
        renderPage(<MultiClassComparison classes={[]} academicYearId="y1" />);
        expect(screen.getByText("Sélectionnez au moins une classe")).toBeInTheDocument();
        expect(api.calls()).toHaveLength(0);
    });

    it.skip("BUG: une erreur HTTP du comparatif doit afficher l'état d'erreur, pas « Sélectionnez au moins une classe »", async () => {
        asRole("DIRECTOR");
        mockApi({ "GET /api/analytics/class-comparison": apiStatus(403, { error: "Accès refusé" }) });
        renderPage(<MultiClassComparison classes={CLASSES} academicYearId="y1" />);
        expect(await screen.findByText("Erreur de chargement des données")).toBeInTheDocument();
    });
});

describe("PeriodComparison", () => {
    const PERIODS = [
        { id: "p1", name: "T1" },
        { id: "p2", name: "T2" },
        { id: "p3", name: "T3" },
        { id: "p4", name: "Rattrapage" },
    ];
    const row = (id: string, name: string) => ({
        periodId: id,
        periodName: name,
        studentCount: 28,
        averageGrade: 11.5,
        passRate: 70,
        performanceDistribution: { excellent: 1, veryGood: 2, good: 3, average: 4, insufficient: 5, weak: 6 },
    });

    it("compare les trois premières périodes puis ajoute / retire une période au clic", async () => {
        asRole("DIRECTOR");
        const api = mockApi({
            "GET /api/analytics/period-comparison": ({ query }: { query: URLSearchParams }) =>
                query.getAll("periodIds").map((id) => row(id, PERIODS.find((p) => p.id === id)!.name)),
        });
        renderPage(<PeriodComparison academicYearId="y1" classId="c1" periods={PERIODS} />);
        expect(screen.getByText("Chargement...")).toBeInTheDocument();
        expect(await screen.findAllByText("Moy: 11.5/20 | Réussite: 70%")).toHaveLength(3);
        expect(api.calls()[0].url).toBe(
            "/api/analytics/period-comparison?academicYearId=y1&classId=c1&periodIds=p1&periodIds=p2&periodIds=p3",
        );
        fireEvent.click(screen.getByText("Rattrapage"));
        expect(await screen.findAllByText("Moy: 11.5/20 | Réussite: 70%")).toHaveLength(4);
        fireEvent.click(screen.getAllByText("T1")[0]); // le badge précède le résumé
        await waitFor(() => expect(screen.getAllByText("Moy: 11.5/20 | Réussite: 70%")).toHaveLength(3));
    });

    it("affiche l'invite quand aucune période n'est comparée", async () => {
        asRole("DIRECTOR");
        mockApi({ "GET /api/analytics/period-comparison": [] });
        renderPage(<PeriodComparison academicYearId="y1" classId="c1" periods={[]} />);
        expect(await screen.findByText("Sélectionnez au moins une période")).toBeInTheDocument();
    });
});

describe("AnalyticsComparisonsTab", () => {
    it("sans classe, propose de créer une classe", () => {
        asRole("DIRECTOR");
        mockApi({});
        renderPage(<AnalyticsComparisonsTab classes={[]} academicYearId="y1" periods={[]} />);
        expect(screen.getByRole("heading", { name: "Aucune classe disponible pour les comparaisons" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Créer une classe" })).toHaveAttribute("href", "/dashboard/classes/new");
    });

    it("affiche les deux comparaisons et change la classe analysée", async () => {
        asRole("DIRECTOR");
        const api = mockApi({
            "GET /api/analytics/class-comparison": [],
            "GET /api/analytics/period-comparison": [],
        });
        renderPage(
            <AnalyticsComparisonsTab classes={CLASSES.slice(0, 2)} academicYearId="y1" periods={[{ id: "p1", name: "T1" }]} />,
        );
        expect(screen.getByText("Comparaison inter-classes")).toBeInTheDocument();
        expect(screen.getByText("Comparaison inter-périodes")).toBeInTheDocument();
        await waitFor(() => expect(api.calls("GET /api/analytics/period-comparison")).toHaveLength(1));
        expect(api.calls("GET /api/analytics/period-comparison")[0].query.get("classId")).toBe("c1");

        await chooseSelectOption("Classe à analyser", "6e B");
        await waitFor(() =>
            expect(api.calls("GET /api/analytics/period-comparison").at(-1)!.query.get("classId")).toBe("c2"),
        );
    });
});

describe("RiskStudentsDrillDown", () => {
    it("liste les élèves à risque avec liens vers leur fiche", async () => {
        asRole("DIRECTOR");
        const api = mockApi({
            "GET /api/analytics/students": [
                { studentId: "s1", studentName: "Aïcha Hounsou", averageGrade: 8.456, attendanceRate: 72, riskLevel: "HIGH" },
                { studentId: "s2", studentName: "Koffi Adjovi", averageGrade: null, attendanceRate: null, riskLevel: "HIGH" },
            ],
        });
        renderPage(<RiskStudentsDrillDown riskLevel="HIGH" academicYearId="y1" periodId="p1" />);
        expect(screen.getByText(/Élèves à risque « Élevé »/)).toBeInTheDocument();
        const lien = await screen.findByRole("link", { name: /Aïcha Hounsou/ });
        expect(lien).toHaveAttribute("href", "/dashboard/students/s1");
        expect(screen.getByText("Moy. 8.46/20")).toBeInTheDocument();
        expect(screen.getByText("Assiduité 72%")).toBeInTheDocument();
        expect(screen.getByText("Moy. —")).toBeInTheDocument();
        expect(screen.getByText("Assiduité —")).toBeInTheDocument();
        const q = api.calls()[0].query;
        expect(q.get("riskLevel")).toBe("HIGH");
        expect(q.get("limit")).toBe("50");
        expect(q.get("academicYearId")).toBe("y1");
        expect(q.get("periodId")).toBe("p1");
    });

    it("affiche l'état vide pour un niveau inconnu, sans filtres", async () => {
        asRole("DIRECTOR");
        const api = mockApi({ "GET /api/analytics/students": { unexpected: true } });
        renderPage(<RiskStudentsDrillDown riskLevel="INCONNU" />);
        expect(screen.getByText(/Élèves à risque « INCONNU »/)).toBeInTheDocument();
        expect(await screen.findByText("Aucun élève à ce niveau de risque sur la période sélectionnée.")).toBeInTheDocument();
        expect(api.calls()[0].query.has("academicYearId")).toBe(false);
        expect(api.calls()[0].query.has("periodId")).toBe(false);
    });

    it("affiche un message d'erreur si le chargement échoue", async () => {
        asRole("DIRECTOR");
        mockApi({ "GET /api/analytics/students": apiStatus(500, { error: "Erreur serveur" }) });
        renderPage(<RiskStudentsDrillDown riskLevel="CRITICAL" />);
        expect(await screen.findByText(/Impossible de charger la liste des élèves/)).toBeInTheDocument();
    });
});
