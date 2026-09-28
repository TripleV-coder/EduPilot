"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/edu";
import { formatFcfa, formatNumber, frenchToday } from "./_shared";
import styles from "./home.module.css";
import { isPageAllowedByModules } from "@/lib/modules/catalog";

export interface DirectorHomeProps {
    /** « finance » : accueil de la comptabilité — actions et liens limités aux pages qui lui sont ouvertes. */
    focus?: "school" | "finance";
    /** Modules actifs de l'établissement : une action vers un module éteint n'est pas proposée. */
    enabledModules?: readonly string[];
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
        /** Recouvrement de l'année sur l'attendu réel ; null si rien n'est facturé. */
        feeRecoveryRate?: number | null;
        feesCollected?: number | null;
        studentGrowth: number;
        attendanceGrowth: number;
        averageGrowth: number;
        activeAlerts: number;
        classSummary: { id?: string; name: string; average: number; studentCount: number }[];
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

/* Direction « colorée et vivante », priorité vue d'ensemble
   (docs/design/directions/direction-approved.md). Une couleur par module. */
const MODULE = {
    blue: "var(--edu-module-blue)",
    green: "var(--edu-module-green)",
    orange: "var(--edu-module-orange)",
    purple: "var(--edu-module-purple)",
    pink: "var(--edu-module-pink)",
    teal: "var(--edu-module-teal)",
} as const;
const CLASS_COLORS = [MODULE.blue, MODULE.orange, MODULE.purple, MODULE.green, MODULE.teal, MODULE.pink];

const QUICK_ACTIONS: { href: string; label: string; icon: IconName; color: string }[] = [
    { href: "/dashboard/attendance", label: "Faire l'appel", icon: "check", color: MODULE.blue },
    { href: "/dashboard/grades/entry", label: "Saisir des notes", icon: "book", color: MODULE.green },
    { href: "/dashboard/finance/payments/new", label: "Encaisser un paiement", icon: "money", color: MODULE.orange },
    { href: "/dashboard/announcements", label: "Nouvelle annonce", icon: "sms", color: MODULE.purple },
    { href: "/dashboard/students/inscription", label: "Inscrire un élève", icon: "plus", color: MODULE.teal },
    { href: "/dashboard/grades/bulletins", label: "Bulletins", icon: "cards", color: MODULE.pink },
];

const FINANCE_ACTIONS: { href: string; label: string; icon: IconName; color: string }[] = [
    { href: "/dashboard/finance/payments/new", label: "Encaisser un paiement", icon: "money", color: MODULE.orange },
    { href: "/dashboard/finance/reconciliation", label: "Valider les paiements", icon: "check", color: MODULE.green },
    { href: "/dashboard/finance/bulk-invoice", label: "Avis de paiement", icon: "cards", color: MODULE.blue },
    { href: "/dashboard/finance", label: "Suivi des impayés", icon: "warning", color: MODULE.pink },
    { href: "/dashboard/accounting", label: "Comptabilité", icon: "chart", color: MODULE.purple },
    { href: "/dashboard/students", label: "Élèves", icon: "users", color: MODULE.teal },
];

const decimal = (value: number, digits = 1) => value.toFixed(digits).replace(".", ",");
const signed = (value: number, unit: string) =>
    `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}${unit}`;

function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function riskLabel(level: string): string {
    const l = level.toLowerCase();
    if (l === "critical") return "risque critique";
    if (l === "high") return "risque élevé";
    if (l === "medium" || l === "moderate") return "risque modéré";
    return "à suivre";
}

export function DirectorHome({ focus = "school", enabledModules, userName, schoolName, periodName, data }: DirectorHomeProps) {
    const finance = focus === "finance";
    const collectionRate = data.feeRecoveryRate == null ? null : Math.round(data.feeRecoveryRate);
    const firstName = userName.trim().split(/\s+/)[0] || userName;

    const figures = [
        {
            href: "/dashboard/students",
            label: "Élèves",
            value: formatNumber(data.totalStudents),
            note: Number.isFinite(data.studentGrowth) ? `${signed(data.studentGrowth, " %")} ce mois` : "Effectif actif",
            color: MODULE.blue,
        },
        {
            href: finance ? undefined : "/dashboard/attendance",
            label: "Présence",
            value: `${decimal(data.attendanceRate)} %`,
            note: Number.isFinite(data.attendanceGrowth) ? `${signed(data.attendanceGrowth, " pt")} ce mois` : "Taux de présence",
            color: MODULE.green,
        },
        {
            href: "/dashboard/finance",
            label: "Frais réglés",
            value: collectionRate === null ? "—" : `${collectionRate} %`,
            note:
                collectionRate === null
                    ? "Aucun frais facturé cette année"
                    : `${formatFcfa(data.feesCollected ?? 0)} FCFA encaissés`,
            color: MODULE.orange,
        },
        {
            href: finance ? undefined : "/dashboard/risks/failure",
            // activeAlerts compte les alertes ouvertes, pas les élèves en échec :
            // le libellé dit ce que le chiffre mesure.
            label: "Alertes ouvertes",
            value: formatNumber(data.activeAlerts),
            note: `${decimal(data.failureRate)} % des élèves en échec`,
            color: MODULE.pink,
        },
    ];

    const watched = data.atRiskStudents.slice(0, 4);

    return (
        <div className={styles.page}>
            <header className={styles.head}>
                <div>
                    <h1 className={styles.title}>Bonjour, {firstName}</h1>
                    <p className={styles.sub}>
                        {frenchToday()} · {periodName ?? "Année en cours"}
                        {schoolName ? ` · ${schoolName}` : ""}
                    </p>
                </div>
            </header>

            {/* Rangée 1 : chiffres (2/3) + à surveiller (1/3), hauteurs comparables. */}
            <div className={styles.top}>
            <section className={styles.block} aria-labelledby="home-overview">
                <div className={styles.blockHead}>
                    <h2 id="home-overview" className={styles.blockTitle}>Vue d&apos;ensemble</h2>
                    {finance ? null : <Link href="/dashboard/analytics" className={styles.link}>Analyses</Link>}
                </div>
                {data.totalStudents === 0 ? (
                    // Aucun élève encore : pas de « 0,0 % » qui ressemblerait à une mesure.
                    <div className={styles.onboard}>
                        <p className={styles.empty}>
                            Aucun élève inscrit pour l&apos;instant. Les chiffres apparaîtront dès les premières inscriptions.
                        </p>
                        <div className={styles.onboardActions}>
                            <Link href="/dashboard/students/inscription" className={styles.primary}>Inscrire le premier élève</Link>
                            <Link href="/dashboard/import" className={styles.pill}>Importer un fichier</Link>
                        </div>
                    </div>
                ) : (
                <div className={styles.figs}>
                    {figures.map((f) => {
                        const inner = (
                            <>
                                <span className={styles.figLabel}>
                                    <span className={styles.dot} style={{ background: f.color }} aria-hidden="true" />
                                    {f.label}
                                </span>
                                <span className={styles.figValue} style={{ display: "block" }}>{f.value}</span>
                                <span className={styles.figNote} style={{ display: "block" }}>{f.note}</span>
                            </>
                        );
                        return f.href ? (
                            <Link key={f.label} href={f.href} className={styles.fig}>{inner}</Link>
                        ) : (
                            <div key={f.label} className={styles.fig}>{inner}</div>
                        );
                    })}
                </div>
                )}
            </section>

            <section className={styles.block} aria-labelledby="home-watch">
                <div className={styles.blockHead}>
                    <h2 id="home-watch" className={styles.blockTitle}>À surveiller</h2>
                    {finance ? null : <Link href="/dashboard/risks/failure" className={styles.link}>Tout voir</Link>}
                </div>
                {watched.length === 0 && data.pendingPayments <= 0 ? (
                    <p className={styles.calm}>
                        <Icon name="success" size={20} color={MODULE.green} />
                        Rien à signaler : aucun élève à risque élevé ni paiement en attente.
                    </p>
                ) : (
                    <ul className={styles.watch}>
                        {watched.map((s) => (
                            <li key={s.id} className={styles.watchItem}>
                                <span
                                    className={styles.avatar}
                                    style={{ background: s.riskLevel.toLowerCase() === "critical" ? MODULE.pink : MODULE.orange }}
                                    aria-hidden="true"
                                >
                                    {initials(s.name)}
                                </span>
                                <div>
                                    <div className={styles.name}>{s.name}</div>
                                    <div className={styles.detail}>
                                        {s.className} · moyenne {decimal(s.average, 2)}/20 · {riskLabel(s.riskLevel)}
                                    </div>
                                </div>
                                <Link href={`/dashboard/students/${s.id}`} className={styles.pill}>
                                    Voir le dossier
                                </Link>
                            </li>
                        ))}
                        {data.pendingPayments > 0 ? (
                            <li className={styles.watchItem}>
                                <span className={styles.avatar} style={{ background: MODULE.orange }} aria-hidden="true">
                                    <Icon name="money" size={18} color="#fff" />
                                </span>
                                <div>
                                    <div className={styles.name}>Paiements à valider</div>
                                    <div className={styles.detail}>{formatFcfa(data.pendingPayments)} FCFA déclarés, en attente de validation</div>
                                </div>
                                <Link href="/dashboard/finance/reconciliation" className={styles.pill}>Valider</Link>
                            </li>
                        ) : null}
                    </ul>
                )}
            </section>

            </div>

            <section className={styles.block} aria-labelledby="home-actions">
                <div className={styles.blockHead}>
                    <h2 id="home-actions" className={styles.blockTitle}>Actions rapides</h2>
                </div>
                <div className={styles.tiles}>
                    {(finance ? FINANCE_ACTIONS : QUICK_ACTIONS).filter((a) => isPageAllowedByModules(a.href, enabledModules)).map((a) => (
                        <Link key={a.href} href={a.href} className={styles.tile}>
                            <span className={styles.tileIcon} style={{ background: a.color }} aria-hidden="true">
                                <Icon name={a.icon} size={18} color="#fff" />
                            </span>
                            {a.label}
                        </Link>
                    ))}
                </div>
            </section>

            {finance ? null : (
            <section className={styles.block} aria-labelledby="home-classes">
                <div className={styles.blockHead}>
                    <h2 id="home-classes" className={styles.blockTitle}>Mes classes</h2>
                    <Link href="/dashboard/classes" className={styles.link}>
                        {data.totalClasses > 0 ? `Les ${formatNumber(data.totalClasses)} classes` : "Toutes les classes"}
                    </Link>
                </div>
                {data.classSummary.length === 0 ? (
                    <p className={styles.empty}>Aucune moyenne publiée pour {periodName ?? "cette période"} pour l&apos;instant.</p>
                ) : (
                    <div className={styles.classes}>
                        {data.classSummary.slice(0, 10).map((c, i) => (
                            <Link
                                key={c.id ?? c.name}
                                href={c.id ? `/dashboard/classes/${c.id}` : "/dashboard/classes"}
                                className={styles.classCard}
                            >
                                <div className={styles.banner} style={{ background: CLASS_COLORS[i % CLASS_COLORS.length] }}>
                                    <span className={styles.className}>{c.name}</span>
                                    <span className={styles.classMeta}>{formatNumber(c.studentCount)} élèves</span>
                                </div>
                                <div className={styles.classBody}>
                                    <span>Moyenne</span>
                                    <span>{c.average > 0 ? `${decimal(c.average)}/20` : "—"}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
            )}
        </div>
    );
}
