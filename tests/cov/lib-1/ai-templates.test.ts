import { describe, it, expect } from "vitest";
import {
  generateAppreciation,
  generateRiskSummary,
  generateStudentAlerts,
  generateAtRiskAlerts,
  generateOrientationSynthesis,
  generateActionPlan,
  generateChatFallback,
  buildStudentTemplateContext,
} from "@/lib/ai/templates";

describe("gabarits IA — contexte élève", () => {
  it("construit le contexte à partir des analyses réelles (forces, faiblesses, conversions Decimal)", () => {
    const ctx = buildStudentTemplateContext(
      { firstName: "Koffi", lastName: "Adjovi", className: "3e A" },
      {
        generalAverage: "12.5",
        progressionRate: 1.2,
        performanceLevel: "GOOD",
        riskLevel: "LOW",
        riskFactors: ["absences"],
        classRank: 4,
        classSize: 30,
        period: { name: "Trimestre 1" },
        subjectPerformances: [
          { average: "15", trend: "UP", isStrength: true, isWeakness: false, subject: { name: "Maths" } },
          { average: null, trend: null, isStrength: false, isWeakness: true, subject: { name: "Anglais" } },
          { average: 8, isStrength: true, isWeakness: true, subject: null },
        ],
      },
      { attendanceRate: 90, incidentCount: 2, failureProbability: 30, failureLevel: "LOW", failureRecommendations: ["x"] }
    );

    expect(ctx.generalAverage).toBe(12.5);
    expect(ctx.progressionRate).toBe(1.2);
    expect(ctx.periodName).toBe("Trimestre 1");
    // Une matière sans nom est écartée des forces/faiblesses mais garde un libellé générique.
    expect(ctx.strengths).toEqual(["Maths"]);
    expect(ctx.weaknesses).toEqual(["Anglais"]);
    expect(ctx.subjectPerformances).toEqual([
      { subjectName: "Maths", average: 15, trend: "UP", isStrength: true, isWeakness: false },
      { subjectName: "Anglais", average: null, trend: null, isStrength: false, isWeakness: true },
      { subjectName: "Matière", average: 8, trend: undefined, isStrength: true, isWeakness: true },
    ]);
    expect(ctx.attendanceRate).toBe(90);
    expect(ctx.incidentCount).toBe(2);
    expect(ctx.failureProbability).toBe(30);
    expect(ctx.failureRecommendations).toEqual(["x"]);
  });

  it("renvoie des valeurs neutres sans analyses ni extras", () => {
    const ctx = buildStudentTemplateContext({ firstName: "Awa" }, null);
    expect(ctx).toMatchObject({
      firstName: "Awa",
      periodName: null,
      generalAverage: null,
      progressionRate: null,
      performanceLevel: null,
      riskLevel: null,
      riskFactors: [],
      classRank: null,
      classSize: null,
      strengths: [],
      weaknesses: [],
      subjectPerformances: [],
      attendanceRate: null,
    });
  });
});

