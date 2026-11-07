/**
 * Compréhension de l'assistant local, sans base : traitement du français,
 * reconnaissance des élèves/classes/matières/dates, classement des intentions.
 * Le corpus reprend des formulations réelles (fautes de frappe comprises) :
 * toute régression de compréhension casse ce test.
 */
import { describe, it, expect } from "vitest";
import { compact, editDistance, normalize, similar, stem } from "@/lib/ai/assistant/text";
import { classify } from "@/lib/ai/assistant/intents";
import { extractEntities, localDay } from "@/lib/ai/assistant/entities";
import type { AssistantScope } from "@/lib/ai/assistant/scope";
import type { IntentId } from "@/lib/ai/assistant/types";

const scope: AssistantScope = {
    user: { id: "u-dir", role: "DIRECTOR", schoolId: "school-a" },
    schoolId: "school-a",
    kind: "direction",
    classes: [
        { id: "c-3b", name: "3e B" },
        { id: "c-4a", name: "4ème A" },
        { id: "c-tled", name: "Tle D" },
        { id: "c-cm2", name: "CM2" },
    ],
    students: [
        { id: "s-koffi", name: "Koffi Adjovi", className: "3e B" },
        { id: "s-awa1", name: "Awa Dossou", className: "4ème A" },
        { id: "s-awa2", name: "Awa Houngbo", className: "3e B" },
        { id: "s-clem", name: "Clément Agossou", className: "Tle D" },
    ],
    subjects: [
        { id: "sub-math", name: "Mathématiques", code: "MATH" },
        { id: "sub-fr", name: "Français", code: "FR" },
        { id: "sub-svt", name: "SVT", code: "SVT" },
    ],
};

// Mercredi 4 novembre 2026, 10 h à Cotonou
const NOW = new Date("2026-11-04T09:00:00Z");

describe("texte — normalisation du français", () => {
    it("retire accents et ponctuation, unifie les ordinaux scolaires", () => {
        expect(normalize("Élèves de la 3ème B ?")).toBe("eleves de la 3e b");
        expect(normalize("3 eme B")).toBe("3e b");
        expect(normalize("1ère C, Tle D, 2nde A")).toBe("1re c terminale d 2nde a");
        expect(normalize("l'élève d'aujourd'hui")).toBe("l eleve d aujourd hui");
        expect(compact("4ème A")).toBe("4ea");
    });

    it("rapproche les formes d'un même mot", () => {
        expect(stem("absences")).toBe(stem("absence"));
        expect(stem("previsions")).toBe(stem("prevision"));
    });

    it("tolère une faute de frappe proportionnée à la longueur", () => {
        expect(editDistance("abscence", "absence")).toBe(1);
        expect(editDistance("prevsiion", "prevision")).toBe(1); // transposition
        expect(similar("orientaton", "orientation")).toBe(true);
        expect(similar("ami", "amie")).toBe(false); // trop court
        expect(similar("3e", "4e")).toBe(false); // jamais sur les chiffres
    });
});

