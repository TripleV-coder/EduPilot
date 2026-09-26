// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor, within, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { cloneElement, isValidElement, type ReactNode } from "react";

vi.mock("next/navigation", async () => (await import("../../pages/harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("../../pages/harness")).schoolMock);
vi.mock("recharts", async (orig) => ({
    ...(await orig<typeof import("recharts")>()),
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
        <div style={{ width: 800, height: 400 }}>
            {isValidElement(children) ? cloneElement(children as React.ReactElement<{ width: number; height: number }>, { width: 800, height: 400 }) : children}
        </div>
    ),
}));

const toastMock = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

// Export : on observe les appels au générateur de sections, au CSV et à jsPDF.
const exportMocks = vi.hoisted(() => {
    const doc = {
        setFontSize: vi.fn(),
        text: vi.fn(),
        save: vi.fn(),
        lastAutoTable: { finalY: 50 },
    };
    return {
        buildReportSections: vi.fn(),
        exportToCSV: vi.fn(),
        doc,
        jsPDF: vi.fn(function () {
            return doc;
        }),
        autoTable: vi.fn(),
    };
});
vi.mock("@/lib/analytics/report-builder", () => ({ buildReportSections: exportMocks.buildReportSections }));
vi.mock("@/lib/utils/export", () => ({ exportToCSV: exportMocks.exportToCSV }));
vi.mock("jspdf", () => ({ jsPDF: exportMocks.jsPDF }));
vi.mock("jspdf-autotable", () => ({ default: exportMocks.autoTable }));

import { asRole, mockApi, renderPage, resetHarness, apiStatus } from "../../pages/harness";
import { installDomPolyfills, chooseSelectOption } from "./helpers";
import { AnalyticsBIBoard } from "@/components/analytics/AnalyticsBIBoard";
import { FinanceAnalyticsTab } from "@/components/analytics/FinanceAnalyticsTab";
import { RiskInterventionTab } from "@/components/analytics/RiskInterventionTab";
import { AcademicPerformancesTab } from "@/components/analytics/AcademicPerformancesTab";
import { AnalyticsReportsTab } from "@/components/analytics/AnalyticsReportsTab";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsContext";

beforeAll(installDomPolyfills);
beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});
afterEach(() => {
    cleanup();
    resetHarness();
});

// ── Tableau BI ──────────────────────────────────────────────────────────────
describe("AnalyticsBIBoard", () => {
    const BI = {
        kpis: { studentCount: 1250, collectionRate: 82.46, attendanceRate: 93.1, passRate: 71 },
        totalCollected: 12_500_000,
        monthly: [
            { label: "Sep", collected: 800 },
            { label: "Oct", collected: 0 },
        ],
        paymentMix: [
            { method: "MOBILE_MONEY", amount: 800, share: 60 },
            { method: "CASH", amount: 400, share: 30 },
            { method: "CRYPTO", amount: 100, share: 10 },
        ],
        topSubjects: [{ subject: "Mathématiques", average: 13.25 }, { subject: "SVT", average: 25 }],
        insight: { headline: "Recouvrement en hausse", recommendation: "Relancer les impayés de 6e", createdAt: "2026-09-01" },
        updatedAt: "2026-09-01",
    };

    it("affiche KPIs, graphiques, mix de paiements, matières et insight IA", async () => {
        asRole("DIRECTOR");
        const onOpenReport = vi.fn();
        const api = mockApi({ "GET /api/analytics/bi": BI });
        renderPage(<AnalyticsBIBoard schoolId="school-a" academicYearId="y1" onOpenReport={onOpenReport} />);
        expect(await screen.findByText("Élèves actifs")).toBeInTheDocument();
        expect(api.calls()[0].url).toBe("/api/analytics/bi?schoolId=school-a&academicYearId=y1");
        expect(screen.getByText(/1\s?250/)).toBeInTheDocument();
        expect(screen.getByText("82,5")).toBeInTheDocument();
        expect(screen.getByText("93,1")).toBeInTheDocument();
        expect(screen.getByText("12,50")).toBeInTheDocument(); // M FCFA
        expect(screen.getByText("Mobile Money")).toBeInTheDocument();
        expect(screen.getByText("Espèces")).toBeInTheDocument();
        expect(screen.getByText("CRYPTO")).toBeInTheDocument(); // méthode inconnue : code brut
        expect(screen.getByText("60,0%")).toBeInTheDocument();
        expect(screen.getByText("13,3")).toBeInTheDocument();
        expect(screen.queryByTitle(/Facturé/)).not.toBeInTheDocument();
        expect(screen.getByText("Recouvrement en hausse")).toBeInTheDocument();
        expect(screen.getByText("Relancer les impayés de 6e")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Voir l'analyse complète" }));
        expect(onOpenReport).toHaveBeenCalledTimes(1);
    });

    it("affiche les états vides et le texte de repli sans insight, sans filtre « ALL »", async () => {
        asRole("DIRECTOR");
        const api = mockApi({
            "GET /api/analytics/bi": { ...BI, paymentMix: [], topSubjects: [], monthly: [], insight: null },
        });
        renderPage(<AnalyticsBIBoard academicYearId="ALL" />);
        expect(await screen.findByText("Aucun paiement enregistré sur la période.")).toBeInTheDocument();
        expect(api.calls()[0].url).toBe("/api/analytics/bi");
        expect(screen.getByText("Pas encore de moyennes calculées.")).toBeInTheDocument();
        expect(screen.getByText("Active l'IA pour obtenir les premières analyses hebdomadaires.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Voir l'analyse complète" })).not.toBeInTheDocument();
    });

    it("affiche un message d'erreur si l'API échoue", async () => {
        asRole("DIRECTOR");
        mockApi({ "GET /api/analytics/bi": apiStatus(500, { error: "KO" }) });
        renderPage(<AnalyticsBIBoard />);
        expect(await screen.findByText("Impossible de charger le tableau BI pour le contexte sélectionné.")).toBeInTheDocument();
    });
});