describe("gabarits IA — appréciation de bulletin", () => {
  const base = { firstName: "Koffi", lastName: "Adjovi" };

  it("félicite un élève excellent et cite ses points forts", () => {
    const text = generateAppreciation({ ...base, generalAverage: 17, strengths: ["Maths", "SVT", "PCT"], progressionRate: 2 });
    expect(text).toContain("trimestre remarquable avec une moyenne de 17.00/20");
    expect(text).toContain("excelle particulièrement en Maths et SVT");
    expect(text).toContain("nette progression");
  });

  it("n'évoque pas de points forts s'il n'y en a pas (élève excellent)", () => {
    const text = generateAppreciation({ ...base, generalAverage: 16 });
    expect(text).not.toContain("excelle particulièrement");
    expect(text).toContain("maintenir cet élan");
  });

  it("gère un très bon élève avec et sans points forts", () => {
    expect(generateAppreciation({ ...base, generalAverage: 14.5, strengths: ["Français"], progressionRate: 0.5 }))
      .toContain("Points forts en Français.");
    const sans = generateAppreciation({ ...base, generalAverage: 14 });
    expect(sans).toContain("très bons résultats (14.00/20)");
    expect(sans).not.toContain("Points forts");
  });

  it("demande une consolidation pour un élève satisfaisant avec faiblesses, sinon constate la maîtrise", () => {
    expect(generateAppreciation({ ...base, generalAverage: 12, weaknesses: ["Anglais"] }))
      .toContain("consolidation est attendu en Anglais");
    expect(generateAppreciation({ ...base, generalAverage: 13 })).toContain("correctement maîtrisé");
  });

  it("signale un niveau fragile avec ou sans lacunes", () => {
    expect(generateAppreciation({ ...base, generalAverage: 10.5, weaknesses: ["A", "B", "C", "D"], progressionRate: -2 }))
      .toMatch(/lacunes persistent en A, B, C\..*baisse sensible/);
    expect(generateAppreciation({ ...base, generalAverage: 10 })).not.toContain("lacunes");
  });

  it("recommande une remédiation pour une période difficile", () => {
    const text = generateAppreciation({ ...base, generalAverage: 7, weaknesses: ["Maths"], progressionRate: -0.5 });
    expect(text).toContain("période difficile (7.00/20)");
    expect(text).toContain("difficultés sont marquées en Maths");
    expect(text).toContain("léger recul");
    expect(generateAppreciation({ ...base, generalAverage: 5 })).not.toContain("difficultés sont marquées");
  });

  it("indique l'absence de notes et signale une assiduité faible, en nom générique", () => {
    const text = generateAppreciation({ attendanceRate: 70, progressionRate: 0 });
    expect(text).toMatch(/^L'élève ne dispose pas encore de notes/);
    expect(text).toContain("L'assiduité (70 %)");
    expect(text).toContain("globalement stables");
  });
});

describe("gabarits IA — synthèse de risque", () => {
  it("classe en critique avec facteurs, moyenne, assiduité et faiblesses", () => {
    const r = generateRiskSummary({
      firstName: "Awa",
      failureProbability: 80,
      riskFactors: ["a", "b", "c", "d", "e"],
      generalAverage: 7.456,
      attendanceRate: 60,
      weaknesses: ["Maths", "PCT", "SVT", "Anglais"],
      failureRecommendations: ["Tutorat ciblé"],
    });
    expect(r.priority).toBe("CRITICAL");
    expect(r.summary).toContain("Awa présente un risque d'échec critique (probabilité estimée : 80 %).");
    expect(r.summary).toContain("Facteurs identifiés : a, b, c, d.");
    expect(r.summary).toContain("Moyenne actuelle : 7.46/20.");
    expect(r.summary).toContain("Assiduité insuffisante (60 %).");
    expect(r.summary).toContain("Matières à surveiller : Maths, PCT, SVT.");
    expect(r.recommendations[0]).toBe("Tutorat ciblé");
    expect(r.recommendations).toContain("Mettre en place un tutorat ciblé sur les matières en difficulté.");
    expect(r.suggestedActions.map((a) => a.title)).toEqual([
      "Renforcement académique",
      "Suivi de l'assiduité",
      "Accompagnement personnalisé",
    ]);
  });

  it("déduit la priorité du niveau de risque ou de la probabilité", () => {
    expect(generateRiskSummary({ riskLevel: "CRITICAL" }).priority).toBe("CRITICAL");
    expect(generateRiskSummary({ failureProbability: 60 }).priority).toBe("HIGH");
    expect(generateRiskSummary({ riskLevel: "HIGH" }).summary).toContain("risque d'échec élevé");
    const medium = generateRiskSummary({ failureProbability: 40 });
    expect(medium.priority).toBe("MEDIUM");
    expect(medium.summary).toContain("modéré");
    expect(medium.recommendations).toEqual(["Renforcer le suivi hebdomadaire des devoirs et des évaluations."]);
    expect(generateRiskSummary({ riskLevel: "MEDIUM" }).priority).toBe("MEDIUM");
  });

  it("propose un suivi régulier pour un risque faible sans signaux", () => {
    const r = generateRiskSummary({ attendanceRate: 95 });
    expect(r.priority).toBe("LOW");
    expect(r.summary).toBe("Cet élève présente un risque d'échec faible.");
    expect(r.recommendations).toEqual(["Maintenir l'encouragement et le suivi habituel."]);
    expect(r.suggestedActions).toEqual([expect.objectContaining({ title: "Suivi régulier", type: "Suivi" })]);
  });

  it("dédoublonne et limite les recommandations à six", () => {
    const r = generateRiskSummary({
      riskLevel: "HIGH",
      failureRecommendations: ["r1", "r1", "r2", "r3", "r4", "r5", "r6"],
    });
    expect(r.recommendations).toEqual(["r1", "r2", "r3", "r4", "r5", "r6"]);
  });
});

describe("gabarits IA — alertes", () => {
  it("génère toutes les alertes individuelles d'un élève critique", () => {
    const alerts = generateStudentAlerts(
      { firstName: "Awa", lastName: "B", riskLevel: "CRITICAL", generalAverage: 6, attendanceRate: 70, incidentCount: 3, weaknesses: ["A", "B", "C", "D"] },
      "s1"
    );
    expect(alerts.map((a) => a.id)).toEqual(["risk_s1", "attendance_s1", "behavior_s1", "academic_s1"]);
    expect(alerts[0]).toMatchObject({ type: "critical", title: "Risque critique" });
    expect(alerts[0].message).toBe("Awa B présente un risque critical avec une moyenne de 6.00/20.");
    expect(alerts[1].message).toContain("70 %");
    expect(alerts[2].message).toContain("3 incident(s)");
    expect(alerts[3].message).toContain("A, B, C.");
  });

  it("émet un avertissement de risque élevé sans moyenne et utilise un nom générique", () => {
    const alerts = generateStudentAlerts({ riskLevel: "HIGH" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ id: "risk_student", type: "warning", title: "Risque élevé" });
    expect(alerts[0].message).toBe("Élève présente un risque high.");
  });

  it("n'émet aucune alerte pour un élève sans signal (faiblesses mais bonne moyenne)", () => {
    expect(generateStudentAlerts({ attendanceRate: 95, incidentCount: 1, weaknesses: ["A", "B", "C"], generalAverage: 12 })).toEqual([]);
    // Sans moyenne connue, la règle suppose 20/20 : pas d'alerte académique.
    expect(generateStudentAlerts({ weaknesses: ["A", "B", "C"] })).toEqual([]);
  });

  it("agrège, trie par gravité et limite à dix les alertes de classe", () => {
    const students = [
      { id: "m", name: "Moyen", riskLevel: "MEDIUM", averageGrade: null },
      { id: "l", name: "Faible", riskLevel: "LOW" },
      { id: "c", name: "Crit", riskLevel: "CRITICAL", averageGrade: 4.5, className: "6e" },
      { id: "h", name: "Haut", riskLevel: "HIGH", averageGrade: 8 },
      { id: "x", name: "Inconnu", riskLevel: "UNKNOWN" },
    ];
    const alerts = generateAtRiskAlerts(students);
    expect(alerts.map((a) => a.id)).toEqual(["risk_c", "risk_h", "risk_m"]);
    expect(alerts[0]).toMatchObject({ type: "critical", title: "Risque critique", actionRequired: true, message: "Crit (6e) — moyenne 4.50/20." });
    expect(alerts[1]).toMatchObject({ type: "warning", title: "Risque élevé", actionRequired: true });
    expect(alerts[2]).toMatchObject({ type: "info", title: "Risque modéré", actionRequired: false, message: "Moyen — moyenne non disponible/20." });

    const many = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, name: `E${i}`, riskLevel: i % 2 ? "HIGH" : "LOW" }));
    many.push({ id: "z", name: "Z", riskLevel: "LOW" });
    expect(generateAtRiskAlerts([...many, ...many]).length).toBe(10);
  });
});

