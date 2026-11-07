/**
 * Reconnaissance des éléments d'une question : élève, classe, matière,
 * période, jour. Seuls les élèves et classes du périmètre de la personne
 * peuvent être reconnus : un nom hors périmètre n'est tout simplement pas trouvé.
 */
import { TRIGGER_VOCABULARY } from "./intents";
import type { AssistantScope } from "./scope";
import { compact, isStopword, normalize, similar, words } from "./text";
import type { Entities, NamedRef, StudentRef, TimeRange } from "./types";

/** Le Bénin est en UTC+1 toute l'année ; les dates d'appel sont des jours à minuit UTC. */
const LOCAL_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Minuit UTC du jour calendaire local de `now`. */
export function localDay(now: Date): Date {
    const local = new Date(now.getTime() + LOCAL_OFFSET_MS);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;

/** Mots qui ne désignent jamais un élève, même s'ils ressemblent à un prénom. */
const NOT_NAMES = new Set<string>([
    ...DAY_NAMES, "aujourd", "hui", "hier", "demain", "semaine", "mois", "trimestre", "semestre", "annee",
    "derniere", "dernier", "derniers", "jours", "passee", "passe", "prochain", "prochaine", "eleve", "eleves",
    "enfant", "enfants", "fils", "fille", "classe", "classes", "matiere", "matieres", "moyenne", "apres",
    "quand", "combien", "quoi", "comment", "pourquoi", "matin", "soir",
]);

const ANAPHORA = /\b(son|sa|ses|lui|cet eleve|cette eleve|cet enfant|cette classe|la meme|le meme|il|elle)\b/;

/** Abréviations courantes vers le début normalisé du nom ou du code de matière. */
const SUBJECT_ALIASES: Record<string, string> = {
    maths: "math", math: "math", mathematiques: "math", francais: "franc", anglais: "angl", svt: "svt",
    pct: "pct", physique: "phys", chimie: "chim", eps: "eps", sport: "eps", philo: "philo",
    philosophie: "philo", histoire: "hist", geo: "geo", geographie: "geo", hg: "hist", espagnol: "esp",
    allemand: "allem", info: "info", informatique: "info", ecm: "ecm",
};

function findClass(queryWords: string[], classes: readonly NamedRef[]): NamedRef | undefined {
    let best: { ref: NamedRef; length: number } | undefined;
    for (const ref of classes) {
        const target = compact(ref.name);
        if (!target) continue;
        // Fenêtres de 1 à 3 mots : « 3e b », « 3eb », « terminale d »…
        for (let size = 1; size <= 3; size++) {
            for (let i = 0; i + size <= queryWords.length; i++) {
                if (queryWords.slice(i, i + size).join("") === target && (!best || target.length > best.length)) {
                    best = { ref, length: target.length };
                }
            }
        }
    }
    return best?.ref;
}

function findSubject(queryWords: string[], subjects: AssistantScope["subjects"]): NamedRef | undefined {
    for (const word of queryWords) {
        const alias = SUBJECT_ALIASES[word];
        for (const subject of subjects) {
            const name = normalize(subject.name);
            const code = normalize(subject.code);
            if (alias && (name.startsWith(alias) || code.startsWith(alias))) return { id: subject.id, name: subject.name };
            if (word.length >= 5 && name.split(" ").some((part) => part.length >= 5 && similar(part, word))) {
                return { id: subject.id, name: subject.name };
            }
            if (word.length >= 3 && word === code) return { id: subject.id, name: subject.name };
        }
    }
    return undefined;
}

/** Mots de la question qui peuvent être un nom propre. */
function nameCandidates(queryWords: string[], excluded: Set<string>): string[] {
    return queryWords.filter(
        (word) =>
            word.length >= 3 &&
            !/\d/.test(word) &&
            !isStopword(word) &&
            !NOT_NAMES.has(word) &&
            !TRIGGER_VOCABULARY.has(word) &&
            !excluded.has(word),
    );
}

function findStudents(candidates: string[], students: readonly StudentRef[]): StudentRef[] {
    if (candidates.length === 0) return [];
    let bestScore = 0;
    let best: StudentRef[] = [];
    for (const student of students) {
        const nameWords = words(student.name).filter((word) => word.length >= 2);
        let score = 0;
        for (const part of nameWords) {
            if (candidates.includes(part)) score += 2;
            else if (part.length >= 5 && candidates.some((candidate) => similar(candidate, part))) score += 1.5;
        }
        if (score === 0) continue;
        if (score > bestScore) {
            bestScore = score;
            best = [student];
        } else if (score === bestScore) {
            best.push(student);
        }
    }
    return best;
}

function findRange(text: string, now: Date): TimeRange | undefined {
    const today = localDay(now);
    const endOfToday = new Date(today.getTime() + DAY_MS - 1);
    const has = (phrase: string) => ` ${text} `.includes(` ${phrase} `);

    if (has("aujourd hui") || has("ce jour") || has("ce matin")) return { from: today, to: endOfToday, label: "aujourd'hui" };
    if (has("hier")) {
        return { from: new Date(today.getTime() - DAY_MS), to: new Date(today.getTime() - 1), label: "hier" };
    }
    // Semaine du lundi au jour courant
    const weekday = (today.getUTCDay() + 6) % 7;
    const monday = new Date(today.getTime() - weekday * DAY_MS);
    if (has("semaine derniere") || has("semaine passee")) {
        return { from: new Date(monday.getTime() - 7 * DAY_MS), to: new Date(monday.getTime() - 1), label: "la semaine dernière" };
    }
    if (has("cette semaine") || has("la semaine")) return { from: monday, to: endOfToday, label: "cette semaine" };
    const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    if (has("mois dernier") || has("mois passe")) {
        const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
        return { from, to: new Date(firstOfMonth.getTime() - 1), label: "le mois dernier" };
    }
    if (has("ce mois") || has("du mois")) return { from: firstOfMonth, to: endOfToday, label: "ce mois-ci" };
    const days = /\b(\d{1,3}) derniers jours\b/.exec(text);
    if (days) {
        const count = Math.min(365, Math.max(1, Number(days[1])));
        return { from: new Date(today.getTime() - (count - 1) * DAY_MS), to: endOfToday, label: `les ${count} derniers jours` };
    }
    return undefined;
}

function findDay(text: string, now: Date): Entities["day"] {
    const today = localDay(now).getUTCDay();
    const has = (phrase: string) => ` ${text} `.includes(` ${phrase} `);
    if (has("apres demain")) return { dayOfWeek: (today + 2) % 7, label: "après-demain" };
    if (has("demain")) return { dayOfWeek: (today + 1) % 7, label: "demain" };
    for (let index = 0; index < DAY_NAMES.length; index++) {
        if (has(DAY_NAMES[index])) return { dayOfWeek: index, label: DAY_NAMES[index] };
    }
    if (has("aujourd hui")) return { dayOfWeek: today, label: "aujourd'hui" };
    return undefined;
}

export function extractEntities(message: string, scope: AssistantScope, now: Date = new Date()): Entities {
    const text = normalize(message);
    const queryWords = words(message);

    const klass = findClass(queryWords, scope.classes);
    const subject = findSubject(queryWords, scope.subjects);
    const excluded = new Set([...(klass ? words(klass.name) : []), ...(subject ? words(subject.name) : [])]);
    for (const [alias] of Object.entries(SUBJECT_ALIASES)) excluded.add(alias);

    const matches = findStudents(nameCandidates(queryWords, excluded), scope.students);

    const entities: Entities = {
        class: klass,
        subject,
        range: findRange(text, now),
        day: findDay(text, now),
        anaphora: ANAPHORA.test(text),
    };
    if (matches.length === 1) entities.student = matches[0];
    else if (matches.length > 1) entities.studentCandidates = matches.slice(0, 6);
    return entities;
}
