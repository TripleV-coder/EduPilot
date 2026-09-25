"use client";

import { formatFcfa, formatNumber, frenchToday } from "./_shared";
import { Block, ColorCards, Empty, Figures, HomeHeader, HomePage, MODULE, QuickActions, Row, WatchList, decimal, initials } from "./home-kit";

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
    /** null : aucun appel enregistré pour cet enfant. */
    attendanceRate: number | null;
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
        overdueCount?: number;
    };
}

/* Accueil parent — même langage que l'accueil direction validé (docs/design/directions/direction-approved.md).
   Plus de notification figée « Réunion parents » : seules des données réelles. */
export function ParentHome({ userName, schoolName, periodName, data }: ParentHomeProps) {
    const firstName = userName.trim().split(/\s+/)[0] || userName;
    const children = data.children;
    const payments = [...(data.pendingPayments ?? [])].sort((a, b) => (a.state === "overdue" ? -1 : 0) - (b.state === "overdue" ? -1 : 0));
    const measured = children.map((c) => c.attendanceRate).filter((r): r is number => r !== null);
    const avgAttendance = measured.length ? measured.reduce((s, r) => s + r, 0) / measured.length : null;
    const nextDue = data.nextDueDate ? new Date(data.nextDueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—";
    const overdue = data.overdueCount ?? payments.filter((p) => p.state === "overdue").length;
    const dueNote = overdue > 0
        ? `${overdue} paiement(s) en retard`
        : payments.length ? `${payments.length} paiement(s) en attente` : "rien en attente";
    return (
        <HomePage>
            <HomeHeader
                title={`Bonjour, ${firstName}`}
                sub={`${frenchToday()} · ${periodName ?? "Année en cours"}${schoolName ? ` · ${schoolName}` : ""}`}
            />
            {children.length === 0 ? (
                <Block id="parent-empty" title="Mes enfants">
                    <Empty>Aucun enfant n&apos;est encore rattaché à ce compte. Utilisez le code de liaison remis par l&apos;établissement.</Empty>
                </Block>
            ) : (
                <>
                    <Row>
                        <Block id="parent-overview" title="Vue d'ensemble" link={{ href: "/dashboard/finance", label: "Paiements" }}>
                            <Figures
                                items={[
                                    { label: "Enfants suivis", value: formatNumber(children.length), note: children.map((c) => c.name.split(" ")[0]).join(", "), color: MODULE.blue, href: "/dashboard/students" },
                                    { label: "Reste à payer", value: `${formatFcfa(data.totalDue ?? 0)}`, note: "FCFA", color: MODULE.orange, href: "/dashboard/finance" },
                                    { label: "Prochaine échéance", value: nextDue, note: dueNote, color: MODULE.pink },
                                    { label: "Présence", value: avgAttendance === null ? "—" : `${decimal(avgAttendance)} %`, note: avgAttendance === null ? "aucun appel enregistré" : "moyenne de mes enfants", color: MODULE.green },
                                ]}
                            />
                        </Block>
                        <Block id="parent-watch" title="À surveiller">
                            <WatchList
                                calm="Aucun paiement en attente."
                                items={payments.slice(0, 4).map((p) => ({
                                    key: p.id,
                                    avatar: initials(p.childName),
                                    color: p.state === "overdue" ? MODULE.pink : MODULE.orange,
                                    name: p.label,
                                    detail: `${p.childName} · ${formatFcfa(p.amount)} FCFA${p.state === "overdue" ? " · en retard" : p.dueDate ? ` · avant le ${new Date(p.dueDate).toLocaleDateString("fr-FR")}` : ""}`,
                                    action: { href: "/dashboard/finance", label: "Payer" },
                                }))}
                            />
                        </Block>
                    </Row>
                    <Block id="parent-actions" title="Actions rapides">
                        <QuickActions
                            actions={[
                                { href: "/dashboard/finance", label: "Payer en ligne", icon: "money", color: MODULE.orange },
                                { href: "/dashboard/students", label: "Mes enfants", icon: "users", color: MODULE.blue },
                                { href: "/dashboard/liaison", label: "Cahier de liaison", icon: "book", color: MODULE.purple },
                                { href: "/dashboard/schedule", label: "Emploi du temps", icon: "calendar", color: MODULE.green },
                                { href: "/dashboard/notifications", label: "Notifications", icon: "bell", color: MODULE.pink },
                                { href: "/dashboard/ai", label: "Assistant IA", icon: "sparkle", color: MODULE.teal },
                            ]}
                        />
                    </Block>
                    <Block id="parent-children" title="Mes enfants" link={{ href: "/dashboard/students", label: "Voir le détail" }}>
                        <ColorCards
                            items={children.map((c) => ({
                                key: c.name,
                                title: c.name,
                                meta: c.myAverage > 0 ? `Moyenne ${decimal(c.myAverage, 2)}/20${c.myRank ? ` · ${c.myRank}ᵉ` : ""}` : "Pas encore de moyenne",
                                footLabel: "Présence",
                                footValue: c.attendanceRate === null ? "—" : `${decimal(c.attendanceRate)} %`,
                                href: "/dashboard/students",
                            }))}
                        />
                    </Block>
                </>
            )}
        </HomePage>
    );
}
