/**
 * Réponses de l'assistant : chacune lit les données réelles, dans le
 * périmètre de la personne, et réutilise les calculs officiels de l'application
 * (gouvernance IA, prévision calibrée, finance famille, recouvrement).
 * Aucune valeur n'est inventée : sans donnée, la réponse le dit et indique quoi saisir.
 */
import prisma from "@/lib/prisma";
import { getPassingGrade } from "@/lib/academic/grading-settings";
import { governanceService } from "@/lib/ai/governance-service";
import { AIServiceError, type GovernanceRequest } from "@/lib/ai/ai-service";
import { computeYearFeeRecovery } from "@/lib/finance/expected-fees";
import { seriesFullLabel } from "@/lib/benin/series";
import type { RecommendedSeries } from "@prisma/client";
import { getChildFinance } from "@/lib/finance/family-finance";
import { SERVICE_CATALOG } from "@/lib/navigation/service-catalog";
import { navForRole } from "@/components/edu-shell/role-nav";
import { hasPermission, roleSatisfies, type Permission } from "@/lib/rbac/permissions";
import type { UserRole } from "@prisma/client";
import { localDay } from "./entities";
import * as f from "./format";
import { deFr, humanize, joinFr, judgeAverage, sentence, voiceFor } from "./phrasing";
import type { AssistantScope } from "./scope";
import { contentWords, similar, stem } from "./text";
import type { AnswerBlock, AssistantContext, Entities, NamedRef, StudentRef, TimeRange, Tone } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SkillInput {
    scope: AssistantScope;
    entities: Entities;
    message: string;
    student?: StudentRef;
    klass?: NamedRef;
    now: Date;
}

export interface SkillOutput {
    text: string;
    blocks?: AnswerBlock[];
    links?: Array<{ label: string; href: string }>;
    suggestions?: string[];
    context?: AssistantContext;
    sources: string[];
}

type GovernanceOk<T> = { ok: true; data: T; recommendations: string[] };
type GovernanceKo = { ok: false; message: string };

async function governance<T>(
    scope: AssistantScope,
    action: string,
    target: { studentId?: string; classId?: string },
): Promise<GovernanceOk<T> | GovernanceKo> {
    const request: GovernanceRequest = {
        action,
        userId: scope.user.id,
        userRole: scope.user.role,
        schoolId: scope.schoolId,
        studentId: target.studentId ?? null,
        classId: target.classId ?? null,
        data: { schoolId: scope.schoolId },
    };
    try {
        const response = await governanceService.execute(request, Date.now());
        return { ok: true, data: response.data as T, recommendations: response.recommendations ?? [] };
    } catch (error) {
        if (error instanceof AIServiceError) return { ok: false, message: error.message };
        throw error;
    }
}

const studentHref = (scope: AssistantScope, id: string) => (scope.kind === "family" ? undefined : `/dashboard/students/${id}`);
const classHref = (scope: AssistantScope, id: string) => (scope.kind === "family" ? undefined : `/dashboard/classes/${id}`);
const refused = (message: string): SkillOutput => ({ text: message, sources: [] });

/** « de **Koffi** », « d'**Aicha** » : élision devant un nom mis en gras. */
const deBold = (name: string) => (deFr(name).startsWith("d'") ? `d'**${name}**` : `de **${name}**`);

/** L'élève parle de lui-même : on lui répond à la deuxième personne. */
const isSelf = (scope: AssistantScope) => scope.user.role === "STUDENT";

function studentFollowUps(scope: AssistantScope, student: StudentRef, exclude: string): string[] {
    if (isSelf(scope)) {
        const mine = [
            { key: "overview", text: "Mon analyse" },
            { key: "forecast", text: "Ma prévision" },
            { key: "plan", text: "Mon plan d'action" },
            { key: "attendance", text: "Mes absences ce mois" },
        ];
        return mine.filter((item) => item.key !== exclude).slice(0, 3).map((item) => item.text);
    }
    // Nom complet : un prénom seul redemanderait « lequel ? » dès qu'il y a des homonymes
    const name = student.name;
    const all = [
        { key: "overview", text: `Analyse ${deFr(name)}` },
        { key: "forecast", text: `Prévision ${deFr(name)}` },
        { key: "plan", text: `Plan d'action pour ${name}` },
        { key: "attendance", text: `Absences ${deFr(name)} ce mois` },
        ...(scope.kind === "family" ? [] : [{ key: "comment", text: `Appréciation de bulletin pour ${name}` }]),
    ];
    return all.filter((item) => item.key !== exclude).slice(0, 3).map((item) => item.text);
}

// ---------------------------------------------------------------------------
// Élèves à risque
// ---------------------------------------------------------------------------

interface AtRiskRow {
    id: string;
    name: string;
    className: string | null;
    riskLevel: string;
    averageGrade: number | null;
}

interface AtRiskData {
    status: string;
    totalStudents: number;
    atRiskCount: number;
    highRiskCount: number;
    atRiskStudents: AtRiskRow[];
}

const RISK_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Élèves dont la DERNIÈRE moyenne de l'année en cours est sous le seuil de
 * réussite, dans le périmètre. Le modèle de risque peut classer « faible »
 * un élève à 9/20 (assiduité et comportement bons) : sans ce chiffre,
 * « aucun élève à risque » contredirait l'accueil (« x % en échec »).
 */
async function belowPassingCount(scope: AssistantScope, classId: string | undefined, passing: number): Promise<number> {
    const classIds = classId ? [classId] : scope.kind === "direction" ? null : scope.classes.map((c) => c.id);
    const rows = await prisma.studentAnalytics.findMany({
        where: {
            academicYear: { schoolId: scope.schoolId, isCurrent: true },
            student: {
                schoolId: scope.schoolId,
                enrollments: { some: { status: "ACTIVE", ...(classIds ? { classId: { in: classIds } } : {}) } },
            },
        },
        select: { studentId: true, generalAverage: true, period: { select: { startDate: true } } },
    });
    const latest = new Map<string, { at: number; average: number | null }>();
    for (const row of rows) {
        const at = new Date(row.period.startDate).getTime();
        const current = latest.get(row.studentId);
        if (!current || at > current.at) latest.set(row.studentId, { at, average: row.generalAverage === null ? null : Number(row.generalAverage) });
    }
    let count = 0;
    for (const { average } of latest.values()) if (average !== null && average < passing) count += 1;
    return count;
}

