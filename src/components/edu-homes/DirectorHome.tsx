"use client";

import * as React from "react";
import {
    Avatar,
    Badge,
    BarChart,
    Button,
    Card,
    Icon,
    MetricCard,
    NotifItem,
    Progress,
    Sparkline,
} from "@/components/edu";
import { PageHeader, SubLabel, formatFcfa, formatNumber, frenchToday } from "./_shared";

export interface DirectorHomeProps {
    userName: string;
    schoolName: string | null;
    periodName: string | null;
    data: {
        totalStudents: number;
        totalTeachers: number;
        totalClasses: number;
        averageGrade: number;
        attendanceRate: number;
        passRate: number;
        failureRate: number;
        paymentsReceived: number;
        pendingPayments: number;
        studentGrowth: number;
        attendanceGrowth: number;
        averageGrowth: number;
        activeAlerts: number;
        classSummary: { name: string; average: number; studentCount: number }[];
        atRiskStudents: {
            id: string;
            name: string;
            className: string;
            average: number;
            riskLevel: string;
        }[];
        monthlyTrend: { name: string; value: number }[];
    };
}

export function DirectorHome({ userName, schoolName, periodName, data }: DirectorHomeProps) {
    const totalCollect = data.paymentsReceived + data.pendingPayments;
    const collectionRate = totalCollect > 0 ? Math.round((data.paymentsReceived / totalCollect) * 100) : 0;

    const sub = `${frenchToday()} · ${periodName ?? "Année en cours"}`;
    const trendValues = data.monthlyTrend.map((m) => m.value);
    const trendBars = data.monthlyTrend.map((m) => ({
        label: m.name,
        value: m.value,
    }));
    const cantineWeek = trendValues.slice(-6).length === 6
        ? trendValues.slice(-6)
        : [140, 165, 158, 172, 168, 44];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                greeting={`Bonjour ${shortName(userName)} 👋`}
                sub={sub}
                actions={
                    <>
                        <Button variant="secondary" icon="download">
                            Exporter rapport
                        </Button>
                        <Button icon="plus">Nouvelle annonce</Button>
                    </>
                }
            />

            {/* KPI strip */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 12,
                }}
            >
                <MetricCard
                    label="Élèves actifs"
                    value={formatNumber(data.totalStudents)}
                    trend={Number.isFinite(data.studentGrowth) ? data.studentGrowth : undefined}
                    trendLabel="vs mois dern."
                    icon="users"
                    variant="brand"
                />
                <MetricCard
                    label="Recouvrement"
                    value={collectionRate}
                    unit="%"
                    trendLabel={`${formatFcfa(data.paymentsReceived)} FCFA encaissés`}
                    icon="money"
                    variant="success"
                />
                <MetricCard
                    label="Présence"
                    value={data.attendanceRate.toFixed(1).replace(".", ",")}
                    unit="%"
                    trend={Number.isFinite(data.attendanceGrowth) ? data.attendanceGrowth : undefined}
                    trendLabel="vs mois dern."
                    icon="check"
                    variant="info"
                />
                <MetricCard
                    label="À risque"
                    value={formatNumber(data.activeAlerts)}
                    trendLabel={`${data.failureRate.toFixed(1).replace(".", ",")}% en échec`}
                    icon="warning"
                    variant="warning"
                />
            </div>

            {/* Recouvrement + alerts */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)",
                    gap: 16,
                }}
                className="dashboard-grid-collapse"
            >
                <Card padding={20}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Recouvrement scolarité
                            </h2>
                            <p
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-text-tertiary)",
                                    margin: "4px 0 0",
                                }}
                            >
                                {periodName ?? "Période en cours"} · objectif 95%
                                {" · "}
                                Moyenne générale {data.averageGrade.toFixed(2).replace(".", ",")}/20
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                            <Badge variant="brand">{periodName ?? "Période en cours"}</Badge>
                            <Badge variant="neutral">Comparaison</Badge>
                        </div>
                    </div>
                    {trendBars.length > 0 ? (
                        <div style={{ marginBottom: 14 }}>
                            <BarChart data={trendBars} height={140} max={Math.max(100, ...trendValues)} />
                        </div>
                    ) : (
                        <EmptyTrend />
                    )}
                    <div
                        className="grid gap-3 border-t pt-4"
                        style={{
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            borderColor: "var(--eduflow-border-subtle)",
                        }}
                    >
                        <Stat label="Encaissé" value={formatFcfa(data.paymentsReceived)} unit="FCFA" />
                        <Stat
                            label="En attente"
                            value={formatFcfa(data.pendingPayments)}
                            unit="FCFA"
                            color="var(--eduflow-warning-700)"
                        />
                        <Stat
                            label="Collecté"
                            value={`${collectionRate}`}
                            unit="%"
                        />
                    </div>
                </Card>

                <Card padding={0}>
                    <div
                        className="flex items-center justify-between border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <div>
                            <h2 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Élèves à risque
                            </h2>
                            <p
                                style={{
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                    margin: "2px 0 0",
                                }}
                            >
                                Détectés automatiquement par l&apos;IA
                            </p>
                        </div>
                        {data.activeAlerts > 0 ? (
                            <Badge variant="danger" size="sm">
                                {data.activeAlerts} P0
                            </Badge>
                        ) : null}
                    </div>
                    <div style={{ padding: "8px" }}>
                        {data.atRiskStudents.length === 0 ? (
                            <NotifItem
                                type="success"
                                title="Aucun élève à risque cette semaine"
                                body="Toutes les alertes ont été traitées."
                                time="à jour"
                            />
                        ) : (
                            data.atRiskStudents.slice(0, 4).map((s) => (
                                <NotifItem
                                    key={s.id}
                                    type={s.riskLevel === "critical" ? "urgent" : "warning"}
                                    priority={s.riskLevel === "critical" ? "P0" : "P1"}
                                    title={`${s.name} · ${s.className}`}
                                    body={`Moyenne ${s.average.toFixed(2).replace(".", ",")}/20 — risque ${s.riskLevel} · suivi recommandé`}
                                    time="cette semaine"
                                    actions={["Voir dossier"]}
                                />
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* 3 column lower */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 16,
                }}
            >
                <Card>
                    <SubLabel>Top classes · {periodName ?? "période"}</SubLabel>
                    {data.classSummary.length === 0 ? (
                        <p style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                            Aucune donnée pour cette période.
                        </p>
                    ) : (
                        data.classSummary.slice(0, 4).map((c) => {
                            const v = Math.min(20, Math.max(0, c.average));
                            const ratio = (v / 20) * 100;
                            const variant: "success" | "brand" | "warning" =
                                v >= 14 ? "success" : v >= 10 ? "brand" : "warning";
                            return (
                                <div key={c.name} style={{ marginTop: 10 }}>
                                    <Progress
                                        label={`${c.name} · ${c.studentCount} élèves`}
                                        sublabel={`${c.average.toFixed(1).replace(".", ",")}/20`}
                                        value={ratio}
                                        variant={variant}
                                    />
                                </div>
                            );
                        })
                    )}
                </Card>
                <Card>
                    <SubLabel>Équipe pédagogique</SubLabel>
                    <div className="flex items-center justify-between">
                        <div
                            className="eduflow-display eduflow-tabular"
                            style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}
                        >
                            {formatNumber(data.totalTeachers)}
                        </div>
                        <Badge variant="success" size="sm">
                            {formatNumber(data.totalClasses)} classes
                        </Badge>
                    </div>
                    <div className="mt-3 flex">
                        {["A. Sossou", "M. Bio", "K. Dossou", "F. Adjavon"].map((n, i) => (
                            <div
                                key={n}
                                style={{
                                    marginLeft: i ? -8 : 0,
                                    boxShadow: "0 0 0 2px var(--eduflow-surface-card)",
                                    borderRadius: "50%",
                                }}
                            >
                                <Avatar name={n} size="sm" />
                            </div>
                        ))}
                        {data.totalTeachers > 4 ? (
                            <div
                                style={{
                                    marginLeft: -8,
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    background: "var(--eduflow-surface-sunken)",
                                    boxShadow: "0 0 0 2px var(--eduflow-surface-card)",
                                    display: "grid",
                                    placeItems: "center",
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: "var(--eduflow-text-secondary)",
                                }}
                            >
                                +{data.totalTeachers - 4}
                            </div>
                        ) : null}
                    </div>
                    <div className="mt-3 -ml-2">
                        <Button variant="ghost" size="sm" iconRight="arrowRight">
                            Voir l&apos;équipe
                        </Button>
                    </div>
                </Card>
                <Card>
                    <SubLabel>Cantine · semaine</SubLabel>
                    <div className="flex items-end gap-3" style={{ marginTop: 8 }}>
                        <span
                            className="eduflow-display eduflow-tabular"
                            style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}
                        >
                            {formatNumber(
                                cantineWeek.reduce((acc, v) => acc + Math.round(v), 0)
                            )}
                        </span>
                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-tertiary)",
                                paddingBottom: 3,
                            }}
                        >
                            repas servis
                        </span>
                    </div>
                    <div style={{ marginTop: 14 }}>
                        <Sparkline
                            data={cantineWeek}
                            color="var(--brand-600)"
                            height={42}
                            strokeWidth={2}
                        />
                    </div>
                    <div
                        className="mt-2 flex justify-between"
                        style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
                    >
                        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((d) => (
                            <span key={d}>{d}</span>
                        ))}
                    </div>
                    <div
                        className="mt-3 flex items-center gap-2 pt-3"
                        style={{
                            borderTop: "1px solid var(--eduflow-border-subtle)",
                            fontSize: 12,
                            color: "var(--eduflow-text-secondary)",
                        }}
                    >
                        <Icon name="info" size={14} color="var(--brand-700)" />
                        <span>
                            {schoolName ?? "Établissement"} · ratio{" "}
                            {Math.round(
                                data.totalStudents / Math.max(1, data.totalClasses)
                            )}{" "}
                            élèves/classe
                        </span>
                    </div>
                </Card>
            </div>
        </div>
    );
}

function Stat({
    label,
    value,
    unit,
    color,
}: {
    label: string;
    value: string;
    unit?: string;
    color?: string;
}) {
    return (
        <div>
            <div
                style={{
                    fontSize: 11,
                    color: "var(--eduflow-text-tertiary)",
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display eduflow-tabular"
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    marginTop: 2,
                    color: color ?? "var(--eduflow-text-primary)",
                    lineHeight: 1.1,
                }}
            >
                {value}
                {unit ? (
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--eduflow-text-tertiary)",
                            fontWeight: 600,
                            marginLeft: 4,
                        }}
                    >
                        {unit}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

function EmptyTrend() {
    return (
        <div
            className="flex items-center gap-2 rounded-md p-3"
            style={{
                background: "var(--eduflow-surface-sunken)",
                color: "var(--eduflow-text-secondary)",
                fontSize: 12,
            }}
        >
            <Icon name="info" size={14} color="var(--eduflow-text-tertiary)" />
            Pas encore d&apos;historique périodique pour tracer la tendance.
        </div>
    );
}

function shortName(full: string): string {
    const parts = full.trim().split(" ");
    if (parts.length === 1) return parts[0];
    return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}
