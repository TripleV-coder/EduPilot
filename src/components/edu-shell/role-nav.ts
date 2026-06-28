// EduPilot — role-based primary navigation for the EduSidebar.
// Les features sont GROUPÉES du global au spécifique au niveau : d'abord les
// groupes thématiques communs à tous les cycles, puis les groupes propres à un
// cycle (Primaire / Collège / Lycée) — ces derniers masqués quand l'école
// n'offre pas le cycle (cf. School.offeredLevels). Cela évite de mélanger les
// features et d'afficher des entrées inutiles selon le niveau.
// Hrefs target real existing routes ; counts come live from
// /api/dashboard/nav-counts (badges élève : pas de modèle Prisma, le lien
// s'affiche sans compteur).

import type { IconName } from "@/components/edu";

export type Cycle = "PRIMARY" | "SECONDARY_COLLEGE" | "SECONDARY_LYCEE";

export interface NavLink {
    icon: IconName;
    label: string;
    href: string;
    countKey?: keyof NavCounts;
    matchPrefix?: boolean;
    /** Masqué si l'école n'offre pas ce cycle (cf. School.offeredLevels). */
    requiresCycle?: Cycle;
}

export interface NavGroup {
    /** En-tête de section ; absent = groupe global sans titre (placé en tête). */
    title?: string;
    /** Groupe entier masqué si l'école n'offre pas ce cycle. */
    requiresCycle?: Cycle;
    links: NavLink[];
}

export interface NavCounts {
    students?: number;
    pendingPayments?: number;
    finance?: number;
    notifications?: number;
    children?: number;
    homework?: number;
    badges?: number;
    teacherStudents?: number;
    teacherMessages?: number;
    teacherGradeEntry?: number;
    networkSchools?: number;
    networkUsers?: number;
    networkAlerts?: number;
}

export const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    SCHOOL_ADMIN: "Direction",
    DIRECTOR: "Directrice",
    TEACHER: "Enseignant",
    STUDENT: "Élève",
    PARENT: "Parent",
    ACCOUNTANT: "Comptabilité",
    STAFF: "Vie scolaire",
};

/**
 * Source de vérité : la navigation groupée par rôle, du global au spécifique.
 * Les rôles sans features dépendantes du cycle renvoient un unique groupe sans
 * titre (rendu à plat).
 */
