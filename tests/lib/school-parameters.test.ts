/**
 * Paramètres de l'établissement : bornes, cohérences, repli sur les valeurs
 * d'origine, niveau de risque officiel (calcul unique serveur + écrans) et
 * lecture des seuils à l'écran.
 */
import { describe, it, expect } from "vitest";
import {
    assessRisk,
    DEFAULT_SCHOOL_PARAMETERS,
    PARAMETER_SECTIONS,
    performanceLevel,
    resolveSchoolParameters,
    schoolParametersSchema,
    type SchoolParameters,
} from "@/lib/schools/school-parameters";
import { attendanceBand, DEFAULT_SCHOOL_THRESHOLDS, gradeBand } from "@/lib/schools/school-thresholds";
import { examSuccessProbability } from "@/lib/benin/exam-prep-service";

const clone = (): SchoolParameters => JSON.parse(JSON.stringify(DEFAULT_SCHOOL_PARAMETERS));

describe("valeurs d'origine", () => {
    it("chaque paramètre a une valeur par défaut dans ses bornes, et l'ensemble est cohérent", () => {
        for (const section of PARAMETER_SECTIONS) {
            for (const info of section.params) {
                expect(info.default, `${section.key}.${info.key}`).toBeGreaterThanOrEqual(info.min);
                expect(info.default, `${section.key}.${info.key}`).toBeLessThanOrEqual(info.max);
            }
        }
        expect(schoolParametersSchema.safeParse(DEFAULT_SCHOOL_PARAMETERS).success).toBe(true);
    });

    it("reprend l'ancien comportement (seuils historiques)", () => {
        const d = DEFAULT_SCHOOL_PARAMETERS;
        expect([d.performance.excellentFrom, d.performance.veryGoodFrom, d.performance.goodFrom, d.performance.weakBelow]).toEqual([16, 14, 12, 8]);
        expect([d.followUp.attendanceWarning, d.followUp.attendanceCritical]).toEqual([85, 70]);
        expect([d.analysis.levelVeryHigh, d.analysis.levelHigh, d.analysis.levelModerate, d.analysis.levelLow]).toEqual([75, 55, 35, 15]);
        expect([d.competences.acquiredFrom, d.competences.inProgressFrom]).toEqual([14, 10]);
        expect(d.services).toEqual({ liaisonSignatureDays: 14, parentLinkCodeDays: 14, canteenTicketDays: 30, libraryLoanDays: 14 });
    });
});

describe("validation (même schéma côté écran et serveur)", () => {
    const issueFor = (mutate: (p: SchoolParameters) => void) => {
        const p = clone();
        mutate(p);
        const r = schoolParametersSchema.safeParse(p);
        return r.success ? null : r.error.issues[0].message;
    };

    it("refuse une valeur hors bornes", () => {
        expect(issueFor((p) => (p.followUp.attendanceWarning = 150))).not.toBeNull();
        expect(issueFor((p) => (p.services.canteenTicketDays = 0))).not.toBeNull();
    });

    it("refuse des seuils incohérents", () => {
        expect(issueFor((p) => (p.followUp.attendanceCritical = 90))).toContain("critique");
        expect(issueFor((p) => (p.performance.goodFrom = 15))).not.toBeNull();
        expect(issueFor((p) => (p.analysis.signalMediumFrom = 80))).toContain("Décrochage");
        expect(issueFor((p) => (p.followUp.climateExcellentBelow = 30))).toContain("Climat");
        expect(issueFor((p) => (p.exams.orientationWeakBelow = 13))).toContain("Orientation");
    });

    it("compétences : une valeur enregistrée doit être relue au même niveau", () => {
        // « En cours » enregistré 15 serait relu « Acquis » (≥ 14) : refusé
        expect(issueFor((p) => (p.competences.scoreInProgress = 15))).toContain("plage");
        expect(issueFor((p) => (p.competences.scoreNotAcquired = 10))).not.toBeNull();
    });

    it("les poids des analyses doivent totaliser 100 %", () => {
        expect(issueFor((p) => (p.analysis.failureWeightResults = 50))).toContain("100");
    });
});

