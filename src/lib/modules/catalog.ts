/**
 * Catalogue des modules d'EduPilot (Lot 6 — minimisation).
 *
 * Une école n'active que ce dont elle se sert : un module éteint disparaît de la
 * navigation ET ses routes d'API répondent 403. C'est ce qui permet à un
 * établissement de ne jamais détenir de données de santé, de discipline ou de
 * paie s'il n'en a pas l'usage.
 *
 * Configuration par défaut — décision du propriétaire du 2026-09-14 :
 * socle actif pour une nouvelle école (élèves, classes, notes et bulletins,
 * appel, emploi du temps, messagerie, finance) ; tout le reste est à activer
 * par l'école. Les écoles existantes gardent tous leurs modules (migration).
 *
 * Module sans dépendance (ni Prisma ni React) : lu par le serveur, par la
 * navigation et par la migration.
 */

export type ModuleId =
    | "students"
    | "classes"
    | "grades"
    | "attendance"
    | "schedule"
    | "messaging"
    | "finance"
    | "health"
    | "discipline"
    | "ai"
    | "access-control"
    | "hr"
    | "canteen"
    | "transport"
    | "courses"
    | "alumni"
    | "signature";

export interface ModuleDefinition {
    id: ModuleId;
    label: string;
    description: string;
    /** Actif dès la création d'une école. */
    defaultEnabled: boolean;
    /** Toujours actif : l'application ne fonctionne pas sans lui. */
    required?: boolean;
    /**
     * Chemins d'API couverts, relatifs à `/api/`. Comparaison par segments :
     * `"health/medical-records"` couvre `/api/health/medical-records` et ce qui
     * est dessous, jamais `/api/health` (le contrôle de santé du serveur).
     */
    apiPrefixes: string[];
    /** Chemins de page couverts, relatifs à `/dashboard/`, mêmes règles. */
    pagePrefixes: string[];
}

export const MODULES: ReadonlyArray<ModuleDefinition> = [
    // ── Socle ───────────────────────────────────────────────────────────────
    {
        id: "students",
        label: "Élèves",
        description: "Fiches des élèves, inscriptions, parents. Indispensable.",
        defaultEnabled: true,
        required: true,
        apiPrefixes: ["students", "parents"],
        pagePrefixes: ["students", "parents"],
    },
    {
        id: "classes",
        label: "Classes et matières",
        description: "Classes, niveaux, matières enseignées. Indispensable.",
        defaultEnabled: true,
        required: true,
        apiPrefixes: ["classes", "class-levels", "class-subjects", "subjects", "subject-categories"],
        pagePrefixes: ["classes"],
    },
    {
        id: "grades",
        label: "Notes et bulletins",
        description: "Saisie des notes, évaluations, bulletins, compétences.",
        defaultEnabled: true,
        apiPrefixes: ["grades", "evaluations", "evaluation-types", "bulletins", "competences", "exams", "performances", "performance"],
        pagePrefixes: ["grades", "competences", "exams", "performances"],
    },
    {
        id: "attendance",
        label: "Appel et présences",
        description: "Appel quotidien, absences, justifications.",
        defaultEnabled: true,
        apiPrefixes: ["attendance"],
        pagePrefixes: ["attendance"],
    },
    {
        id: "schedule",
        label: "Emploi du temps",
        description: "Emplois du temps, calendrier scolaire, devoirs.",
        defaultEnabled: true,
        apiPrefixes: ["schedules", "calendar", "homework", "lessons"],
        pagePrefixes: ["schedule", "schedules", "calendar", "homework"],
    },
    {
        id: "messaging",
        label: "Messagerie et annonces",
        description: "Messages, annonces, notifications, cahier de liaison.",
        defaultEnabled: true,
        apiPrefixes: ["messages", "announcements", "notifications", "liaison", "communication"],
        pagePrefixes: ["messages", "announcements", "notifications", "liaison"],
    },
    {
        id: "finance",
        label: "Finance et paiements",
        description: "Frais de scolarité, paiements, bourses, comptabilité.",
        defaultEnabled: true,
        apiPrefixes: ["fees", "finance", "payments", "payment-plans", "accounting", "scholarships", "wallet", "cagnottes"],
        pagePrefixes: ["finance", "accounting", "scholarships", "wallet", "cagnotte"],
    },

    // ── À activer par l'école ───────────────────────────────────────────────
    {
        id: "health",
        label: "Santé",
        description: "Dossiers médicaux, allergies, vaccinations, contacts d'urgence. Données sensibles : à n'activer qu'avec une infirmerie.",
        defaultEnabled: false,
        // Jamais "health" seul : /api/health est le contrôle de santé du serveur (H1).
        apiPrefixes: ["health/medical-records", "health/vaccinations", "health/emergency-contacts", "medical-records"],
        pagePrefixes: ["health", "medical"],
    },
    {
        id: "discipline",
        label: "Discipline",
        description: "Incidents, sanctions, conseils de discipline.",
        defaultEnabled: false,
        apiPrefixes: ["incidents"],
        pagePrefixes: ["discipline", "incidents"],
    },
    {
        id: "ai",
        label: "Assistant IA",
        description: "Assistant conversationnel et analyses assistées. Les données sont envoyées à un service d'IA.",
        defaultEnabled: false,
        apiPrefixes: ["ai"],
        pagePrefixes: ["ai", "ai-assistant"],
    },
    {
        id: "access-control",
        label: "Badges et contrôle d'accès",
        description: "Cartes scolaires, points de scan, journaux d'entrée et de sortie.",
        defaultEnabled: false,
        apiPrefixes: ["access-control"],
        pagePrefixes: ["access-control", "cards"],
    },
    {
        id: "hr",
        label: "Ressources humaines et paie",
        description: "Personnel, présence, congés, bulletins de paie.",
        defaultEnabled: false,
        apiPrefixes: ["staff"],
        pagePrefixes: ["staff"],
    },
    {
        id: "canteen",
        label: "Cantine",
        description: "Menus, inscriptions et facturation de la cantine.",
        defaultEnabled: false,
        apiPrefixes: ["canteen"],
        pagePrefixes: ["canteen", "cafeteria"],
    },
    {
        id: "transport",
        label: "Transport",
        description: "Circuits, arrêts et inscriptions au transport scolaire.",
        defaultEnabled: false,
        apiPrefixes: ["transport"],
        pagePrefixes: ["transport"],
    },
    {
        id: "courses",
        label: "Cours en ligne",
        description: "Cours, modules et ressources pédagogiques en ligne.",
        defaultEnabled: false,
        apiPrefixes: ["courses", "modules", "resources"],
        pagePrefixes: ["courses", "lms", "resources"],
    },
    {
        id: "alumni",
        label: "Anciens élèves",
        description: "Annuaire et suivi des anciens élèves.",
        defaultEnabled: false,
        apiPrefixes: ["alumni"],
        pagePrefixes: ["alumni"],
    },
    {
        id: "signature",
        label: "Signature électronique",
        description: "Signature des documents et attestations.",
        defaultEnabled: false,
        apiPrefixes: ["signatures"],
        pagePrefixes: ["signatures"],
    },
];