export function navGroupsForRole(role: string | undefined | null): NavGroup[] {
    switch (role) {
        case "SUPER_ADMIN":
            return [
                {
                    links: [
                        { icon: "grid", label: "Vue réseau", href: "/dashboard" },
                        { icon: "school", label: "Établissements", href: "/dashboard/root-control/schools", countKey: "networkSchools", matchPrefix: true },
                        { icon: "users", label: "Utilisateurs", href: "/dashboard/users", countKey: "networkUsers", matchPrefix: true },
                    ],
                },
                {
                    title: "Pilotage réseau",
                    links: [
                        { icon: "money", label: "Finance consolidée", href: "/dashboard/finance", matchPrefix: true },
                        { icon: "chart", label: "Analytics BI", href: "/dashboard/analytics", matchPrefix: true },
                        { icon: "trophy", label: "Benchmark MEMP", href: "/dashboard/benchmark", matchPrefix: true },
                        { icon: "bell", label: "Alertes", href: "/dashboard/alerts", countKey: "networkAlerts", matchPrefix: true },
                        { icon: "settings", label: "Configuration", href: "/dashboard/settings", matchPrefix: true },
                    ],
                },
            ];

        case "DIRECTOR":
        case "SCHOOL_ADMIN":
            return [
                {
                    links: [
                        { icon: "home", label: "Vue d'ensemble", href: "/dashboard" },
                        { icon: "school", label: "Établissement", href: "/dashboard/schools", matchPrefix: true },
                    ],
                },
                {
                    title: "Scolarité",
                    links: [
                        { icon: "users", label: "Élèves", href: "/dashboard/students", countKey: "students", matchPrefix: true },
                        { icon: "plus", label: "Inscriptions", href: "/dashboard/students/inscription" },
                        { icon: "book", label: "Pédagogie", href: "/dashboard/courses", matchPrefix: true },
                        { icon: "cards", label: "Conseil de classe", href: "/dashboard/grades/councils", matchPrefix: true },
                        { icon: "grid", label: "Compétences MEMP", href: "/dashboard/competences", matchPrefix: true },
                    ],
                },
                {
                    title: "Finance",
                    links: [
                        { icon: "money", label: "Finance", href: "/dashboard/finance", countKey: "finance", matchPrefix: true },
                        { icon: "money", label: "Wallet & banques", href: "/dashboard/wallet", matchPrefix: true },
                        { icon: "cards", label: "Comptabilité OHADA", href: "/dashboard/accounting", matchPrefix: true },
                    ],
                },
                {
                    title: "Vie scolaire",
                    links: [
                        { icon: "calendar", label: "Vie scolaire", href: "/dashboard/calendar", matchPrefix: true },
                        { icon: "sparkle", label: "Bien-être & écoute", href: "/dashboard/wellbeing", matchPrefix: true },
                        { icon: "school", label: "Transport scolaire", href: "/dashboard/transport", matchPrefix: true },
                    ],
                },
                {
                    title: "Pilotage & communication",
                    links: [
                        { icon: "chart", label: "Analytics", href: "/dashboard/analytics", matchPrefix: true },
                        { icon: "trophy", label: "Benchmark MEMP", href: "/dashboard/benchmark", matchPrefix: true },
                        { icon: "bell", label: "Communication", href: "/dashboard/announcements", countKey: "notifications", matchPrefix: true },
                        { icon: "sms", label: "Vocal multilingue", href: "/dashboard/voice-notifs", matchPrefix: true },
                        { icon: "settings", label: "Paramètres", href: "/dashboard/settings", matchPrefix: true },
                    ],
                },
                {
                    title: "Cycle Primaire",
                    requiresCycle: "PRIMARY",
                    links: [
                        { icon: "book", label: "Passage CEP (CM2)", href: "/dashboard/orientation/cep", matchPrefix: true, requiresCycle: "PRIMARY" },
                    ],
                },
                {
                    title: "Cycle Collège",
                    requiresCycle: "SECONDARY_COLLEGE",
                    links: [
                        { icon: "book", label: "Préparation BEPC", href: "/dashboard/bepc-prep", matchPrefix: true, requiresCycle: "SECONDARY_COLLEGE" },
                        { icon: "school", label: "Orientation post-BEPC", href: "/dashboard/orientation/post-bepc", matchPrefix: true, requiresCycle: "SECONDARY_COLLEGE" },
                    ],
                },
            ];

        case "TEACHER":
            return [
                {
                    links: [
                        { icon: "home", label: "Mes classes", href: "/dashboard" },
                        { icon: "users", label: "Mes élèves", href: "/dashboard/students", countKey: "teacherStudents", matchPrefix: true },
                    ],
                },
                {
                    title: "Pédagogie",
                    links: [
                        { icon: "book", label: "Cahier de textes", href: "/dashboard/grades/cahier", matchPrefix: true },
                        { icon: "pencil", label: "Saisie de notes", href: "/dashboard/grades/entry", countKey: "teacherGradeEntry", matchPrefix: true },
                        { icon: "cards", label: "Conseil de classe", href: "/dashboard/grades/councils", matchPrefix: true },
                        { icon: "grid", label: "Compétences MEMP", href: "/dashboard/competences", matchPrefix: true },
                        { icon: "check", label: "Appel d'aujourd'hui", href: "/dashboard/attendance", matchPrefix: true },
                        { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true },
                    ],
                },
                {
                    title: "Communication",
                    links: [
                        { icon: "bell", label: "Messages", href: "/dashboard/messages", countKey: "teacherMessages", matchPrefix: true },
                        { icon: "sparkle", label: "Assistant IA", href: "/dashboard/ai-assistant", matchPrefix: true },
                    ],
                },
            ];

        case "PARENT":
            return [
                {
                    links: [
                        { icon: "home", label: "Accueil", href: "/dashboard" },
                        { icon: "users", label: "Mes enfants", href: "/dashboard/students", countKey: "children", matchPrefix: true },
                        { icon: "book", label: "Cahier de liaison", href: "/dashboard/liaison", matchPrefix: true },
                        { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true },
                    ],
                },
                {
                    title: "Finance",
                    links: [
                        { icon: "money", label: "Paiements", href: "/dashboard/finance", countKey: "pendingPayments", matchPrefix: true },
                        { icon: "sparkle", label: "Cagnottes & pots communs", href: "/dashboard/cagnotte", matchPrefix: true },
                    ],
                },
                {
                    title: "Communication",
                    links: [
                        { icon: "bell", label: "Notifications", href: "/dashboard/notifications", countKey: "notifications", matchPrefix: true },
                        { icon: "sms", label: "Messagerie école", href: "/dashboard/messages", matchPrefix: true },
                        { icon: "settings", label: "Mon compte", href: "/dashboard/settings", matchPrefix: true },
                    ],
                },
            ];

        case "STUDENT":
            return [
                {
                    links: [
                        { icon: "home", label: "Mon tableau", href: "/dashboard" },
                        { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true },
                        { icon: "users", label: "Ma classe", href: "/dashboard/classes", matchPrefix: true },
                    ],
                },
                {
                    title: "Scolarité",
                    links: [
                        { icon: "pencil", label: "Mes notes", href: "/dashboard/grades", matchPrefix: true },
                        { icon: "book", label: "Devoirs", href: "/dashboard/homework", countKey: "homework", matchPrefix: true },
                        { icon: "sparkle", label: "Mon orientation", href: "/dashboard/orientation/me", matchPrefix: true },
                        { icon: "trophy", label: "Mes badges", href: "/dashboard/gamification", countKey: "badges", matchPrefix: true },
                    ],
                },
                {
                    title: "Communication",
                    links: [
                        { icon: "sms", label: "Messagerie", href: "/dashboard/messages", matchPrefix: true },
                    ],
                },
            ];

        case "ACCOUNTANT":
            return [
                {
                    links: [
                        { icon: "home", label: "Vue d'ensemble", href: "/dashboard" },
                        { icon: "users", label: "Élèves", href: "/dashboard/students", matchPrefix: true },
                    ],
                },
                {
                    title: "Finance",
                    links: [
                        { icon: "money", label: "Finance", href: "/dashboard/finance", matchPrefix: true },
                        { icon: "money", label: "Wallet & banques", href: "/dashboard/wallet", matchPrefix: true },
                        { icon: "cards", label: "Comptabilité OHADA", href: "/dashboard/accounting", matchPrefix: true },
                        { icon: "chart", label: "Reporting", href: "/dashboard/analytics", matchPrefix: true },
                    ],
                },
                {
                    title: "Paramètres",
                    links: [
                        { icon: "settings", label: "Paramètres", href: "/dashboard/settings", matchPrefix: true },
                    ],
                },
            ];

        case "STAFF":
        default:
            return [
                {
                    links: [
                        { icon: "home", label: "Accueil", href: "/dashboard" },
                        { icon: "users", label: "Élèves", href: "/dashboard/students", matchPrefix: true },
                        { icon: "calendar", label: "Vie scolaire", href: "/dashboard/calendar", matchPrefix: true },
                        { icon: "bell", label: "Communication", href: "/dashboard/announcements", matchPrefix: true },
                        { icon: "settings", label: "Paramètres", href: "/dashboard/settings", matchPrefix: true },
                    ],
                },
            ];
    }
}

