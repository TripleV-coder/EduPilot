// EduPilot — role-based primary navigation for the EduSidebar.
// Parcours réduits à 5–8 actions clés par rôle ; les fonctions secondaires
// restent accessibles via le tableau de bord, la palette de commandes ou la
// recherche. Hrefs ciblent des routes existantes ; compteurs via
// /api/dashboard/nav-counts.

import type { IconName } from "@/components/edu";
import type { ModuleId } from "@/lib/modules/catalog";

export type Cycle = "PRIMARY" | "SECONDARY_COLLEGE" | "SECONDARY_LYCEE";

export interface NavLink {
    icon: IconName;
    label: string;
    href: string;
    countKey?: keyof NavCounts;
    matchPrefix?: boolean;
    /** Masqué si l'école n'offre pas ce cycle (cf. School.offeredLevels). */
    requiresCycle?: Cycle;
    /** Masqué si l'école n'a pas activé ce module (cf. School.enabledModules, Lot 6). */
    requiresModule?: ModuleId;
}

export interface NavGroup {
    /** En-tête de section ; absent = groupe global sans titre (placé en tête). */
    title?: string;
    /** Groupe entier masqué si l'école n'offre pas ce cycle. */
    requiresCycle?: Cycle;
    /** Groupe entier masqué si l'école n'a pas activé ce module. */
    requiresModule?: ModuleId;
    links: NavLink[];
}

/** Lien Assistant IA — source unique pour sidebar, mobile et palette. */
export const AI_ASSISTANT_NAV_LINK: NavLink = {
    icon: "sparkle",
    label: "Assistant IA",
    href: "/dashboard/ai-assistant",
    matchPrefix: true,
    requiresModule: "ai",
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
    NETWORK_ADMIN: "Admin réseau",
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
                        { icon: "users", label: "Élèves", href: "/dashboard/students", countKey: "students", matchPrefix: true, requiresModule: "students" },
                        { icon: "pencil", label: "Notes & bulletins", href: "/dashboard/grades", matchPrefix: true, requiresModule: "grades" },
                        { icon: "check", label: "Appel", href: "/dashboard/attendance", matchPrefix: true, requiresModule: "attendance" },
                        { icon: "money", label: "Finance", href: "/dashboard/finance", countKey: "finance", matchPrefix: true, requiresModule: "finance" },
                        { icon: "bell", label: "Messages", href: "/dashboard/messages", countKey: "notifications", matchPrefix: true, requiresModule: "messaging" },
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
                        { icon: "users", label: "Mes élèves", href: "/dashboard/students", countKey: "teacherStudents", matchPrefix: true, requiresModule: "students" },
                        { icon: "pencil", label: "Saisie de notes", href: "/dashboard/grades/entry", countKey: "teacherGradeEntry", matchPrefix: true, requiresModule: "grades" },
                        { icon: "book", label: "Cahier de textes", href: "/dashboard/grades/cahier", matchPrefix: true, requiresModule: "grades" },
                        { icon: "check", label: "Appel du jour", href: "/dashboard/attendance", matchPrefix: true, requiresModule: "attendance" },
                        { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true, requiresModule: "schedule" },
                        { icon: "bell", label: "Messages", href: "/dashboard/messages", countKey: "teacherMessages", matchPrefix: true, requiresModule: "messaging" },
                        AI_ASSISTANT_NAV_LINK,
                    ],
                },
            ];

        case "PARENT":
            return [
                {
                    links: [
                        { icon: "home", label: "Accueil", href: "/dashboard" },
                        { icon: "users", label: "Mes enfants", href: "/dashboard/students", countKey: "children", matchPrefix: true, requiresModule: "students" },
                        { icon: "book", label: "Cahier de liaison", href: "/dashboard/liaison", matchPrefix: true, requiresModule: "messaging" },
                        { icon: "money", label: "Paiements", href: "/dashboard/finance", countKey: "pendingPayments", matchPrefix: true, requiresModule: "finance" },
                        { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true, requiresModule: "schedule" },
                        { icon: "bell", label: "Notifications", href: "/dashboard/notifications", countKey: "notifications", matchPrefix: true, requiresModule: "messaging" },
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
                        { icon: "pencil", label: "Mes notes", href: "/dashboard/grades", matchPrefix: true, requiresModule: "grades" },
                        { icon: "book", label: "Devoirs", href: "/dashboard/homework", countKey: "homework", matchPrefix: true, requiresModule: "schedule" },
                        { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true, requiresModule: "schedule" },
                        { icon: "users", label: "Ma classe", href: "/dashboard/classes", matchPrefix: true, requiresModule: "classes" },
                        { icon: "sparkle", label: "Mon orientation", href: "/dashboard/orientation/me", matchPrefix: true },
                        { icon: "sms", label: "Messagerie", href: "/dashboard/messages", matchPrefix: true, requiresModule: "messaging" },
                        AI_ASSISTANT_NAV_LINK,
                    ],
                },
            ];

        case "ACCOUNTANT":
            return [
                {
                    links: [
                        { icon: "home", label: "Vue d'ensemble", href: "/dashboard" },
                        { icon: "users", label: "Élèves", href: "/dashboard/students", matchPrefix: true, requiresModule: "students" },
                        { icon: "money", label: "Finance", href: "/dashboard/finance", matchPrefix: true, requiresModule: "finance" },
                        { icon: "money", label: "Portefeuille", href: "/dashboard/wallet", matchPrefix: true, requiresModule: "finance" },
                        { icon: "cards", label: "Comptabilité OHADA", href: "/dashboard/accounting", matchPrefix: true, requiresModule: "finance" },
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
                        { icon: "users", label: "Élèves", href: "/dashboard/students", matchPrefix: true, requiresModule: "students" },
                        { icon: "calendar", label: "Vie scolaire", href: "/dashboard/calendar", matchPrefix: true, requiresModule: "schedule" },
                        { icon: "bell", label: "Communication", href: "/dashboard/announcements", matchPrefix: true, requiresModule: "messaging" },
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
    offeredLevels: string[] | undefined | null,
    enabledModules?: string[] | null
): NavGroup[] {
    const groups = navGroupsForRole(role);
    const filterCycle = Boolean(offeredLevels && offeredLevels.length > 0);
    // Tant que les modules ne sont pas connus (session en cours de chargement),
    // rien n'est masqué : l'API reste, elle, la garde réelle (Lot 6).
    const filterModule = Boolean(enabledModules && enabledModules.length > 0);
    if (!filterCycle && !filterModule) return groups;

    const cycleOk = (c?: Cycle) => !filterCycle || !c || offeredLevels!.includes(c);
    const moduleOk = (m?: ModuleId) => !filterModule || !m || enabledModules!.includes(m);

    return groups
        .filter((g) => cycleOk(g.requiresCycle) && moduleOk(g.requiresModule))
        .map((g) => ({
            ...g,
            links: g.links.filter((l) => cycleOk(l.requiresCycle) && moduleOk(l.requiresModule)),
        }))
        .filter((g) => g.links.length > 0);
}

export function isActiveLink(pathname: string, link: NavLink): boolean {
    if (!pathname) return false;
    if (link.matchPrefix) return pathname === link.href || pathname.startsWith(link.href + "/");
    return pathname === link.href;
}
