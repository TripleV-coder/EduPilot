// EduPilot — role-based primary navigation for the EduSidebar.
// Maps each role to the design's primary nav. Hrefs target real existing routes;
// counts are placeholders that will be wired with live numbers progressively.

import type { IconName } from "@/components/edu";

export interface NavLink {
    icon: IconName;
    label: string;
    href: string;
    countKey?: keyof NavCounts;
    matchPrefix?: boolean;
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

export function navForRole(role: string | undefined | null): NavLink[] {
    switch (role) {
        case "SUPER_ADMIN":
            return [
                { icon: "grid", label: "Vue réseau", href: "/dashboard" },
                { icon: "school", label: "Établissements", href: "/dashboard/root-control/schools", countKey: "networkSchools", matchPrefix: true },
                { icon: "users", label: "Utilisateurs", href: "/dashboard/users", countKey: "networkUsers", matchPrefix: true },
                { icon: "money", label: "Finance consolidée", href: "/dashboard/finance", matchPrefix: true },
                { icon: "chart", label: "Analytics BI", href: "/dashboard/analytics", matchPrefix: true },
                { icon: "bell", label: "Alertes", href: "/dashboard/alerts", countKey: "networkAlerts", matchPrefix: true },
                { icon: "settings", label: "Configuration", href: "/dashboard/settings", matchPrefix: true },
            ];

        case "DIRECTOR":
        case "SCHOOL_ADMIN":
            return [
                { icon: "home", label: "Vue d'ensemble", href: "/dashboard" },
                { icon: "school", label: "Établissement", href: "/dashboard/schools", matchPrefix: true },
                { icon: "users", label: "Élèves", href: "/dashboard/students", countKey: "students", matchPrefix: true },
                { icon: "plus", label: "Inscriptions", href: "/dashboard/students/inscription" },
                { icon: "book", label: "Pédagogie", href: "/dashboard/courses", matchPrefix: true },
                { icon: "cards", label: "Conseil de classe", href: "/dashboard/grades/councils", matchPrefix: true },
                { icon: "school", label: "Orientation post-BEPC", href: "/dashboard/orientation/post-bepc", matchPrefix: true },
                { icon: "book", label: "Passage CEP (CM2)", href: "/dashboard/orientation/cep", matchPrefix: true },
                { icon: "grid", label: "Compétences MEMP", href: "/dashboard/competences", matchPrefix: true },
                { icon: "money", label: "Finance", href: "/dashboard/finance", countKey: "finance", matchPrefix: true },
                { icon: "calendar", label: "Vie scolaire", href: "/dashboard/calendar", matchPrefix: true },
                { icon: "school", label: "Transport scolaire", href: "/dashboard/transport", matchPrefix: true },
                { icon: "chart", label: "Analytics", href: "/dashboard/analytics", matchPrefix: true },
                { icon: "bell", label: "Communication", href: "/dashboard/announcements", countKey: "notifications", matchPrefix: true },
                { icon: "settings", label: "Paramètres", href: "/dashboard/settings", matchPrefix: true },
            ];

        case "TEACHER":
            return [
                { icon: "home", label: "Mes classes", href: "/dashboard" },
                { icon: "book", label: "Cahier de textes", href: "/dashboard/grades/cahier", matchPrefix: true },
                { icon: "pencil", label: "Saisie de notes", href: "/dashboard/grades/entry", countKey: "teacherGradeEntry", matchPrefix: true },
                { icon: "cards", label: "Conseil de classe", href: "/dashboard/grades/councils", matchPrefix: true },
                { icon: "grid", label: "Compétences MEMP", href: "/dashboard/competences", matchPrefix: true },
                { icon: "check", label: "Appel d'aujourd'hui", href: "/dashboard/attendance", matchPrefix: true },
                { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true },
                { icon: "users", label: "Mes élèves", href: "/dashboard/students", countKey: "teacherStudents", matchPrefix: true },
                { icon: "bell", label: "Messages", href: "/dashboard/messages", countKey: "teacherMessages", matchPrefix: true },
                { icon: "sparkle", label: "Assistant IA", href: "/dashboard/ai-assistant", matchPrefix: true },
            ];

        case "PARENT":
            return [
                { icon: "home", label: "Accueil", href: "/dashboard" },
                { icon: "users", label: "Mes enfants", href: "/dashboard/students", countKey: "children", matchPrefix: true },
                { icon: "book", label: "Cahier de liaison", href: "/dashboard/liaison", matchPrefix: true },
                { icon: "money", label: "Paiements", href: "/dashboard/finance", countKey: "pendingPayments", matchPrefix: true },
                { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true },
                { icon: "bell", label: "Notifications", href: "/dashboard/notifications", countKey: "notifications", matchPrefix: true },
                { icon: "sms", label: "Messagerie école", href: "/dashboard/messages", matchPrefix: true },
                { icon: "settings", label: "Mon compte", href: "/dashboard/settings", matchPrefix: true },
            ];

        case "STUDENT":
            return [
                { icon: "home", label: "Mon tableau", href: "/dashboard" },
                { icon: "calendar", label: "Emploi du temps", href: "/dashboard/schedule", matchPrefix: true },
                { icon: "pencil", label: "Mes notes", href: "/dashboard/grades", matchPrefix: true },
                { icon: "book", label: "Devoirs", href: "/dashboard/homework", countKey: "homework", matchPrefix: true },
                { icon: "sparkle", label: "Mon orientation", href: "/dashboard/orientation/me", matchPrefix: true },
                { icon: "trophy", label: "Mes badges", href: "/dashboard/gamification", countKey: "badges", matchPrefix: true },
                { icon: "users", label: "Ma classe", href: "/dashboard/classes", matchPrefix: true },
                { icon: "sms", label: "Messagerie", href: "/dashboard/messages", matchPrefix: true },
            ];

        case "ACCOUNTANT":
            return [
                { icon: "home", label: "Vue d'ensemble", href: "/dashboard" },
                { icon: "money", label: "Finance", href: "/dashboard/finance", matchPrefix: true },
                { icon: "users", label: "Élèves", href: "/dashboard/students", matchPrefix: true },
                { icon: "chart", label: "Reporting", href: "/dashboard/analytics", matchPrefix: true },
                { icon: "settings", label: "Paramètres", href: "/dashboard/settings", matchPrefix: true },
            ];

        case "STAFF":
        default:
            return [
                { icon: "home", label: "Accueil", href: "/dashboard" },
                { icon: "users", label: "Élèves", href: "/dashboard/students", matchPrefix: true },
                { icon: "calendar", label: "Vie scolaire", href: "/dashboard/calendar", matchPrefix: true },
                { icon: "bell", label: "Communication", href: "/dashboard/announcements", matchPrefix: true },
                { icon: "settings", label: "Paramètres", href: "/dashboard/settings", matchPrefix: true },
            ];
    }
}

export function isActiveLink(pathname: string, link: NavLink): boolean {
    if (!pathname) return false;
    if (link.matchPrefix) return pathname === link.href || pathname.startsWith(link.href + "/");
    return pathname === link.href;
}
