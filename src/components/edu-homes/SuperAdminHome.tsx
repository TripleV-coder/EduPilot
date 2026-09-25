"use client";

import { formatNumber, frenchToday } from "./_shared";
import { Block, ColorCards, Empty, Figures, HomeHeader, HomePage, MODULE, QuickActions, Row, WatchList, initials } from "./home-kit";

interface RecentSchool {
    id: string;
    name: string;
    city: string | null;
    isActive: boolean;
}

interface NetworkSchool extends RecentSchool {
    studentCount: number;
    teacherCount: number;
    userCount: number;
    openAlerts: number;
}

interface RecentActivity {
    id?: string;
    action?: string;
    entityType?: string | null;
    createdAt?: Date | string;
    user?: { firstName?: string | null; lastName?: string | null } | null;
}

export interface SuperAdminHomeProps {
    userName: string;
    data: {
        totalSchools: number;
        totalUsers: number;
        recentSchools: RecentSchool[];
        networkSchools?: NetworkSchool[];
        recentActivity: RecentActivity[];
    };
}

/* Accueil super-admin — même langage que l'accueil direction validé
   (docs/design/directions/direction-approved.md). La courbe « croissance du réseau » a été retirée :
   elle était fabriquée à partir d'un seul total (generateGrowthSeries). */
export function SuperAdminHome({ userName, data }: SuperAdminHomeProps) {
    const firstName = userName.trim().split(/\s+/)[0] || userName;
    const network = data.networkSchools ?? [];
    const students = network.reduce((acc, s) => acc + s.studentCount, 0);
    const withAlerts = network.filter((s) => s.openAlerts > 0).length;
    const schools = network.length ? network : data.recentSchools.map((s) => ({ ...s, studentCount: 0, teacherCount: 0, userCount: 0, openAlerts: 0 }));
    return (
        <HomePage>
            <HomeHeader title={`Bonjour, ${firstName}`} sub={`${frenchToday()} · Vue réseau`} />
            <Row>
                <Block id="root-overview" title="Vue d'ensemble" link={{ href: "/dashboard/analytics", label: "Analyses" }}>
                    <Figures
                        items={[
                            { label: "Établissements", value: formatNumber(data.totalSchools), note: `${network.filter((s) => s.isActive).length || data.totalSchools} actifs`, color: MODULE.blue, href: "/dashboard/root-control/schools" },
                            { label: "Élèves du réseau", value: formatNumber(students), note: "tous établissements", color: MODULE.green },
                            { label: "Utilisateurs", value: formatNumber(data.totalUsers), note: "comptes actifs", color: MODULE.purple, href: "/dashboard/users" },
                            { label: "Sites en alerte", value: formatNumber(withAlerts), note: "alertes ouvertes", color: MODULE.pink, href: "/dashboard/notifications" },
                        ]}
                    />
                </Block>
                <Block id="root-activity" title="Activité récente" link={{ href: "/dashboard/root-control/logs", label: "Journaux" }}>
                    <WatchList
                        calm="Aucune activité signalée."
                        items={data.recentActivity.slice(0, 4).map((a, i) => ({
                            key: a.id ?? String(i),
                            avatar: initials(formatUser(a.user) || "E P"),
                            color: MODULE.blue,
                            name: humanizeAction(a.action, a.entityType),
                            detail: [formatUser(a.user), formatRelative(a.createdAt)].filter(Boolean).join(" · "),
                        }))}
                    />
                </Block>
            </Row>
            <Block id="root-actions" title="Actions rapides">
                <QuickActions
                    actions={[
                        { href: "/dashboard/root-control/schools", label: "Établissements", icon: "school", color: MODULE.blue },
                        { href: "/dashboard/root-control/plans", label: "Plans & tarifs", icon: "money", color: MODULE.orange },
                        { href: "/dashboard/root-control/monitoring", label: "Supervision", icon: "chart", color: MODULE.green },
                        { href: "/dashboard/root-control/users", label: "Utilisateurs", icon: "users", color: MODULE.purple },
                        { href: "/dashboard/root-control/logs", label: "Journaux", icon: "cards", color: MODULE.teal },
                        { href: "/dashboard/root-control/maintenance", label: "Maintenance", icon: "settings", color: MODULE.pink },
                    ]}
                />
            </Block>
            <Block id="root-schools" title="Établissements" link={{ href: "/dashboard/root-control/schools", label: `Les ${formatNumber(data.totalSchools)} établissements` }}>
                {schools.length === 0 ? (
                    <Empty>Aucun établissement enregistré pour l&apos;instant.</Empty>
                ) : (
                    <ColorCards
                        items={schools.slice(0, 10).map((s) => ({
                            key: s.id,
                            title: s.name,
                            meta: `${s.city ?? "Ville non renseignée"} · ${s.isActive ? "actif" : "suspendu"}`,
                            footLabel: s.openAlerts > 0 ? `${s.openAlerts} alerte(s)` : "Élèves",
                            footValue: formatNumber(s.studentCount),
                            href: "/dashboard/root-control/schools",
                        }))}
                    />
                )}
            </Block>
        </HomePage>
    );
}

/* Codes du journal d'audit (texte libre, casse variable) → libellés lisibles. */
const ACTION_LABELS: Record<string, string> = {
    LOGIN_SUCCESS: "Connexion",
    LOGIN: "Connexion",
    LOGIN_FAILED: "Échec de connexion",
    LOGOUT: "Déconnexion",
    DATA_ACCESS: "Consultation",
    CREATE: "Création",
    UPDATE: "Modification",
    DELETE: "Suppression",
    EXPORT: "Export",
    CONSENT_TERMS_ACCEPTED: "Conditions acceptées",
    CONSENT_CHILD_REVOKED: "Consentement retiré",
};

const ENTITY_LABELS: Record<string, string> = {
    PAYMENT: "paiement",
    GRADE: "note",
    USER: "utilisateur",
    ATTENDANCE: "présence",
    STUDENT: "élève",
    SCHOOL: "établissement",
    FEE: "frais",
    EVALUATION: "évaluation",
};

function humanizeAction(action: string | undefined, entityType: string | null | undefined): string {
    const code = (action ?? "").trim().toUpperCase().replace(/[.\s-]+/g, "_");
    const label = ACTION_LABELS[code] ?? (action ? action.replace(/[_.]+/g, " ").toLowerCase() : "Activité");
    // La connexion porte déjà son sujet (l'utilisateur affiché dessous).
    if (code.startsWith("LOGIN") || code === "LOGOUT" || code.startsWith("CONSENT")) {
        return label.charAt(0).toUpperCase() + label.slice(1);
    }
    const entity = entityType ? ENTITY_LABELS[entityType.toUpperCase()] ?? entityType.toLowerCase() : null;
    const text = entity ? `${label} · ${entity}` : label;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatUser(user: RecentActivity["user"]): string {
    if (!user) return "";
    const f = user.firstName ?? "";
    const l = user.lastName ?? "";
    return `${f} ${l}`.trim();
}

function formatRelative(value: Date | string | undefined): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.round(diff / 60_000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.round(hours / 24);
    if (days < 7) return `il y a ${days} j`;
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