export async function riskList(input: SkillInput): Promise<SkillOutput> {
    const { scope, klass, message } = input;
    const voice = voiceFor(scope, message);
    const targets: Array<{ classId?: string }> = klass
        ? [{ classId: klass.id }]
        : scope.kind === "direction"
          ? [{}]
          : scope.classes.slice(0, 40).map((item) => ({ classId: item.id }));
    if (targets.length === 0) return refused("Aucune classe ne vous est rattachée pour le moment.");

    const results = await Promise.all(targets.map((target) => governance<AtRiskData>(scope, "detect-at-risk", target)));
    const failure = results.find((result): result is GovernanceKo => !result.ok);
    const successes = results.filter((result): result is GovernanceOk<AtRiskData> => result.ok);
    if (successes.length === 0 && failure) return refused(failure.message);

    const byId = new Map<string, AtRiskRow>();
    let analysed = 0;
    for (const result of successes) {
        analysed += result.data.totalStudents;
        for (const row of result.data.atRiskStudents) if (!byId.has(row.id)) byId.set(row.id, row);
    }
    const rows = Array.from(byId.values()).sort(
        (a, b) => (RISK_ORDER[b.riskLevel] ?? 0) - (RISK_ORDER[a.riskLevel] ?? 0) || (a.averageGrade ?? 99) - (b.averageGrade ?? 99),
    );
    const where = klass ? `en ${klass.name}` : scope.kind === "direction" ? "dans l'établissement" : "dans vos classes";
    const context: AssistantContext = { intent: "risk.list", classId: klass?.id };

    if (analysed === 0) {
        return {
            text: `Aucune analyse n'est encore disponible ${where} : les moyennes de période n'ont pas été calculées. Saisissez des notes, puis lancez le calcul des moyennes ; l'assistant pourra alors repérer les élèves à suivre.`,
            links: [{ label: "Notes & bulletins", href: "/dashboard/grades" }],
            sources: ["analyses de période"],
            context,
        };
    }

    const passing = await getPassingGrade(scope.schoolId);
    const below = await belowPassingCount(scope, klass?.id, passing);
    const high = rows.filter((row) => row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL").length;
    const analysedLabel = f.count(analysed, "élève analysé", "élèves analysés");
    const text =
        rows.length === 0
            ? below > 0
                ? `Le modèle ne signale aucun élève à risque modéré ou élevé ${where} (${analysedLabel}).`
                : voice.pick([
                      `Bonne nouvelle : aucun élève à risque modéré ou élevé ${where} (${analysedLabel}).`,
                      `Rien à signaler ${where} : aucun élève à risque modéré ou élevé sur ${analysedLabel}.`,
                  ])
            : voice.pick([
                  `**${f.count(rows.length, "élève à suivre", "élèves à suivre")}** ${where}, dont **${high}** à risque élevé ou critique, sur ${analysedLabel}.`,
                  `Sur ${analysedLabel} ${where}, **${rows.length}** ${rows.length > 1 ? "demandent" : "demande"} un suivi, dont **${high}** en priorité (risque élevé ou critique).`,
                  `J'ai repéré **${f.count(rows.length, "élève à suivre", "élèves à suivre")}** ${where} (sur ${analysedLabel}) ; **${high}** ${high > 1 ? "sont" : "est"} à traiter en priorité.`,
              ]) + (high > 0 ? ` ${voice.pick(["Je les ai classés du plus urgent au moins urgent.", "Le tableau commence par les plus urgents."], 1)}` : "");
    const belowNote =
        below > rows.length
            ? `\n${rows.length === 0 ? "En revanche" : "Par ailleurs"}, **${f.count(below, "élève a", "élèves ont")}** une moyenne sous ${f.grade(passing)} : le modèle ${below - rows.length > 1 ? "les classe" : "le classe"} à risque faible (assiduité et comportement corrects), mais ${below > 1 ? "ils restent" : "il reste"} à accompagner sur les résultats.`
            : "";

    const first = rows[0];
    return {
        text: text + belowNote,
        blocks: rows.length
            ? [
                  {
                      type: "table",
                      title: "Par ordre de priorité",
                      columns: ["Élève", "Classe", "Risque", "Moyenne"],
                      rows: rows.slice(0, 15).map((row) => ({
                          cells: [row.name, row.className ?? "—", f.RISK_LABELS[row.riskLevel] ?? row.riskLevel, f.grade(row.averageGrade)],
                          href: studentHref(scope, row.id),
                          tone: row.averageGrade !== null && row.averageGrade < passing ? "danger" : f.riskTone(row.riskLevel),
                      })),
                  },
              ]
            : [],
        suggestions: first
            ? [`Plan d'action pour ${first.name}`, `Analyse de ${first.name}`, "Absences de cette semaine"]
            : ["Absences de cette semaine", "Que sais-tu faire ?"],
        links: [{ label: "Analyses détaillées", href: "/dashboard/analytics" }],
        sources: ["analyses de période", "niveaux de risque"],
        context,
    };
}

// ---------------------------------------------------------------------------
// Un élève
// ---------------------------------------------------------------------------

interface StudentAnalysis {
    status: string;
    student: { name: string; class: { name: string } | null };
    analyticsPeriod: { periodName: string } | null;
    metrics: {
        averageGrade: number | null;
        classRank: number | null;
        classSize: number | null;
        attendanceRate: number | null;
        riskLevel: string | null;
        incidentCount: number;
        progressionRate: number | null;
    };
    strengths: string[];
    weaknesses: string[];
    prediction: { probability: number; level: string } | null;
}

export async function studentOverview(input: SkillInput): Promise<SkillOutput> {
    const { scope, student, message } = input;
    if (!student) return refused("Précisez l'élève.");
    const voice = voiceFor(scope, message);
    const result = await governance<StudentAnalysis>(scope, "analyze-student", { studentId: student.id });
    if (!result.ok) return refused(result.message);
    const data = result.data;
    const passing = await getPassingGrade(scope.schoolId);
    const m = data.metrics;
    const context: AssistantContext = { intent: "student.overview", studentId: student.id };

    if (data.status === "insufficient_data") {
        return {
            text: `Pas encore d'analyse pour **${student.name}** : aucune moyenne de période n'a été calculée.${m.attendanceRate !== null ? ` Son assiduité récente est de ${f.percent(m.attendanceRate)}.` : ""}`,
            suggestions: [`Dernières notes de ${f.firstName(student.name)}`, `Absences de ${f.firstName(student.name)} ce mois`],
            sources: ["appel", "notes"],
            context,
        };
    }

    const period = data.analyticsPeriod ? data.analyticsPeriod.periodName : null;
    const lines = [
        isSelf(scope) ? `Voici où vous en êtes${period ? ` (${period})` : ""}.` : voice.by(
            [
                `Voici comment va **${f.firstName(data.student.name)}**${period ? ` (${period})` : ""}.`,
                `Voici les dernières nouvelles de **${f.firstName(data.student.name)}**${period ? `, ${period}` : ""}.`,
            ],
            [
                `**${data.student.name}**${data.student.class ? ` (${data.student.class.name})` : ""}${period ? ` — ${period}` : ""}.`,
                `Analyse de **${data.student.name}**${data.student.class ? `, ${data.student.class.name}` : ""}${period ? ` (${period})` : ""}.`,
            ],
        ),
    ];
    if (m.averageGrade !== null) {
        lines.push(`${isSelf(scope) ? "Votre moyenne est de" : voice.pick(["Moyenne de", "Sa moyenne est de"], 2)} **${f.grade(m.averageGrade)}** (seuil de réussite : ${f.grade(passing)}) : ${judgeAverage(voice, m.averageGrade, passing)}.`);
    }
    if (m.progressionRate !== null && Math.abs(m.progressionRate) >= 1) {
        lines.push(
            m.progressionRate > 0
                ? `En progrès de ${f.percent(m.progressionRate)} sur la période précédente.`
                : `En recul de ${f.percent(-m.progressionRate)} sur la période précédente.`,
        );
    }
    if (data.prediction) lines.push(`Probabilité d'échec estimée : **${f.percent(data.prediction.probability)}**.`);

    const blocks: AnswerBlock[] = [
        {
            type: "metrics",
            items: [
                { label: "Moyenne", value: f.grade(m.averageGrade), tone: f.gradeTone(m.averageGrade, passing) },
                { label: "Rang", value: m.classRank && m.classSize ? `${m.classRank}/${m.classSize}` : "—" },
                { label: "Assiduité", value: f.percent(m.attendanceRate), tone: m.attendanceRate !== null && m.attendanceRate < 90 ? "warning" : "neutral" },
                { label: "Risque", value: m.riskLevel ? f.RISK_LABELS[m.riskLevel] ?? m.riskLevel : "—", tone: f.riskTone(m.riskLevel) },
                { label: "Incidents", value: String(m.incidentCount), tone: m.incidentCount > 0 ? "warning" : "neutral" },
            ],
        },
    ];
    if (data.strengths.length || data.weaknesses.length) {
        blocks.push({
            type: "list",
            title: "Points forts et points faibles",
            items: [
                ...data.strengths.map((name) => ({ label: name, detail: "Point fort", tone: "success" as Tone })),
                ...data.weaknesses.map((name) => ({ label: name, detail: "À renforcer", tone: "danger" as Tone })),
            ],
        });
    }
    if (result.recommendations.length) {
        blocks.push({ type: "list", title: "Recommandations", items: result.recommendations.map((label) => ({ label })) });
    }

    const href = studentHref(scope, student.id);
    return {
        text: lines.join("\n"),
        blocks,
        links: href ? [{ label: "Fiche de l'élève", href }] : [{ label: "Notes & bulletins", href: "/dashboard/grades" }],
        suggestions: studentFollowUps(scope, student, "overview"),
        sources: ["analyses de période", "appel", "discipline", "modèle de risque"],
        context,
    };
}

interface GradePrediction {
    status: string;
    generalAveragePrediction: {
        predicted: number | null;
        confidence: number;
        range: { min: number; max: number } | null;
        warning: string | null;
    } | null;
    subjectPredictions: Array<{
        subjectName: string;
        latestAverage: number;
        projectedAverage: number;
        trend: "up" | "down" | "stable";
    }>;
}

export async function studentForecast(input: SkillInput): Promise<SkillOutput> {
    const { scope, student, entities, message } = input;
    if (!student) return refused("Précisez l'élève.");
    const voice = voiceFor(scope, message);
    const result = await governance<GradePrediction>(scope, "predict-grades", { studentId: student.id });
    if (!result.ok) return refused(result.message);
    const data = result.data;
    const context: AssistantContext = { intent: "student.forecast", studentId: student.id };
    const general = data.generalAveragePrediction;
    const predicted = general?.predicted ?? null;

    if (data.status === "insufficient_data" || (predicted === null && data.subjectPredictions.length === 0)) {
        return {
            text: `Impossible de prévoir la moyenne de **${student.name}** : aucune moyenne de période n'existe encore. La prévision demande au moins une période close.`,
            suggestions: studentFollowUps(scope, student, "forecast"),
            sources: ["historique des moyennes"],
            context,
        };
    }

    const passing = await getPassingGrade(scope.schoolId);
    const subjects = entities.subject
        ? data.subjectPredictions.filter((row) => row.subjectName === entities.subject?.name)
        : data.subjectPredictions;
    const lines: string[] = [];
    if (predicted !== null) {
        const range = general?.range
            ? voice.pick(
                  [
                      ` très probablement entre ${f.grade(general.range.min)} et ${f.grade(general.range.max)}`,
                      ` vraisemblablement entre ${f.grade(general.range.min)} et ${f.grade(general.range.max)}`,
                      ` dans une fourchette de ${f.grade(general.range.min)} à ${f.grade(general.range.max)}`,
                  ],
                  1,
              )
            : "";
        lines.push(
            (isSelf(scope) ? `Ma prévision pour vous : **${f.grade(predicted)}** à la prochaine période,${range}.` : voice.pick([
                `Moyenne attendue pour **${student.name}** à la prochaine période : **${f.grade(predicted)}**,${range}.`,
                `Si la tendance se maintient, **${f.firstName(student.name)}** devrait obtenir environ **${f.grade(predicted)}** à la prochaine période,${range}.`,
                `Ma prévision pour **${f.firstName(student.name)}** : **${f.grade(predicted)}** à la prochaine période,${range}.`,
            ])).replace(",.", "."),
        );
        lines.push(`${f.percent(general?.confidence)} de chances que la vraie moyenne soit à un point près.`);
        if (voice.register === "family") {
            lines.push(
                predicted >= passing
                    ? "C'est une estimation, pas une certitude : le travail des prochaines semaines compte toujours."
                    : "C'est une estimation, pas une fatalité : un accompagnement maintenant peut faire mentir cette prévision.",
            );
        }
    }
    if (general?.warning) lines.push(general.warning);
    const below = subjects.filter((row) => row.projectedAverage < passing).map((row) => row.subjectName);
    if (below.length) {
        const shown = below.slice(0, 4);
        const rest = below.length - shown.length;
        lines.push(`Matières projetées sous ${f.grade(passing)} : **${shown.join(", ")}**${rest > 0 ? ` et ${f.count(rest, "autre")} (détail ci-dessous)` : ""}.`);
    }
    lines.push("Méthode : lissage des moyennes passées, fourchette calibrée sur l'historique de l'élève.");

    const trendLabel = { up: "↗ hausse", down: "↘ baisse", stable: "→ stable" } as const;
    const blocks: AnswerBlock[] = [];
    if (predicted !== null) {
        blocks.push({
            type: "metrics",
            items: [
                { label: "Moyenne prévue", value: f.grade(predicted), tone: f.gradeTone(predicted, passing) },
                { label: "Fourchette 95 %", value: general?.range ? `${f.grade(general.range.min)} – ${f.grade(general.range.max)}` : "—" },
                { label: "À ±1 point", value: f.percent(general?.confidence) },
            ],
        });
    }
    if (subjects.length) {
        blocks.push({
            type: "table",
            title: entities.subject ? entities.subject.name : "Par matière",
            columns: ["Matière", "Dernière", "Prévue", "Évolution récente"],
            rows: subjects.map((row) => ({
                cells: [row.subjectName, f.grade(row.latestAverage), f.grade(row.projectedAverage), trendLabel[row.trend]],
                tone: f.gradeTone(row.projectedAverage, passing),
            })),
        });
    }
    return {
        text: lines.join("\n"),
        blocks,
        suggestions: studentFollowUps(scope, student, "forecast"),
        sources: ["historique des moyennes", "prévision calibrée"],
        context,
    };
}

interface OrientationData {
    series: string;
    score?: number;
    justification: string;
    alternatives?: string[];
    synthesis?: string;
}

export async function studentOrientation(input: SkillInput): Promise<SkillOutput> {
    const { scope, student } = input;
    if (!student) return refused("Précisez l'élève.");
    const result = await governance<OrientationData>(scope, "recommend-orientation", { studentId: student.id });
    if (!result.ok) return refused(result.message);
    const data = result.data;
    const label = (code: string) => seriesFullLabel(code as RecommendedSeries);
    const blocks: AnswerBlock[] = [];
    if (data.alternatives?.length) blocks.push({ type: "list", title: "Autres séries possibles", items: data.alternatives.map((code) => ({ label: label(code) })) });
    // La synthèse reprend la justification : on n'en garde que ce qu'elle ajoute
    const extra = data.synthesis?.split(data.justification).slice(1).join("").trim();
    if (extra) blocks.push({ type: "text", text: extra });
    return {
        text: `Série la plus adaptée pour **${student.name}** : **${label(data.series)}**${data.score !== undefined ? ` (adéquation ${f.percent(data.score)})` : ""}.\n${data.justification}`,
        blocks,
        suggestions: studentFollowUps(scope, student, "orientation"),
        sources: ["moyennes par discipline", "critères d'orientation de l'école"],
        context: { intent: "student.orientation", studentId: student.id },
    };
}

interface ActionPlanData {
    title: string;
    description: string;
    priority: string;
    steps: string[];
}

const PRIORITY_LABELS: Record<string, string> = { CRITICAL: "critique", HIGH: "haute", MEDIUM: "moyenne", LOW: "basse" };

export async function studentActionPlan(input: SkillInput): Promise<SkillOutput> {
    const { scope, student } = input;
    if (!student) return refused("Précisez l'élève.");
    const result = await governance<ActionPlanData>(scope, "generate-action-plan", { studentId: student.id });
    if (!result.ok) return refused(result.message);
    const plan = result.data;
    return {
        text: `**${plan.title}** — priorité ${PRIORITY_LABELS[plan.priority] ?? plan.priority}.\n${plan.description}`,
        blocks: [{ type: "list", title: "Étapes", items: plan.steps.map((label, index) => ({ label: `${index + 1}. ${label}` })) }],
        suggestions: studentFollowUps(scope, student, "plan"),
        sources: ["analyses de période", "assiduité", "seuils de l'école"],
        context: { intent: "student.action-plan", studentId: student.id },
    };
}

export async function studentComment(input: SkillInput): Promise<SkillOutput> {
    const { scope, student } = input;
    if (!student) return refused("Précisez l'élève.");
    const result = await governance<{ comment: string }>(scope, "draft-report-comment", { studentId: student.id });
    if (!result.ok) return refused(result.message);
    return {
        text: `Proposition d'appréciation pour **${student.name}**, à relire et ajuster avant de la reporter sur le bulletin :`,
        blocks: [{ type: "quote", text: result.data.comment }],
        suggestions: studentFollowUps(scope, student, "comment"),
        sources: ["analyses de période"],
        context: { intent: "student.comment", studentId: student.id },
    };
}

export async function studentGrades(input: SkillInput): Promise<SkillOutput> {
    const { scope, student, entities } = input;
    if (!student) return refused("Précisez l'élève.");
    const grades = await prisma.grade.findMany({
        where: {
            studentId: student.id,
            deletedAt: null,
            evaluation: {
                classSubject: {
                    class: { schoolId: scope.schoolId },
                    ...(entities.subject ? { subjectId: entities.subject.id } : {}),
                },
            },
        },
        orderBy: { evaluation: { date: "desc" } },
        take: 12,
        select: {
            value: true,
            isAbsent: true,
            isExcused: true,
            evaluation: {
                select: {
                    title: true,
                    date: true,
                    maxGrade: true,
                    type: { select: { name: true } },
                    classSubject: { select: { subject: { select: { name: true } } } },
                },
            },
        },
    });
    const context: AssistantContext = { intent: "student.grades", studentId: student.id, subjectId: entities.subject?.id };
    const scopeLabel = entities.subject ? ` en ${entities.subject.name}` : "";
    if (grades.length === 0) {
        return { text: `Aucune note enregistrée pour **${student.name}**${scopeLabel}.`, sources: ["notes"], context };
    }
    const passing = await getPassingGrade(scope.schoolId);
    const onTwenty = grades
        .filter((g) => g.value !== null && !g.isAbsent)
        .map((g) => (Number(g.value) / Number(g.evaluation.maxGrade)) * 20);
    const mean = onTwenty.length ? onTwenty.reduce((sum, v) => sum + v, 0) / onTwenty.length : null;
    return {
        text:
            (isSelf(scope)
                ? `Vos ${f.count(grades.length, "dernière note", "dernières notes")}${scopeLabel}`
                : `Les ${f.count(grades.length, "dernière note", "dernières notes")} ${deBold(student.name)}${scopeLabel}`) +
            (mean !== null
                ? ` — moyenne simple de ces notes : **${f.grade(mean)}** (la moyenne officielle applique les coefficients et la formule de l'école).`
                : "."),
        blocks: [
            {
                type: "table",
                columns: ["Date", "Matière", "Évaluation", "Note"],
                rows: grades.map((g) => {
                    const max = Number(g.evaluation.maxGrade);
                    const value = g.value === null ? null : Number(g.value);
                    const cell = g.isAbsent ? (g.isExcused ? "Absent (excusé)" : "Absent") : value === null ? "—" : f.grade(value, max);
                    const tone: Tone = g.isAbsent ? "warning" : value === null ? "neutral" : f.gradeTone((value / max) * 20, passing);
                    return {
                        cells: [f.day(g.evaluation.date), g.evaluation.classSubject.subject.name, g.evaluation.title || g.evaluation.type.name, cell],
                        tone,
                    };
                }),
            },
        ],
        links: [{ label: "Notes & bulletins", href: "/dashboard/grades" }],
        suggestions: studentFollowUps(scope, student, "grades"),
        sources: ["notes"],
        context,
    };
}

// ---------------------------------------------------------------------------
// Classe et établissement
// ---------------------------------------------------------------------------

interface ClassAnalysis {
    status: string;
    totals: { activeStudents: number; analyticsCoverage: number };
    metrics: { classAverage: number | null; attendanceRate: number | null; atRiskCount: number; criticalRiskCount: number };
    topStudents: Array<{ id: string; name: string; averageGrade: number; classRank: number | null }>;
}

export async function classOverview(input: SkillInput): Promise<SkillOutput> {
    const { scope, klass } = input;
    if (!klass) return refused("Précisez la classe.");
    const result = await governance<ClassAnalysis>(scope, "analyze-class", { classId: klass.id });
    if (!result.ok) return refused(result.message);
    const data = result.data;
    const passing = await getPassingGrade(scope.schoolId);
    const m = data.metrics;
    const lines = [`**${klass.name}** : ${f.count(data.totals.activeStudents, "élève inscrit", "élèves inscrits")}.`];
    if (data.status === "insufficient_data") {
        lines.push("Aucune moyenne de période n'est encore calculée pour cette classe.");
    } else {
        if (m.classAverage !== null) lines.push(`Moyenne de classe : **${f.grade(m.classAverage)}**.`);
        lines.push(
            m.atRiskCount > 0
                ? `**${f.count(m.atRiskCount, "élève à suivre", "élèves à suivre")}**, dont ${m.criticalRiskCount} en situation critique.`
                : "Aucun élève à risque modéré ou élevé.",
        );
    }
    const blocks: AnswerBlock[] = [
        {
            type: "metrics",
            items: [
                { label: "Moyenne", value: f.grade(m.classAverage), tone: f.gradeTone(m.classAverage, passing) },
                { label: "Assiduité", value: f.percent(m.attendanceRate) },
                { label: "À suivre", value: String(m.atRiskCount), tone: m.atRiskCount > 0 ? "warning" : "success" },
                { label: "Effectif", value: String(data.totals.activeStudents) },
            ],
        },
    ];
    if (data.topStudents.length) {
        blocks.push({
            type: "table",
            title: "Meilleures moyennes",
            columns: ["Rang", "Élève", "Moyenne"],
            rows: data.topStudents.map((row, index) => ({
                cells: [String(row.classRank ?? index + 1), row.name, f.grade(row.averageGrade)],
                href: studentHref(scope, row.id),
            })),
        });
    }
    return {
        text: lines.join("\n"),
        blocks,
        links: [{ label: "Fiche de la classe", href: classHref(scope, klass.id) ?? "/dashboard/classes" }],
        suggestions: [`Élèves à risque en ${klass.name}`, `Absences de la ${klass.name} cette semaine`, `Emploi du temps de la ${klass.name} demain`],
        sources: ["analyses de période", "appel"],
        context: { intent: "class.overview", classId: klass.id },
    };
}

interface SchoolAnalysis {
    status: string;
    totals: { students: number; teachers: number; classes: number };
    metrics: { overallAverage: number | null; atRiskCount: number; criticalRiskCount: number };
}

async function currentYear(schoolId: string) {
    return prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true, name: true } });
}

