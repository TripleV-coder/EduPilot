/**
 * Compréhension de la question — classement pondéré, sans modèle de langage.
 *
 * Chaque intention porte des déclencheurs pondérés : expressions (« emploi du
 * temps », « reste à payer ») cherchées dans le texte normalisé, et mots
 * comparés par leur racine avec tolérance aux fautes (« absance », « prévison »).
 * Les éléments reconnus (un élève, une classe) renforcent les intentions qui
 * en ont besoin, sans jamais en créer une à eux seuls.
 */
import { isStopword, normalize, similar, stem, words } from "./text";
import type { Entities, IntentId } from "./types";

type Need = "student" | "class" | null;

export interface IntentDefinition {
    id: IntentId;
    /** Rôles admis (comparés avec `roleSatisfies` : NETWORK_ADMIN hérite de SCHOOL_ADMIN). */
    roles: readonly string[];
    needs: Need;
    /** [déclencheur normalisé, poids] ; un déclencheur à plusieurs mots est une expression. */
    triggers: ReadonlyArray<readonly [string, number]>;
}

export const DIRECTION = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;
export const STAFF = [...DIRECTION, "TEACHER"] as const;
export const EVERYONE = [...STAFF, "PARENT", "STUDENT"] as const;
const FAMILY_AND_DIRECTION = [...DIRECTION, "PARENT", "STUDENT"] as const;