// ── Finance ─────────────────────────────────────────────────────────────────
describe("FinanceAnalyticsTab", () => {
    it("calcule le cumul mensuel, la part par cycle et charge le graphique d'ancienneté", async () => {
        render(
            <FinanceAnalyticsTab
                data={{
                    totalRevenue: "200000",
                    totalPending: 50000,
                    revenueByMonth: [{ month: "Sep", amount: "100000" }, { month: "Oct" }],
                    debtAgingBuckets: [{ range: "0-30 j", amount: 30000 }],
                    revenueByCycle: [{ name: "Collège", value: 150000 }, { name: "Lycée" }],
                }}
            />,
        );
        expect(screen.getByText(/50\s?000 FCFA en retard/)).toBeInTheDocument();
        expect(screen.getByText("Collège")).toBeInTheDocument();
        expect(screen.getByText("75.0%")).toBeInTheDocument();
        expect(screen.getByText("0.0%")).toBeInTheDocument();
        // Graphique chargé à la demande (next/dynamic)
        await waitFor(() => expect(screen.queryAllByText("0-30 j").length).toBeGreaterThan(0));
    });

    it("sans données, affiche l'absence d'ancienneté et aucune ligne", () => {
        render(<FinanceAnalyticsTab data={null} />);
        expect(screen.getByText(/0 FCFA en retard/)).toBeInTheDocument();
        expect(screen.getByText("Données d'ancienneté non exposées par l'API finance")).toBeInTheDocument();
        expect(screen.getAllByRole("row")).toHaveLength(1);
    });
});

