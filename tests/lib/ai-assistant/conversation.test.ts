/**
 * Qualité conversationnelle de l'assistant local (2026-11-07) :
 * tournures variées mais stables, ton selon le rôle, synthèse rédigée,
 * explication des « pourquoi », reformulation et suite de conversation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AssistantScope } from "@/lib/ai/assistant/scope";

const state = vi.hoisted(() => ({ scope: null as unknown }));

vi.mock("@/lib/prisma", () => ({ default: { attendance: { findMany: vi.fn() } } }));
vi.mock("@/lib/academic/grading-settings", () => ({ getPassingGrade: vi.fn(async () => 10) }));
vi.mock("@/lib/ai/governance-service", () => ({ governanceService: { execute: vi.fn() } }));
vi.mock("@/lib/finance/expected-fees", () => ({ computeYearFeeRecovery: vi.fn() }));
vi.mock("@/lib/finance/family-finance", () => ({ getChildFinance: vi.fn() }));
vi.mock("@/lib/ai/assistant/scope", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/ai/assistant/scope")>();
    return { ...actual, loadScope: vi.fn(async () => state.scope) };
});

import prisma from "@/lib/prisma";
import { governanceService } from "@/lib/ai/governance-service";
import { getChildFinance } from "@/lib/finance/family-finance";
import { hashSeed, joinFr, vary, voiceFor } from "@/lib/ai/assistant/phrasing";
import { studentSummary, studentWhy } from "@/lib/ai/assistant/skills";
import { answerQuestion } from "@/lib/ai/assistant/engine";
import type { Entities } from "@/lib/ai/assistant/types";

const NOW = new Date("2026-11-04T09:00:00Z");
const m = <T>(fn: T) => vi.mocked(fn as unknown as (...args: unknown[]) => unknown);
const none: Entities = { anaphora: false };
const koffi = { id: "s-koffi", name: "Koffi Adjovi", className: "3e B" };

function scope(kind: AssistantScope["kind"], role: string): AssistantScope {
    return {
        user: { id: `u-${role}`, role, schoolId: "school-a" },
        schoolId: "school-a",
        kind,
        classes: [{ id: "c-3b", name: "3e B" }],
        students: [koffi],
        subjects: [],
    };
}

function analysis(overrides: Record<string, unknown> = {}) {
    return {
        data: {
            status: "analyzed",
            student: { name: "Koffi Adjovi", class: { name: "3e B" } },
            analyticsPeriod: { periodName: "Trimestre 1" },
            metrics: { averageGrade: 8.5, classRank: 21, classSize: 30, attendanceRate: 88, riskLevel: "HIGH", incidentCount: 1, progressionRate: -12 },
            strengths: ["Anglais"],
            weaknesses: ["Mathématiques", "Physique-Chimie"],
            subjectPerformance: [
                { subjectName: "Mathématiques", average: 6, progressionRate: -25, isWeakness: true },
                { subjectName: "Anglais", average: 14, progressionRate: 4, isWeakness: false },
            ],
            prediction: {
                probability: 62,
                level: "HIGH",
                causalFactors: [
                    { factor: "moyenne_insuffisante", weight: 0.4, contribution: 70, description: "La moyenne est en dessous du seuil de réussite (10/20)" },
                    { factor: "assiduite_faible", weight: 0.25, contribution: 40, description: "Taux de présence de 88% (recommandé: >90%)" },
                ],
            },
            ...overrides,
        },
        recommendations: [],
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    m(prisma.attendance.findMany).mockResolvedValue([{ status: "ABSENT" }, { status: "ABSENT" }, { status: "LATE" }]);
});

describe("formulation", () => {
    it("même question → même tournure ; questions différentes → tournures variées", () => {
        const variants = ["A", "B", "C", "D"];
        expect(vary(hashSeed("prévision de Koffi"), variants)).toBe(vary(hashSeed("prévision de Koffi"), variants));
        const seen = new Set(Array.from({ length: 20 }, (_, i) => vary(hashSeed(`question ${i}`), variants)));
        expect(seen.size).toBeGreaterThanOrEqual(3);
    });

    it("relie les énumérations comme en français", () => {
        expect(joinFr(["maths"])).toBe("maths");
        expect(joinFr(["maths", "SVT"])).toBe("maths et SVT");
        expect(joinFr(["maths", "SVT", "anglais"])).toBe("maths, SVT et anglais");
    });

    it("registre familial pour les parents et élèves, factuel pour l'équipe", () => {
        expect(voiceFor(scope("family", "PARENT"), "x").register).toBe("family");
        expect(voiceFor(scope("teacher", "TEACHER"), "x").register).toBe("staff");
    });
});

describe("synthèse rédigée — « résume Koffi »", () => {
    it("parent : paragraphe relié (résultats, en revanche, assiduité, paiements), ton bienveillant", async () => {
        m(governanceService.execute).mockResolvedValueOnce(analysis());
        m(getChildFinance).mockResolvedValueOnce({ totals: { remaining: 45000 } });
        const out = await studentSummary({ scope: scope("family", "PARENT"), entities: none, message: "résume Koffi", now: NOW, student: koffi });
        expect(out.text).toContain("**8,50/20**");
        expect(out.text).toContain("21ᵉ sur 30");
        expect(out.text).toContain("Koffi réussit bien en Anglais ; en revanche, Mathématiques et Physique-Chimie demandent plus de travail.");
        expect(out.text).toContain("2 absences non justifiées et 1 retard sur les 30 derniers jours");
        expect(out.text).toContain("1 incident de discipline a été signalé");
        expect(out.text).toMatch(/il reste \*\*45\s000 FCFA\*\* à régler/);
        expect(out.text).toMatch(/coup de pouce|accompagner Koffi/);
        expect(out.text).not.toMatch(/priorité de suivi|plan d'action est conseillé/); // registre équipe absent
        expect(out.suggestions[0]).toBe("Pourquoi Koffi Adjovi est en difficulté ?");
        expect(out.context).toEqual({ intent: "student.summary", studentId: "s-koffi" });
    });

    it("enseignant : registre factuel, jamais la finance", async () => {
        m(governanceService.execute).mockResolvedValueOnce(analysis());
        const out = await studentSummary({ scope: scope("teacher", "TEACHER"), entities: none, message: "résume Koffi", now: NOW, student: koffi });
        expect(getChildFinance).not.toHaveBeenCalled();
        expect(out.text).not.toContain("FCFA");
        expect(out.text).toMatch(/Synthèse|Point complet/);
        expect(out.text).toMatch(/plan d'action est conseillé|suivi prioritaire/);
    });

    it("sans moyenne calculée : le dit, sans inventer de chiffre", async () => {
        m(governanceService.execute).mockResolvedValueOnce(
            analysis({
                metrics: { averageGrade: null, classRank: null, classSize: null, attendanceRate: null, riskLevel: null, incidentCount: 0, progressionRate: null },
                strengths: [],
                weaknesses: [],
            }),
        );
        m(prisma.attendance.findMany).mockResolvedValueOnce([]);
        const out = await studentSummary({ scope: scope("teacher", "TEACHER"), entities: none, message: "résume Koffi", now: NOW, student: koffi });
        expect(out.text).toContain("Aucune moyenne de période n'est encore calculée pour Koffi.");
        expect(out.text).not.toMatch(/\/20/);
    });
});

describe("synthèse — conclusion honnête et élève à la deuxième personne", () => {
    const moderate = (overrides: Record<string, unknown>) =>
        analysis({
            metrics: { averageGrade: 8.9, classRank: 23, classSize: 32, attendanceRate: 95, riskLevel: "LOW", incidentCount: 0, progressionRate: -3 },
            ...overrides,
        });

    it("risque « faible » mais sous la moyenne : jamais « rassurante » (cas réel : Rosine, 8,93/20)", async () => {
        m(governanceService.execute).mockResolvedValueOnce(moderate({}));
        m(prisma.attendance.findMany).mockResolvedValueOnce([]);
        m(getChildFinance).mockResolvedValueOnce({ totals: { remaining: 0 } });
        const out = await studentSummary({ scope: scope("family", "PARENT"), entities: none, message: "résume Koffi", now: NOW, student: koffi });
        expect(out.text).not.toMatch(/rassurante|bonne trajectoire/);
        expect(out.text).toMatch(/demandent de l'attention|encouragements et d'un suivi/);
        expect(out.text).not.toMatch(/encouragée?\b/); // jamais d'accord deviné
    });

    it("l'élève lui-même : vouvoiement, suggestions à la première personne", async () => {
        m(governanceService.execute).mockResolvedValueOnce(moderate({}));
        m(prisma.attendance.findMany).mockResolvedValueOnce([]);
        m(getChildFinance).mockResolvedValueOnce({ totals: { remaining: 0 } });
        const out = await studentSummary({ scope: scope("family", "STUDENT"), entities: none, message: "résume ma situation", now: NOW, student: koffi });
        expect(out.text).toMatch(/^(Voici où vous en êtes|Je vous fais le point)\./);
        expect(out.text).toMatch(/(V|v)otre moyenne est de \*\*8,90\/20\*\*/);
        expect(out.text).toContain("Vous réussissez bien en Anglais");
        expect(out.text).not.toContain("Koffi");
        expect(out.suggestions[0]).toBe("Pourquoi mes résultats baissent ?");
        expect(out.suggestions).toContain("Ma prévision");
    });
});

