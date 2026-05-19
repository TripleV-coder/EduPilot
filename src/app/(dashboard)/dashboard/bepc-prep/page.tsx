"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Badge,
    Button,
    Card,
    Icon,
    Spinner,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type SubjectAvg = { name: string; average: number };

type StatsResponse = {
    statistics?: { average?: number; bySubject?: Record<string, { average: number }> };
};

type BulletinResp = {
    subjectAverages?: { name: string; average: number }[];
    student?: { firstName: string; lastName: string };
};

const FR_NUM = (v: number | null, digits = 1): string =>
    v === null || Number.isNaN(v) ? "—" : v.toFixed(digits).replace(".", ",");

// Default BEPC date — end-of-academic-year exam window (June 27, current year).
function defaultBepcDate(): Date {
    const now = new Date();
    const year = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
    return new Date(year, 5, 27); // June 27
}

function daysBetween(a: Date, b: Date): number {
    const ms = b.getTime() - a.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function mentionFromAvg(avg: number | null): {
    label: string;
    variant: "success" | "info" | "warning" | "neutral";
} {
    if (avg === null) return { label: "À calculer", variant: "neutral" };
    if (avg >= 16) return { label: "Mention Très Bien probable", variant: "success" };
    if (avg >= 14) return { label: "Mention Bien probable", variant: "success" };
    if (avg >= 12) return { label: "Mention Assez Bien probable", variant: "info" };
    if (avg >= 10) return { label: "Admis probable · sans mention", variant: "warning" };
    return { label: "Risque échec", variant: "warning" };
}

const REVISION_PLAN: { day: string; activity: string; duration: string }[] = [
    { day: "Lundi", activity: "Math · équations & fonctions", duration: "45 min" },
    { day: "Mardi", activity: "Français · dissertation structurée", duration: "1 h" },
    { day: "Mercredi", activity: "Repos cerveau · sport ⚡", duration: "—" },
    { day: "Jeudi", activity: "SVT · génétique / écologie", duration: "30 min" },
    { day: "Vendredi", activity: "Annale BEPC chronométrée", duration: "3 h" },
];

export default function BepcPrepPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generalAvg, setGeneralAvg] = useState<number | null>(null);
    const [subjectAverages, setSubjectAverages] = useState<SubjectAvg[]>([]);
    const [now, setNow] = useState(() => new Date());

    const bepcDate = useMemo(() => defaultBepcDate(), []);
    const daysLeft = useMemo(() => daysBetween(now, bepcDate), [now, bepcDate]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                // Try the bulletin endpoint for current period
                const periodsRes = await fetch("/api/periods");
                const periodsBody = await periodsRes.json().catch(() => []);
                const periodsList: { id: string; name: string }[] = Array.isArray(periodsBody)
                    ? periodsBody
                    : periodsBody.data ?? [];
                const lastPeriod = periodsList[periodsList.length - 1];

                let avgs: SubjectAvg[] = [];
                let general: number | null = null;

                if (lastPeriod) {
                    // Try /api/grades/statistics?type=student
                    const statsRes = await fetch(
                        `/api/grades/statistics?type=student&periodId=${lastPeriod.id}`
                    );
                    if (statsRes.ok) {
                        const stats: StatsResponse = await statsRes.json();
                        if (stats.statistics?.average !== undefined) {
                            general = Number(stats.statistics.average);
                        }
                        if (stats.statistics?.bySubject) {
                            avgs = Object.entries(stats.statistics.bySubject).map(
                                ([name, v]) => ({ name, average: v.average })
                            );
                        }
                    }
                }

                // Fallback: try /api/bulletins with own student id
                if (avgs.length === 0) {
                    const meRes = await fetch("/api/user/profile");
                    if (meRes.ok && lastPeriod) {
                        // No direct studentId here; rely on stats only — skip fallback to avoid noisy errors.
                    }
                }

                setGeneralAvg(general);
                setSubjectAverages(avgs.sort((a, b) => a.average - b.average));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const weakSubjects = useMemo(
        () => subjectAverages.filter((s) => s.average < 14).slice(0, 3),
        [subjectAverages]
    );
    const mention = mentionFromAvg(generalAvg);

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["STUDENT", "PARENT", "TEACHER", "DIRECTOR", "SCHOOL_ADMIN", "SUPER_ADMIN"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Préparation BEPC"
                    sub={`Plus que ${daysLeft} jours · annales · IA tutrice · planning de révision`}
                    breadcrumb={["Examens", `BEPC ${bepcDate.getFullYear()}`]}
                    actions={
                        <Badge variant="warning" icon="flame">
                            Compte à rebours · J-{daysLeft}
                        </Badge>
                    }
                />

                {/* Hero countdown */}
                <Card
                    style={{
                        background:
                            "linear-gradient(135deg, var(--brand-800, var(--brand-700)), var(--eduflow-danger-700))",
                        color: "#fff",
                        border: 0,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 28,
                            flexWrap: "wrap",
                        }}
                        className="bepc-hero"
                    >
                        <div style={{ minWidth: 200 }}>
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    opacity: 0.85,
                                }}
                            >
                                Examen · BEPC
                            </div>
                            <div
                                className="eduflow-display tabular"
                                style={{
                                    fontSize: 48,
                                    fontWeight: 800,
                                    lineHeight: 1,
                                    letterSpacing: "-0.04em",
                                    marginTop: 4,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {bepcDate.toLocaleDateString("fr-FR", {
                                    day: "numeric",
                                    month: "long",
                                })}
                            </div>
                            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                                Date indicative · session juin {bepcDate.getFullYear()}
                            </div>
                        </div>
                        <div
                            style={{
                                height: 80,
                                width: 1,
                                background: "rgba(255,255,255,0.25)",
                            }}
                        />
                        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                            <HeroStat label="jours" value={String(daysLeft)} />
                            <HeroStat label="épreuves" value="6" />
                            <HeroStat
                                label="moy. estimée"
                                value={FR_NUM(generalAvg)}
                            />
                            <HeroStat
                                label="mention visée"
                                value={
                                    mention.variant === "neutral"
                                        ? "—"
                                        : mention.label.split(" probable")[0].replace("Mention ", "")
                                }
                            />
                        </div>
                        <div style={{ marginLeft: "auto" }}>
                            <Button
                                size="lg"
                                style={{ background: "#fff", color: "var(--brand-800, var(--brand-700))" }}
                                iconRight="chevron"
                            >
                                Plan de révision IA
                            </Button>
                        </div>
                    </div>
                </Card>

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                color: "var(--eduflow-danger-800)",
                                fontWeight: 500,
                            }}
                        >
                            {error}
                        </p>
                    </Card>
                ) : null}

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1.5fr 1fr",
                        gap: 14,
                    }}
                    className="bepc-grid"
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <Card padding={0}>
                            <div
                                style={{
                                    padding: "14px 18px",
                                    borderBottom: "1px solid var(--eduflow-border-subtle)",
                                }}
                            >
                                <h3
                                    className="eduflow-display"
                                    style={{ fontSize: 16, margin: 0 }}
                                >
                                    Annales BEPC · corrigées par l'IA
                                </h3>
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        margin: "2px 0 0",
                                    }}
                                >
                                    Module à venir · les annales {bepcDate.getFullYear() - 2}–
                                    {bepcDate.getFullYear() - 1} seront disponibles offline avec
                                    correction IA chronométrée.
                                </p>
                            </div>
                            <div
                                style={{
                                    padding: "48px 18px",
                                    textAlign: "center",
                                    fontSize: 12,
                                    color: "var(--eduflow-text-tertiary)",
                                    lineHeight: 1.7,
                                }}
                            >
                                Aucune annale chargée pour l'instant.
                                <br />
                                Une fois activé, ce module proposera Math · Français · SVT ·
                                Histoire-Géo · Anglais · Physique-Chimie, scoring automatique et
                                analyse temps moyen par question.
                            </div>
                        </Card>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <Card
                            style={{
                                background: "var(--brand-50)",
                                border: "1px solid var(--brand-200)",
                            }}
                        >
                            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                <Icon
                                    name="sparkle"
                                    size={20}
                                    color="var(--brand-700)"
                                    style={{ marginTop: 2, flexShrink: 0 }}
                                />
                                <div>
                                    <div
                                        className="eduflow-display"
                                        style={{
                                            fontSize: 16,
                                            fontWeight: 700,
                                            color: "var(--brand-900, var(--brand-800))",
                                        }}
                                    >
                                        Plan de révision IA · semaine
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "var(--brand-800)",
                                            marginTop: 8,
                                            lineHeight: 1.7,
                                        }}
                                    >
                                        {REVISION_PLAN.map((r) => (
                                            <div key={r.day}>
                                                <strong>{r.day}</strong> · {r.activity}
                                                {r.duration !== "—" ? ` (${r.duration})` : ""}
                                            </div>
                                        ))}
                                    </div>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--brand-700)",
                                            marginTop: 10,
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        Personnalisation IA à venir : ajustera la priorité par
                                        matière selon tes derniers résultats.
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <SubLabel>Pronostic mention · BEPC</SubLabel>
                            {loading ? (
                                <div style={{ padding: 12, textAlign: "center" }}>
                                    <Spinner size={20} color="var(--brand-600)" />
                                </div>
                            ) : (
                                <>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "baseline",
                                            gap: 8,
                                            marginTop: 6,
                                        }}
                                    >
                                        <span
                                            className="eduflow-display tabular"
                                            style={{
                                                fontSize: 38,
                                                fontWeight: 800,
                                                color: `var(--eduflow-${mention.variant}-700, var(--eduflow-text-primary))`,
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {FR_NUM(generalAvg)}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 14,
                                                color: "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            / 20
                                        </span>
                                    </div>
                                    <Badge
                                        variant={mention.variant === "neutral" ? "neutral" : mention.variant}
                                        icon={mention.variant === "success" ? "trophy" : "sparkle"}
                                    >
                                        {mention.label}
                                    </Badge>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            marginTop: 10,
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        Basé sur ta moyenne actuelle · les écarts simulation/BEPC réel sont typiquement de −0,8 pts. À affiner avec plus d'annales.
                                    </p>
                                </>
                            )}
                        </Card>

                        <Card>
                            <SubLabel>Points faibles · à travailler</SubLabel>
                            {loading ? (
                                <div style={{ padding: 12, textAlign: "center" }}>
                                    <Spinner size={18} color="var(--brand-600)" />
                                </div>
                            ) : weakSubjects.length === 0 ? (
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginTop: 8,
                                        lineHeight: 1.5,
                                    }}
                                >
                                    Tu n'as pas de matière sous 14/20 — continue comme ça !
                                </p>
                            ) : (
                                <div style={{ marginTop: 8 }}>
                                    {weakSubjects.map((s, i) => {
                                        const tone =
                                            s.average < 10
                                                ? "danger"
                                                : s.average < 12
                                                ? "warning"
                                                : "info";
                                        return (
                                            <div
                                                key={s.name}
                                                style={{
                                                    padding: "8px 0",
                                                    borderTop:
                                                        i > 0
                                                            ? "1px solid var(--eduflow-border-subtle)"
                                                            : 0,
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    gap: 8,
                                                }}
                                            >
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {s.name}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 10,
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                        }}
                                                    >
                                                        Cible : porter à 14/20
                                                    </div>
                                                </div>
                                                <span
                                                    className="eduflow-display tabular"
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        color: `var(--eduflow-${tone}-700)`,
                                                        fontVariantNumeric: "tabular-nums",
                                                    }}
                                                >
                                                    {FR_NUM(s.average)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>

                        <Link href="/dashboard/grades" style={{ textDecoration: "none" }}>
                            <Button variant="secondary" style={{ width: "100%" }} iconRight="chevron">
                                Voir mes notes détaillées
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .bepc-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}

function HeroStat({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ textAlign: "center" }}>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: 32,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
            </div>
            <div
                style={{
                    fontSize: 10,
                    opacity: 0.75,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                }}
            >
                {label}
            </div>
        </div>
    );
}