export const INTENTS: readonly IntentDefinition[] = [
    {
        id: "greeting",
        roles: EVERYONE,
        needs: null,
        triggers: [["bonjour", 1.2], ["salut", 1.2], ["bonsoir", 1.2], ["hello", 1.2], ["coucou", 1.2], ["hey", 1]],
    },
    {
        id: "thanks",
        roles: EVERYONE,
        needs: null,
        triggers: [["merci", 1.2], ["parfait", 0.8], ["genial", 0.8]],
    },
    {
        id: "ack",
        roles: EVERYONE,
        needs: null,
        triggers: [["d accord", 1.5], ["ok", 1.2], ["okay", 1.2], ["oui", 1], ["entendu", 1.2], ["compris", 1.2], ["super", 1], ["top", 0.8], ["tres bien", 1.2], ["bien recu", 1.5]],
    },
    {
        id: "repeat",
        roles: EVERYONE,
        needs: null,
        triggers: [
            ["repete", 3], ["repeter", 3], ["redis", 3], ["redire", 3], ["encore une fois", 3], ["reformule", 3],
            ["reformuler", 3], ["pas compris", 2.5], ["autrement", 1.5],
        ],
    },
    {
        id: "more",
        roles: EVERYONE,
        needs: null,
        triggers: [
            ["autre chose", 3], ["quoi d autre", 3], ["et ensuite", 2.5], ["la suite", 2.5], ["continue", 2.5],
            ["et apres", 2], ["en savoir plus", 3], ["que proposes tu", 3],
        ],
    },
    {
        id: "help",
        roles: EVERYONE,
        needs: null,
        triggers: [
            ["aide", 2], ["aider", 1], ["help", 2], ["que sais tu faire", 3.5], ["que peux tu faire", 3.5],
            ["tu fais quoi", 3], ["tu sers a quoi", 3.5], ["fonctionnalites", 2], ["capable", 1.5],
            ["comment ca marche", 3], ["exemples", 1.5], ["quoi demander", 3],
        ],
    },
    {
        id: "risk.list",
        roles: STAFF,
        needs: null,
        triggers: [
            ["risque", 3], ["decrochage", 3], ["decrocher", 3], ["en difficulte", 3], ["difficulte", 2],
            ["echec", 2.5], ["echouer", 2.5], ["fragile", 2], ["fragiles", 2], ["alerte", 1.5], ["redoubler", 2],
            ["redoublement", 2], ["a suivre", 2], ["prioritaire", 1.5], ["en danger", 2.5], ["surveiller", 1.5],
            ["inquietant", 2],
        ],
    },
    {
        id: "student.overview",
        roles: EVERYONE,
        needs: "student",
        triggers: [
            ["analyse", 1.5], ["analyser", 1.5], ["bilan", 1.5], ["comment va", 2.5], ["comment se porte", 2.5],
            ["situation", 1.2], ["profil", 1.5], ["niveau", 0.8], ["ou en est", 2.5], ["suivi", 0.8],
            ["point sur", 2], ["forces", 1.5], ["faiblesses", 1.5], ["rang", 1.2], ["fiche", 1],
        ],
    },
    {
        id: "student.summary",
        roles: EVERYONE,
        needs: "student",
        triggers: [
            ["resume", 3.5], ["resumer", 3.5], ["resume moi", 4], ["synthese", 2.5], ["tout sur", 3], ["point complet", 3.5],
            ["bilan complet", 3.5], ["etat des lieux", 3], ["en general", 1.5], ["globalement", 2], ["vue complete", 3],
        ],
    },
    {
        id: "student.why",
        roles: EVERYONE,
        needs: "student",
        triggers: [
            ["pourquoi", 3.5], ["comment ca se fait", 3.5], ["explique", 2.5], ["expliquer", 2.5], ["cause", 2.5],
            ["causes", 2.5], ["raison", 2.5], ["raisons", 2.5], ["qu est ce qui explique", 3.5], ["d ou vient", 3],
            ["baisse", 1.5], ["chute", 1.5], ["recule", 1.5], ["difficultes", 1],
        ],
    },
    {
        id: "student.forecast",
        roles: EVERYONE,
        needs: "student",
        triggers: [
            ["prevision", 3], ["prevoir", 3], ["predire", 3], ["prediction", 3], ["projection", 3],
            ["projeter", 2.5], ["prochain trimestre", 2.5], ["prochaine periode", 2.5], ["prochain semestre", 2.5],
            ["estimer", 2], ["estimation", 2], ["futur", 1.5], ["moyenne prevue", 3], ["va avoir", 2],
            ["pronostic", 3], ["anticiper", 2],
        ],
    },
    {
        id: "student.orientation",
        roles: EVERYONE,
        needs: "student",
        triggers: [
            ["orientation", 3], ["orienter", 3], ["serie", 2.5], ["filiere", 3], ["quelle serie", 3],
            ["carriere", 2], ["metier", 2], ["apres le bepc", 3], ["2nde", 1], ["bac", 1],
        ],
    },
    {
        id: "student.action-plan",
        roles: EVERYONE,
        needs: "student",
        triggers: [
            ["plan d action", 3.5], ["plan action", 3], ["remediation", 3], ["plan de remediation", 3.5],
            ["comment aider", 3], ["comment l aider", 3.5], ["soutien", 2], ["accompagnement", 2.5],
            ["accompagner", 2.5], ["ameliorer", 1.5], ["que faire", 2], ["actions", 1.5], ["redresser", 2.5],
        ],
    },
    {
        id: "student.comment",
        roles: STAFF,
        needs: "student",
        triggers: [
            ["appreciation", 3.5], ["commentaire", 3], ["rediger", 2], ["redige", 2], ["ecrire", 1.2],
            ["mot du bulletin", 3.5], ["observation", 2], ["bulletin", 1.2],
        ],
    },
    {
        id: "student.grades",
        roles: EVERYONE,
        needs: "student",
        triggers: [
            ["notes", 2.5], ["note", 2], ["dernieres notes", 3.5], ["mes notes", 3.5], ["interrogation", 2],
            ["composition", 2], ["evaluation", 1.5], ["devoir surveille", 2.5], ["moyenne", 1.2],
            ["resultats", 1.2],
        ],
    },
    {
        id: "class.overview",
        roles: STAFF,
        needs: "class",
        triggers: [
            ["classe", 1.2], ["niveau de la classe", 3], ["moyenne de la classe", 3], ["bilan de la classe", 3],
            ["bilan", 1.5], ["analyse", 1.5], ["niveau", 0.8], ["comment va", 1.5], ["situation", 1.2],
            ["meilleurs eleves", 2.5], ["meilleur eleve", 2.5], ["classement", 2], ["premiers", 1.5],
            ["major", 2], ["tete de classe", 3],
        ],
    },
    {
        id: "school.overview",
        roles: DIRECTION,
        needs: null,
        triggers: [
            ["ecole", 1.5], ["etablissement", 2], ["vue d ensemble", 3], ["global", 2], ["globale", 2],
            ["synthese", 2], ["bilan general", 3], ["toute l ecole", 3], ["effectif", 2], ["effectifs", 2],
            ["statistiques", 2], ["chiffres cles", 3], ["comment va l ecole", 3.5], ["indicateurs", 2.5],
        ],
    },
    {
        id: "attendance.summary",
        roles: EVERYONE,
        needs: null,
        triggers: [
            ["absence", 3], ["absences", 3], ["absent", 3], ["absents", 3], ["absenteisme", 3], ["retard", 2.5],
            ["retards", 2.5], ["presence", 2.5], ["assiduite", 3], ["appel", 1.5], ["qui manque", 3],
            ["pas venu", 3], ["justificatif", 2],
        ],
    },
    {
        id: "schedule.day",
        roles: EVERYONE,
        needs: null,
        triggers: [
            ["emploi du temps", 4], ["edt", 3], ["horaire", 2.5], ["horaires", 2.5], ["planning", 2.5],
            ["cours", 1.5], ["quels cours", 3], ["a quelle heure", 3], ["salle", 1.2], ["programme", 1.2],
        ],
    },
    {
        id: "homework.upcoming",
        roles: EVERYONE,
        needs: null,
        triggers: [
            ["devoir", 2.5], ["devoirs", 3], ["devoirs a rendre", 3.5], ["a rendre", 2.5], ["a faire", 1.2],
            ["exercice", 2], ["exercices", 2], ["travail a la maison", 3], ["rendre", 1.2],
        ],
    },
    {
        id: "finance.balance",
        roles: FAMILY_AND_DIRECTION,
        needs: null,
        triggers: [
            ["paiement", 2.5], ["paiements", 2.5], ["payer", 2.5], ["paye", 2], ["frais", 2.5], ["scolarite", 2.5],
            ["solde", 3], ["reste a payer", 4], ["reste", 1.5], ["impaye", 3.5], ["impayes", 3.5], ["dette", 2.5],
            ["argent", 2], ["facture", 2], ["montant", 1.5], ["echeance", 2.5], ["echeances", 2.5],
            ["recouvrement", 3], ["encaisse", 2.5], ["encaissement", 2.5], ["tranche", 2], ["contribution", 1.5],
            ["combien je dois", 4], ["combien dois je", 4],
        ],
    },
    {
        id: "navigate",
        roles: EVERYONE,
        needs: null,
        triggers: [
            ["ou trouver", 3], ["ou se trouve", 3], ["ou puis je", 3], ["ou je peux", 3], ["comment faire", 2],
            ["comment saisir", 3], ["comment ajouter", 3], ["comment creer", 3], ["comment envoyer", 3],
            ["comment inscrire", 3], ["comment modifier", 3], ["comment imprimer", 3], ["page", 1.2],
            ["menu", 1.5], ["acceder", 2], ["trouver", 1.2], ["ou est", 1.5], ["comment", 0.6],
        ],
    },
];