// ── Risques / IA ────────────────────────────────────────────────────────────
describe("RiskInterventionTab", () => {
    const STUDENTS = [
        {
            student: { id: "s1", user: { firstName: "Aïcha", lastName: "Hounsou" }, class: { name: "6e A" } },
            generalAverage: 7.456,
            period: { id: "p1", name: "T1" },
        },
        {
            student: { id: "s2", user: { firstName: "Koffi", lastName: "Adjovi" }, class: { name: "5e B" } },
            generalAverage: 8,
            period: { id: "p1", name: "T1" },
        },
    ];
    const PLAN = (priority: string) => ({
        riskLevel: "HIGH",
        riskScore: 72.6,
        factors: ["Absences répétées"],
        recommendations: ["Tutorat en maths"],
        priority,
        suggestedActions: [
            { title: "Soutien", description: "2h/semaine", type: "Pédagogique" },
            { title: "Entretien", description: "Avec les parents", type: "Suivi" },
        ],
    });

    it("sans élève, affiche l'état vide et l'invite de sélection", () => {
        render(<RiskInterventionTab atRiskStudents={[]} academicYearId="y1" />);
        expect(screen.getByText("Aucun élève à risque identifié.")).toBeInTheDocument();
        expect(screen.getByText("Sélectionnez un élève")).toBeInTheDocument();
    });

    it("lance l'analyse IA d'un élève et affiche le plan d'intervention", async () => {
        const api = mockApi({ "POST /api/ai/analyze-risk": { success: true, data: PLAN("CRITICAL") } });
        render(<RiskInterventionTab atRiskStudents={STUDENTS} academicYearId="y1" />);
        expect(screen.getByText("Moy: 7.46/20")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Hounsou Aïcha/ }));
        expect(await screen.findByText("73%")).toBeInTheDocument();
        expect(api.calls("POST /api/ai/analyze-risk")[0].body).toEqual({ studentId: "s1", academicYearId: "y1" });
        expect(screen.getByText("CRITICAL")).toBeInTheDocument();
        expect(screen.getByText("Absences répétées")).toBeInTheDocument();
        expect(screen.getByText("Tutorat en maths")).toBeInTheDocument();
        expect(screen.getByText("Soutien")).toBeInTheDocument();
        expect(screen.getByText("Entretien")).toBeInTheDocument();
        expect(toastMock.success).toHaveBeenCalledWith("Analyse IA terminée avec succès");

        // Relance depuis la barre élève (priorité HIGH puis MEDIUM)
        api.fetch.mockClear();
        mockApi({ "POST /api/ai/analyze-risk": { success: true, data: PLAN("HIGH") } });
        fireEvent.click(screen.getByRole("button", { name: /Relancer l'IA/ }));
        expect(await screen.findByText("HIGH")).toBeInTheDocument();
        mockApi({ "POST /api/ai/analyze-risk": { success: true, data: PLAN("MEDIUM") } });
        fireEvent.click(screen.getByRole("button", { name: /Relancer l'IA/ }));
        expect(await screen.findByText("MEDIUM")).toBeInTheDocument();
    });

    it("affiche l'erreur renvoyée par l'IA puis propose de relancer l'analyse", async () => {
        mockApi({ "POST /api/ai/analyze-risk": apiStatus(403, { error: "Accès refusé à cet élève" }) });
        render(<RiskInterventionTab atRiskStudents={STUDENTS} academicYearId="y1" />);
        fireEvent.click(screen.getByRole("button", { name: /Adjovi Koffi/ }));
        await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Accès refusé à cet élève"));
        expect(await screen.findByText("Aucune analyse disponible")).toBeInTheDocument();

        const api = mockApi({ "POST /api/ai/analyze-risk": { success: false } });
        fireEvent.click(screen.getByRole("button", { name: "Lancer l'Analyse Maintenant" }));
        await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Une erreur est survenue lors de l'analyse"));
        expect(api.calls("POST /api/ai/analyze-risk")[0].body).toEqual({ studentId: "s2", academicYearId: "y1" });
    });

    it("signale une erreur réseau", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => {
            throw new TypeError("Failed to fetch");
        }));
        render(<RiskInterventionTab atRiskStudents={STUDENTS} academicYearId="y1" />);
        fireEvent.click(screen.getByRole("button", { name: /Hounsou Aïcha/ }));
        await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Erreur de connexion au service d'IA"));
    });
});

// ── Performances académiques ────────────────────────────────────────────────
describe("AcademicPerformancesTab", () => {
    const CLASSES = [{ id: "c1", name: "6e A" }, { id: "c2", name: "5e B" }];
    const CLASS_DATA = {
        subjectSummary: [
            { subjectId: "math", name: "Mathématiques", average: 12 },
            { subjectId: "fr", name: "Français", average: 9 },
        ],
        studentRanking: [
            { studentId: "s1", name: "Aïcha", average: 15, rank: 1 },
            { studentId: "s2", name: "Koffi", average: 9, rank: 2 },
        ],
        monthlyTrend: [{ name: "Sep", value: 11 }],
    };

    it("charge la classe, affiche le classement puis le détail d'une matière", async () => {
        asRole("DIRECTOR");
        const api = mockApi({
            "GET /api/analytics/class/c1": CLASS_DATA,
            "GET /api/analytics/class/c1/subject/math": {
                monthlyTrend: [{ name: "Sep", value: 12 }],
                gradeDistribution: { excellent: 1, veryGood: 1, good: 1, average: 1, insufficient: 1, weak: 1 },
                teacherName: "M. Dossou",
            },
            "GET /api/analytics/class/c2": {},
        });
        renderPage(<AcademicPerformancesTab classes={CLASSES} academicYearId="y1" />);
        expect((await screen.findAllByText("15/20")).length).toBeGreaterThan(0);
        expect(screen.getByText("#1")).toBeInTheDocument();
        expect(api.calls()[0].url).toBe("/api/analytics/class/c1");

        // Radar chargé à la demande, puis clic sur une matière
        const bouton = await screen.findByRole("button", { name: /Mathématiques/ });
        fireEvent.click(bouton);
        expect(await screen.findByText("M. Dossou")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Focus Matière : Mathématiques/ })).toHaveAttribute(
            "href",
            "/dashboard/analytics/class/c1/subject/math",
        );
        expect(api.calls("GET /api/analytics/class/c1/subject/math")).toHaveLength(1);

        // Changer de classe réinitialise la matière
        await chooseSelectOption("Classe", "5e B");
        await waitFor(() => expect(api.calls("GET /api/analytics/class/c2")).toHaveLength(1));
        expect(screen.queryByText("M. Dossou")).not.toBeInTheDocument();
    });

    it("sans données de matière, affiche « Non assigné » et des valeurs par défaut", async () => {
        asRole("DIRECTOR");
        mockApi({
            "GET /api/analytics/class/c1": { subjectSummary: [{ subjectId: "hist", name: "Histoire", average: 10 }], studentRanking: [] },
            "GET /api/analytics/class/c1/subject/hist": {},
        });
        renderPage(<AcademicPerformancesTab classes={CLASSES} academicYearId="y1" />);
        fireEvent.click(await screen.findByRole("button", { name: /Histoire/ }));
        expect(await screen.findByText("Non assigné")).toBeInTheDocument();
    });

    it("sans classe, n'émet aucune requête et le nom de matière retombe sur « Matière »", async () => {
        asRole("DIRECTOR");
        const api = mockApi({});
        renderPage(<AcademicPerformancesTab classes={[]} academicYearId="y1" />);
        expect(screen.getByText("Performances par Classe")).toBeInTheDocument();
        expect(api.calls()).toHaveLength(0);
    });

    it("le détail d'une matière inconnue du résumé affiche « Matière »", async () => {
        asRole("DIRECTOR");
        mockApi({
            "GET /api/analytics/class/c1": { studentRanking: [{ name: "Sans moyenne", average: 0, rank: 3 }] },
        });
        renderPage(<AcademicPerformancesTab classes={CLASSES} academicYearId="y1" />);
        expect(await screen.findByText("Sans moyenne")).toBeInTheDocument();
        // Pas de matière dans le résumé : le radar n'a pas de bouton de matière
        await waitFor(() => expect(screen.getByText("Cliquez sur une matière")).toBeInTheDocument());
        expect(screen.queryByText("Matière")).not.toBeInTheDocument();
    });
});