export const ALL_MODULE_IDS: ModuleId[] = MODULES.map((m) => m.id);

/** Socle d'une nouvelle école. */
export const DEFAULT_ENABLED_MODULES: ModuleId[] = MODULES.filter((m) => m.defaultEnabled).map((m) => m.id);

/** Modules que l'école ne peut pas éteindre. */
export const REQUIRED_MODULE_IDS: ModuleId[] = MODULES.filter((m) => m.required).map((m) => m.id);

export function isModuleId(value: string): value is ModuleId {
    return (ALL_MODULE_IDS as string[]).includes(value);
}

function segmentsAfter(pathname: string, base: string): string[] | null {
    const normalized = pathname.split("?")[0].replace(/\/+$/, "");
    if (normalized !== base && !normalized.startsWith(base + "/")) return null;
    const rest = normalized.slice(base.length).replace(/^\/+/, "");
    return rest ? rest.split("/") : [];
}

/** `prefix` couvre-t-il `segments` ? Comparaison segment par segment. */
function covers(prefix: string, segments: string[]): boolean {
    const parts = prefix.split("/");
    if (parts.length > segments.length) return false;
    return parts.every((part, i) => part === segments[i]);
}

function findModule(segments: string[] | null, key: "apiPrefixes" | "pagePrefixes"): ModuleDefinition | null {
    if (!segments || segments.length === 0) return null;
    return MODULES.find((m) => m[key].some((prefix) => covers(prefix, segments))) ?? null;
}

/** Module couvrant une route d'API, ou `null` si elle n'appartient à aucun module. */
export function moduleForApiPath(pathname: string): ModuleDefinition | null {
    return findModule(segmentsAfter(pathname, "/api"), "apiPrefixes");
}

/** Module couvrant une page du tableau de bord, ou `null`. */
export function moduleForPagePath(pathname: string): ModuleDefinition | null {
    return findModule(segmentsAfter(pathname, "/dashboard"), "pagePrefixes");
}

/**
 * Normalise une liste enregistrée : identifiants inconnus écartés, modules
 * requis toujours présents, ordre du catalogue.
 */
export function normalizeEnabledModules(stored: readonly string[] | null | undefined): ModuleId[] {
    const set = new Set((stored ?? []).filter(isModuleId));
    for (const id of REQUIRED_MODULE_IDS) set.add(id);
    return ALL_MODULE_IDS.filter((id) => set.has(id));
}

export function isModuleEnabled(enabled: readonly string[] | null | undefined, id: ModuleId): boolean {
    return normalizeEnabledModules(enabled).includes(id);
}
