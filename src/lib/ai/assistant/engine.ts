/**
 * Assistant EduPilot — moteur local, sans modèle de langage ni service externe.
 *
 * Une question suit toujours le même chemin :
 *  1. périmètre de la personne (session, jamais ce qui est écrit) ;
 *  2. reconnaissance des éléments (élève, classe, matière, période, jour) ;
 *  3. compréhension de l'intention (classement pondéré, tolérant aux fautes) ;
 *  4. reprise du contexte du tour précédent (« et sa prévision ? », « et la 4e A ? ») ;
 *  5. contrôle du rôle, puis réponse calculée sur les données réelles.
 *
 * Quand la question est ambiguë (deux élèves du même prénom, pas de classe),
 * l'assistant demande une précision avec des choix en un clic, au lieu de deviner.
 */
import { roleSatisfies } from "@/lib/rbac/permissions";
import { extractEntities } from "./entities";
import { classify, DIRECTION, intentDefinition, STAFF, type Classification } from "./intents";
import { loadScope, scopeHasClass, scopeHasStudent, type AssistantScope } from "./scope";
import { deFr, voiceFor, withDe } from "./phrasing";
import * as skills from "./skills";
import type { SkillInput, SkillOutput } from "./skills";
import type { AssistantAnswer, AssistantContext, AssistantUser, Entities, IntentId, NamedRef, StudentRef } from "./types";

type SkillHandler = (input: SkillInput) => Promise<SkillOutput> | SkillOutput;

const HANDLERS: Partial<Record<IntentId, SkillHandler>> = {
    "risk.list": skills.riskList,
    "student.overview": skills.studentOverview,
    "student.summary": skills.studentSummary,
    "student.why": skills.studentWhy,
    "student.forecast": skills.studentForecast,
    "student.orientation": skills.studentOrientation,
    "student.action-plan": skills.studentActionPlan,
    "student.comment": skills.studentComment,
    "student.grades": skills.studentGrades,
    "class.overview": skills.classOverview,
    "school.overview": skills.schoolOverview,
    "attendance.summary": skills.attendanceSummary,
    "schedule.day": skills.scheduleDay,
    "homework.upcoming": skills.homeworkUpcoming,
    "finance.balance": skills.financeBalance,
    navigate: skills.navigate,
};

/** Intentions où un élève précis est facultatif : repris du contexte seulement s'il est désigné (« son », « sa »). */
const OPTIONAL_STUDENT: ReadonlySet<IntentId> = new Set(["attendance.summary", "schedule.day", "homework.upcoming", "finance.balance"]);
const OPTIONAL_CLASS: ReadonlySet<IntentId> = new Set(["risk.list", "attendance.summary", "schedule.day", "homework.upcoming"]);
const SOCIAL: ReadonlySet<IntentId> = new Set(["greeting", "thanks", "help", "ack", "repeat", "more"]);

/** Reformulation en un clic quand il faut choisir un élève. */
const STUDENT_PHRASES: Partial<Record<IntentId, string>> = {
    "student.overview": "Analyse de",
    "student.summary": "Résume",
    "student.why": "Pourquoi les résultats de",
    "student.forecast": "Prévision de",
    "student.orientation": "Orientation de",
    "student.action-plan": "Plan d'action pour",
    "student.comment": "Appréciation de bulletin pour",
    "student.grades": "Dernières notes de",
    "attendance.summary": "Absences de",
    "schedule.day": "Emploi du temps de",
    "homework.upcoming": "Devoirs de",
    "finance.balance": "Reste à payer pour",
};

const CLASS_PHRASES: Partial<Record<IntentId, string>> = {
    "class.overview": "Bilan de la",
    "risk.list": "Élèves à risque en",
    "attendance.summary": "Absences de la",
    "schedule.day": "Emploi du temps de la",
    "homework.upcoming": "Devoirs de la",
};