describe("explication — « pourquoi Koffi baisse ? »", () => {
    it("classe les causes par poids réel et nomme les matières en baisse", async () => {
        m(governanceService.execute).mockResolvedValueOnce(analysis());
        const out = await studentWhy({ scope: scope("family", "PARENT"), entities: none, message: "pourquoi Koffi baisse", now: NOW, student: koffi });
        const items = (out.blocks?.[0] as { items: Array<{ label: string }> }).items.map((i) => i.label);
        expect(items).toHaveLength(3);
        expect(items[0]).toBe("1. La baisse vient surtout de Mathématiques (−25 %)");
        expect(out.suggestions).toContain("Absences de Koffi Adjovi ce mois");
        expect(items[1]).toBe("2. La moyenne est en dessous du seuil de réussite (10/20)");
        expect(out.text).toMatch(/3 éléments|pèse le plus/);
        expect(items[2]).toBe("3. Taux de présence de 88 % (au moins 90 % recommandés)");
        expect(out.blocks?.[1]).toMatchObject({ type: "text", text: expect.stringMatching(/on peut agir|se travaillent/) }); // ton familial, après la liste
        expect(out.suggestions).toContain("Plan d'action pour Koffi Adjovi");
    });

    it("rien d'inquiétant : le dit clairement", async () => {
        m(governanceService.execute).mockResolvedValueOnce(analysis({ subjectPerformance: [], prediction: { probability: 5, level: "LOW", causalFactors: [] } }));
        m(prisma.attendance.findMany).mockResolvedValueOnce([]);
        const out = await studentWhy({ scope: scope("teacher", "TEACHER"), entities: none, message: "pourquoi", now: NOW, student: koffi });
        expect(out.text).toContain("Aucun facteur de risque significatif");
    });
});

