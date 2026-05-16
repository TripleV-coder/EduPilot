"use client";

import * as React from "react";
import {
    Badge,
    Button,
    Card,
    Icon,
    RingProgress,
    Sparkline,
    type IconName,
} from "@/components/edu";
import { PageHeader, SubLabel } from "./_shared";

export interface StudentHomeProps {
    userName: string;
    schoolName: string | null;
    periodName: string | null;
    data: {
        myAverage: number;
        myRank: number | null;
        attendanceRate: number;
        subjectPerformances: { name: string; average: number }[];
        monthlyTrend: { name: string; value: number }[];
    };
}

export function StudentHome({ userName, schoolName, periodName, data }: StudentHomeProps) {
    const sub = data.myRank
        ? `Tu es ${data.myRank}ᵉ de la classe ce trimestre. Belle progression !`
        : `${schoolName ?? "Mon école"} · ${periodName ?? "Période en cours"}`;

    const presenceVariant: "success" | "warning" | "danger" =
        data.attendanceRate >= 95 ? "success" : data.attendanceRate >= 85 ? "warning" : "danger";
    const averageVariant = pickSubjectVariant(data.myAverage);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                greeting={`Salut ${firstName(userName)} 👋`}
                sub={sub}
                actions={
                    <>
                        <Button variant="ghost" icon="trophy">
                            Mes badges
                        </Button>
                        <Button variant="secondary" icon="calendar">
                            Mon EDT
                        </Button>
                    </>
                }
            />

            {/* Hero strip */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                }}
            >
                <Card
                    style={{
                        background: "linear-gradient(135deg, var(--brand-800), var(--brand-600))",
                        color: "#fff",
                        border: 0,
                    }}
                >
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            opacity: 0.85,
                        }}
                    >
                        Ma moyenne
                    </div>
                    <div
                        className="eduflow-display eduflow-tabular"
                        style={{
                            fontSize: 56,
                            fontWeight: 700,
                            lineHeight: 0.95,
                            letterSpacing: "-0.04em",
                            marginTop: 6,
                        }}
                    >
                        {data.myAverage.toFixed(2).replace(".", ",")}
                    </div>
                    <div className="mt-2 flex items-center gap-2" style={{ fontSize: 12 }}>
                        <Icon name={data.myAverage >= 10 ? "arrowUp" : "arrowDown"} size={12} />
                        {periodName ?? "Période en cours"}
                    </div>
                </Card>

                <Card>
                    <SubLabel>Classement</SubLabel>
                    {data.myRank ? (
                        <>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span
                                    className="eduflow-display eduflow-tabular"
                                    style={{
                                        fontSize: 56,
                                        fontWeight: 700,
                                        lineHeight: 0.95,
                                        letterSpacing: "-0.04em",
                                    }}
                                >
                                    {data.myRank}
                                </span>
                                <span
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        color: "var(--eduflow-text-secondary)",
                                    }}
                                >
                                    ᵉ
                                </span>
                            </div>
                            <div
                                className="mt-2 flex items-center gap-2"
                                style={{
                                    fontSize: 11,
                                    color: "var(--eduflow-success-700)",
                                    fontWeight: 600,
                                }}
                            >
                                <Icon name="arrowUp" size={11} /> Continue comme ça !
                            </div>
                        </>
                    ) : (
                        <p
                            style={{
                                fontSize: 13,
                                color: "var(--eduflow-text-secondary)",
                                lineHeight: 1.55,
                                marginTop: 6,
                            }}
                        >
                            Le classement sera publié à la prochaine évaluation.
                        </p>
                    )}
                </Card>

                <Card>
                    <SubLabel>Présence</SubLabel>
                    <div className="mt-1 flex items-center gap-3">
                        <RingProgress
                            value={Math.max(0, Math.min(100, data.attendanceRate))}
                            size={60}
                            variant={presenceVariant}
                        >
                            <span
                                className="eduflow-display eduflow-tabular"
                                style={{ fontSize: 13, fontWeight: 700 }}
                            >
                                {Math.round(data.attendanceRate)}%
                            </span>
                        </RingProgress>
                        <div>
                            <div
                                className="eduflow-display eduflow-tabular"
                                style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}
                            >
                                {Math.round(data.attendanceRate)}
                                <span
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-tertiary)",
                                        fontWeight: 600,
                                        marginLeft: 4,
                                    }}
                                >
                                    %
                                </span>
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                    marginTop: 4,
                                }}
                            >
                                Présence cumulée — garde la flamme !
                            </div>
                        </div>
                    </div>
                </Card>
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
                        className="border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                            Mes matières
                        </h3>
                        <p
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-tertiary)",
                                margin: "2px 0 0",
                            }}
                        >
                            Moyenne par discipline · {periodName ?? "période en cours"}
                        </p>
                    </div>
                    <div>
                        {data.subjectPerformances.length === 0 ? (
                            <EmptyRow
                                title="Pas encore de notes"
                                body="Tes notes apparaîtront ici dès qu&apos;elles auront été saisies."
                            />
                        ) : (
                            data.subjectPerformances.slice(0, 6).map((s, i) => {
                                const variant = pickSubjectVariant(s.average);
                                const icon = pickSubjectIcon(s.name);
                                return (
                                    <div
                                        key={s.name}
                                        className="grid items-center gap-3 px-5 py-3"
                                        style={{
                                            gridTemplateColumns: "44px 1fr 80px",
                                            borderTop:
                                                i > 0
                                                    ? "1px solid var(--eduflow-border-subtle)"
                                                    : "none",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 10,
                                                background: `var(--eduflow-${variant}-50)`,
                                                display: "grid",
                                                placeItems: "center",
                                            }}
                                        >
                                            <Icon
                                                name={icon}
                                                size={16}
                                                color={`var(--eduflow-${variant}-700)`}
                                            />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                {variant === "success"
                                                    ? "Très bonne maîtrise"
                                                    : variant === "brand"
                                                    ? "Niveau correct"
                                                    : variant === "warning"
                                                    ? "À renforcer"
                                                    : "Effort prioritaire"}
                                            </div>
                                        </div>
                                        <span
                                            className="eduflow-display eduflow-tabular"
                                            style={{
                                                fontSize: 22,
                                                fontWeight: 700,
                                                color: `var(--eduflow-${variant}-700)`,
                                            }}
                                        >
                                            {s.average.toFixed(1).replace(".", ",")}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>

                <div className="flex flex-col gap-4">
                    <Card>
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                                Évolution
                            </h3>
                            <Badge variant={averageVariant} size="sm">
                                {data.myAverage.toFixed(1).replace(".", ",")}/20
                            </Badge>
                        </div>
                        {data.monthlyTrend.length === 0 ? (
                            <EmptyRow
                                title="Trop tôt"
                                body="La courbe se construit avec tes notes au fil des périodes."
                            />
                        ) : (
                            <>
                                <Sparkline
                                    data={data.monthlyTrend.map((m) => m.value)}
                                    color={`var(--eduflow-${averageVariant}-600)`}
                                    height={48}
                                    strokeWidth={2}
                                />
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

                    <Card>
                        <SubLabel>Mes badges récents</SubLabel>
                        <div
                            className="mt-1 grid"
                            style={{
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                gap: 10,
                            }}
                        >
                            <BadgeTile
                                icon="trophy"
                                color="warning"
                                label={data.myRank && data.myRank <= 5 ? `Top ${data.myRank}` : "Top 10"}
                                achieved={Boolean(data.myRank && data.myRank <= 10)}
                            />
                            <BadgeTile
                                icon="flame"
                                color="danger"
                                label={`${Math.round(data.attendanceRate)}% présence`}
                                achieved={data.attendanceRate >= 90}
                            />
                            <BadgeTile
                                icon="sparkle"
                                color="brand"
                                label={`Moyenne ${data.myAverage.toFixed(1).replace(".", ",")}`}
                                achieved={data.myAverage >= 14}
                            />
                            <BadgeTile
                                icon="check"
                                color="success"
                                label={`${data.subjectPerformances.filter((s) => s.average >= 14).length} matières fortes`}
                                achieved={
                                    data.subjectPerformances.filter((s) => s.average >= 14).length > 0
                                }
                            />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function BadgeTile({
    icon,
    color,
    label,
    achieved,
}: {
    icon: IconName;
    color: "warning" | "danger" | "brand" | "success";
    label: string;
    achieved: boolean;
}) {
    const bg =
        color === "brand"
            ? "var(--brand-50)"
            : `var(--eduflow-${color}-50)`;
    const fg =
        color === "brand"
            ? "var(--brand-600)"
            : `var(--eduflow-${color}-600)`;
    const labelColor =
        color === "brand"
            ? "var(--brand-800)"
            : `var(--eduflow-${color}-800)`;
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: 12,
                background: achieved ? bg : "var(--eduflow-surface-sunken)",
                borderRadius: "var(--eduflow-radius-md)",
                opacity: achieved ? 1 : 0.55,
                transition: "opacity var(--motion-fast) var(--ease-out)",
            }}
        >
            <div
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: achieved ? fg : "var(--eduflow-neutral-300)",
                    display: "grid",
                    placeItems: "center",
                }}
            >
                <Icon name={icon} size={18} color="#fff" />
            </div>
            <div
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: achieved ? labelColor : "var(--eduflow-text-tertiary)",
                    textAlign: "center",
                    lineHeight: 1.25,
                }}
            >
                {label}
            </div>
        </div>
    );
}

function EmptyRow({ title, body }: { title: string; body: string }) {
    return (
        <div
            className="flex items-start gap-2 rounded-md p-3"
            style={{
                background: "var(--eduflow-surface-sunken)",
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

function pickSubjectVariant(avg: number): "success" | "brand" | "warning" | "danger" {
    if (avg >= 14) return "success";
    if (avg >= 10) return "brand";
    if (avg >= 8) return "warning";
    return "danger";
}

function pickSubjectIcon(name: string): IconName {
    const n = name.toLowerCase();
    if (/(math|géom|algeb|calcul)/.test(n)) return "chart";
    if (/(franç|litt|philo|histoire|géo|civique)/.test(n)) return "book";
    if (/(svt|biolog|physiq|chim|techn|sciences)/.test(n)) return "sparkle";
    if (/(angl|espagn|allem|portug|langue)/.test(n)) return "sms";
    if (/(eps|sport)/.test(n)) return "flame";
    return "book";
}

function firstName(full: string): string {
    return full.trim().split(" ")[0];
}