export async function schoolOverview(input: SkillInput): Promise<SkillOutput> {
    const { scope } = input;
    const [result, year, passing] = await Promise.all([
        governance<SchoolAnalysis>(scope, "analyze-school", {}),
        currentYear(scope.schoolId),
        getPassingGrade(scope.schoolId),
    ]);
    if (!result.ok) return refused(result.message);
    const recovery = year ? await computeYearFeeRecovery(scope.schoolId, year.id) : null;
    const data = result.data;
    const m = data.metrics;
    const lines = [
        `**Vue d'ensemble${year ? ` — ${year.name}` : ""}** : ${f.count(data.totals.students, "élève")}, ${f.count(data.totals.teachers, "enseignant")}, ${f.count(data.totals.classes, "classe")}.`,
    ];
    if (m.overallAverage !== null) lines.push(`Moyenne générale : **${f.grade(m.overallAverage)}**.`);
    lines.push(
        m.atRiskCount
            ? `**${f.count(m.atRiskCount, "élève à suivre", "élèves à suivre")}**, dont ${m.criticalRiskCount} en situation critique.`
            : "Aucun élève à risque modéré ou élevé.",
    );
    if (recovery) {
        lines.push(`Recouvrement : **${f.percent(recovery.rate)}** (${f.fcfa(recovery.collected)} encaissés sur ${f.fcfa(recovery.expected)} attendus).`);
    }
    return {
        text: lines.join("\n"),
        blocks: [
            {
                type: "metrics",
                items: [
                    { label: "Élèves", value: String(data.totals.students) },
                    { label: "Moyenne générale", value: f.grade(m.overallAverage), tone: f.gradeTone(m.overallAverage, passing) },
                    { label: "À suivre", value: String(m.atRiskCount), tone: m.atRiskCount > 0 ? "warning" : "success" },
                    { label: "Recouvrement", value: recovery ? f.percent(recovery.rate) : "—", tone: recovery && recovery.rate < 60 ? "warning" : "neutral" },
                ],
            },
        ],
        links: [
            { label: "Analyses", href: "/dashboard/analytics" },
            { label: "Finance", href: "/dashboard/finance" },
        ],
        suggestions: ["Élèves à risque", "Absences de cette semaine", "Combien reste-t-il à encaisser ?"],
        sources: ["analyses de période", "effectifs", "paiements validés"],
        context: { intent: "school.overview" },
    };
}