describe("suite de conversation", () => {
    const ask = (message: string, context?: Parameters<typeof answerQuestion>[2]) =>
        answerQuestion(message, { id: "u-PARENT", role: "PARENT", schoolId: "school-a" }, context, NOW);

    beforeEach(() => {
        state.scope = scope("family", "PARENT");
    });

    it("« tu peux répéter ? » reformule la réponse précédente sur le même élève", async () => {
        m(governanceService.execute).mockResolvedValueOnce(analysis());
        m(getChildFinance).mockResolvedValueOnce({ totals: { remaining: 0 } });
        const answer = await ask("tu peux répéter ?", { intent: "student.summary", studentId: "s-koffi" });
        expect(answer.meta.intent).toBe("student.summary");
        expect(answer.text).toMatch(/^(Je reformule|Autrement dit|Pour le dire autrement) :/);
        expect(answer.text).toContain("8,50/20");
    });

    it("« répète » sans réponse précédente : le dit", async () => {
        const answer = await ask("répète");
        expect(answer.text).toContain("rien dit à reformuler");
    });

    it("« autre chose ? » propose la suite autour de l'élève en cours", async () => {
        const answer = await ask("autre chose ?", { intent: "student.summary", studentId: "s-koffi" });
        expect(answer.meta.intent).toBe("more");
        expect(answer.suggestions).toEqual(["Pourquoi les résultats de Koffi Adjovi ?", "Prévision de Koffi Adjovi", "Plan d'action pour Koffi Adjovi", "Absences de Koffi Adjovi ce mois"]);
        expect(answer.context).toEqual({ intent: "student.summary", studentId: "s-koffi" });
    });

    it("« d'accord » garde le fil et ne relit rien en base", async () => {
        const answer = await ask("d'accord", { intent: "student.forecast", studentId: "s-koffi" });
        expect(answer.meta.intent).toBe("ack");
        expect(answer.suggestions[0]).toBe("Résume Koffi Adjovi");
        expect(governanceService.execute).not.toHaveBeenCalled();
    });

    it("« pourquoi ? » après une analyse explique le même élève", async () => {
        m(governanceService.execute).mockResolvedValueOnce(analysis());
        const answer = await ask("pourquoi ?", { intent: "student.overview", studentId: "s-koffi" });
        expect(answer.meta.intent).toBe("student.why");
        expect(m(governanceService.execute).mock.calls[0][0]).toMatchObject({ action: "analyze-student", studentId: "s-koffi" });
    });
});
