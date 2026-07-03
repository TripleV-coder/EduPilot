// EduPilot — role-based primary navigation for the EduSidebar.
// Parcours réduits à 5–8 actions clés par rôle ; les fonctions secondaires
// restent accessibles via le tableau de bord, la palette de commandes ou la
// recherche. Hrefs ciblent des routes existantes ; compteurs via
// /api/dashboard/nav-counts.

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

/** Lien Assistant IA — source unique pour sidebar, mobile et palette. */
export const AI_ASSISTANT_NAV_LINK: NavLink = {
    icon: "sparkle",
    label: "Assistant IA",
    href: "/dashboard/ai-assistant",
    matchPrefix: true,
};

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
 * Source de vérité : navigation groupée par rôle, limitée à 5–8 actions clés.
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
                        { icon: "money", label: "Finance consolidée", href: "/dashboard/finance", matchPrefix: true },
                        { icon: "chart", label: "Analyses réseau", href: "/dashboard/analytics", matchPrefix: true },
                        { icon: "bell", label: "Alertes", href: "/dashboard/alerts", countKey: "networkAlerts", matchPrefix: true },
                        AI_ASSISTANT_NAV_LINK,
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
                        { icon: "users", label: "Élèves", href: "/dashboard/students", countKey: "students", matchPrefix: true },
                        { icon: "pencil", label: "Notes & bulletins", href: "/dashboard/grades", matchPrefix: true },
                        { icon: "check", label: "Appel", href: "/dashboard/attendance", matchPrefix: true },
                        { icon: "money", label: "Finance", href: "/dashboard/finance", countKey: "finance", matchPrefix: true },
                        { icon: "bell", label: "Messages", href: "/dashboard/messages", countKey: "notifications", matchPrefix: true },
                        AI_ASSISTANT_NAV_LINK,
                        { icon: "settings", label: "Paramètres", href: "/dashboard/settings", matchPrefix: true },
                    ],
                },
            ];

        case "TEACHER":
            return [
                {
                    links: [
                        { icon: "home", label: "Mes classes", href: "/dashboard" },
                        { icon: "users", label: "Mes élèves", href: "/dashboard/students", countKey: "teacherStudents", matchPrefix: true },
                        { icon: "pencil", label: "Saisie de notes", href: "/dashboard/grades/entry", countKey: "teacherGradeEntry", matchPrefix: true },
                        { icon: "book", label: "Cahier de textes", href: "/dashboard/grades/cahier", matchPrefix: true },
                        { icon: "check", label: "Appel du jour", href: "/dashboard/attendance", matchPrefix: true },
                        { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true },
                        { icon: "bell", label: "Messages", href: "/dashboard/messages", countKey: "teacherMessages", matchPrefix: true },
                        AI_ASSISTANT_NAV_LINK,
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
                        { icon: "money", label: "Paiements", href: "/dashboard/finance", countKey: "pendingPayments", matchPrefix: true },
                        { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true },
                        { icon: "bell", label: "Notifications", href: "/dashboard/notifications", countKey: "notifications", matchPrefix: true },
                        AI_ASSISTANT_NAV_LINK,
                        { icon: "settings", label: "Mon compte", href: "/dashboard/settings", matchPrefix: true },
                    ],
                },
            ];

        case "STUDENT":
            return [
                {
                    links: [
                        { icon: "home", label: "Mon tableau", href: "/dashboard" },
                        { icon: "pencil", label: "Mes notes", href: "/dashboard/grades", matchPrefix: true },
                        { icon: "book", label: "Devoirs", href: "/dashboard/homework", countKey: "homework", matchPrefix: true },
                        { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true },
                        { icon: "users", label: "Ma classe", href: "/dashboard/classes", matchPrefix: true },
                        { icon: "sparkle", label: "Mon orientation", href: "/dashboard/orientation/me", matchPrefix: true },
                        { icon: "sms", label: "Messagerie", href: "/dashboard/messages", matchPrefix: true },
                        AI_ASSISTANT_NAV_LINK,
                    ],
                },
            ];

        case "ACCOUNTANT":
            return [
                {
                    links: [
                        { icon: "home", label: "Vue d'ensemble", href: "/dashboard" },
                        { icon: "users", label: "Élèves", href: "/dashboard/students", matchPrefix: true },
                        { icon: "money", label: "Finance", href: "/dashboard/finance", matchPrefix: true },
                        { icon: "money", label: "Portefeuille", href: "/dashboard/wallet", matchPrefix: true },
                        { icon: "cards", label: "Comptabilité OHADA", href: "/dashboard/accounting", matchPrefix: true },
                        AI_ASSISTANT_NAV_LINK,
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
                        AI_ASSISTANT_NAV_LINK,
                        { icon: "settings", label: "Paramètres", href: "/dashboard/settings", matchPrefix: true },
                    ],
                },
            ];
    }
}

/**
 * Liste à plat des liens d'un rôle. Conservée pour la palette de commandes et la nav mobile.
 */
export function navForRole(role: string | undefined | null): NavLink[] {
    return navGroupsForRole(role).flatMap((g) => g.links);
}

/**
 * Groupes visibles pour un rôle compte tenu des cycles offerts par l'école.
 * Défaut sûr : tant que offeredLevels est vide, tout est affiché.
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