/**
 * Liste à plat des liens d'un rôle (tous cycles confondus). Conservée pour les
 * consommateurs qui n'affichent pas de sections (ex. command palette).
 */
export function navForRole(role: string | undefined | null): NavLink[] {
    return navGroupsForRole(role).flatMap((g) => g.links);
}

/**
 * Groupes visibles pour un rôle compte tenu des cycles offerts par l'école.
 * Défaut SÛR : tant que offeredLevels est vide (chargement / non configuré),
 * tout est affiché — on ne masque jamais hâtivement une section.
 * Masque les groupes de cycle non offert ET, à l'intérieur d'un groupe, les
 * liens tagués pour un cycle non offert. Les groupes devenus vides sont retirés.
 */
export function visibleNavGroups(
    role: string | undefined | null,
    offeredLevels: string[] | undefined | null
): NavGroup[] {
    const groups = navGroupsForRole(role);
    if (!offeredLevels || offeredLevels.length === 0) return groups;

    return groups
        .filter((g) => !g.requiresCycle || offeredLevels.includes(g.requiresCycle))
        .map((g) => ({
            ...g,
            links: g.links.filter((l) => !l.requiresCycle || offeredLevels.includes(l.requiresCycle)),
        }))
        .filter((g) => g.links.length > 0);
}

export function isActiveLink(pathname: string, link: NavLink): boolean {
    if (!pathname) return false;
    if (link.matchPrefix) return pathname === link.href || pathname.startsWith(link.href + "/");
    return pathname === link.href;
}
