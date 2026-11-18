import type { IconName } from "@/components/edu";
import type { UserRole } from "@prisma/client";
import { Permission } from "@/lib/rbac/permissions";
import { STAFF_MEMBER_ROLES } from "@/lib/staff/hr";

/**
 * Annuaire des services : chaque page fonctionnelle de l'application qui
 * n'a pas sa place dans le menu (5 à 8 actions clés par rôle). Ces pages
 * n'avaient AUCUN point d'entrée depuis la réduction du menu du 2026-06-28
 * (bibliothèque, transport, discipline, documents, promotion…).
 *
 * `roles` et `permission` recopient EXACTEMENT la garde PageGuard de la page :
 * jamais de lien vers « Accès refusé » (vérifié par tests/components/service-catalog.test.ts).
 */
export type ServiceGroup =
    | "Pédagogie"
    | "Vie scolaire"
    | "Services aux familles"
    | "Communication"
    | "Finance"
    | "Administration"
    | "Plateforme";

export interface ServiceEntry {
    href: string;
    label: string;
    description: string;
    icon: IconName;
    group: ServiceGroup;
    roles?: readonly UserRole[];
    permission?: string | readonly string[];
    /** Page réservée à un cycle (CycleGuard) : masquée si l'école ne l'offre pas. */
    cycle?: "PRIMARY" | "SECONDARY_COLLEGE" | "SECONDARY_LYCEE";
}

const DIRECTION: readonly UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
const ROOT: readonly UserRole[] = ["SUPER_ADMIN"];

export const SERVICE_GROUP_ORDER: readonly ServiceGroup[] = [
    "Pédagogie", "Vie scolaire", "Services aux familles", "Communication", "Finance", "Administration", "Plateforme",
];

