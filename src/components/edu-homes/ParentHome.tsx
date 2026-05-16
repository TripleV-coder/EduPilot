"use client";

import * as React from "react";
import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    NotifItem,
} from "@/components/edu";
import { PageHeader, SubLabel, formatFcfa } from "./_shared";

export interface ParentPayment {
    id: string;
    childName: string;
    label: string;
    amount: number;
    dueDate: string | null;
    state: "paid" | "due" | "overdue";
}

export interface ParentChild {
    name: string;
    myAverage: number;
    myRank: number | null;
    attendanceRate: number;
    subjectPerformances: { name: string; average: number }[];
    monthlyTrend: { name: string; value: number }[];
}

export interface ParentHomeProps {
    userName: string;
    schoolName: string | null;
    periodName: string | null;
    data: {
        children: ParentChild[];
        pendingPayments?: ParentPayment[];
        totalDue?: number;
        nextDueDate?: string | null;
    };
}

export function ParentHome({ userName, schoolName, periodName, data }: ParentHomeProps) {
    const sub = data.children.length
        ? `${data.children.map((c) => firstName(c.name)).join(" · ")} — voici ce qui compte aujourd'hui`
        : "Aucun enfant rattaché à ce compte pour le moment";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                greeting={`Bonjour ${shortName(userName)}`}
                sub={sub}
                actions={
                    <Button variant="secondary" icon="sms">
                        Contacter l&apos;école
                    </Button>
                }
            />

            {data.children.length === 0 ? (
                <Card>
                    <SubLabel>Aucun enfant</SubLabel>
                    <p
                        style={{
                            fontSize: 13,
                            color: "var(--eduflow-text-secondary)",
                            lineHeight: 1.55,
                        }}
                    >
                        Demande à l&apos;école de rattacher tes enfants à ton compte parent. Une fois
                        rattachés, leur tableau de bord apparaîtra ici.
                    </p>
                </Card>
            ) : (
                <>
                    {/* Children cards */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                data.children.length > 1
                                    ? "repeat(auto-fit, minmax(320px, 1fr))"
                                    : "minmax(0, 1fr)",
                            gap: 16,
                        }}
                    >
                        {data.children.map((child) => (
                            <ChildCard key={child.name} child={child} periodName={periodName} />
                        ))}
                    </div>

                    {data.pendingPayments && data.pendingPayments.length > 0 ? (
                        <PaymentsSection
                            payments={data.pendingPayments}
                            totalDue={data.totalDue ?? 0}
                            nextDueDate={data.nextDueDate ?? null}
                        />
                    ) : null}

                    {/* Activity */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
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
                                        Performances par matière
                                    </h3>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            margin: "2px 0 0",
                                        }}
                                    >
                                        {schoolName ?? "École"} · {periodName ?? "Période en cours"}
                                    </p>
                                </div>
                            </div>
                            <div>
                                {gatherSubjects(data.children).slice(0, 8).map((row, i) => (
                                    <div
                                        key={`${row.child}-${row.subject}`}
                                        className="grid items-center gap-3 px-5 py-3"
                                        style={{
                                            gridTemplateColumns: "1fr auto auto",
                                            borderTop:
                                                i > 0
                                                    ? "1px solid var(--eduflow-border-subtle)"
                                                    : "none",
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                                {row.subject}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                {row.child}
                                            </div>
                                        </div>
                                        <span
                                            className="eduflow-display eduflow-tabular"
                                            style={{
                                                fontSize: 18,
                                                fontWeight: 700,
                                                color: `var(--eduflow-${pickSubjectVariant(row.average)}-700)`,
                                            }}
                                        >
                                            {row.average.toFixed(1).replace(".", ",")}
                                        </span>
                                        <Badge
                                            variant={pickSubjectVariant(row.average)}
                                            size="sm"
                                        >
                                            /20
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card padding={0}>
                            <div
                                className="border-b px-5 py-4"
                                style={{ borderColor: "var(--eduflow-border-subtle)" }}
                            >
                                <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                    Activité récente
                                </h3>
                            </div>
                            <div className="px-2 py-2">
                                {data.children.slice(0, 3).map((child) => {
                                    const top = child.subjectPerformances[0];
                                    return (
                                        <NotifItem
                                            key={child.name}
                                            type={child.attendanceRate >= 92 ? "success" : "warning"}
                                            title={`${firstName(child.name)} · moyenne ${child.myAverage
                                                .toFixed(2)
                                                .replace(".", ",")}/20`}
                                            body={
                                                top
                                                    ? `Top matière : ${top.name} (${top.average
                                                          .toFixed(1)
                                                          .replace(".", ",")}/20) · présence ${child.attendanceRate
                                                          .toFixed(0)}%`
                                                    : `Présence ${child.attendanceRate.toFixed(0)}%`
                                            }
                                            time="cette semaine"
                                        />
                                    );
                                })}
                                <NotifItem
                                    type="info"
                                    title="Réunion parents"
                                    body="Pense à consulter le calendrier scolaire pour les prochaines dates."
                                    time="à venir"
                                />
                            </div>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}

function ChildCard({
    child,
    periodName,
}: {
    child: ParentChild;
    periodName: string | null;
}) {
    const firstSubject = child.subjectPerformances[0];
    const isAtRisk = child.attendanceRate < 90 || child.myAverage < 10;
    const accent = isAtRisk ? "warning" : "brand";

    return (
        <Card padding={0} style={{ overflow: "hidden" }}>
            <div
                className="flex items-center gap-4 border-b px-5 py-5"
                style={{
                    background: `var(--eduflow-${accent}-50)`,
                    borderColor: "var(--eduflow-border-subtle)",
                }}
            >
                <Avatar name={child.name} size="xl" />
                <div className="min-w-0 flex-1">
                    <div
                        className="eduflow-display"
                        style={{
                            fontSize: 22,
                            fontWeight: 700,
                            letterSpacing: "-0.025em",
                            lineHeight: 1.15,
                        }}
                    >
                        {child.name}
                    </div>
                    <div
                        style={{ fontSize: 12, color: "var(--eduflow-text-secondary)", marginTop: 2 }}
                    >
                        {periodName ?? "Période en cours"}
                    </div>
                    {firstSubject ? (
                        <div className="mt-2">
                            <Badge variant={pickSubjectVariant(firstSubject.average)}>
                                {firstSubject.name} · {firstSubject.average.toFixed(1).replace(".", ",")}/20
                            </Badge>
                        </div>
                    ) : null}
                </div>
                <Icon name="chevron" size={18} color="var(--eduflow-text-tertiary)" />
            </div>
            <div
                className="grid gap-3 px-5 py-5"
                style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
            >
                <Stat label="Moyenne" value={child.myAverage.toFixed(2).replace(".", ",")} unit="/20" />
                <Stat
                    label="Présence"
                    value={child.attendanceRate.toFixed(0)}
                    unit="%"
                    progress={child.attendanceRate}
                />
                <Stat
                    label="Classement"
                    value={child.myRank ? `${child.myRank}` : "—"}
                    unit={child.myRank ? "ᵉ" : undefined}
                />
            </div>
        </Card>
    );
}

function Stat({
    label,
    value,
    unit,
    progress,
}: {
    label: string;
    value: string;
    unit?: string;
    progress?: number;
}) {
    return (
        <div>
            <div
                style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--eduflow-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display eduflow-tabular"
                style={{ fontSize: 26, fontWeight: 700, marginTop: 4, lineHeight: 1.05 }}
            >
                {value}
                {unit ? (
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--eduflow-text-tertiary)",
                            fontWeight: 600,
                            marginLeft: 2,
                        }}
                    >
                        {unit}
                    </span>
                ) : null}
            </div>
            {progress != null ? (
                <div
                    className="mt-2"
                    style={{
                        height: 4,
                        background: "var(--eduflow-neutral-200)",
                        borderRadius: 2,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            height: "100%",
                            width: `${Math.min(100, Math.max(0, progress))}%`,
                            background:
                                progress >= 92
                                    ? "var(--eduflow-success-500)"
                                    : "var(--eduflow-warning-500)",
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
}

function PaymentsSection({
    payments,
    totalDue,
    nextDueDate,
}: {
    payments: ParentPayment[];
    totalDue: number;
    nextDueDate: string | null;
}) {
    const hasOverdue = payments.some((p) => p.state === "overdue");
    const banner = nextDueDate
        ? formatDueLine(nextDueDate)
        : "Aucune échéance immédiate";
    return (
        <Card padding={0} style={{ overflow: "hidden" }}>
            <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: "var(--eduflow-border-subtle)" }}
            >
                <div>
                    <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                        Paiements de scolarité
                    </h3>
                    <p
                        style={{
                            fontSize: 11,
                            color: "var(--eduflow-text-tertiary)",
                            margin: "2px 0 0",
                        }}
                    >
                        Plans actifs · {payments.length} échéance
                        {payments.length > 1 ? "s" : ""}
                    </p>
                </div>
                {hasOverdue ? (
                    <Badge variant="danger" icon="warning">
                        Échéance dépassée
                    </Badge>
                ) : (
                    <Badge variant="warning" icon="clock">
                        {banner}
                    </Badge>
                )}
            </div>
            <div>
                {payments.map((p, i) => (
                    <div
                        key={p.id}
                        className="grid items-center gap-4 px-5 py-3"
                        style={{
                            gridTemplateColumns: "1fr auto auto",
                            borderTop:
                                i > 0
                                    ? "1px solid var(--eduflow-border-subtle)"
                                    : "none",
                        }}
                    >
                        <div className="min-w-0">
                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                {p.childName} · {p.label}
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color:
                                        p.state === "overdue"
                                            ? "var(--eduflow-danger-700)"
                                            : p.state === "due"
                                            ? "var(--eduflow-warning-700)"
                                            : "var(--eduflow-text-tertiary)",
                                    marginTop: 2,
                                }}
                            >
                                {p.state === "paid"
                                    ? `Payé · ${formatDate(p.dueDate)}`
                                    : p.state === "overdue"
                                    ? `Retard · échéance ${formatDate(p.dueDate)}`
                                    : `Échéance ${formatRelativeDue(p.dueDate)}`}
                            </div>
                        </div>
                        <span
                            className="eduflow-display eduflow-tabular"
                            style={{ fontSize: 18, fontWeight: 700 }}
                        >
                            {formatFcfa(p.amount)}
                            <span
                                style={{
                                    fontSize: 10,
                                    color: "var(--eduflow-text-tertiary)",
                                    fontWeight: 600,
                                    marginLeft: 4,
                                }}
                            >
                                FCFA
                            </span>
                        </span>
                        {p.state === "paid" ? (
                            <Badge variant="success" icon="check">
                                Payé
                            </Badge>
                        ) : (
                            <Button size="sm" icon="money">
                                Payer
                            </Button>
                        )}
                    </div>
                ))}
            </div>
            {totalDue > 0 ? (
                <div
                    className="flex items-center justify-between px-5 py-3"
                    style={{ background: "var(--eduflow-surface-sunken)" }}
                >
                    <span
                        style={{
                            fontSize: 12,
                            color: "var(--eduflow-text-secondary)",
                        }}
                    >
                        Total restant à payer
                        {nextDueDate ? ` · échéance ${formatDate(nextDueDate)}` : ""}
                    </span>
                    <span
                        className="eduflow-display eduflow-tabular"
                        style={{ fontSize: 22, fontWeight: 700 }}
                    >
                        {formatFcfa(totalDue)}{" "}
                        <span style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                            FCFA
                        </span>
                    </span>
                </div>
            ) : null}
        </Card>
    );
}

function formatDate(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
    }).format(d);
}

function formatRelativeDue(iso: string | null): string {
    if (!iso) return "à venir";
    const d = new Date(iso);
    const diff = d.getTime() - Date.now();
    const days = Math.round(diff / (24 * 60 * 60 * 1000));
    if (days < 0) return `il y a ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}`;
    if (days === 0) return "aujourd'hui";
    if (days === 1) return "demain";
    if (days <= 14) return `dans ${days} jours`;
    return formatDate(iso);
}

function formatDueLine(iso: string): string {
    const rel = formatRelativeDue(iso);
    return `Prochaine échéance ${rel}`;
}

function gatherSubjects(children: ParentChild[]) {
    const rows: { child: string; subject: string; average: number }[] = [];
    for (const c of children) {
        for (const s of c.subjectPerformances.slice(0, 4)) {
            rows.push({ child: firstName(c.name), subject: s.name, average: s.average });
        }
    }
    return rows.sort((a, b) => b.average - a.average);
}

function pickSubjectVariant(avg: number): "success" | "brand" | "warning" | "danger" {
    if (avg >= 14) return "success";
    if (avg >= 10) return "brand";
    if (avg >= 8) return "warning";
    return "danger";
}

function shortName(full: string): string {
    const parts = full.trim().split(" ");
    if (parts.length === 1) return parts[0];
    return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

function firstName(full: string): string {
    return full.trim().split(" ")[0];
}