// ---------------------------------------------------------------------------
// Vie scolaire : appel, emploi du temps, devoirs
// ---------------------------------------------------------------------------

function currentWeek(now: Date): TimeRange {
    const today = localDay(now);
    const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
    return { from: monday, to: new Date(today.getTime() + DAY_MS - 1), label: "cette semaine" };
}

/** Classe active de l'élève dans l'école (pour la direction et l'enseignant, qui ne l'ont pas dans le périmètre famille). */
async function studentClassIds(scope: AssistantScope, student: StudentRef): Promise<string[]> {
    if (scope.kind === "family") return scope.classes.filter((c) => c.name === student.className).map((c) => c.id);
    const enrollment = await prisma.enrollment.findFirst({
        where: { studentId: student.id, status: "ACTIVE", class: { schoolId: scope.schoolId } },
        select: { classId: true },
    });
    return enrollment ? [enrollment.classId] : [];
}

const ATTENDANCE_LABELS: Record<string, string> = { ABSENT: "Absence non justifiée", EXCUSED: "Absence justifiée", LATE: "Retard" };

export async function attendanceSummary(input: SkillInput): Promise<SkillOutput> {
    const { scope, entities, student, klass, now, message } = input;
    const voice = voiceFor(scope, message);
    const range = entities.range ?? currentWeek(now);
    const studentIds = student ? [student.id] : scope.kind === "family" ? scope.students.map((s) => s.id) : null;
    const classIds = klass ? [klass.id] : scope.kind === "teacher" ? scope.classes.map((c) => c.id) : null;
    if (studentIds?.length === 0 || classIds?.length === 0) return refused("Aucun élève ni aucune classe dans votre périmètre.");

    const records = await prisma.attendance.findMany({
        where: {
            date: { gte: range.from, lte: range.to },
            status: { in: ["ABSENT", "LATE", "EXCUSED"] },
            class: { schoolId: scope.schoolId },
            ...(classIds ? { classId: { in: classIds } } : {}),
            ...(studentIds ? { studentId: { in: studentIds } } : {}),
        },
        orderBy: { date: "desc" },
        take: 2000,
        select: {
            status: true,
            date: true,
            reason: true,
            studentId: true,
            class: { select: { name: true } },
            student: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
    });

    const target = student
        ? student.name
        : klass
          ? `la ${klass.name}`
          : scope.kind === "family"
            ? scope.students.length > 1 ? "vos enfants" : scope.students[0]?.name ?? "votre enfant"
            : scope.kind === "teacher" ? "vos classes" : "l'établissement";
    const context: AssistantContext = { intent: "attendance.summary", studentId: student?.id, classId: klass?.id };
    if (records.length === 0) {
        return {
            text: voice.by(
                [`Aucune absence ni aucun retard pour ${target} ${range.label} : c'est parfait.`, `Rien à signaler ${range.label} : aucune absence ni aucun retard pour ${target}.`],
                [`Aucune absence ni aucun retard enregistré pour ${target} ${range.label}.`, `Aucune absence ni retard ${range.label} pour ${target}.`],
            ),
            suggestions: student ? studentFollowUps(scope, student, "attendance") : ["Absences du mois dernier"],
            sources: ["appel"],
            context,
        };
    }

    const absent = records.filter((r) => r.status === "ABSENT").length;
    const excused = records.filter((r) => r.status === "EXCUSED").length;
    const late = records.filter((r) => r.status === "LATE").length;
    const summary = `Pour ${target}, ${range.label} : **${f.count(absent, "absence non justifiée", "absences non justifiées")}**, ${f.count(excused, "absence justifiée", "absences justifiées")} et ${f.count(late, "retard")}.`;

    if (student || (scope.kind === "family" && scope.students.length === 1)) {
        return {
            text: summary,
            blocks: [
                {
                    type: "list",
                    items: records.slice(0, 20).map((r) => ({
                        label: f.day(r.date),
                        detail: `${ATTENDANCE_LABELS[r.status]}${r.reason ? ` — ${r.reason}` : ""}`,
                        tone: r.status === "ABSENT" ? "danger" : "warning",
                    })),
                },
            ],
            links: [{ label: "Assiduité", href: "/dashboard/attendance" }],
            suggestions: student ? studentFollowUps(scope, student, "attendance") : [],
            sources: ["appel"],
            context,
        };
    }

    const perStudent = new Map<string, { name: string; className: string; absent: number; late: number }>();
    for (const r of records) {
        const row = perStudent.get(r.studentId) ?? {
            name: `${r.student.user.firstName ?? ""} ${r.student.user.lastName ?? ""}`.trim(),
            className: r.class.name,
            absent: 0,
            late: 0,
        };
        if (r.status === "LATE") row.late += 1;
        else row.absent += 1;
        perStudent.set(r.studentId, row);
    }
    const rows = Array.from(perStudent.entries()).sort((a, b) => b[1].absent - a[1].absent || b[1].late - a[1].late);
    return {
        text: `${summary}\n${f.count(rows.length, "élève concerné", "élèves concernés")}.`,
        blocks: [
            {
                type: "table",
                title: "Les plus absents",
                columns: ["Élève", "Classe", "Absences", "Retards"],
                rows: rows.slice(0, 15).map(([id, row]) => ({
                    cells: [row.name, row.className, String(row.absent), String(row.late)],
                    href: studentHref(scope, id),
                    tone: row.absent >= 3 ? "danger" : row.absent > 0 ? "warning" : "neutral",
                })),
            },
        ],
        links: [{ label: "Appel et justificatifs", href: "/dashboard/attendance" }],
        suggestions: rows[0] ? [`Analyse de ${rows[0][1].name}`, "Absences du mois dernier"] : [],
        sources: ["appel"],
        context,
    };
}

const DAY_LABELS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export async function scheduleDay(input: SkillInput): Promise<SkillOutput> {
    const { scope, entities, student, klass, now } = input;
    const day = entities.day ?? { dayOfWeek: localDay(now).getUTCDay(), label: "aujourd'hui" };
    const dayName = DAY_LABELS[day.dayOfWeek];
    const when = day.label === dayName ? dayName : `${day.label} (${dayName})`;

    let classIds: string[];
    let teacherOnly = false;
    let target: string;
    if (klass) {
        classIds = [klass.id];
        target = `la ${klass.name}`;
    } else if (student) {
        classIds = await studentClassIds(scope, student);
        target = student.name;
    } else if (scope.kind === "teacher") {
        classIds = scope.classes.map((c) => c.id);
        teacherOnly = true;
        target = "vous";
    } else if (scope.kind === "family" && scope.classes.length > 0) {
        classIds = scope.classes.map((c) => c.id);
        target = scope.user.role === "STUDENT" ? "vous" : scope.students.length > 1 ? "vos enfants" : scope.students[0]?.name ?? "votre enfant";
    } else {
        return {
            text: "De quelle classe voulez-vous l'emploi du temps ?",
            suggestions: scope.classes.slice(0, 4).map((c) => `Emploi du temps de la ${c.name} ${day.label}`),
            sources: [],
            context: { intent: "schedule.day" },
        };
    }

    const slots = await prisma.schedule.findMany({
        where: {
            classId: { in: classIds },
            dayOfWeek: day.dayOfWeek,
            class: { schoolId: scope.schoolId },
            ...(teacherOnly ? { classSubject: { teacher: { userId: scope.user.id } } } : {}),
        },
        orderBy: { startTime: "asc" },
        select: {
            startTime: true,
            endTime: true,
            room: true,
            class: { select: { name: true } },
            classSubject: { select: { subject: { select: { name: true } } } },
        },
    });
    const context: AssistantContext = { intent: "schedule.day", studentId: student?.id, classId: klass?.id };
    if (slots.length === 0) {
        return { text: target === "vous" ? `Vous n'avez aucun cours ${when}.` : `Aucun cours prévu pour ${target} ${when}.`, sources: ["emploi du temps"], context };
    }

    const showClass = new Set(slots.map((s) => s.class.name)).size > 1 || teacherOnly;
    return {
        text: `${target === "vous" ? "Votre emploi du temps" : `Emploi du temps de ${target}`}, ${when} : **${f.count(slots.length, "cours", "cours")}**, de ${slots[0].startTime} à ${slots[slots.length - 1].endTime}.`,
        blocks: [
            {
                type: "table",
                columns: showClass ? ["Horaire", "Matière", "Classe", "Salle"] : ["Horaire", "Matière", "Salle"],
                rows: slots.map((s) => ({
                    cells: [
                        `${s.startTime} – ${s.endTime}`,
                        s.classSubject?.subject.name ?? "—",
                        ...(showClass ? [s.class.name] : []),
                        s.room ?? "—",
                    ],
                })),
            },
        ],
        links: [{ label: "Emploi du temps complet", href: "/dashboard/schedule" }],
        suggestions: ["Devoirs à rendre", day.label === "demain" ? "Emploi du temps de lundi" : "Emploi du temps de demain"],
        sources: ["emploi du temps"],
        context,
    };
}

export async function homeworkUpcoming(input: SkillInput): Promise<SkillOutput> {
    const { scope, entities, student, klass, now } = input;
    const today = localDay(now);
    const until = new Date(today.getTime() + 15 * DAY_MS - 1);
    const classIds = klass ? [klass.id] : student ? await studentClassIds(scope, student) : scope.kind === "direction" ? [] : scope.classes.map((c) => c.id);
    if (classIds.length === 0) {
        return {
            text: scope.kind === "direction" ? "Pour quelle classe ?" : "Aucune classe dans votre périmètre.",
            suggestions: scope.classes.slice(0, 4).map((c) => `Devoirs de la ${c.name}`),
            sources: [],
            context: { intent: "homework.upcoming" },
        };
    }

    const homeworks = await prisma.homework.findMany({
        where: {
            deletedAt: null,
            isPublished: true,
            dueDate: { gte: today, lte: until },
            classSubject: {
                classId: { in: classIds },
                class: { schoolId: scope.schoolId },
                ...(entities.subject ? { subjectId: entities.subject.id } : {}),
                ...(scope.kind === "teacher" && !klass ? { teacher: { userId: scope.user.id } } : {}),
            },
        },
        orderBy: { dueDate: "asc" },
        take: 30,
        select: {
            id: true,
            title: true,
            dueDate: true,
            classSubject: { select: { class: { select: { name: true } }, subject: { select: { name: true } } } },
        },
    });
    // Suivi des remises : pour l'élève lui-même, ou l'enfant précisé (famille) ou l'élève visé (personnel)
    const trackedStudentId = student?.id ?? (scope.kind === "family" && scope.students.length === 1 ? scope.students[0].id : undefined);
    const submitted = trackedStudentId
        ? new Set(
              (
                  await prisma.homeworkSubmission.findMany({
                      where: { studentId: trackedStudentId, homeworkId: { in: homeworks.map((h) => h.id) } },
                      select: { homeworkId: true },
                  })
              ).map((s) => s.homeworkId),
          )
        : null;

    const context: AssistantContext = { intent: "homework.upcoming", studentId: student?.id, classId: klass?.id, subjectId: entities.subject?.id };
    if (homeworks.length === 0) {
        return { text: `Aucun devoir à rendre dans les 14 prochains jours${entities.subject ? ` en ${entities.subject.name}` : ""}.`, sources: ["devoirs"], context };
    }
    const pending = submitted ? homeworks.filter((h) => !submitted.has(h.id)).length : null;
    return {
        text: `**${f.count(homeworks.length, "devoir")}** à rendre dans les 14 prochains jours${pending !== null ? `, dont **${pending}** pas encore ${pending > 1 ? "rendus" : "rendu"}` : ""}.`,
        blocks: [
            {
                type: "table",
                columns: ["Pour le", "Matière", "Devoir", submitted ? "État" : "Classe"],
                rows: homeworks.map((h) => ({
                    cells: [
                        f.day(h.dueDate),
                        h.classSubject.subject.name,
                        h.title,
                        submitted ? (submitted.has(h.id) ? "Rendu" : "À rendre") : h.classSubject.class.name,
                    ],
                    tone: submitted ? (submitted.has(h.id) ? "success" : "warning") : undefined,
                })),
            },
        ],
        links: [{ label: "Devoirs", href: "/dashboard/homework" }],
        suggestions: ["Emploi du temps de demain"],
        sources: ["devoirs", ...(submitted ? ["remises"] : [])],
        context,
    };
}

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export async function financeBalance(input: SkillInput): Promise<SkillOutput> {
    const { scope, student } = input;
    if (scope.kind === "direction") {
        const year = await currentYear(scope.schoolId);
        const recovery = year ? await computeYearFeeRecovery(scope.schoolId, year.id) : null;
        if (!year || !recovery) {
            return {
                text: "Aucun frais attendu n'est enregistré pour l'année en cours : impossible de calculer un recouvrement.",
                links: [{ label: "Finance", href: "/dashboard/finance" }],
                sources: ["frais", "échéanciers"],
                context: { intent: "finance.balance" },
            };
        }
        const remaining = Math.max(0, recovery.expected - recovery.collected);
        return {
            text: `**${year.name}** : ${f.fcfa(recovery.collected)} encaissés sur ${f.fcfa(recovery.expected)} attendus, soit **${f.percent(recovery.rate)}**. Reste à encaisser : **${f.fcfa(remaining)}**.`,
            blocks: [
                {
                    type: "metrics",
                    items: [
                        { label: "Attendu", value: f.fcfa(recovery.expected) },
                        { label: "Encaissé", value: f.fcfa(recovery.collected), tone: "success" },
                        { label: "Reste", value: f.fcfa(remaining), tone: remaining > 0 ? "warning" : "success" },
                        { label: "Taux", value: f.percent(recovery.rate) },
                    ],
                },
            ],
            links: [{ label: "Finance", href: "/dashboard/finance" }],
            suggestions: ["Vue d'ensemble de l'école"],
            sources: ["échéanciers", "frais sans échéancier", "paiements validés"],
            context: { intent: "finance.balance" },
        };
    }
    if (scope.kind !== "family") return refused("La situation financière est réservée à la direction et aux familles.");
    const voice = voiceFor(scope, input.message);

    const ids = student ? [student.id] : scope.students.map((s) => s.id);
    const finances = (await Promise.all(ids.map((id) => getChildFinance(prisma, id)))).filter(
        (x): x is NonNullable<typeof x> => x !== null,
    );
    if (finances.length === 0) return refused("Aucune situation financière disponible.");

    const total = finances.reduce((sum, fin) => sum + fin.totals.remaining, 0);
    const nextDue = finances
        .flatMap((fin) =>
            fin.fees.flatMap((fee) =>
                (fee.installments ?? [])
                    .filter((i) => i.outstanding > 0)
                    .map((i) => ({ child: fin.child.firstName, fee: fee.name, date: i.dueDate, amount: i.outstanding })),
            ),
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);

    const blocks: AnswerBlock[] = [
        {
            type: "table",
            columns: ["Enfant", "Facturé", "Payé", "Reste"],
            rows: finances.map((fin) => ({
                cells: [`${fin.child.firstName} ${fin.child.lastName}`, f.fcfa(fin.totals.billed), f.fcfa(fin.totals.settled), f.fcfa(fin.totals.remaining)],
                tone: fin.totals.remaining > 0 ? "warning" : "success",
            })),
        },
    ];
    if (nextDue.length) {
        blocks.push({
            type: "list",
            title: "Prochaines échéances",
            items: nextDue.map((d) => ({ label: `${f.day(d.date)} — ${f.fcfa(d.amount)}`, detail: `${d.fee} (${d.child})` })),
        });
    }
    return {
        text:
            total > 0
                ? voice.pick([
                      `Reste à payer : **${f.fcfa(total)}**${finances.length > 1 ? ` pour ${f.count(finances.length, "enfant")}` : ""}.`,
                      `Il vous reste **${f.fcfa(total)}** à régler${finances.length > 1 ? ` pour vos ${finances.length} enfants` : ""}.`,
                  ]) + (nextDue[0] ? ` La prochaine échéance est le ${f.day(nextDue[0].date)} (${f.fcfa(nextDue[0].amount)}).` : "")
                : voice.pick(["Tout est réglé : aucun montant restant dû. Merci !", "Vous êtes à jour : rien ne reste à payer."]),
        blocks,
        links: [{ label: total > 0 ? "Payer" : "Paiements", href: "/dashboard/finance" }],
        suggestions: ["Devoirs à rendre", "Absences de ce mois"],
        sources: ["frais applicables", "échéanciers", "paiements validés"],
        context: { intent: "finance.balance", studentId: student?.id },
    };
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const NAVIGATION_NOISE = new Set(["comment", "trouv", "acced", "page", "menu"]);

export function navigate(input: SkillInput): SkillOutput {
    const { scope, message } = input;
    const role = scope.user.role as UserRole;
    const allowed = (roles?: readonly string[], permission?: string | readonly string[]) => {
        if (roles && !roleSatisfies(role, roles)) return false;
        if (!permission) return true;
        const list = typeof permission === "string" ? [permission] : permission;
        return list.some((p) => hasPermission(role, p as Permission));
    };
    const pages = new Map<string, { label: string; description: string }>();
    for (const link of navForRole(role)) pages.set(link.href, { label: link.label, description: "" });
    for (const entry of SERVICE_CATALOG) {
        if (allowed(entry.roles, entry.permission)) pages.set(entry.href, { label: entry.label, description: entry.description });
    }

    const query = contentWords(message)
        .map(stem)
        .filter((w) => w.length >= 3 && !NAVIGATION_NOISE.has(w));
    const matches = (pool: string[], word: string) => pool.some((w) => w === word || (w.length >= 5 && similar(w, word)));
    const scored = Array.from(pages.entries())
        .map(([href, page]) => {
            const label = contentWords(page.label).map(stem);
            const description = contentWords(page.description).map(stem);
            let score = 0;
            for (const word of query) {
                if (matches(label, word)) score += 3;
                else if (matches(description, word)) score += 1;
            }
            return { href, ...page, score };
        })
        .filter((page) => page.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

    if (scored.length === 0) {
        return {
            text: "Je n'ai pas trouvé de page correspondante. Toutes les fonctions auxquelles vous avez accès sont listées dans « Tous les services ».",
            links: [{ label: "Tous les services", href: "/dashboard/services" }],
            sources: ["menu"],
            context: { intent: "navigate" },
        };
    }
    return {
        text: scored.length === 1 ? `C'est dans **${scored[0].label}**.` : "Voici les pages qui correspondent :",
        blocks: [{ type: "list", items: scored.map((page) => ({ label: page.label, detail: page.description || undefined, href: page.href })) }],
        sources: ["menu", "annuaire des services"],
        context: { intent: "navigate" },
    };
}

// ---------------------------------------------------------------------------
// Synthèse rédigée et explication (« résume Koffi », « pourquoi Koffi baisse ? »)
// ---------------------------------------------------------------------------

interface StudentAnalysisDetailed extends StudentAnalysis {
    subjectPerformance: Array<{ subjectName: string; average: number | null; progressionRate: number | null; isWeakness: boolean }>;
    prediction: (StudentAnalysis["prediction"] & { causalFactors?: Array<{ factor: string; weight: number; contribution: number; description: string }> }) | null;
}

async function recentAttendance(scope: AssistantScope, studentId: string, now: Date) {
    const from = new Date(localDay(now).getTime() - 29 * DAY_MS);
    const rows = await prisma.attendance.findMany({
        where: { studentId, date: { gte: from }, status: { in: ["ABSENT", "LATE", "EXCUSED"] }, class: { schoolId: scope.schoolId } },
        select: { status: true },
    });
    return {
        unexcused: rows.filter((r) => r.status === "ABSENT").length,
        excused: rows.filter((r) => r.status === "EXCUSED").length,
        late: rows.filter((r) => r.status === "LATE").length,
    };
}

const lowerFirst = (text: string) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);

export async function studentSummary(input: SkillInput): Promise<SkillOutput> {
    const { scope, student, message, now } = input;
    if (!student) return refused("Précisez l'élève.");
    const voice = voiceFor(scope, message);
    const name = f.firstName(student.name);
    const withFinance = scope.kind === "family" || scope.kind === "direction";

    const [result, attendance, passing, finance] = await Promise.all([
        governance<StudentAnalysisDetailed>(scope, "analyze-student", { studentId: student.id }),
        recentAttendance(scope, student.id, now),
        getPassingGrade(scope.schoolId),
        withFinance ? getChildFinance(prisma, student.id).catch(() => null) : Promise.resolve(null),
    ]);
    if (!result.ok) return refused(result.message);
    const data = result.data;
    const m = data.metrics;

    const self = isSelf(scope);
    const paragraphs: string[] = [];
    paragraphs.push(
        self ? voice.pick(["Voici où vous en êtes.", "Je vous fais le point."]) : voice.by(
            [`Voici où en est **${name}**.`, `Je vous fais le point sur **${name}**.`, `Voici un résumé pour **${name}**.`],
            [`Synthèse — **${student.name}**${student.className ? ` (${student.className})` : ""}.`, `Point complet sur **${student.name}**${student.className ? `, ${student.className}` : ""}.`],
        ),
    );

    // Résultats
    if (m.averageGrade !== null) {
        let line = `${self ? voice.pick(["Votre moyenne est de", "Sur la dernière période, votre moyenne est de"], 2) : voice.pick(["Sa moyenne est de", "Côté résultats, sa moyenne atteint", "Sur la dernière période, sa moyenne est de"], 2)} **${f.grade(m.averageGrade)}**`;
        if (m.classRank && m.classSize) line += ` (${m.classRank}ᵉ sur ${m.classSize})`;
        line += ` : ${judgeAverage(voice, m.averageGrade, passing)}.`;
        const strengths = data.strengths.slice(0, 2);
        const weaknesses = data.weaknesses.slice(0, 2);
        if (strengths.length && weaknesses.length) {
            line += ` ${self ? "Vous réussissez" : `${name} réussit`} bien en ${joinFr(strengths)} ; en revanche, ${joinFr(weaknesses)} ${weaknesses.length > 1 ? "demandent" : "demande"} plus de travail.`;
        } else if (strengths.length) {
            line += ` ${self ? "Vos" : "Ses"} points forts : ${joinFr(strengths)}.`;
        } else if (weaknesses.length) {
            line += ` ${sentence(joinFr(weaknesses))} ${weaknesses.length > 1 ? "sont les matières à renforcer" : "est la matière à renforcer"}.`;
        }
        if (m.progressionRate !== null && Math.abs(m.progressionRate) >= 1) {
            line += m.progressionRate > 0
                ? ` ${voice.pick(["Bonne nouvelle : la tendance est à la hausse", "La progression est nette"], 3)} (+${f.percent(m.progressionRate)}).`
                : ` ${voice.pick(["La tendance est à la baisse", "On note un recul"], 3)} (−${f.percent(-m.progressionRate)}).`;
        }
        paragraphs.push(line);
    } else {
        paragraphs.push(self ? "Aucune moyenne de période n'est encore calculée pour vous." : `Aucune moyenne de période n'est encore calculée pour ${name}.`);
    }

    // Assiduité et comportement
    const presence: string[] = [];
    if (attendance.unexcused === 0 && attendance.late === 0) {
        presence.push(voice.by(["Aucune absence non justifiée ni retard ce dernier mois, c'est très bien.", "Ce mois-ci, aucune absence non justifiée ni retard."], ["Assiduité irréprochable sur 30 jours.", "Aucune absence non justifiée ni retard sur 30 jours."], 4));
    } else {
        const parts = [
            attendance.unexcused ? f.count(attendance.unexcused, "absence non justifiée", "absences non justifiées") : "",
            attendance.excused ? f.count(attendance.excused, "absence justifiée", "absences justifiées") : "",
            attendance.late ? f.count(attendance.late, "retard") : "",
        ].filter(Boolean);
        presence.push(`Côté assiduité, ${joinFr(parts)} sur les 30 derniers jours.`);
    }
    if (m.incidentCount > 0) presence.push(`${voice.pick(["Par ailleurs", "À noter aussi"], 5)}, ${f.count(m.incidentCount, "incident de discipline", "incidents de discipline")} ${m.incidentCount > 1 ? "ont été signalés" : "a été signalé"} récemment.`);
    paragraphs.push(presence.join(" "));

    // Paiements
    if (finance) {
        const remaining = finance.totals.remaining;
        paragraphs.push(
            remaining > 0
                ? `Côté paiements, il reste **${f.fcfa(remaining)}** à régler.`
                : voice.by(["Côté paiements, tout est réglé.", "Les frais sont entièrement réglés."], ["Frais : soldés.", "Aucun reste à payer."], 6),
        );
    }

    // Conclusion : jamais « rassurante » sous le seuil ou en recul net
    const high = m.riskLevel === "HIGH" || m.riskLevel === "CRITICAL";
    const watch = !high && m.averageGrade !== null && (m.averageGrade < passing || (m.progressionRate ?? 0) <= -5);
    if (self && (high || watch)) {
        paragraphs.push(voice.pick(["En résumé, c'est le moment de vous accrocher : n'hésitez pas à demander de l'aide à vos professeurs.", "En résumé, un effort régulier dans les prochaines semaines peut tout changer ; vos professeurs peuvent vous aider."], 7));
    } else if (self && m.averageGrade !== null) {
        paragraphs.push(voice.pick(["Dans l'ensemble, vous êtes sur une bonne trajectoire : continuez ainsi.", "Globalement, c'est une bonne période : gardez ce rythme."], 7));
    } else if (high) {
        paragraphs.push(
            voice.by(
                [`En résumé, ${name} a besoin d'un coup de pouce en ce moment. Un échange avec l'équipe pédagogique serait utile.`, `En résumé, c'est le bon moment pour accompagner ${name} de plus près ; l'école peut vous proposer un plan d'aide.`],
                [`En résumé : risque ${f.RISK_LABELS[m.riskLevel ?? ""]?.toLowerCase() ?? "élevé"}, un plan d'action est conseillé.`, `Conclusion : suivi prioritaire recommandé (risque ${f.RISK_LABELS[m.riskLevel ?? ""]?.toLowerCase() ?? "élevé"}).`],
                7,
            ),
        );
    } else if (watch) {
        paragraphs.push(
            voice.by(
                [`En résumé, rien d'alarmant pour l'instant, mais les résultats de ${name} demandent de l'attention dans les prochaines semaines.`, `En résumé, ${name} a besoin d'encouragements et d'un suivi régulier sur ses résultats.`],
                [`En résumé : risque faible selon le modèle, mais résultats à surveiller.`, `Conclusion : à suivre sur les résultats (sous le seuil ou en recul).`],
                7,
            ),
        );
    } else if (m.averageGrade !== null) {
        paragraphs.push(voice.by([`Dans l'ensemble, ${name} est sur une bonne trajectoire.`, `Globalement, la situation de ${name} est rassurante.`], [`Dans l'ensemble : situation maîtrisée.`, `Globalement : pas de signal d'alerte.`], 7));
    }

    const href = studentHref(scope, student.id);
    return {
        text: paragraphs.join("\n"),
        links: href ? [{ label: "Fiche de l'élève", href }] : [{ label: "Notes & bulletins", href: "/dashboard/grades" }],
        suggestions: [
            ...(high || watch || (m.progressionRate ?? 0) < 0 ? [self ? "Pourquoi mes résultats baissent ?" : `Pourquoi ${student.name} est en difficulté ?`] : []),
            ...studentFollowUps(scope, student, "overview"),
        ].slice(0, 3),
        sources: ["analyses de période", "appel (30 jours)", "discipline", ...(finance ? ["paiements"] : [])],
        context: { intent: "student.summary", studentId: student.id },
    };
}

export async function studentWhy(input: SkillInput): Promise<SkillOutput> {
    const { scope, student, message, now } = input;
    if (!student) return refused("Précisez l'élève.");
    const voice = voiceFor(scope, message);
    const name = f.firstName(student.name);
    const [result, attendance] = await Promise.all([
        governance<StudentAnalysisDetailed>(scope, "analyze-student", { studentId: student.id }),
        recentAttendance(scope, student.id, now),
    ]);
    if (!result.ok) return refused(result.message);
    const data = result.data;
    const context: AssistantContext = { intent: "student.why", studentId: student.id };

    const reasons: Array<{ text: string; weight: number }> = [];
    for (const factor of data.prediction?.causalFactors ?? []) {
        reasons.push({ text: lowerFirst(humanize(factor.description)), weight: factor.weight * factor.contribution });
    }
    const declining = data.subjectPerformance
        .filter((s) => s.progressionRate !== null && s.progressionRate <= -5)
        .sort((a, b) => (a.progressionRate ?? 0) - (b.progressionRate ?? 0))
        .slice(0, 3);
    if (declining.length) {
        reasons.push({
            text: `la baisse vient surtout ${deFr(joinFr(declining.map((s) => `${s.subjectName} (−${f.percent(-(s.progressionRate ?? 0))})`)))}`,
            weight: 60,
        });
    }
    if (attendance.unexcused >= 2 && !reasons.some((r) => r.text.includes("présence"))) {
        reasons.push({ text: `${f.count(attendance.unexcused, "absence non justifiée", "absences non justifiées")} sur les 30 derniers jours font perdre des cours`, weight: 20 + attendance.unexcused * 5 });
    }
    reasons.sort((a, b) => b.weight - a.weight);
    const top = reasons.slice(0, 3);

    if (top.length === 0) {
        return {
            text: data.status === "insufficient_data"
                ? `Je n'ai pas encore assez de données pour expliquer la situation de **${name}** : aucune moyenne de période n'est calculée.`
                : voice.by(
                      [`Rien d'inquiétant dans les données de **${name}** : pas de baisse marquée, pas d'absences répétées, pas d'incident important.`],
                      [`Aucun facteur de risque significatif pour **${student.name}** : ni baisse marquée, ni absentéisme, ni incident notable.`],
                  ),
            suggestions: studentFollowUps(scope, student, "overview"),
            sources: ["analyses de période", "modèle de risque", "appel (30 jours)"],
            context,
        };
    }

    const intro = isSelf(scope)
        ? top.length === 1
            ? "Voici ce qui pèse le plus sur vos résultats :"
            : voice.pick([`D'après vos données, ${top.length} éléments expliquent surtout vos résultats :`, "Voici ce qui pèse le plus sur vos résultats :"])
        : top.length === 1
        ? voice.pick([`D'après les données, un élément explique surtout la situation de **${name}** :`, `La raison principale, pour **${name}** :`])
        : voice.pick([`D'après les données, ${top.length} éléments expliquent surtout la situation de **${name}** :`, `Voici ce qui pèse le plus sur les résultats de **${name}** :`, `Si l'on regarde de près, la situation de **${name}** s'explique par ${top.length} éléments :`]);
    const closing = voice.by(
        ["Ce sont des points sur lesquels on peut agir : un plan d'aide peut vous être proposé.", "La bonne nouvelle, c'est que ces points se travaillent ; l'équipe pédagogique peut vous aider."],
        ["Ces facteurs sont tirés du modèle de risque (pondérations de l'école).", "Facteurs issus du modèle de risque, classés par poids."],
        2,
    );
    return {
        text: intro,
        blocks: [
            { type: "list", items: top.map((r, index) => ({ label: `${index + 1}. ${sentence(r.text)}` })) },
            { type: "text", text: closing },
        ],
        suggestions: isSelf(scope) ? ["Mon plan d'action", "Résume ma situation", "Mes absences ce mois"] : [`Plan d'action pour ${student.name}`, `Résume ${student.name}`, `Absences ${deFr(student.name)} ce mois`],
        sources: ["modèle de risque", "progression par matière", "appel (30 jours)"],
        context,
    };
}
