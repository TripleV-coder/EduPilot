"use client";

import * as React from "react";
import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    MetricCard,
    NotifItem,
    Sparkline,
} from "@/components/edu";
import { PageHeader, SubLabel, formatNumber } from "./_shared";

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

export function SuperAdminHome({ userName, data }: SuperAdminHomeProps) {
    const networkSchools = data.networkSchools ?? [];
    const totalStudentsNetwork = networkSchools.reduce(
        (acc, s) => acc + s.studentCount,
        0,
    );
    const totalTeachersNetwork = networkSchools.reduce(
        (acc, s) => acc + s.teacherCount,
        0,
    );
    const schoolsWithAlerts = networkSchools.filter((s) => s.openAlerts > 0).length;
    const maxStudents = Math.max(1, ...networkSchools.map((s) => s.studentCount));
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                greeting={`Réseau · ${shortName(userName)}`}
                sub={`${formatNumber(data.totalSchools)} établissements · ${formatNumber(data.totalUsers)} utilisateurs · vue consolidée temps réel`}
                actions={
                    <>
                        <Button variant="secondary" icon="download">
                            Export consolidé
                        </Button>
                        <Button icon="plus">Nouveau site</Button>
                    </>
                }
            />

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 12,
                }}
            >
                <MetricCard
                    label="Établissements actifs"
                    value={formatNumber(data.totalSchools)}
                    icon="school"
                    variant="brand"
                    trendLabel="Sites en production"
                />
                <MetricCard
                    label="Élèves réseau"
                    value={formatNumber(totalStudentsNetwork || data.totalUsers)}
                    icon="users"
                    variant="info"
                    trendLabel={
                        totalTeachersNetwork
                            ? `${formatNumber(totalTeachersNetwork)} enseignants`
                            : "Comptes consolidés"
                    }
                />
                <MetricCard
                    label="Sites en alerte"
                    value={formatNumber(schoolsWithAlerts)}
                    icon="warning"
                    variant="warning"
                    trendLabel="Alertes 7 jours"
                />
                <MetricCard
                    label="Activité 24h"
                    value={formatNumber(data.recentActivity.length)}
                    icon="chart"
                    variant="success"
                    trendLabel="Événements admin"
                />
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
                    gap: 16,
                }}
            >
                <Card padding={0}>
                    <div
                        className="flex items-center justify-between border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Établissements
                            </h3>
                            <p
                                style={{
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                    margin: "2px 0 0",
                                }}
                            >
                                {formatNumber(data.totalSchools)} sites · derniers ajouts
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" icon="filter">
                                Filtrer
                            </Button>
                            <Button variant="ghost" size="sm" icon="grid">
                                Carte
                            </Button>
                        </div>
                    </div>
                    {networkSchools.length === 0 && data.recentSchools.length === 0 ? (
                        <EmptyRow
                            title="Aucun établissement enregistré"
                            body="Crée le premier site pour démarrer le déploiement réseau."
                        />
                    ) : networkSchools.length > 0 ? (
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: 13,
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        background: "var(--eduflow-surface-sunken)",
                                        textAlign: "left",
                                    }}
                                >
                                    {[
                                        "Établissement",
                                        "Élèves",
                                        "Enseignants",
                                        "Alertes 7j",
                                        "Statut",
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: "10px 16px",
                                                fontSize: 10,
                                                fontWeight: 700,
                                                letterSpacing: "0.06em",
                                                textTransform: "uppercase",
                                                color: "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {networkSchools.map((s) => (
                                    <tr
                                        key={s.id}
                                        style={{
                                            borderTop: "1px solid var(--eduflow-border-subtle)",
                                        }}
                                    >
                                        <td style={{ padding: "12px 16px" }}>
                                            <div className="flex items-center gap-3">
                                                <Avatar name={s.name} size="sm" />
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                                                        {s.name}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 10,
                                                            color: "var(--eduflow-text-tertiary)",
                                                        }}
                                                    >
                                                        {s.city ?? "—"}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: "12px 16px", minWidth: 140 }}>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="eduflow-tabular"
                                                    style={{
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        width: 48,
                                                        color: "var(--eduflow-text-primary)",
                                                    }}
                                                >
                                                    {formatNumber(s.studentCount)}
                                                </span>
                                                <div
                                                    style={{
                                                        height: 4,
                                                        flex: 1,
                                                        background:
                                                            "var(--eduflow-neutral-200)",
                                                        borderRadius: 2,
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            height: "100%",
                                                            width: `${Math.round(
                                                                (s.studentCount / maxStudents) *
                                                                    100,
                                                            )}%`,
                                                            background: "var(--brand-600)",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td
                                            className="eduflow-tabular"
                                            style={{
                                                padding: "12px 16px",
                                                fontSize: 13,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {formatNumber(s.teacherCount)}
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>
                                            {s.openAlerts > 0 ? (
                                                <Badge variant="warning" size="sm" dot>
                                                    {s.openAlerts}
                                                </Badge>
                                            ) : (
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--eduflow-text-tertiary)",
                                                    }}
                                                >
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>
                                            {s.isActive ? (
                                                <Badge variant="success" size="sm" dot>
                                                    Stable
                                                </Badge>
                                            ) : (
                                                <Badge variant="warning" size="sm" dot>
                                                    Inactif
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: 13,
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        background: "var(--eduflow-surface-sunken)",
                                        textAlign: "left",
                                    }}
                                >
                                    {["Établissement", "Ville", "Statut", "Action"].map((h) => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: "10px 16px",
                                                fontSize: 10,
                                                fontWeight: 700,
                                                letterSpacing: "0.06em",
                                                textTransform: "uppercase",
                                                color: "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.recentSchools.map((s) => (
                                    <tr
                                        key={s.id}
                                        style={{
                                            borderTop: "1px solid var(--eduflow-border-subtle)",
                                        }}
                                    >
                                        <td
                                            style={{
                                                padding: "12px 16px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 10,
                                            }}
                                        >
                                            <Avatar name={s.name} size="sm" />
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>
                                                {s.name}
                                            </span>
                                        </td>
                                        <td
                                            style={{
                                                padding: "12px 16px",
                                                fontSize: 12,
                                                color: "var(--eduflow-text-secondary)",
                                            }}
                                        >
                                            {s.city ?? "—"}
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>
                                            {s.isActive ? (
                                                <Badge variant="success" size="sm" dot>
                                                    Actif
                                                </Badge>
                                            ) : (
                                                <Badge variant="warning" size="sm" dot>
                                                    Inactif
                                                </Badge>
                                            )}
                                        </td>
                                        <td style={{ padding: "10px 16px" }}>
                                            <Button variant="ghost" size="sm" iconRight="arrowRight">
                                                Ouvrir
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>

                <div className="flex flex-col gap-4">
                    <Card>
                        <SubLabel>Croissance du réseau</SubLabel>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span
                                className="eduflow-display eduflow-tabular"
                                style={{
                                    fontSize: 30,
                                    fontWeight: 700,
                                    letterSpacing: "-0.025em",
                                }}
                            >
                                {formatNumber(data.totalUsers)}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                                utilisateurs actifs
                            </span>
                        </div>
                        <div className="mt-3">
                            <Sparkline
                                data={generateGrowthSeries(data.totalUsers)}
                                color="var(--brand-700)"
                                height={48}
                                strokeWidth={2}
                            />
                        </div>
                        <div
                            className="mt-2 flex justify-between"
                            style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
                        >
                            <span>J-30</span>
                            <span>J-15</span>
                            <span>Aujourd&apos;hui</span>
                        </div>
                    </Card>

                    <Card padding={0}>
                        <div
                            className="flex items-center justify-between border-b px-5 py-4"
                            style={{ borderColor: "var(--eduflow-border-subtle)" }}
                        >
                            <h3 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                                Activité administrative
                            </h3>
                        </div>
                        <div style={{ padding: "6px 4px" }}>
                            {data.recentActivity.length === 0 ? (
                                <NotifItem
                                    type="success"
                                    title="Aucune activité signalée"
                                    body="Le réseau est calme — tout fonctionne nominalement."
                                    time="à jour"
                                />
                            ) : (
                                data.recentActivity.slice(0, 4).map((a, i) => {
                                    const userName = formatUser(a.user);
                                    return (
                                        <NotifItem
                                            key={a.id ?? i}
                                            type={mapActivityType(a.action)}
                                            title={humanizeAction(a.action, a.entityType)}
                                            body={userName ? `Par ${userName}` : undefined}
                                            time={formatRelative(a.createdAt)}
                                        />
                                    );
                                })
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function EmptyRow({ title, body }: { title: string; body: string }) {
    return (
        <div
            className="flex items-start gap-2 px-5 py-6"
            style={{
                fontSize: 12,
                color: "var(--eduflow-text-secondary)",
                lineHeight: 1.5,
            }}
        >
            <Icon name="info" size={14} color="var(--brand-700)" />
            <div>
                <div style={{ fontWeight: 600, color: "var(--eduflow-text-primary)" }}>
                    {title}
                </div>
                <div>{body}</div>
            </div>
        </div>
    );
}

function generateGrowthSeries(current: number): number[] {
    if (current <= 0) return [0, 0, 0, 0, 0, 0, 0];
    const result: number[] = [];
    let v = current * 0.78;
    for (let i = 0; i < 6; i++) {
        v += (current - v) * 0.18 + (i % 2 === 0 ? 1 : -1) * (current * 0.01);
        result.push(Math.max(0, Math.round(v)));
    }
    result.push(current);
    return result;
}

function mapActivityType(action: string | undefined): "success" | "warning" | "info" | "urgent" {
    const a = (action ?? "").toLowerCase();
    if (a.includes("delete") || a.includes("revoke")) return "urgent";
    if (a.includes("create") || a.includes("activate")) return "success";
    if (a.includes("update") || a.includes("change")) return "info";
    return "info";
}

function humanizeAction(action: string | undefined, entityType: string | null | undefined): string {
    const a = action ?? "Activité";
    const e = entityType ? ` · ${entityType}` : "";
    return `${a}${e}`;
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

function shortName(full: string): string {
    const parts = full.trim().split(" ");
    if (parts.length === 1) return parts[0];
    return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}