function examplesFor(scope: AssistantScope): string[] {
    const someone = scope.students[0];
    const name = someone ? someone.name.split(" ")[0] : null;
    const someClass = scope.classes[0]?.name;
    if (scope.kind === "direction") {
        return [
            "Vue d'ensemble de l'école",
            "Élèves à risque",
            "Absences de cette semaine",
            "Combien reste-t-il à encaisser ?",
            ...(someClass ? [`Bilan de la ${someClass}`] : []),
        ];
    }
    if (scope.kind === "teacher") {
        return [
            someClass ? `Élèves à risque en ${someClass}` : "Élèves à risque dans mes classes",
            "Mon emploi du temps de demain",
            "Absences de cette semaine",
            ...(someone ? [`Prévision de ${someone.name}`, `Appréciation de bulletin pour ${someone.name}`] : []),
        ];
    }
    if (scope.user.role === "STUDENT") {
        return ["Mes dernières notes", "Ma prévision pour la prochaine période", "Mes devoirs à rendre", "Mon emploi du temps de demain", "Mes absences de ce mois"];
    }
    return [
        ...(name ? [`Comment va ${name} ?`, `Dernières notes de ${name}`] : []),
        "Combien je dois encore payer ?",
        "Devoirs à rendre",
        "Absences de ce mois",
    ];
}

function capabilities(scope: AssistantScope): string {
    if (scope.kind === "direction") {
        return "Je lis les données de l'établissement : analyses et élèves à risque, prévisions de moyennes, orientation, appel, emplois du temps, devoirs et recouvrement.";
    }
    if (scope.kind === "teacher") {
        return "Je lis les données de vos classes : élèves à risque, analyse et prévision par élève, plans d'action, appréciations de bulletin, appel, emploi du temps et devoirs.";
    }
    if (scope.user.role === "STUDENT") return "Je lis vos données : notes, prévision de moyenne, orientation, absences, emploi du temps et devoirs.";
    return "Je lis les données de vos enfants : notes, analyse, prévision, absences, emploi du temps, devoirs et reste à payer.";
}

/** Suite logique de la conversation : autour de l'élève ou de la classe du tour précédent. */
function followUps(scope: AssistantScope, previous: AssistantContext | undefined): string[] {
    const student = scope.students.find((s) => s.id === previous?.studentId);
    if (student) {
        // Nom complet : un prénom seul est ambigu dès qu'il y a des homonymes
        const name = student.name;
        const all: Array<[IntentId, string]> = scope.user.role === "STUDENT"
            ? [
                  ["student.summary", "Résume ma situation"],
                  ["student.why", "Pourquoi mes résultats ?"],
                  ["student.forecast", "Ma prévision"],
                  ["student.action-plan", "Mon plan d'action"],
                  ["attendance.summary", "Mes absences ce mois"],
              ]
            : [
                  ["student.summary", `Résume ${name}`],
                  ["student.why", `Pourquoi les résultats ${deFr(name)} ?`],
                  ["student.forecast", `Prévision ${deFr(name)}`],
                  ["student.action-plan", `Plan d'action pour ${name}`],
                  ["attendance.summary", `Absences ${deFr(name)} ce mois`],
              ];
        return all.filter(([id]) => id !== previous?.intent).slice(0, 4).map(([, text]) => text);
    }
    const klass = scope.classes.find((c) => c.id === previous?.classId);
    if (klass && scope.kind !== "family") {
        return [`Bilan de la ${klass.name}`, `Élèves à risque en ${klass.name}`, `Absences de la ${klass.name} cette semaine`, `Devoirs de la ${klass.name}`];
    }
    return examplesFor(scope).slice(0, 4);
}

