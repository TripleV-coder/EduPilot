"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PageGuard } from "@/components/guard/page-guard";
import { CycleGuard } from "@/components/guard/cycle-guard";
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

type ExamItem = {
    id: string;
    title: string;
    isPublished: boolean;
    duration: number;
    totalPoints: number;
    _count: { questions: number };
    classSubject: {
        subject: { name: string };
        class: { name: string };
    };
};

type ReadinessResponse = {
    overallReadiness: number;
    predictedSuccess: number;
    weakAreas: string[];
    strongAreas: string[];
};

const BEPC_SUBJECT_NAMES = [
    "Mathématiques", "Français", "Anglais", "SVT",
    "Sciences de la Vie et de la Terre",
    "Physique-Chimie", "Physique-Chimie-Technologie",
    "Histoire-Géographie", "Éducation Physique et Sportive",
];

function isBepcSubject(name: string): boolean {
    return BEPC_SUBJECT_NAMES.some((s) => name.toLowerCase().includes(s.toLowerCase().split(" ")[0]));
}

const FR_NUM = (v: number | null, digits = 1): string =>
    v === null || Number.isNaN(v) ? "—" : v.toFixed(digits).replace(".", ",");

function defaultBepcDate(): Date {
    const now = new Date();
    const year = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
    return new Date(year, 5, 27);
}