describe("repli sur les valeurs d'origine", () => {
    it("valeur absente ou hors bornes → valeur d'origine, le reste est gardé", () => {
        const r = resolveSchoolParameters({ followUp: { attendanceWarning: 90, attendanceCritical: "x" }, services: { canteenTicketDays: 9999 } });
        expect(r.followUp.attendanceWarning).toBe(90);
        expect(r.followUp.attendanceCritical).toBe(70);
        expect(r.services.canteenTicketDays).toBe(30);
    });

    it("section devenue incohérente → toute la section revient à l'origine", () => {
        const r = resolveSchoolParameters({ followUp: { attendanceWarning: 60, attendanceCritical: 65 } });
        expect(r.followUp).toEqual(DEFAULT_SCHOOL_PARAMETERS.followUp);
    });

    it("rien d'enregistré → valeurs d'origine", () => {
        expect(resolveSchoolParameters(null)).toEqual(DEFAULT_SCHOOL_PARAMETERS);
    });
});

describe("niveau de risque officiel (calcul unique)", () => {
    const f = DEFAULT_SCHOOL_PARAMETERS.followUp;

    it("additionne moyenne, assiduité et incidents aux seuils de l'école", () => {
        const r = assessRisk(5.5, 65, 5, f, 10);
        expect(r.score).toBe(40 + 30 + 20);
        expect(r.level).toBe("CRITICAL");
        expect(r.factors).toHaveLength(3);
    });

    it("une donnée absente n'ajoute aucun point (jamais lue comme 0)", () => {
        expect(assessRisk(null, null, 0, f, 10)).toEqual({ level: "NONE", score: 0, factors: [] });
        expect(assessRisk(null, 60, 0, f, 10).score).toBe(30);
    });

    it("suit le seuil de passage de l'école", () => {
        expect(assessRisk(11, 100, 0, f, 10).level).toBe("NONE");
        expect(assessRisk(11, 100, 0, f, 12).factors[0]).toContain("< 12");
    });
});

describe("lecture des moyennes", () => {
    it("niveau de performance aux seuils et au seuil de passage", () => {
        const perf = DEFAULT_SCHOOL_PARAMETERS.performance;
        expect(performanceLevel(16, perf, 10)).toBe("EXCELLENT");
        expect(performanceLevel(10, perf, 10)).toBe("AVERAGE");
        expect(performanceLevel(10, perf, 11)).toBe("INSUFFICIENT");
        expect(performanceLevel(null, perf, 10)).toBeNull();
    });

    it("tranches et assiduité à l'écran", () => {
        const t = DEFAULT_SCHOOL_THRESHOLDS;
        expect(gradeBand(14, t)).toBe("veryGood");
        expect(gradeBand(9.99, t)).toBe("weak");
        expect(gradeBand(null, t)).toBeNull();
        expect(gradeBand(11, { ...t, passingGrade: 12 })).toBe("weak");
        expect(attendanceBand(84, t)).toBe("warning");
        expect(attendanceBand(69, t)).toBe("critical");
        expect(attendanceBand(null, t)).toBeNull();
    });
});

describe("chances d'admission à l'examen (loi normale)", () => {
    it("50 % à la moyenne d'admission, symétrique, bornée à 1–99 %", () => {
        expect(examSuccessProbability(10, 10, 2)).toBe(50);
        expect(examSuccessProbability(12, 10, 2)).toBe(84);
        expect(examSuccessProbability(8, 10, 2)).toBe(16);
        expect(examSuccessProbability(20, 10, 2)).toBe(99);
        expect(examSuccessProbability(0, 10, 2)).toBe(1);
    });

    it("plus l'écart habituel est grand, plus l'estimation est prudente", () => {
        expect(examSuccessProbability(12, 10, 4)).toBeLessThan(examSuccessProbability(12, 10, 1));
    });
});