export const SERVICE_CATALOG: readonly ServiceEntry[] = [
    // ── Pédagogie
    { href: "/dashboard/homework", label: "Devoirs", description: "Devoirs à rendre, rendus et corrections.", icon: "book", group: "Pédagogie", roles: [...DIRECTION, "TEACHER", "STUDENT", "PARENT"], permission: Permission.EVALUATION_READ },
    { href: "/dashboard/schedule", label: "Emploi du temps", description: "Les cours de la semaine, heure par heure.", icon: "calendar", group: "Pédagogie", roles: [...DIRECTION, "TEACHER", "STUDENT", "PARENT"], permission: Permission.SCHEDULE_READ },
    { href: "/dashboard/courses", label: "Cours en ligne", description: "Modules et leçons publiés par les enseignants.", icon: "book", group: "Pédagogie", roles: [...DIRECTION, "TEACHER", "STUDENT", "PARENT"], permission: [Permission.CLASS_READ, Permission.SUBJECT_READ, Permission.SCHEDULE_READ] },
    { href: "/dashboard/lms", label: "Parcours d'apprentissage", description: "Progression des élèves dans leurs cours.", icon: "sparkle", group: "Pédagogie", roles: [...DIRECTION, "TEACHER", "STUDENT", "PARENT"], permission: Permission.SCHOOL_READ },
    { href: "/dashboard/resources", label: "Ressources pédagogiques", description: "Documents et supports partagés.", icon: "download", group: "Pédagogie", roles: [...DIRECTION, "TEACHER", "STUDENT"] },
    { href: "/dashboard/exams", label: "Examens en ligne", description: "Épreuves en ligne, durée contrôlée.", icon: "cards", group: "Pédagogie", roles: [...DIRECTION, "TEACHER", "STUDENT"], permission: Permission.EVALUATION_READ },
    { href: "/dashboard/exams/planning", label: "Planning des examens", description: "Compositions et examens de la période.", icon: "calendar", group: "Pédagogie", roles: [...DIRECTION, "TEACHER"], permission: Permission.EVALUATION_READ },
    { href: "/dashboard/competences", label: "Compétences", description: "Référentiel et évaluation par compétences.", icon: "success", group: "Pédagogie", roles: [...DIRECTION, "TEACHER"], permission: Permission.SCHOOL_READ },
    { href: "/dashboard/performances", label: "Performances", description: "Résultats par classe, matière et période.", icon: "chart", group: "Pédagogie", roles: [...DIRECTION, "TEACHER"], permission: Permission.GRADE_READ },
    { href: "/dashboard/bepc-prep", label: "Préparation au BEPC", description: "Suivi des candidats et épreuves blanches.", icon: "trophy", group: "Pédagogie", roles: ["STUDENT", "PARENT", "TEACHER", "DIRECTOR", "SCHOOL_ADMIN", "SUPER_ADMIN"], permission: Permission.SCHOOL_READ, cycle: "SECONDARY_COLLEGE" },
    { href: "/dashboard/orientation/cep", label: "Orientation après le CEP", description: "Passage du CM2 vers la 6e.", icon: "arrowRight", group: "Pédagogie", roles: [...DIRECTION, "TEACHER"], permission: Permission.SCHOOL_READ, cycle: "PRIMARY" },
    { href: "/dashboard/orientation/post-bepc", label: "Orientation après le BEPC", description: "Choix des séries du second cycle.", icon: "arrowRight", group: "Pédagogie", roles: [...DIRECTION, "TEACHER"], permission: Permission.SCHOOL_READ, cycle: "SECONDARY_COLLEGE" },
    { href: "/dashboard/ai", label: "Assistant IA", description: "Questions sur les notes, les devoirs, l'école.", icon: "sparkle", group: "Pédagogie", roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"], permission: Permission.SCHOOL_READ },

    // ── Vie scolaire
    { href: "/dashboard/discipline", label: "Discipline", description: "Tableau de bord des incidents et sanctions.", icon: "warning", group: "Vie scolaire", roles: [...DIRECTION, "TEACHER", "STAFF"] },
    { href: "/dashboard/incidents", label: "Incidents", description: "Signalements et suivi des incidents.", icon: "warning", group: "Vie scolaire", roles: [...DIRECTION, "TEACHER", "STAFF", "PARENT", "STUDENT"], permission: Permission.SCHOOL_READ },
    { href: "/dashboard/appointments", label: "Rendez-vous", description: "Rencontres entre familles et enseignants.", icon: "calendar", group: "Vie scolaire", roles: [...DIRECTION, "TEACHER", "PARENT"], permission: Permission.SCHOOL_READ },
    { href: "/dashboard/wellbeing", label: "Cellule d'écoute", description: "Signalements de mal-être, anonymat possible.", icon: "info", group: "Vie scolaire", roles: DIRECTION, permission: Permission.SCHOOL_READ },
    { href: "/dashboard/wellbeing/new", label: "Parler à la cellule d'écoute", description: "Harcèlement, mal-être : écrire à l'établissement, anonymement si vous le souhaitez.", icon: "sms", group: "Vie scolaire", roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF", "PARENT", "STUDENT"] },
    { href: "/dashboard/alerts/risks", label: "Élèves à risque", description: "Alertes d'échec et d'absentéisme.", icon: "danger", group: "Vie scolaire", roles: DIRECTION },
    { href: "/dashboard/risks/dropout", label: "Décrochage", description: "Signaux qui précèdent le décrochage.", icon: "danger", group: "Vie scolaire", roles: [...DIRECTION, "TEACHER"], permission: Permission.ANALYTICS_VIEW },
    { href: "/dashboard/clubs", label: "Clubs", description: "Clubs de l'école et inscriptions.", icon: "users", group: "Vie scolaire", roles: [...DIRECTION, "TEACHER", "STUDENT", "STAFF"] },
    { href: "/dashboard/events", label: "Évènements", description: "Sorties, fêtes et manifestations.", icon: "calendar", group: "Vie scolaire", roles: [...DIRECTION, "TEACHER", "STUDENT", "PARENT"], permission: Permission.SCHOOL_READ },
    { href: "/dashboard/gamification", label: "Récompenses", description: "Badges de mérite et classements.", icon: "trophy", group: "Vie scolaire", roles: [...DIRECTION, "TEACHER", "STUDENT", "PARENT"], permission: Permission.SCHOOL_READ },

    // ── Services aux familles
    { href: "/dashboard/library", label: "Bibliothèque", description: "Catalogue, emprunts et retours.", icon: "book", group: "Services aux familles", roles: [...DIRECTION, "TEACHER", "STUDENT", "PARENT"] },
    { href: "/dashboard/canteen", label: "Cantine", description: "Menus et tickets repas.", icon: "tag", group: "Services aux familles", roles: [...DIRECTION, "PARENT", "STUDENT"] },
    { href: "/dashboard/transport", label: "Transport scolaire", description: "Lignes, état du trafic et élèves inscrits.", icon: "arrowRight", group: "Services aux familles", roles: [...DIRECTION, "STAFF"], permission: Permission.SCHOOL_READ },
    { href: "/dashboard/access-control", label: "Badges et contrôle d'accès", description: "Points de passage et journal des entrées.", icon: "cards", group: "Services aux familles", roles: [...DIRECTION, "STAFF"], permission: Permission.SCHOOL_READ },
    { href: "/dashboard/alumni", label: "Anciens élèves", description: "Annuaire des anciens.", icon: "school", group: "Services aux familles", roles: [...DIRECTION, "TEACHER", "STAFF"], permission: Permission.SCHOOL_READ },

    // ── Communication
    { href: "/dashboard/whatsapp", label: "WhatsApp", description: "Messages aux familles par WhatsApp Business.", icon: "sms", group: "Communication", roles: DIRECTION, permission: Permission.SCHOOL_READ },
    { href: "/dashboard/voice-notifs", label: "Messages vocaux", description: "Messages vocaux en langues locales.", icon: "bell", group: "Communication", roles: DIRECTION, permission: Permission.SCHOOL_READ },

    // ── Finance
    { href: "/dashboard/finance/reports", label: "Rapports financiers", description: "Encaissements, restes à payer, périodes.", icon: "chart", group: "Finance", roles: [...DIRECTION, "ACCOUNTANT"], permission: [Permission.FINANCE_READ] },
    { href: "/dashboard/finance/export", label: "Exports comptables", description: "Fichiers pour la comptabilité.", icon: "download", group: "Finance", roles: [...DIRECTION, "ACCOUNTANT"], permission: [Permission.FINANCE_READ] },
    { href: "/dashboard/risks/debts", label: "Impayés à risque", description: "Familles à relancer en priorité.", icon: "money", group: "Finance", roles: [...DIRECTION, "ACCOUNTANT"], permission: [Permission.FINANCE_READ, Permission.PAYMENT_READ] },
    { href: "/dashboard/scholarships", label: "Bourses", description: "Bourses et réductions accordées.", icon: "money", group: "Finance", roles: [...DIRECTION, "ACCOUNTANT"], permission: Permission.SCHOOL_UPDATE },
    { href: "/dashboard/wallet", label: "Portefeuille", description: "Comptes de l'école et soldes.", icon: "money", group: "Finance", roles: [...DIRECTION, "ACCOUNTANT"], permission: Permission.SCHOOL_READ },

    // ── Administration
    { href: "/dashboard/settings/academic/promotion", label: "Promotion de fin d'année", description: "Passage des élèves dans la classe supérieure.", icon: "arrowUp", group: "Administration", roles: DIRECTION },
    { href: "/dashboard/settings/evaluation-types", label: "Types d'évaluation", description: "Interrogations, devoirs, compositions et plafonds.", icon: "pencil", group: "Administration", permission: [Permission.EVALUATION_CREATE] },
    { href: "/dashboard/settings/class-subjects", label: "Matières par classe", description: "Matières, coefficients et enseignants.", icon: "book", group: "Administration", roles: DIRECTION },
    { href: "/dashboard/settings/curriculum", label: "Programmes", description: "Programmes officiels par niveau.", icon: "book", group: "Administration", roles: DIRECTION },
    { href: "/dashboard/settings/levels", label: "Cycles, niveaux et séries", description: "Structure de l'établissement.", icon: "grid", group: "Administration", roles: DIRECTION },
    { href: "/dashboard/teachers/hr", label: "RH enseignants", description: "Contrats, titulaires et vacataires.", icon: "users", group: "Administration", roles: DIRECTION, permission: Permission.SCHOOL_UPDATE },
    { href: "/dashboard/staff", label: "Personnel", description: "Présence et congés du personnel.", icon: "users", group: "Administration", roles: STAFF_MEMBER_ROLES },
    { href: "/dashboard/staff/payroll", label: "Paie", description: "Fiches de paie et bulletins.", icon: "money", group: "Administration", roles: STAFF_MEMBER_ROLES },
    { href: "/dashboard/parents", label: "Parents", description: "Comptes des familles et liens enfant.", icon: "users", group: "Administration", roles: DIRECTION, permission: [Permission.USER_READ] },
    { href: "/dashboard/documents", label: "Documents et attestations", description: "Certificats et attestations à signer.", icon: "download", group: "Administration", roles: DIRECTION, permission: Permission.SCHOOL_UPDATE },
    { href: "/dashboard/schools", label: "Établissements", description: "Vos établissements.", icon: "school", group: "Administration", roles: DIRECTION, permission: Permission.SCHOOL_READ },

    // ── Plateforme (super-admin)
    { href: "/dashboard/root-control/analytics", label: "Analyses de la plateforme", description: "Usage et activité globale.", icon: "chart", group: "Plateforme", roles: ROOT },
    { href: "/dashboard/root-control/finance", label: "Finance de la plateforme", description: "Abonnements et facturation.", icon: "money", group: "Plateforme", roles: ROOT },
    { href: "/dashboard/root-control/curriculum", label: "Référentiel des programmes", description: "Programmes nationaux.", icon: "book", group: "Plateforme", roles: ROOT },
    { href: "/dashboard/root-control/reforms", label: "Réformes", description: "Règles nationales en vigueur.", icon: "settings", group: "Plateforme", roles: ROOT },
    { href: "/dashboard/system/backup", label: "Sauvegardes", description: "Sauvegardes chiffrées et restauration.", icon: "download", group: "Plateforme", roles: ROOT, permission: [Permission.SYSTEM_BACKUP_CREATE, Permission.SYSTEM_BACKUP_VIEW] },
    { href: "/dashboard/system/retention", label: "Conservation des données", description: "Durées de conservation appliquées.", icon: "clock", group: "Plateforme", roles: ROOT },
    { href: "/dashboard/system/info", label: "Informations système", description: "Version, état et environnement.", icon: "info", group: "Plateforme", roles: ROOT },
    { href: "/dashboard/admin", label: "Administration de la plateforme", description: "Outils réservés au super-admin.", icon: "settings", group: "Plateforme", roles: ROOT },
];

export interface ServiceFilterContext {
    /** Même décision que PageGuard (useRBAC().canAccess). */
    canAccess: (check: { roles?: readonly string[]; permission?: string | readonly string[] }) => boolean;
    enabledModules: readonly string[];
    offeredLevels: readonly string[];
    isPageAllowedByModules: (href: string, enabledModules: readonly string[]) => boolean;
}

/** Services ouverts à la personne : rôle et permission, modules activés, cycles offerts. */
export function filterServices(entries: readonly ServiceEntry[], ctx: ServiceFilterContext): ServiceEntry[] {
    return entries.filter((entry) => {
        if (!ctx.canAccess({ roles: entry.roles, permission: entry.permission })) return false;
        if (!ctx.isPageAllowedByModules(entry.href, ctx.enabledModules)) return false;
        // Défaut sûr de CycleGuard : cycles non configurés → tout est ouvert
        if (entry.cycle && ctx.offeredLevels.length > 0 && !ctx.offeredLevels.includes(entry.cycle)) return false;
        return true;
    });
}

/** Pages principales du menu (hors annuaire), valides comme entrée d'un module. */
const MENU_PAGES = new Set([
    "/dashboard/students", "/dashboard/grades", "/dashboard/attendance", "/dashboard/finance",
    "/dashboard/messages", "/dashboard/classes", "/dashboard/medical", "/dashboard/liaison",
]);

/**
 * Page d'entrée d'un module : son premier préfixe qui correspond à une page
 * réelle (annuaire ou menu). Null si le module n'a pas de page propre
 * (ex. signature électronique, intégrée aux documents).
 */
export function moduleHomeHref(pagePrefixes: readonly string[]): string | null {
    const known = new Set([...SERVICE_CATALOG.map((s) => s.href), ...MENU_PAGES]);
    for (const prefix of pagePrefixes) {
        const href = `/dashboard/${prefix}`;
        if (known.has(href)) return href;
    }
    return null;
}
