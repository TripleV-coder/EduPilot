"use client";

import * as React from "react";
import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Sparkline,
} from "@/components/edu";
import { PageHeader, SubLabel, frenchToday } from "./_shared";

export interface TeacherTodaySlot {
    id: string;
    time: string;
    className: string;
    subjectName: string;
    room: string;
    state: "done" | "now" | "next";
}

export interface TeacherHomeProps {
    userName: string;
    schoolName: string | null;
    periodName: string | null;
    data: {
        myClasses: number;
        myStudents: number;
        classAverage: number;
        classPerformance: { name: string; average: number }[];
        atRiskStudents: {
            id: string;
            name: string;
            className: string;
            average: number;
            riskLevel: string;
        }[];
        monthlyTrend: { name: string; value: number }[];
        todaySchedule?: TeacherTodaySlot[];
    };
}

export function TeacherHome({ userName, schoolName, periodName, data }: TeacherHomeProps) {
    const pendingCount = data.atRiskStudents.filter((s) => s.riskLevel !== "low").length;
    const todaySchedule = data.todaySchedule ?? [];
    const todayCount = todaySchedule.length;
    const sub = `${frenchToday()} · ${
        todayCount > 0 ? `${todayCount} cours aujourd'hui · ` : ""
    }${data.myClasses} classes · ${data.myStudents} élèves${
        pendingCount > 0 ? ` · ${pendingCount} suivi${pendingCount > 1 ? "s" : ""} en attente` : ""
    }`;
    const insight = pickInsight(data);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                greeting={`Bonjour ${shortFirst(userName)}`}
                sub={sub}
                actions={
                    <>
                        <Button variant="secondary" icon="calendar">
                            Mon emploi du temps
                        </Button>
                        <Button icon="plus">Nouvelle note</Button>
                    </>
                }
            />

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
                    gap: 16,
                }}
            >
                <div className="flex flex-col gap-4">
                    {todaySchedule.length > 0 ? <TodayScheduleCard schedule={todaySchedule} /> : null}

                    <Card padding={0}>
                        <div
                            className="flex items-center justify-between border-b px-5 py-4"
                            style={{ borderColor: "var(--eduflow-border-subtle)" }}
                        >
                            <div>
                                <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                    Mes classes — {periodName ?? "période en cours"}
                                </h3>
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        margin: "2px 0 0",
                                    }}
                                >
                                    Moyenne globale {data.classAverage.toFixed(2).replace(".", ",")}/20 ·{" "}
                                    {data.myStudents} élèves
                                </p>
                            </div>
                            <Badge variant="info" dot>
                                {schoolName ?? "École"}
                            </Badge>
                        </div>
                        <div className="edu-stagger">
                            {data.classPerformance.length === 0 ? (
                                <EmptyState
                                    title="Aucune classe pour cette période"
                                    body="Tes classes apparaîtront ici dès que les enseignements seront affectés."
                                />
                            ) : (
                                data.classPerformance.map((c, i) => {
                                    const variant = pickClassVariant(c.average);
                                    return (
                                        <div
                                            key={c.name}
                                            className="grid items-center gap-3 px-5 py-3"
                                            style={{
                                                gridTemplateColumns: "70px 1fr 100px 110px",
                                                borderTop:
                                                    i > 0
                                                        ? "1px solid var(--eduflow-border-subtle)"
                                                        : "none",
                                            }}
                                        >
                                            <span
                                                className="eduflow-display"
                                                style={{
                                                    fontSize: 18,
                                                    fontWeight: 700,
                                                    color: "var(--eduflow-text-primary)",
                                                }}
                                            >
                                                {c.name}
                                            </span>
                                            <Sparkline
                                                data={fakeSeries(c.average)}
                                                color={`var(--eduflow-${variant}-600)`}
                                                height={24}
                                            />
                                            <span
                                                className="eduflow-display eduflow-tabular"
                                                style={{
                                                    fontSize: 18,
                                                    fontWeight: 700,
                                                    color: `var(--eduflow-${variant}-700)`,
                                                }}
                                            >
                                                {c.average.toFixed(1).replace(".", ",")}
                                            </span>
                                            <Button variant="secondary" size="sm" iconRight="arrowRight">
                                                Cahier
                                            </Button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </Card>

                    <Card padding={0}>
                        <div
                            className="flex items-center justify-between border-b px-5 py-4"
                            style={{ borderColor: "var(--eduflow-border-subtle)" }}
                        >
                            <div>
                                <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                    Élèves à suivre
                                </h3>
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        margin: "2px 0 0",
                                    }}
                                >
                                    Détectés cette semaine — interventions recommandées
                                </p>
                            </div>
                            <Badge variant="warning" size="sm">
                                {data.atRiskStudents.length} alerte
                                {data.atRiskStudents.length > 1 ? "s" : ""}
                            </Badge>
                        </div>
                        {data.atRiskStudents.length === 0 ? (
                            <div className="px-5 py-6">
                                <EmptyState
                                    title="Aucun élève en difficulté détecté"
                                    body="L&apos;IA n&apos;a relevé aucun signal d&apos;alerte cette semaine."
                                />
                            </div>
                        ) : (
                            data.atRiskStudents.slice(0, 5).map((s, i) => (
                                <div
                                    key={s.id}
                                    className="flex items-center gap-3 px-5 py-3"
                                    style={{
                                        borderTop:
                                            i > 0
                                                ? "1px solid var(--eduflow-border-subtle)"
                                                : "none",
                                    }}
                                >
                                    <Avatar name={s.name} size="sm" />
                                    <div className="flex-1 min-w-0">
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            {s.className} · risque {s.riskLevel}
                                        </div>
                                    </div>
                                    <Badge variant={s.riskLevel === "critical" ? "danger" : "warning"} size="sm">
                                        {s.average.toFixed(1).replace(".", ",")}/20
                                    </Badge>
                                </div>
                            ))
                        )}
                    </Card>
                </div>

                <div className="flex flex-col gap-4">
                    <Card
                        style={{
                            background: "linear-gradient(135deg, var(--brand-800), var(--brand-700))",
                            color: "#fff",
                            border: 0,
                        }}
                    >
                        <div
                            className="mb-3 flex items-center gap-2"
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                opacity: 0.85,
                            }}
                        >
                            <Icon name="sparkle" size={14} /> Insight IA
                        </div>
                        <div
                            className="eduflow-display"
                            style={{
                                fontSize: 18,
                                fontWeight: 600,
                                lineHeight: 1.25,
                                marginBottom: 8,
                            }}
                        >
                            {insight.headline}
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                opacity: 0.85,
                                lineHeight: 1.55,
                                marginBottom: 14,
                            }}
                        >
                            {insight.body}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="soft"
                                size="sm"
                                style={{
                                    background: "rgba(255,255,255,0.95)",
                                    color: "var(--brand-800)",
                                }}
                            >
                                {insight.cta}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                style={{
                                    color: "#fff",
                                    border: "1px solid rgba(255,255,255,0.3)",
                                }}
                            >
                                Plus tard
                            </Button>
                        </div>
                    </Card>

                    <Card>
                        <SubLabel>Évolution périodique</SubLabel>
                        {data.monthlyTrend.length === 0 ? (
                            <EmptyState
                                title="Pas encore de période"
                                body="Les notes saisies apparaîtront sur la courbe."
                            />
                        ) : (
                            <>
                                <div className="flex items-baseline gap-2">
                                    <span
                                        className="eduflow-display eduflow-tabular"
                                        style={{
                                            fontSize: 32,
                                            fontWeight: 700,
                                            letterSpacing: "-0.02em",
                                        }}
                                    >
                                        {data.classAverage.toFixed(1).replace(".", ",")}
                                    </span>
                                    <span style={{ color: "var(--eduflow-text-tertiary)", fontSize: 13 }}>
                                        / 20 moyen
                                    </span>
                                </div>
                                <div className="mt-3">
                                    <Sparkline
                                        data={data.monthlyTrend.map((m) => m.value)}
                                        color="var(--brand-600)"
                                        height={50}
                                        strokeWidth={2}
                                    />
                                </div>
                                <div
                                    className="mt-2 flex justify-between"
                                    style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
                                >
                                    {data.monthlyTrend.map((m) => (
                                        <span key={m.name}>{m.name}</span>
                                    ))}
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}

function TodayScheduleCard({ schedule }: { schedule: TeacherTodaySlot[] }) {
    const liveCount = schedule.filter((s) => s.state === "now").length;
    return (
        <Card padding={0}>
            <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: "var(--eduflow-border-subtle)" }}
            >
                <div>
                    <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                        Aujourd&apos;hui
                    </h3>
                    <p
                        style={{
                            fontSize: 11,
                            color: "var(--eduflow-text-tertiary)",
                            margin: "2px 0 0",
                        }}
                    >
                        {schedule.length} cours programmé{schedule.length > 1 ? "s" : ""}
                    </p>
                </div>
                {liveCount > 0 ? (
                    <Badge variant="info" dot>
                        En cours
                    </Badge>
                ) : (
                    <Badge variant="neutral">Programme du jour</Badge>
                )}
            </div>
            <div className="edu-stagger">
                {schedule.map((slot, i) => (
                    <div
                        key={slot.id}
                        className="grid items-center gap-3 px-5 py-3"
                        style={{
                            gridTemplateColumns: "130px 1fr 130px",
                            background:
                                slot.state === "now" ? "var(--brand-50)" : "transparent",
                            borderTop:
                                i > 0
                                    ? "1px solid var(--eduflow-border-subtle)"
                                    : "none",
                        }}
                    >
                        <span
                            className="eduflow-mono eduflow-tabular"
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-secondary)",
                                fontWeight: 600,
                            }}
                        >
                            {slot.time}
                        </span>
                        <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                                <span
                                    className="eduflow-display"
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: "var(--eduflow-text-primary)",
                                    }}
                                >
                                    {slot.className}
                                </span>
                                <span
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-secondary)",
                                        fontWeight: 500,
                                    }}
                                >
                                    {slot.subjectName}
                                </span>
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                    marginTop: 2,
                                }}
                            >
                                Salle {slot.room}
                            </div>
                        </div>
                        <div className="flex justify-end">
                            {slot.state === "done" ? (
                                <Badge variant="success" icon="check" size="sm">
                                    Appel fait
                                </Badge>
                            ) : slot.state === "now" ? (
                                <Button size="sm" icon="check">
                                    Faire l&apos;appel
                                </Button>
                            ) : (
                                <Button variant="secondary" size="sm">
                                    Préparer
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function EmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div
            className="flex items-start gap-2 p-4"
            style={{
                background: "var(--eduflow-surface-sunken)",
                borderRadius: "var(--eduflow-radius-md)",
                color: "var(--eduflow-text-secondary)",
                fontSize: 12,
                lineHeight: 1.5,
            }}
        >
            <Icon name="info" size={14} color="var(--brand-700)" />
            <div>
                <div
                    style={{ fontWeight: 600, color: "var(--eduflow-text-primary)", fontSize: 13 }}
                >
                    {title}
                </div>
                <div>{body}</div>
            </div>
        </div>
    );
}

function pickInsight(data: TeacherHomeProps["data"]): {
    headline: string;
    body: string;
    cta: string;
} {
    if (data.atRiskStudents.length >= 3) {
        return {
            headline: `${data.atRiskStudents.length} élèves montrent un décrochage cette semaine.`,
            body: "Recommandation : exercices ciblés et entretien individuel avant la prochaine évaluation.",
            cta: `Voir les ${data.atRiskStudents.length} élèves`,
        };
    }
    if (data.classAverage < 10) {
        return {
            headline: "La moyenne de tes classes est sous le seuil de réussite.",
            body: "Suggestion : revisiter les chapitres clés et planifier un DST de remédiation.",
            cta: "Préparer le plan",
        };
    }
    return {
        headline: "Belle dynamique cette période — continue !",
        body: "Tes classes maintiennent une moyenne saine. Pense à valoriser les progrès individuels.",
        cta: "Voir les progrès",
    };
}

function pickClassVariant(avg: number): "success" | "brand" | "warning" {
    if (avg >= 14) return "success";
    if (avg >= 10) return "brand";
    return "warning";
}

function fakeSeries(target: number): number[] {
    // Generates a smoothed series ending at the target. Used purely for the
    // visual sparkline; the analytics service does not yet expose per-class
    // trend points.
    const values: number[] = [];
    for (let i = 0; i < 7; i++) {
        const noise = (Math.sin(i * 1.3) + 1) * 0.6;
        values.push(Math.max(0, Math.min(20, target - 1.4 + noise + i * 0.18)));
    }
    values[values.length - 1] = target;
    return values;
}

function shortFirst(full: string): string {
    const parts = full.trim().split(" ");
    return parts[0];
}