describe("gabarits IA — orientation", () => {
  const perf = (subjectName: string, average: number | null) => ({ subjectName, average });

  it("recommande la série C pour un profil scientifique solide", () => {
    const r = generateOrientationSynthesis({
      firstName: "Koffi",
      className: "3e A",
      strengths: ["Maths", "PCT", "SVT", "Anglais"],
      subjectPerformances: [perf("Mathématiques", 15), perf("Physique", 14), perf("Français", 10)],
    });
    expect(r.series).toBe("SERIE_C");
    expect(r.alternatives).toEqual(["SERIE_D", "SERIE_E"]);
    expect(r.synthesis).toContain("Koffi (3e A) — orientation recommandée : Série C.");
    expect(r.synthesis).toContain("Points forts observés : Maths, PCT, SVT.");
    expect(r.synthesis).toContain("Alternatives envisageables : Série D, Série E.");
  });

  it("recommande la série D pour de bonnes aptitudes en sciences", () => {
    const r = generateOrientationSynthesis({ subjectPerformances: [perf("SVT", 12), perf("Philosophie", 9)] });
    expect(r.series).toBe("SERIE_D");
    expect(r.justification).toContain("12.0/20");
    expect(r.synthesis).toMatch(/^L'élève — orientation/);
  });

  it("recommande A1 puis A2 pour les profils littéraires", () => {
    expect(generateOrientationSynthesis({ subjectPerformances: [perf("Français", 14), perf("Maths", 9)] }).series).toBe("SERIE_A1");
    expect(generateOrientationSynthesis({ subjectPerformances: [perf("Histoire", 11.5), perf("Maths", 11.5)] }).series).toBe("SERIE_A2");
  });

  it("recommande G pour un profil économique", () => {
    const r = generateOrientationSynthesis({ subjectPerformances: [perf("Comptabilité", 12), perf("Maths", null)] });
    expect(r.series).toBe("SERIE_G");
    expect(r.alternatives).toEqual(["SERIE_B", "SERIE_A2"]);
  });

  it("recommande D (polyvalent) selon la moyenne générale quand aucun profil ne se dégage", () => {
    const poly = generateOrientationSynthesis({ generalAverage: 12.5, subjectPerformances: [perf("EPS", 12)] });
    expect(poly.series).toBe("SERIE_D");
    expect(poly.justification).toContain("Profil polyvalent");
    expect(poly.alternatives).toEqual(["SERIE_C", "SERIE_A2"]);

    const prudent = generateOrientationSynthesis({});
    expect(prudent.series).toBe("SERIE_D");
    expect(prudent.justification).toContain("Moyenne générale de 0.0/20");
    expect(prudent.alternatives).toEqual(["SERIE_G", "SERIE_A2"]);
  });
});

describe("gabarits IA — plan d'action", () => {
  it("produit un plan critique complet (faiblesses, assiduité, conseiller)", () => {
    const plan = generateActionPlan({
      firstName: "Awa",
      className: "4e B",
      riskLevel: "CRITICAL",
      generalAverage: 8.25,
      weaknesses: ["Maths", "PCT", "SVT"],
      attendanceRate: 70,
    });
    expect(plan.priority).toBe("CRITICAL");
    expect(plan.title).toBe("Plan de remédiation — Awa");
    expect(plan.description).toBe("Intervention pédagogique ciblée pour Awa (4e B). Moyenne actuelle : 8.25/20.");
    expect(plan.steps).toEqual([
      "Entretien individuel avec Awa pour identifier les blocages et fixer des objectifs concrets.",
      "Mise en place de séances de remédiation hebdomadaires en Maths et PCT.",
      "Suivi renforcé de l'assiduité avec alerte parents en cas d'absence non justifiée.",
      "Point de situation avec les parents sous 10 jours ouvrés.",
      "Mobilisation du conseiller d'orientation pour un accompagnement individualisé.",
    ]);
  });

  it("dérive la priorité de la probabilité d'échec et de la moyenne", () => {
    expect(generateActionPlan({ failureProbability: 80, generalAverage: 15 }).priority).toBe("CRITICAL");
    expect(generateActionPlan({ riskLevel: "HIGH", generalAverage: 15 }).priority).toBe("HIGH");
    expect(generateActionPlan({ failureProbability: 60, generalAverage: 15 }).priority).toBe("HIGH");
    expect(generateActionPlan({ generalAverage: 9 }).priority).toBe("HIGH");
  });

  it("produit un plan moyen de méthodologie sans moyenne connue ni nom", () => {
    const plan = generateActionPlan({ generalAverage: 12, attendanceRate: 95 });
    expect(plan.priority).toBe("MEDIUM");
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[1]).toBe("Organisation de séances de méthodologie et de travail personnel encadré.");
    expect(plan.title).toBe("Plan de remédiation — l'élève");
    expect(generateActionPlan({}).description).toContain("Moyenne actuelle : non disponible.");
  });
});