function socialAnswer(intent: IntentId, scope: AssistantScope, message = "", previous?: AssistantContext): SkillOutput {
    const examples = examplesFor(scope);
    const voice = voiceFor(scope, message);
    const context = previous ?? {};
    if (intent === "thanks") {
        return { text: voice.pick(["Avec plaisir ! Autre chose ?", "Je vous en prie. Je peux vous aider pour autre chose ?", "De rien, c'est fait pour ça."]), suggestions: followUps(scope, previous).slice(0, 3), sources: [], context };
    }
    if (intent === "ack") {
        return { text: voice.pick(["Très bien.", "Parfait.", "Entendu."]) + " " + voice.pick(["Voulez-vous aller plus loin ?", "Voici ce que je peux vous montrer ensuite :", "Je reste à votre disposition."], 1), suggestions: followUps(scope, previous), sources: [], context };
    }
    if (intent === "more") {
        return { text: voice.pick(["Bien sûr. Voici ce que je peux encore vous montrer :", "Volontiers. Quelques pistes pour continuer :", "Oui : voici la suite possible."]), suggestions: followUps(scope, previous), sources: [], context };
    }
    if (intent === "repeat") {
        return { text: "Je n'ai encore rien dit à reformuler. Que voulez-vous savoir ?", suggestions: examples.slice(0, 4), sources: [] };
    }
    const hello = intent === "greeting" ? `Bonjour${scope.user.firstName ? ` ${scope.user.firstName}` : ""} ! ` : "";
    return {
        text: `${hello}${capabilities(scope)}\nPosez votre question en français, même avec des fautes : je réponds avec les chiffres réels et je vous indique la page où agir.`,
        blocks: intent === "help" ? [{ type: "list", title: "Exemples", items: examples.map((label) => ({ label })) }] : [],
        suggestions: examples.slice(0, 4),
        sources: [],
    };
}

function roleRefusal(intent: IntentId, scope: AssistantScope): SkillOutput {
    const roles = intentDefinition(intent).roles;
    const sameRoles = (group: readonly string[]) => group.length === roles.length && group.every((role) => roles.includes(role));
    const who = sameRoles(DIRECTION) ? "la direction" : sameRoles(STAFF) ? "l'équipe pédagogique" : "d'autres profils";
    return { text: `Cette information est réservée à ${who}. Voici ce que je peux faire pour vous :`, suggestions: examplesFor(scope).slice(0, 4), sources: [] };
}

function pickIntent(classification: Classification, entities: Entities, previous: AssistantContext | undefined): IntentId | null {
    const ranked = classification.ranked;
    const top = ranked[0];
    // « Bonjour, quels élèves sont à risque ? » : la demande l'emporte sur la politesse
    const request = ranked.find((entry) => !SOCIAL.has(entry.id) && entry.score >= (top && SOCIAL.has(top.id) ? 2 : 1.5));
    if (request) {
        // Le risque d'UN élève nommé = son analyse (elle contient sa probabilité d'échec)
        if (request.id === "risk.list" && entities.student) return "student.overview";
        return request.id;
    }
    if (top && SOCIAL.has(top.id)) return top.id;

    const hasStudent = Boolean(entities.student || entities.studentCandidates);
    // Suite d'une conversation : « et pour Koffi ? », « et en maths ? », « et la semaine dernière ? »
    if (previous?.intent && !SOCIAL.has(previous.intent) && HANDLERS[previous.intent]) {
        const needs = intentDefinition(previous.intent).needs;
        const fits =
            (hasStudent && (needs === "student" || OPTIONAL_STUDENT.has(previous.intent))) ||
            (entities.class && (needs === "class" || OPTIONAL_CLASS.has(previous.intent))) ||
            entities.subject ||
            entities.range ||
            entities.day ||
            entities.anaphora;
        if (fits) return previous.intent;
    }
    if (hasStudent) return "student.overview";
    if (entities.class) return "class.overview";
    return top?.id ?? null;
}

type Resolution<T> = { value?: T; clarify?: SkillOutput };