describe("éléments reconnus", () => {
    const entities = (message: string) => extractEntities(message, scope, NOW);

    it("reconnaît une classe sous toutes ses écritures", () => {
        expect(entities("bilan de la 3eme B").class?.id).toBe("c-3b");
        expect(entities("bilan de la 3eB").class?.id).toBe("c-3b");
        expect(entities("élèves de 4e A").class?.id).toBe("c-4a");
        expect(entities("absences en terminale D").class?.id).toBe("c-tled");
        expect(entities("emploi du temps du CM2").class?.id).toBe("c-cm2");
        expect(entities("élèves à risque").class).toBeUndefined();
    });

    it("reconnaît un élève par son nom complet, son nom seul ou avec une faute", () => {
        expect(entities("analyse de Koffi Adjovi").student?.id).toBe("s-koffi");
        expect(entities("comment va adjovi ?").student?.id).toBe("s-koffi");
        expect(entities("prévision de Kofi Adjovy").student?.id).toBe("s-koffi");
        expect(entities("notes de clement").student?.id).toBe("s-clem");
    });

    it("propose les homonymes au lieu de deviner", () => {
        const found = entities("comment va Awa ?");
        expect(found.student).toBeUndefined();
        expect(found.studentCandidates?.map((s) => s.id).sort()).toEqual(["s-awa1", "s-awa2"]);
        expect(entities("comment va Awa Houngbo ?").student?.id).toBe("s-awa2");
    });

    it("ne prend jamais un mot de la question pour un élève hors périmètre", () => {
        expect(entities("absences de cette semaine").student).toBeUndefined();
        expect(entities("emploi du temps de demain").student).toBeUndefined();
        expect(entities("analyse de Moussa Traoré").student).toBeUndefined();
    });

    it("reconnaît les matières et leurs abréviations", () => {
        expect(entities("notes de Koffi en maths").subject?.id).toBe("sub-math");
        expect(entities("prévision en mathematique").subject?.id).toBe("sub-math");
        expect(entities("devoirs de svt").subject?.id).toBe("sub-svt");
        expect(entities("notes de Koffi en maths").student?.id).toBe("s-koffi");
    });

    it("traduit les périodes et les jours en dates locales (UTC+1)", () => {
        expect(localDay(NOW).toISOString()).toBe("2026-11-04T00:00:00.000Z");
        expect(entities("absents aujourd'hui").range?.from.toISOString()).toBe("2026-11-04T00:00:00.000Z");
        expect(entities("absences d'hier").range?.from.toISOString()).toBe("2026-11-03T00:00:00.000Z");
        expect(entities("absences de cette semaine").range?.from.toISOString()).toBe("2026-11-02T00:00:00.000Z"); // lundi
        expect(entities("absences de la semaine dernière").range?.from.toISOString()).toBe("2026-10-26T00:00:00.000Z");
        expect(entities("absences du mois dernier").range?.from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
        expect(entities("absences des 10 derniers jours").range?.from.toISOString()).toBe("2026-10-26T00:00:00.000Z");
        expect(entities("emploi du temps de demain").day).toEqual({ dayOfWeek: 4, label: "demain" });
        expect(entities("cours de lundi").day).toEqual({ dayOfWeek: 1, label: "lundi" });
        // 23 h 30 à Cotonou = déjà le lendemain en heure locale ? Non : 22 h 30 UTC = 23 h 30 locale, même jour
        expect(localDay(new Date("2026-11-04T22:30:00Z")).toISOString()).toBe("2026-11-04T00:00:00.000Z");
        expect(localDay(new Date("2026-11-04T23:30:00Z")).toISOString()).toBe("2026-11-05T00:00:00.000Z");
    });

    it("repère les renvois au tour précédent", () => {
        expect(entities("et sa prévision ?").anaphora).toBe(true);
        expect(entities("élèves à risque").anaphora).toBe(false);
    });
});

const SOCIAL = new Set<IntentId>(["greeting", "thanks", "help", "ack", "repeat", "more"]);

/** Même règle que le moteur : une demande nette l'emporte sur la politesse. */
function pick(message: string): IntentId | undefined {
    const result = classify(message, extractEntities(message, scope, NOW));
    const top = result.ranked[0];
    const request = result.ranked.find((r) => !SOCIAL.has(r.id) && r.score >= (top && SOCIAL.has(top.id) ? 2 : 1.5));
    return request?.id ?? top?.id;
}

describe("compréhension des intentions — corpus", () => {
    const corpus: Array<[string, IntentId]> = [
        ["Bonjour", "greeting"],
        ["salut !", "greeting"],
        ["merci beaucoup", "thanks"],
        ["que sais-tu faire ?", "help"],
        ["aide", "help"],
        ["quels élèves sont à risque ?", "risk.list"],
        ["Élèves en difficulté en 3e B", "risk.list"],
        ["qui risque de décrocher ce trimestre", "risk.list"],
        ["liste des élèves fragiles", "risk.list"],
        ["élèves a risqe", "risk.list"],
        ["Bonjour, quels élèves sont à risque ?", "risk.list"],
        ["analyse de Koffi Adjovi", "student.overview"],
        ["comment va Koffi ?", "student.overview"],
        ["où en est Clément", "student.overview"],
        ["bilan de Koffi", "student.overview"],
        ["prévision de Koffi", "student.forecast"],
        ["quelle moyenne va avoir Koffi au prochain trimestre ?", "student.forecast"],
        ["prédis la moyenne de Clément", "student.forecast"],
        ["previsoin de koffi", "student.forecast"],
        ["quelle série pour Koffi ?", "student.orientation"],
        ["orientation de Clément", "student.orientation"],
        ["orientaton de koffi", "student.orientation"],
        ["plan d'action pour Koffi", "student.action-plan"],
        ["comment aider Koffi à remonter", "student.action-plan"],
        ["propose une remédiation pour Clément", "student.action-plan"],
        ["rédige l'appréciation de Koffi", "student.comment"],
        ["commentaire de bulletin pour Clément", "student.comment"],
        ["dernières notes de Koffi", "student.grades"],
        ["notes de Koffi en maths", "student.grades"],
        ["mes notes", "student.grades"],
        ["bilan de la 3e B", "class.overview"],
        ["moyenne de la classe de 4e A", "class.overview"],
        ["meilleurs élèves de la 3e B", "class.overview"],
        ["vue d'ensemble de l'école", "school.overview"],
        ["chiffres clés de l'établissement", "school.overview"],
        ["statistiques globales", "school.overview"],
        ["absences de cette semaine", "attendance.summary"],
        ["qui est absent aujourd'hui ?", "attendance.summary"],
        ["retards de la 3e B", "attendance.summary"],
        ["abscences d'hier", "attendance.summary"],
        ["assiduité de Koffi ce mois", "attendance.summary"],
        ["emploi du temps de demain", "schedule.day"],
        ["edt de la 3e B lundi", "schedule.day"],
        ["à quelle heure commencent les cours demain ?", "schedule.day"],
        ["mes horaires de jeudi", "schedule.day"],
        ["devoirs à rendre", "homework.upcoming"],
        ["quels exercices pour demain ?", "homework.upcoming"],
        ["travail à la maison en SVT", "homework.upcoming"],
        // Faux positif corrigé : « cette » ressemblait à « dette » (finance) à une faute près
        ["qu'est-ce qu'on doit rendre cette semaine", "homework.upcoming"],
        ["combien je dois encore payer ?", "finance.balance"],
        ["reste à payer pour la scolarité", "finance.balance"],
        ["prochaine échéance des frais", "finance.balance"],
        ["taux de recouvrement", "finance.balance"],
        ["impayés de l'année", "finance.balance"],
        ["où trouver les bulletins ?", "navigate"],
        ["comment saisir les notes", "navigate"],
        ["où puis-je inscrire un élève", "navigate"],
        // Synthèse, explication, petites phrases (2026-11-07)
        ["résume Koffi", "student.summary"],
        ["fais-moi un point complet sur Clément", "student.summary"],
        ["état des lieux pour Koffi", "student.summary"],
        ["pourquoi Koffi baisse ?", "student.why"],
        ["qu'est-ce qui explique les résultats de Clément", "student.why"],
        ["d'où viennent les difficultés de Koffi", "student.why"],
        ["d'accord", "ack"],
        ["ok merci", "thanks"],
        ["tu peux répéter ?", "repeat"],
        ["reformule stp", "repeat"],
        ["autre chose ?", "more"],
        ["quoi d'autre", "more"],
    ];

    it.each(corpus)("« %s » → %s", (message, expected) => {
        expect(pick(message)).toBe(expected);
    });

    it("ne comprend rien à une question hors sujet", () => {
        const message = "quelle est la capitale du Japon";
        expect(classify(message, extractEntities(message, scope, NOW)).top).toBeNull();
    });

    it("mesure une compréhension nette sur une question claire", () => {
        const message = "emploi du temps de demain";
        expect(classify(message, extractEntities(message, scope, NOW)).understanding).toBeGreaterThanOrEqual(0.8);
    });
});