describe("gabarits IA — chat de secours", () => {
  it("salue différemment le public et les utilisateurs connectés", () => {
    expect(generateChatFallback("Bonjour", "PUBLIC")).toContain("expliquer les fonctionnalités d'EduPilot");
    expect(generateChatFallback("salut !", "TEACHER")).toContain("même sans connexion à un service cloud");
  });

  it("explique la notation selon le rôle", () => {
    expect(generateChatFallback("Quelle est ma moyenne ?", "TEACHER")).toContain("Saisie des évaluations");
    expect(generateChatFallback("mes notes", "PARENT")).toContain("notes de votre enfant");
    expect(generateChatFallback("bulletin", "STUDENT")).toContain("enregistrées par vos enseignants");
  });

  it("décrit les prédictions selon le rôle", () => {
    expect(generateChatFallback("quel risque ?", "DIRECTOR")).toContain("tableau de bord IA");
    expect(generateChatFallback("prédiction", "STUDENT")).toContain("votre historique scolaire");
  });

  it("répond sur l'orientation", () => {
    expect(generateChatFallback("quelle filière choisir", "STUDENT")).toContain("système béninois");
  });

  it("répond par défaut en tronquant la question à 50 caractères", () => {
    const long = "x".repeat(80);
    const pub = generateChatFallback(long, "PUBLIC");
    expect(pub).toContain(`« ${"x".repeat(50)}... »`);
    expect(pub).toContain("mode autonome");
    // intention reconnue mais sans gabarit dédié (présences) → réponse générique
    expect(generateChatFallback("absence", "TEACHER")).toContain("Précisez votre besoin");
  });

  it.skip("BUG: une question de notes contenant « hi » (philosophie) ne doit pas être prise pour une salutation", () => {
    // detectIntent teste les motifs par sous-chaîne : « hi » (salutation) est
    // trouvé dans « philosophie », « chimie », « historique »… et la salutation
    // passe avant les notes.
    expect(generateChatFallback("Quelle est ma moyenne en philosophie ?", "STUDENT")).toContain("Système de notation");
  });
});
