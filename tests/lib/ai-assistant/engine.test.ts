/**
 * Moteur de l'assistant : aiguillage, suite de conversation, demandes de
 * précision, contrôle des rôles et du périmètre. Les réponses (skills) sont
 * remplacées par des espions : on vérifie QUI est appelé avec QUOI.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AssistantScope } from "@/lib/ai/assistant/scope";

const state = vi.hoisted(() => ({ scope: null as AssistantScope | null }));

vi.mock("@/lib/ai/assistant/scope", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/ai/assistant/scope")>();
    return { ...actual, loadScope: vi.fn(async () => state.scope) };
});
vi.mock("@/lib/ai/assistant/skills", () => {
    const skill = (name: string) =>
        vi.fn(async (input: { student?: { id: string }; klass?: { id: string } }) => ({
            text: name,
            sources: ["test"],
            context: { intent: name, studentId: input.student?.id, classId: input.klass?.id },
        }));
    return {
        riskList: skill("risk.list"),
        studentOverview: skill("student.overview"),
        studentSummary: skill("student.summary"),
        studentWhy: skill("student.why"),
        studentForecast: skill("student.forecast"),
        studentOrientation: skill("student.orientation"),
        studentActionPlan: skill("student.action-plan"),
        studentComment: skill("student.comment"),
        studentGrades: skill("student.grades"),
        classOverview: skill("class.overview"),
        schoolOverview: skill("school.overview"),
        attendanceSummary: skill("attendance.summary"),
        scheduleDay: skill("schedule.day"),
        homeworkUpcoming: skill("homework.upcoming"),
        financeBalance: skill("finance.balance"),
        navigate: vi.fn(() => ({ text: "navigate", sources: [] })),
    };
});

import { answerQuestion } from "@/lib/ai/assistant/engine";
import * as skills from "@/lib/ai/assistant/skills";

const NOW = new Date("2026-11-04T09:00:00Z");

function scopeFor(kind: AssistantScope["kind"], role: string, extra: Partial<AssistantScope> = {}): AssistantScope {
    return {
        user: { id: `u-${role}`, role, schoolId: "school-a", firstName: "Awa" },
        schoolId: "school-a",
        kind,
        classes: [
            { id: "c-3b", name: "3e B" },
            { id: "c-4a", name: "4e A" },
        ],
        students: [
            { id: "s-koffi", name: "Koffi Adjovi", className: "3e B" },
            { id: "s-awa1", name: "Awa Dossou", className: "4e A" },
            { id: "s-awa2", name: "Awa Houngbo", className: "3e B" },
        ],
        subjects: [{ id: "sub-math", name: "Mathématiques", code: "MATH" }],
        ...extra,
    };
}

const ask = (message: string, role = "DIRECTOR", context?: Parameters<typeof answerQuestion>[2]) =>
    answerQuestion(message, { id: `u-${role}`, role, schoolId: "school-a" }, context, NOW);

beforeEach(() => {
    vi.clearAllMocks();
    state.scope = scopeFor("direction", "DIRECTOR");
});

describe("assistant — aiguillage", () => {
    it("appelle la bonne réponse avec l'élève reconnu", async () => {
        const answer = await ask("prévision de Koffi");
        expect(answer.meta.intent).toBe("student.forecast");
        expect(skills.studentForecast).toHaveBeenCalledWith(expect.objectContaining({ student: expect.objectContaining({ id: "s-koffi" }) }));
        expect(answer.meta.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it("un nom seul ouvre l'analyse de l'élève ; une classe seule, le bilan de la classe", async () => {
        expect((await ask("Koffi Adjovi")).meta.intent).toBe("student.overview");
        expect((await ask("3e B")).meta.intent).toBe("class.overview");
    });

    it("le risque d'un élève nommé est son analyse (elle contient sa probabilité d'échec)", async () => {
        expect((await ask("risque de décrochage de Koffi")).meta.intent).toBe("student.overview");
    });

    it("répond aux salutations sans toucher aux données", async () => {
        const answer = await ask("Bonjour");
        expect(answer.meta.intent).toBe("greeting");
        expect(answer.text).toContain("Bonjour Awa");
        expect(answer.suggestions.length).toBeGreaterThan(0);
        expect(skills.schoolOverview).not.toHaveBeenCalled();
    });

    it("avoue ne pas comprendre et propose des exemples", async () => {
        const answer = await ask("quelle est la capitale du Japon");
        expect(answer.meta.intent).toBe("unknown");
        expect(answer.suggestions.length).toBeGreaterThan(0);
    });
});

describe("assistant — suite de conversation", () => {
    it("« et pour Awa Houngbo ? » reprend l'intention précédente", async () => {
        const answer = await ask("et pour Awa Houngbo ?", "DIRECTOR", { intent: "student.forecast", studentId: "s-koffi" });
        expect(answer.meta.intent).toBe("student.forecast");
        expect(skills.studentForecast).toHaveBeenCalledWith(expect.objectContaining({ student: expect.objectContaining({ id: "s-awa2" }) }));
    });

    it("« et son plan d'action ? » reprend l'élève précédent", async () => {
        await ask("et son plan d'action ?", "DIRECTOR", { intent: "student.forecast", studentId: "s-koffi" });
        expect(skills.studentActionPlan).toHaveBeenCalledWith(expect.objectContaining({ student: expect.objectContaining({ id: "s-koffi" }) }));
    });

    it("« et la semaine dernière ? » rejoue la même question sur une autre période", async () => {
        const answer = await ask("et la semaine dernière ?", "DIRECTOR", { intent: "attendance.summary" });
        expect(answer.meta.intent).toBe("attendance.summary");
        const input = vi.mocked(skills.attendanceSummary).mock.calls[0][0];
        expect(input.entities.range?.label).toBe("la semaine dernière");
    });

    it("ignore un identifiant d'élève hors périmètre envoyé par le navigateur", async () => {
        const answer = await ask("et son plan d'action ?", "DIRECTOR", { intent: "student.forecast", studentId: "eleve-autre-ecole" });
        expect(skills.studentActionPlan).not.toHaveBeenCalled();
        expect(answer.meta.intent).toBe("clarify");
    });
});

describe("assistant — précisions demandées au lieu de deviner", () => {
    it("deux élèves du même prénom : choix en un clic", async () => {
        const answer = await ask("prévision de Awa");
        expect(answer.meta.intent).toBe("clarify");
        expect(answer.suggestions).toEqual(["Prévision de Awa Dossou (4e A)", "Prévision de Awa Houngbo (3e B)"]);
        expect(skills.studentForecast).not.toHaveBeenCalled();
    });

    it("bilan de classe sans classe : la liste des classes", async () => {
        const answer = await ask("moyenne de la classe");
        expect(answer.meta.intent).toBe("clarify");
        expect(answer.suggestions).toEqual(["Bilan de la 3e B", "Bilan de la 4e A"]);
    });

    it("un parent d'un seul enfant n'a pas à le nommer", async () => {
        state.scope = scopeFor("family", "PARENT", {
            students: [{ id: "s-koffi", name: "Koffi Adjovi", className: "3e B" }],
            classes: [{ id: "c-3b", name: "3e B" }],
        });
        await ask("comment va mon enfant ?", "PARENT");
        expect(skills.studentOverview).toHaveBeenCalledWith(expect.objectContaining({ student: expect.objectContaining({ id: "s-koffi" }) }));
    });

    it("un parent de plusieurs enfants choisit lequel", async () => {
        state.scope = scopeFor("family", "PARENT");
        const answer = await ask("dernières notes", "PARENT");
        expect(answer.meta.intent).toBe("clarify");
        expect(answer.text).toBe("Pour lequel de vos enfants ?");
        expect(answer.suggestions).toHaveLength(3);
    });
});

describe("assistant — rôles", () => {
    it("un parent n'obtient ni la liste des élèves à risque ni la vue établissement", async () => {
        state.scope = scopeFor("family", "PARENT");
        const risk = await ask("quels élèves sont à risque ?", "PARENT");
        expect(risk.text).toContain("réservée à l'équipe pédagogique");
        expect(skills.riskList).not.toHaveBeenCalled();
        const school = await ask("vue d'ensemble de l'école", "PARENT");
        expect(school.text).toContain("réservée à la direction");
        expect(skills.schoolOverview).not.toHaveBeenCalled();
    });

    it("un enseignant n'a pas la vue établissement mais a ses élèves à risque", async () => {
        state.scope = scopeFor("teacher", "TEACHER");
        expect((await ask("vue d'ensemble de l'école", "TEACHER")).text).toContain("réservée à la direction");
        await ask("élèves à risque", "TEACHER");
        expect(skills.riskList).toHaveBeenCalled();
    });

    it("le réseau (NETWORK_ADMIN) hérite des droits de la direction", async () => {
        state.scope = scopeFor("direction", "NETWORK_ADMIN");
        await ask("vue d'ensemble de l'école", "NETWORK_ADMIN");
        expect(skills.schoolOverview).toHaveBeenCalled();
    });

    it("un compte sans périmètre (comptable, personnel) est refusé poliment", async () => {
        state.scope = null;
        const answer = await ask("élèves à risque", "ACCOUNTANT");
        expect(answer.meta.intent).toBe("unknown");
        expect(answer.text).toContain("réservé");
    });
});