// ── Rapports ────────────────────────────────────────────────────────────────
describe("AnalyticsReportsTab", () => {
    const SECTIONS = [
        { title: "Synthèse", headers: ["KPI", "Valeur"], rows: [["Élèves", 120]] },
        { title: "Performances", headers: ["Matière", "Moyenne"], rows: [["Maths", 12]] },
    ];

    function montage() {
        return render(
            <AnalyticsProvider initialAcademicYearId="y1" initialPeriodId="p1">
                <AnalyticsReportsTab />
            </AnalyticsProvider>,
        );
    }

    it("exporte un CSV fusionné avec les filtres actifs et l'ajoute à l'historique", async () => {
        exportMocks.buildReportSections.mockResolvedValue(SECTIONS);
        montage();
        expect(screen.getByText("Aucun rapport généré pour l'instant.")).toBeInTheDocument();
        const titre = screen.getByDisplayValue(/^Rapport Analytique - /);
        fireEvent.change(titre, { target: { value: "Bilan T1" } });

        // Inclure la section finance (5e case)
        const cases = screen.getAllByRole("checkbox");
        expect(cases).toHaveLength(5);
        fireEvent.click(cases[4]);

        fireEvent.click(screen.getByRole("button", { name: /Exporter CSV/ }));
        expect(screen.getByRole("button", { name: /Génération…/ })).toBeDisabled();
        await waitFor(() => expect(exportMocks.exportToCSV).toHaveBeenCalledTimes(1));
        const input = exportMocks.buildReportSections.mock.calls[0][0];
        expect(input.filters).toEqual({ schoolId: "ALL", academicYearId: "y1", periodId: "p1", classIds: [], subjectIds: [] });
        expect(input.blocks.finance).toBe(true);
        expect(input.order).toEqual(["overview", "performances", "attendance", "risks", "finance"]);
        const csv = exportMocks.exportToCSV.mock.calls[0][0];
        expect(csv.title).toBe("Bilan T1");
        expect(csv.rows).toEqual([["Synthèse"], ["KPI", "Valeur"], ["Élèves", 120], [""], [""], ["Performances"], ["Matière", "Moyenne"], ["Maths", 12]]);
        await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Rapport CSV généré.", { id: "toast-id" }));
        expect(await screen.findByText("Bilan T1")).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem("edupilot.recent-reports") || "[]")[0].format).toBe("CSV");
    });

    it("génère un PDF avec une table par section et un nom de fichier assaini", async () => {
        exportMocks.buildReportSections.mockResolvedValue(SECTIONS);
        montage();
        fireEvent.change(screen.getByDisplayValue(/^Rapport Analytique - /), { target: { value: "Bilan / T1" } });
        fireEvent.click(screen.getByRole("button", { name: /Générer PDF/ }));
        await waitFor(() => expect(exportMocks.doc.save).toHaveBeenCalledTimes(1));
        expect(exportMocks.autoTable).toHaveBeenCalledTimes(2);
        expect(exportMocks.autoTable.mock.calls[0][1]).toMatchObject({ head: [["KPI", "Valeur"]], body: [["Élèves", 120]], startY: 38 });
        expect(exportMocks.doc.text).toHaveBeenCalledWith("Bilan / T1", 14, 18);
        expect(exportMocks.doc.save.mock.calls[0][0]).toMatch(/^Bilan_T1_\d{2}-\d{2}-\d{4}\.pdf$/);
        await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Rapport PDF généré.", { id: "toast-id" }));
    });

    it("refuse d'exporter sans section et signale un échec du générateur", async () => {
        exportMocks.buildReportSections.mockResolvedValueOnce([]);
        montage();
        fireEvent.click(screen.getByRole("button", { name: /Exporter CSV/ }));
        await waitFor(() =>
            expect(toastMock.error).toHaveBeenCalledWith("Sélectionnez au moins une section à exporter.", { id: "toast-id" }),
        );
        expect(exportMocks.exportToCSV).not.toHaveBeenCalled();

        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        exportMocks.buildReportSections.mockRejectedValueOnce(new Error("réseau"));
        await waitFor(() => expect(screen.getByRole("button", { name: /Générer PDF/ })).toBeEnabled());
        fireEvent.click(screen.getByRole("button", { name: /Générer PDF/ }));
        await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Échec de l'export PDF.", { id: "toast-id" }));
        spy.mockRestore();
    });

    it("ignore un second clic pendant une génération", async () => {
        let resolve: (v: unknown) => void = () => {};
        exportMocks.buildReportSections.mockReturnValue(new Promise((r) => (resolve = r)));
        montage();
        const csv = screen.getByRole("button", { name: /Exporter CSV/ });
        fireEvent.click(csv);
        // Le bouton est désactivé : on force l'appel du gestionnaire via React
        const props = Object.entries(csv).find(([k]) => k.startsWith("__reactProps"))?.[1] as { onClick: () => void };
        props.onClick();
        resolve(SECTIONS);
        await waitFor(() => expect(exportMocks.exportToCSV).toHaveBeenCalledTimes(1));
        expect(exportMocks.buildReportSections).toHaveBeenCalledTimes(1);
    });

    it("réordonne les sections par glisser-déposer et décoche une section", () => {
        montage();
        const libelles = () => screen.getAllByText(/^(Synthèse Globale|Performances Académiques|Assiduité & Ponctualité|Risques & Décrochage|Santé Financière)$/).map((n) => n.textContent);
        const ligne = (label: string) => screen.getByText(label).closest("[draggable]") as HTMLElement;

        fireEvent.dragStart(ligne("Santé Financière"));
        fireEvent.dragEnter(ligne("Synthèse Globale"));
        fireEvent.dragOver(ligne("Synthèse Globale"));
        fireEvent.dragEnd(ligne("Santé Financière"));
        expect(libelles()[0]).toBe("Santé Financière");

        // Glisser sur soi-même ou sans cible : aucun changement
        fireEvent.dragStart(ligne("Synthèse Globale"));
        fireEvent.dragEnter(ligne("Synthèse Globale"));
        fireEvent.dragEnd(ligne("Synthèse Globale"));
        fireEvent.dragEnd(ligne("Synthèse Globale"));
        expect(libelles()[0]).toBe("Santé Financière");

        // Décocher « Synthèse Globale » retire le badge « Inclus »
        const avant = screen.getAllByText("Inclus").length;
        fireEvent.click(within(ligne("Synthèse Globale")).getByRole("checkbox"));
        expect(screen.getAllByText("Inclus")).toHaveLength(avant - 1);
    });

    it("recharge l'historique existant au montage", () => {
        localStorage.setItem(
            "edupilot.recent-reports",
            JSON.stringify([{ title: "Ancien rapport", format: "PDF", generatedAt: "2026-09-01T10:00:00.000Z" }]),
        );
        montage();
        expect(screen.getByText("Ancien rapport")).toBeInTheDocument();
    });
});
