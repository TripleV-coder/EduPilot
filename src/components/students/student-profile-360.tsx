"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Loader2, Sparkles, Award, Flame, Check, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Profile360Response {
    student: {
        id: string;
        firstName: string;
        lastName: string;
        avatar: string | null;
        matricule: string;
        className: string | null;
        academicYearName: string | null;
    };
    stats: {
        averageGrade: number | null;
        rank: number | null;
        classSize: number | null;
        attendanceRate: number | null;
        paymentStatus: "ok" | "late" | "unknown";
        riskLevel: string;
        currentPeriod: string | null;
    };
    subjects: Array<{
        subjectId: string;
        name: string;
        coefficient: number;
        average: number | null;
        min: number | null;
        max: number | null;
        isStrength: boolean;
        isWeakness: boolean;
    }>;
    evolution: Array<{ label: string; average: number }>;
    parents: Array<{
        firstName: string; lastName: string; relationship: string;
        email: string | null; phone: string | null; isPrimary: boolean;
    }>;
    medical: {
        bloodType: string | null;
        conditions: string[];
        medications: string[];
        allergies: Array<{ allergen: string; severity: string }>;
        notes: string | null;
        updatedAt: string;
    } | null;
    recentActivity: Array<{ kind: string; label: string; at: string }>;
}

function fmt1(n: number): string {
    return n.toFixed(1).replace(".", ",");
}

function fmt2(n: number): string {
    return n.toFixed(2).replace(".", ",");
}

