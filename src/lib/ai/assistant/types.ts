/**
 * Contrat de l'assistant local : une question en français → une réponse
 * calculée sur les données réelles de l'école, sans modèle de langage.
 */

export type IntentId =
    | "greeting"
    | "help"
    | "thanks"
    | "ack"
    | "repeat"
    | "more"
    | "student.summary"
    | "student.why"
    | "risk.list"
    | "student.overview"
    | "student.forecast"
    | "student.orientation"
    | "student.action-plan"
    | "student.comment"
    | "student.grades"
    | "class.overview"
    | "school.overview"
    | "attendance.summary"
    | "schedule.day"
    | "homework.upcoming"
    | "finance.balance"
    | "navigate";

/** Ce que l'assistant a compris d'un tour, réutilisé au tour suivant (« et sa prévision ? »). */
export interface AssistantContext {
    intent?: IntentId;
    studentId?: string;
    classId?: string;
    subjectId?: string;
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export type AnswerBlock =
    | { type: "metrics"; items: Array<{ label: string; value: string; tone?: Tone; hint?: string }> }
    | {
          type: "table";
          title?: string;
          columns: string[];
          rows: Array<{ cells: string[]; href?: string; tone?: Tone }>;
      }
    | { type: "list"; title?: string; items: Array<{ label: string; detail?: string; href?: string; tone?: Tone }> }
    | { type: "quote"; title?: string; text: string }
    /** Paragraphe de texte après les autres blocs (conclusion) ; gras `**…**` interprété. */
    | { type: "text"; text: string };

export interface AssistantAnswer {
    /** Texte principal ; seul le gras `**…**` et les sauts de ligne sont interprétés. */
    text: string;
    blocks: AnswerBlock[];
    links: Array<{ label: string; href: string }>;
    /** Questions suivantes proposées en un clic. */
    suggestions: string[];
    context: AssistantContext;
    meta: {
        intent: IntentId | "unknown" | "clarify";
        /** Confiance de la compréhension de la question (0-1), pas de la réponse. */
        understanding: number;
        elapsedMs: number;
        /** Données réellement lues pour répondre (traçabilité). */
        sources: string[];
    };
}

export interface AssistantUser {
    id: string;
    role: string;
    schoolId: string | null;
    firstName?: string | null;
}

export type TimeRange = { from: Date; to: Date; label: string };

export interface NamedRef {
    id: string;
    name: string;
}

export interface StudentRef extends NamedRef {
    className: string | null;
}

/** Éléments reconnus dans la question. */
export interface Entities {
    student?: StudentRef;
    /** Plusieurs élèves correspondent : l'assistant demande lequel. */
    studentCandidates?: StudentRef[];
    class?: NamedRef;
    subject?: NamedRef;
    range?: TimeRange;
    /** Jour visé pour l'emploi du temps (0 = dimanche … 6 = samedi). */
    day?: { dayOfWeek: number; label: string };
    /** Nom propre écrit dans la question mais introuvable dans le périmètre (« analyse de Patrick Chabi » pour un parent). */
    unknownName?: string;
    /** Le message renvoie à l'élève ou à la classe du tour précédent (« son », « sa », « cette classe »). */
    anaphora: boolean;
}