function resolveStudent(intent: IntentId, scope: AssistantScope, entities: Entities, previous: AssistantContext | undefined): Resolution<StudentRef> {
    const needed = intentDefinition(intent).needs === "student";
    if (!needed && !OPTIONAL_STUDENT.has(intent)) return {};
    if (entities.student) return { value: entities.student };

    const phrase = STUDENT_PHRASES[intent] ?? "Analyse de";
    if (entities.unknownName && !entities.studentCandidates?.length) {
        const where = scope.kind === "family" ? "vos enfants" : scope.kind === "teacher" ? "vos classes" : "l'établissement";
        return {
            clarify: {
                text: scope.user.role === "STUDENT"
                    ? "Vous ne pouvez consulter que vos propres résultats."
                    : `Je ne trouve aucun élève « ${entities.unknownName} » parmi ${where}. Vérifiez l'orthographe du nom.`,
                suggestions: scope.kind === "family" && scope.user.role !== "STUDENT" ? scope.students.map((s) => withDe(phrase, s.name)) : [],
                sources: [],
                context: { intent },
            },
        };
    }
    // « Prévision de Zoé » pendant une conversation sur Zoé Houétchénou : c'est elle
    const continuing = entities.studentCandidates?.find((s) => s.id === previous?.studentId);
    if (continuing) return { value: continuing };
    if (entities.studentCandidates?.length) {
        return {
            clarify: {
                text: "Plusieurs élèves correspondent. Lequel ?",
                suggestions: entities.studentCandidates.map((s) => `${withDe(phrase, s.name)}${s.className ? ` (${s.className})` : ""}`),
                sources: [],
                context: { intent },
            },
        };
    }
    const previousStudent = scope.students.find((s) => s.id === previous?.studentId);
    if (previousStudent && (needed || entities.anaphora)) return { value: previousStudent };
    if (!needed) return {};
    if (scope.kind === "family" && scope.students.length === 1) return { value: scope.students[0] };
    const family = scope.kind === "family";
    return {
        clarify: {
            text: family ? "Pour lequel de vos enfants ?" : "De quel élève parlez-vous ? Écrivez son nom ou son prénom.",
            // Famille : ses enfants en un clic ; équipe : jamais d'élèves pris au hasard
            suggestions: family ? scope.students.map((s) => withDe(phrase, s.name)) : [],
            sources: [],
            context: { intent },
        },
    };
}

function resolveClass(
    intent: IntentId,
    scope: AssistantScope,
    entities: Entities,
    previous: AssistantContext | undefined,
    student: StudentRef | undefined,
): Resolution<NamedRef> {
    const needed = intentDefinition(intent).needs === "class";
    if (!needed && !OPTIONAL_CLASS.has(intent)) return {};
    if (entities.class) return { value: entities.class };
    if (student) return {};
    const previousClass = scope.classes.find((c) => c.id === previous?.classId);
    if (previousClass && (needed || entities.anaphora)) return { value: previousClass };
    if (!needed) return {};
    if (scope.classes.length === 1) return { value: scope.classes[0] };
    const phrase = CLASS_PHRASES[intent] ?? "Bilan de la";
    return {
        clarify: {
            text: scope.classes.length ? "Quelle classe ?" : "Aucune classe dans votre périmètre.",
            suggestions: scope.classes.slice(0, 6).map((c) => `${phrase} ${c.name}`),
            sources: [],
            context: { intent },
        },
    };
}

function finish(output: SkillOutput, intent: AssistantAnswer["meta"]["intent"], understanding: number, startedAt: number): AssistantAnswer {
    return {
        text: output.text,
        blocks: output.blocks ?? [],
        links: output.links ?? [],
        suggestions: output.suggestions ?? [],
        context: output.context ?? {},
        meta: { intent, understanding, elapsedMs: Date.now() - startedAt, sources: output.sources },
    };
}