const DEFINITIONS = new Map(INTENTS.map((intent) => [intent.id, intent]));

export function intentDefinition(id: IntentId): IntentDefinition {
    const definition = DEFINITIONS.get(id);
    if (!definition) throw new Error(`Intention inconnue : ${id}`);
    return definition;
}

/** Tous les mots déclencheurs : jamais pris pour un nom d'élève. */
export const TRIGGER_VOCABULARY: ReadonlySet<string> = new Set(
    INTENTS.flatMap((intent) => intent.triggers.flatMap(([trigger]) => trigger.split(" "))),
);

export interface IntentScore {
    id: IntentId;
    score: number;
}

export interface Classification {
    ranked: IntentScore[];
    top: IntentScore | null;
    /** 0-1 : force de la meilleure intention et écart avec la suivante. */
    understanding: number;
}

/** Vrai si l'expression apparaît mot pour mot dans le texte normalisé. */
function containsPhrase(text: string, phrase: string): boolean {
    return ` ${text} `.includes(` ${phrase} `);
}

function matchesWord(queryWords: readonly string[], queryStems: readonly string[], trigger: string): boolean {
    const triggerStem = stem(trigger);
    for (let i = 0; i < queryWords.length; i++) {
        if (queryWords[i] === trigger || queryStems[i] === triggerStem) return true;
        // Pas de tolérance aux fautes sur les mots-outils : « cette » n'est pas « dette »
        if (trigger.length >= 5 && !isStopword(queryWords[i]) && (similar(queryWords[i], trigger) || similar(queryStems[i], triggerStem))) {
            return true;
        }
    }
    return false;
}

export function classify(message: string, entities: Entities): Classification {
    const text = normalize(message);
    const queryWords = words(message);
    const queryStems = queryWords.map(stem);

    const ranked: IntentScore[] = INTENTS.map((intent) => {
        let score = 0;
        // Un même mot n'est compté qu'une fois (« note » et « notes », « absent » et « absence »)
        const counted = new Map<string, number>();
        for (const [trigger, weight] of intent.triggers) {
            if (trigger.includes(" ")) {
                if (containsPhrase(text, trigger)) score += weight;
            } else if (matchesWord(queryWords, queryStems, trigger)) {
                const root = stem(trigger);
                counted.set(root, Math.max(counted.get(root) ?? 0, weight));
            }
        }
        for (const weight of counted.values()) score += weight;
        // Un élément reconnu soutient l'intention qui en a besoin, sans la créer seul
        if (score > 0 && intent.needs === "student" && (entities.student || entities.studentCandidates)) score += 1.5;
        if (score > 0 && intent.needs === "class" && entities.class) score += 1.5;
        return { id: intent.id, score };
    })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);

    const top = ranked[0] ?? null;
    if (!top) return { ranked, top: null, understanding: 0 };

    const second = ranked[1]?.score ?? 0;
    const strength = Math.min(1, top.score / 3);
    const margin = top.score / (top.score + second);
    return { ranked, top, understanding: Math.round(strength * margin * 100) / 100 };
}