function daysBetween(a: Date, b: Date): number {
    return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
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
    const [exams, setExams] = useState<ExamItem[]>([]);
    const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
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
                // 1. Fetch periods + grades stats + exams + profile in parallel
                const [periodsRes, examsRes, profileRes] = await Promise.all([
                    fetch("/api/periods"),
                    fetch("/api/exams"),
                    fetch("/api/user/profile"),
                ]);

                // Grades stats
                const periodsBody = await periodsRes.json().catch(() => []);
                const periodsList: { id: string; name: string }[] = Array.isArray(periodsBody)
                    ? periodsBody
                    : periodsBody.data ?? [];
                const lastPeriod = periodsList[periodsList.length - 1];

                let avgs: SubjectAvg[] = [];
                let general: number | null = null;

                if (lastPeriod) {
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

                setGeneralAvg(general);
                setSubjectAverages(avgs.sort((a, b) => a.average - b.average));

                // Exams
                if (examsRes.ok) {
                    const examsBody = await examsRes.json();
                    const all: ExamItem[] = examsBody.exams ?? [];
                    setExams(
                        all
                            .filter((e) => isBepcSubject(e.classSubject.subject.name))
                            .sort((a, b) => (b.isPublished ? 1 : 0) - (a.isPublished ? 1 : 0))
                    );
                }

                // AI readiness (only if student profile)
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    const studentProfileId: string | null = profile.studentProfile?.id ?? null;
                    if (studentProfileId) {
                        const prepRes = await fetch(
                            `/api/exams/prep?exam=BEPC&studentId=${studentProfileId}`
                        );
                        if (prepRes.ok) {
                            setReadiness(await prepRes.json());
                        }
                    }
                }
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
            <CycleGuard requires="SECONDARY_COLLEGE">
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
                            <HeroStat label="épreuves" value="7" />
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
                            <Link href="/dashboard/grades">
                                <Button
                                    size="lg"
                                    style={{ background: "#fff", color: "var(--brand-800, var(--brand-700))" }}
                                    iconRight="chevron"
                                >
                                    Mes notes détaillées
                                </Button>
                            </Link>
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
                        {/* Annales section — real exams from DB */}
                        <Card padding={0}>
                            <div
                                style={{
                                    padding: "14px 18px",
                                    borderBottom: "1px solid var(--eduflow-border-subtle)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                }}
                            >
                                <div>
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 16, margin: 0 }}
                                    >
                                        Annales BEPC · examens disponibles
                                    </h3>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            margin: "2px 0 0",
                                        }}
                                    >
                                        Examens publiés par vos enseignants pour les matières BEPC
                                    </p>
                                </div>
                                <Link href="/dashboard/exams">
                                    <Button size="sm" variant="ghost" iconRight="chevron">
                                        Tous les examens
                                    </Button>
                                </Link>
                            </div>

                            {loading ? (
                                <div style={{ padding: 32, textAlign: "center" }}>
                                    <Spinner size={22} color="var(--brand-600)" />
                                </div>
                            ) : exams.length === 0 ? (
                                <div
                                    style={{
                                        padding: "32px 18px",
                                        textAlign: "center",
                                        fontSize: 12,
                                        color: "var(--eduflow-text-tertiary)",
                                        lineHeight: 1.7,
                                    }}
                                >
                                    Aucun examen BEPC disponible pour l&apos;instant.
                                    <br />
                                    Vos enseignants peuvent en créer dans le module{" "}
                                    <Link
                                        href="/dashboard/exams"
                                        style={{ color: "var(--brand-600)" }}
                                    >
                                        Évaluations
                                    </Link>
                                    .
                                </div>
                            ) : (
                                <div>
                                    {exams.map((exam, i) => (
                                        <ExamRow exam={exam} key={exam.id} hasBorder={i > 0} />
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {/* AI readiness card */}
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
                                <div style={{ flex: 1 }}>
                                    <div
                                        className="eduflow-display"
                                        style={{
                                            fontSize: 16,
                                            fontWeight: 700,
                                            color: "var(--brand-900, var(--brand-800))",
                                        }}
                                    >
                                        Analyse IA · préparation BEPC
                                    </div>

                                    {loading ? (
                                        <div style={{ marginTop: 10 }}>
                                            <Spinner size={16} color="var(--brand-600)" />
                                        </div>
                                    ) : readiness ? (
                                        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7, color: "var(--brand-800)" }}>
                                            <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                                                <ReadinessStat
                                                    label="Préparation"
                                                    value={`${Math.round(readiness.overallReadiness)}%`}
                                                />
                                                <ReadinessStat
                                                    label="Succès prédit"
                                                    value={`${Math.round(readiness.predictedSuccess)}%`}
                                                />
                                            </div>
                                            {readiness.strongAreas.length > 0 ? (
                                                <div>
                                                    <span style={{ fontWeight: 600 }}>Points forts :</span>{" "}
                                                    {readiness.strongAreas.join(", ")}
                                                </div>
                                            ) : null}
                                            {readiness.weakAreas.length > 0 ? (
                                                <div>
                                                    <span style={{ fontWeight: 600 }}>À renforcer :</span>{" "}
                                                    {readiness.weakAreas.join(", ")}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                marginTop: 8,
                                                fontSize: 12,
                                                color: "var(--brand-700)",
                                                lineHeight: 1.7,
                                            }}
                                        >
                                            Plan de révision · semaine
                                            {REVISION_PLAN.map((r) => (
                                                <div key={r.day}>
                                                    <strong>{r.day}</strong> · {r.activity}
                                                    {r.duration !== "—" ? ` (${r.duration})` : ""}
                                                </div>
                                            ))}
                                            <p
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--brand-700)",
                                                    marginTop: 10,
                                                    lineHeight: 1.55,
                                                }}
                                            >
                                                Connectez-vous en tant qu&apos;élève pour obtenir un plan personnalisé par matière selon vos résultats.
                                            </p>
                                        </div>
                                    )}
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
                                        Basé sur votre moyenne actuelle · les écarts simulation/BEPC réel sont typiquement de −0,8 pts.
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
                                    {subjectAverages.length === 0
                                        ? "Aucune note disponible pour cette période."
                                        : "Aucune matière sous 14/20 — continuez comme ça !"}
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
                                                            color: "var(--eduflow-text-tertiary)",
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
            </CycleGuard>
        </PageGuard>
    );
}

function ExamRow({ exam, hasBorder }: { exam: ExamItem; hasBorder: boolean }) {
    return (
        <div
            style={{
                padding: "10px 18px",
                borderTop: hasBorder ? "1px solid var(--eduflow-border-subtle)" : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
            }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{exam.title}</div>
                <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)", marginTop: 1 }}>
                    {exam.classSubject.subject.name} · {exam.classSubject.class.name} ·{" "}
                    {exam._count.questions} question{exam._count.questions !== 1 ? "s" : ""} ·{" "}
                    {exam.duration} min
                </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <Badge variant={exam.isPublished ? "success" : "neutral"}>
                    {exam.isPublished ? "Publié" : "Brouillon"}
                </Badge>
                <Link href={`/dashboard/exams/${exam.id}`}>
                    <Button size="sm" variant="ghost" iconRight="chevron">
                        Ouvrir
                    </Button>
                </Link>
            </div>
        </div>
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

function ReadinessStat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div
                className="eduflow-display tabular"
                style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-700)", fontVariantNumeric: "tabular-nums" }}
            >
                {value}
            </div>
            <div style={{ fontSize: 10, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {label}
            </div>
        </div>
    );
}