/** Contexte reçu du navigateur : seuls les identifiants du périmètre sont repris. */
function sanitizeContext(scope: AssistantScope, previous: AssistantContext | undefined): AssistantContext | undefined {
    if (!previous) return undefined;
    return {
        intent: previous.intent && HANDLERS[previous.intent] ? previous.intent : undefined,
        studentId: scopeHasStudent(scope, previous.studentId) ? previous.studentId : undefined,
        classId: scopeHasClass(scope, previous.classId) ? previous.classId : undefined,
        subjectId: scope.subjects.some((s) => s.id === previous.subjectId) ? previous.subjectId : undefined,
    };
}

export async function answerQuestion(
    message: string,
    user: AssistantUser,
    previousContext?: AssistantContext,
    now: Date = new Date(),
): Promise<AssistantAnswer> {
    const startedAt = Date.now();
    const scope = await loadScope(user);
    if (!scope) {
        return finish(
            { text: "L'assistant est réservé à la direction, aux enseignants, aux élèves et aux parents d'un établissement.", sources: [] },
            "unknown",
            0,
            startedAt,
        );
    }

    const previous = sanitizeContext(scope, previousContext);
    const entities = extractEntities(message, scope, now);
    if (!entities.subject && previous?.subjectId && entities.anaphora) {
        const subject = scope.subjects.find((s) => s.id === previous.subjectId);
        if (subject) entities.subject = { id: subject.id, name: subject.name };
    }
    const classification = classify(message, entities);
    const intent = pickIntent(classification, entities, previous);

    if (!intent) {
        return finish(
            {
                text: "Je n'ai pas compris la question. Essayez avec un nom d'élève, une classe ou un sujet (notes, absences, emploi du temps, devoirs, paiements) :",
                suggestions: examplesFor(scope).slice(0, 4),
                sources: [],
                context: previous ?? {},
            },
            "unknown",
            0,
            startedAt,
        );
    }

    let understanding = classification.top?.id === intent ? classification.understanding : Math.max(0.5, classification.understanding);
    // « Tu peux répéter ? » : la réponse précédente, reformulée (autres tournures)
    let resolved = intent;
    let rephrase = false;
    if (intent === "repeat" && previous?.intent && HANDLERS[previous.intent]) {
        resolved = previous.intent;
        rephrase = true;
        entities.anaphora = true;
        understanding = Math.max(understanding, 0.8);
    }
    if (SOCIAL.has(resolved)) return finish(socialAnswer(resolved, scope, message, previous), resolved, understanding, startedAt);
    return runIntent(resolved, { scope, entities, message, previous, understanding, startedAt, rephrase, userRole: user.role, now });
}

interface RunState {
    scope: AssistantScope;
    entities: Entities;
    message: string;
    previous: AssistantContext | undefined;
    understanding: number;
    startedAt: number;
    rephrase: boolean;
    userRole: string;
    now: Date;
}

async function runIntent(intent: IntentId, state: RunState): Promise<AssistantAnswer> {
    const { scope, entities, message, previous, understanding, startedAt, rephrase, userRole: role, now } = state;
    const user = { role };
    if (!roleSatisfies(user.role, intentDefinition(intent).roles)) return finish(roleRefusal(intent, scope), intent, understanding, startedAt);

    const student = resolveStudent(intent, scope, entities, previous);
    if (student.clarify) return finish(student.clarify, "clarify", understanding, startedAt);
    const klass = resolveClass(intent, scope, entities, previous, student.value);
    if (klass.clarify) return finish(klass.clarify, "clarify", understanding, startedAt);

    const handler = HANDLERS[intent];
    if (!handler) return finish(socialAnswer("help", scope), "help", understanding, startedAt);
    const output = await handler({ scope, entities, message, student: student.value, klass: klass.value, now });
    if (rephrase) {
        const voice = voiceFor(scope, message);
        output.text = `${voice.pick(["Je reformule :", "Autrement dit :", "Pour le dire autrement :"])} ${output.text.charAt(0).toLowerCase()}${output.text.slice(1)}`;
    }
    return finish(output, intent, understanding, startedAt);
}