function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return "à l'instant";
    const min = Math.floor(ms / 60_000);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}j`;
    const w = Math.floor(d / 7);
    return `${w} sem.`;
}

function initials(first: string, last: string): string {
    return `${first[0] ?? "?"}${last[0] ?? "?"}`.toUpperCase();
}

function subjectColor(average: number | null): "success" | "warning" | "danger" | "brand" {
    if (average === null) return "brand";
    if (average >= 14) return "success";
    if (average < 10) return "danger";
    if (average < 12) return "warning";
    return "brand";
}

export function StudentProfile360({ studentId }: { studentId: string }) {
    const { data, error, isLoading } = useSWR<Profile360Response>(
        `/api/students/${studentId}/profile-360`,
        fetcher,
        { revalidateOnFocus: false },
    );

    if (isLoading) {
        return (
            <div className="py-16 text-center" style={{ color: "var(--eduflow-text-tertiary)" }}>
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
        );
    }
    if (error || !data) {
        return (
            <div
                className="py-12 px-6 rounded-xl text-center"
                style={{ background: "var(--eduflow-danger-50)", color: "var(--eduflow-danger-800)", fontSize: 13 }}
            >
                Impossible de charger la vue 360° de cet élève.
            </div>
        );
    }

    const { student, stats, subjects, evolution, parents, medical, recentActivity } = data;
    const maxEvolution = Math.max(1, ...evolution.map((e) => e.average));

    const badges: Array<{ label: string; variant: "success" | "brand" | "warning"; icon: React.ReactNode }> = [];
    badges.push({ label: `Inscrit · ${stats.currentPeriod ?? "période courante"}`, variant: "success", icon: <Check className="w-3 h-3" /> });
    if (stats.rank !== null && stats.classSize !== null && stats.rank <= Math.ceil((stats.classSize ?? 0) / 5)) {
        badges.push({ label: "Top 5 classe", variant: "brand", icon: <Award className="w-3 h-3" /> });
    }
    if (stats.riskLevel === "HIGH" || stats.riskLevel === "CRITICAL") {
        badges.push({ label: "Sous surveillance", variant: "warning", icon: <Flame className="w-3 h-3" /> });
    }

    return (
        <div className="space-y-4">
            {/* Hero strip */}
            <div
                className="rounded-xl p-6"
                style={{
                    background: "linear-gradient(135deg, var(--eduflow-brand-50), var(--eduflow-neutral-100))",
                    border: "1px solid var(--eduflow-brand-200)",
                }}
            >
                <div className="flex items-center gap-6 flex-wrap">
                    <div
                        className="rounded-full grid place-items-center shrink-0"
                        style={{
                            width: 96, height: 96,
                            background: "var(--eduflow-brand-100)",
                            color: "var(--eduflow-brand-800)",
                            fontSize: 28, fontWeight: 700,
                            border: "2px solid #fff",
                        }}
                    >
                        {initials(student.firstName, student.lastName)}
                    </div>

                    <div className="flex-1 min-w-[260px]">
                        <div className="flex gap-2 mb-2">
                            {badges.map((b, i) => (
                                <span
                                    key={i}
                                    className="inline-flex items-center gap-1 rounded-md font-bold"
                                    style={{
                                        fontSize: 10,
                                        padding: "3px 8px",
                                        background: `var(--eduflow-${b.variant}-50)`,
                                        color: `var(--eduflow-${b.variant}-800)`,
                                    }}
                                >
                                    {b.icon}
                                    {b.label}
                                </span>
                            ))}
                        </div>
                        <h2
                            className="m-0"
                            style={{
                                fontSize: 28,
                                fontWeight: 700,
                                letterSpacing: "-0.025em",
                                color: "var(--eduflow-text-primary)",
                            }}
                        >
                            {student.firstName} {student.lastName}
                        </h2>
                        <div
                            className="mt-1"
                            style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}
                        >
                            {student.className ?? "Classe non affectée"} · {student.matricule}
                            {student.academicYearName ? ` · ${student.academicYearName}` : ""}
                        </div>
                    </div>

                    <div
                        className="flex gap-8 pl-6"
                        style={{ borderLeft: "1px solid var(--eduflow-border-subtle)" }}
                    >
                        <StatChip
                            label={`Moyenne ${stats.currentPeriod ?? ""}`.trim()}
                            value={stats.averageGrade !== null ? fmt1(stats.averageGrade) : "—"}
                            tone={subjectColor(stats.averageGrade)}
                        />
                        <StatChip
                            label="Rang"
                            value={stats.rank !== null && stats.classSize !== null ? `${stats.rank}/${stats.classSize}` : "—"}
                            tone="brand"
                        />
                        <StatChip
                            label="Présence"
                            value={stats.attendanceRate !== null ? `${fmt1(stats.attendanceRate)}%` : "—"}
                            tone={(stats.attendanceRate ?? 0) >= 90 ? "success" : (stats.attendanceRate ?? 0) >= 75 ? "warning" : "danger"}
                        />
                        <StatChip
                            label="Paiement"
                            value={stats.paymentStatus === "ok" ? "✓ À jour" : stats.paymentStatus === "late" ? "En retard" : "—"}
                            tone={stats.paymentStatus === "ok" ? "success" : stats.paymentStatus === "late" ? "danger" : "warning"}
                        />
                    </div>
                </div>
            </div>

            <div className="grid gap-3.5" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
                <div className="flex flex-col gap-3.5">
                    {/* Subjects */}
                    <div
                        className="rounded-xl p-4"
                        style={{ background: "var(--eduflow-surface-card)", border: "1px solid var(--eduflow-border-subtle)" }}
                    >
                        <div className="flex justify-between items-center mb-3.5">
                            <h3 className="m-0" style={{ fontSize: 14, fontWeight: 700 }}>
                                Performances par matière {stats.currentPeriod ? `· ${stats.currentPeriod}` : ""}
                            </h3>
                            {evolution.length >= 2 && (
                                <DeltaBadge
                                    delta={evolution[evolution.length - 1].average - evolution[evolution.length - 2].average}
                                />
                            )}
                        </div>
                        {subjects.length === 0 ? (
                            <p style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                                Pas encore de moyennes calculées pour la période en cours.
                            </p>
                        ) : subjects.map((m, i) => {
                            const tone = subjectColor(m.average);
                            return (
                                <div
                                    key={m.subjectId}
                                    className="grid gap-3 items-center"
                                    style={{
                                        gridTemplateColumns: "1fr 60px 70px 50px",
                                        padding: "10px 0",
                                        borderTop: i > 0 ? "1px solid var(--eduflow-border-subtle)" : 0,
                                    }}
                                >
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                                    <span style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                                        coef. {m.coefficient}
                                    </span>
                                    <div
                                        className="rounded-full overflow-hidden"
                                        style={{ height: 4, background: "var(--eduflow-neutral-200)" }}
                                    >
                                        <div
                                            style={{
                                                height: "100%",
                                                width: m.average !== null ? `${Math.min(100, (m.average / 20) * 100)}%` : "0%",
                                                background: `var(--eduflow-${tone}-500)`,
                                            }}
                                        />
                                    </div>
                                    <span
                                        className="font-mono text-right"
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: `var(--eduflow-${tone}-700)`,
                                        }}
                                    >
                                        {m.average !== null ? fmt1(m.average) : "—"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Evolution */}
                    <div
                        className="rounded-xl p-4"
                        style={{ background: "var(--eduflow-surface-card)", border: "1px solid var(--eduflow-border-subtle)" }}
                    >
                        <SubLabel>Évolution sur les {evolution.length} dernières périodes</SubLabel>
                        <div className="flex items-end gap-3 mt-3" style={{ height: 120 }}>
                            {evolution.length === 0 ? (
                                <p style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                                    Pas encore d&apos;historique disponible.
                                </p>
                            ) : evolution.map((b, i) => {
                                const last = i === evolution.length - 1;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                                        <span
                                            className="font-mono"
                                            style={{ fontSize: 10, fontWeight: 700, color: "var(--eduflow-brand-700)" }}
                                        >
                                            {fmt1(b.average)}
                                        </span>
                                        <div
                                            style={{
                                                width: "60%",
                                                height: `${(b.average / maxEvolution) * 100}%`,
                                                background: last ? "var(--eduflow-brand-700)" : "var(--eduflow-brand-300)",
                                                borderRadius: "6px 6px 0 0",
                                                minHeight: 12,
                                            }}
                                        />
                                        <span style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}>
                                            {b.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-3.5">
                    <div
                        className="rounded-xl p-4"
                        style={{ background: "var(--eduflow-surface-card)", border: "1px solid var(--eduflow-border-subtle)" }}
                    >
                        <SubLabel>Famille & contacts</SubLabel>
                        {parents.length === 0 ? (
                            <p style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)", marginTop: 6 }}>
                                Aucun contact parent enregistré.
                            </p>
                        ) : parents.map((p, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-2.5"
                                style={{
                                    padding: "10px 0",
                                    borderTop: i > 0 ? "1px solid var(--eduflow-border-subtle)" : 0,
                                }}
                            >
                                <span
                                    className="rounded-full grid place-items-center font-bold shrink-0"
                                    style={{
                                        width: 32, height: 32,
                                        background: "var(--eduflow-neutral-200)",
                                        color: "var(--eduflow-text-secondary)",
                                        fontSize: 11,
                                    }}
                                >
                                    {initials(p.firstName, p.lastName)}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                                        {p.firstName} {p.lastName}
                                    </div>
                                    <div style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}>
                                        {p.relationship}{p.phone ? ` · ${p.phone}` : ""}
                                    </div>
                                </div>
                                {p.isPrimary && (
                                    <span
                                        className="rounded-md font-bold"
                                        style={{
                                            fontSize: 9,
                                            padding: "2px 6px",
                                            background: "var(--eduflow-success-50)",
                                            color: "var(--eduflow-success-800)",
                                        }}
                                    >
                                        Principal
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {medical && (
                        <div
                            className="rounded-xl p-4"
                            style={{ background: "var(--eduflow-surface-card)", border: "1px solid var(--eduflow-border-subtle)" }}
                        >
                            <SubLabel>Suivi médical</SubLabel>
                            <div style={{ fontSize: 12, color: "var(--eduflow-text-secondary)", lineHeight: 1.6, marginTop: 6 }}>
                                {medical.bloodType && (
                                    <>
                                        Groupe sanguin · <strong>{medical.bloodType}</strong>
                                        <br />
                                    </>
                                )}
                                {medical.conditions.length > 0 && (
                                    <>
                                        <strong style={{ color: "var(--eduflow-warning-700)" }}>
                                            {medical.conditions.join(", ")}
                                        </strong>
                                        {medical.medications.length > 0 && ` · ${medical.medications.join(", ")} en cas de besoin (infirmerie).`}
                                        <br />
                                    </>
                                )}
                                {medical.allergies.length > 0 && (
                                    <>
                                        Allergies · {medical.allergies.map((a) => `${a.allergen} (${a.severity})`).join(", ")}
                                        <br />
                                    </>
                                )}
                                {medical.notes && <span style={{ fontStyle: "italic" }}>{medical.notes}</span>}
                            </div>
                        </div>
                    )}

                    <div
                        className="rounded-xl p-4"
                        style={{
                            background: "var(--eduflow-brand-50)",
                            border: "1px solid var(--eduflow-brand-200)",
                        }}
                    >
                        <div className="flex items-start gap-2.5">
                            <Sparkles
                                className="w-4 h-4 shrink-0"
                                style={{ color: "var(--eduflow-brand-700)", marginTop: 2 }}
                            />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--eduflow-brand-900)", marginBottom: 4 }}>
                                    Recommandation IA
                                </div>
                                <p style={{ fontSize: 12, color: "var(--eduflow-brand-800)", margin: 0, lineHeight: 1.5 }}>
                                    {aiRecommendation(student.firstName, subjects)}
                                </p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    style={{
                                        marginTop: 10,
                                        background: "#fff",
                                        color: "var(--eduflow-brand-700)",
                                        border: "1px solid var(--eduflow-brand-200)",
                                    }}
                                >
                                    Discuter orientation
                                </Button>
                            </div>
                        </div>
                    </div>

                    {recentActivity.length > 0 && (
                        <div
                            className="rounded-xl p-4"
                            style={{ background: "var(--eduflow-surface-card)", border: "1px solid var(--eduflow-border-subtle)" }}
                        >
                            <SubLabel>Activités récentes</SubLabel>
                            <div
                                className="flex flex-col gap-2"
                                style={{ fontSize: 12, color: "var(--eduflow-text-secondary)", marginTop: 6 }}
                            >
                                {recentActivity.map((a, i) => (
                                    <div key={i} className="flex justify-between gap-3">
                                        <span>• {a.label}</span>
                                        <span
                                            className="font-mono shrink-0"
                                            style={{ color: "var(--eduflow-text-tertiary)" }}
                                        >
                                            {timeAgo(a.at)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatChip({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone: "brand" | "success" | "warning" | "danger";
}) {
    return (
        <div>
            <div
                style={{
                    fontSize: 10,
                    color: "var(--eduflow-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </div>
            <div
                className="font-mono"
                style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: `var(--eduflow-${tone}-700)`,
                    marginTop: 2,
                }}
            >
                {value}
            </div>
        </div>
    );
}

function DeltaBadge({ delta }: { delta: number }) {
    if (Math.abs(delta) < 0.05) return null;
    const positive = delta > 0;
    return (
        <span
            className="inline-flex items-center gap-1 rounded-md font-bold"
            style={{
                fontSize: 10,
                padding: "2px 7px",
                background: positive ? "var(--eduflow-success-50)" : "var(--eduflow-warning-50)",
                color: positive ? "var(--eduflow-success-800)" : "var(--eduflow-warning-800)",
            }}
        >
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positive ? "+" : ""}{fmt2(delta)} pts vs précédent
        </span>
    );
}

function aiRecommendation(firstName: string, subjects: Profile360Response["subjects"]): string {
    const strengths = subjects
        .filter((s) => s.average !== null && (s.average ?? 0) >= 14)
        .map((s) => s.name.toLowerCase());
    const weaknesses = subjects
        .filter((s) => s.average !== null && (s.average ?? 0) < 10)
        .map((s) => s.name.toLowerCase());

    if (strengths.length === 0 && weaknesses.length === 0) {
        return `Pas encore assez de données pour générer un profil pour ${firstName}. Lancez une analyse complète après la prochaine évaluation.`;
    }
    if (strengths.length >= 2) {
        return `${firstName} excelle en ${strengths.slice(0, 3).join(", ")}. Continuer à valoriser ces forces et envisager une orientation cohérente.`;
    }
    if (weaknesses.length > 0) {
        return `${firstName} montre des fragilités en ${weaknesses.slice(0, 2).join(", ")}. Mettre en place un soutien ciblé sur la prochaine période.`;
    }
    return `${firstName} a un profil équilibré. Continuer le travail régulier et viser une progression sur les matières à fort coefficient.`;
}

function SubLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--eduflow-text-tertiary)",
            }}
        >
            {children}
        </div>
    );
}
