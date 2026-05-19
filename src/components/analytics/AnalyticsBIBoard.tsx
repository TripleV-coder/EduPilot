"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Loader2, TrendingUp, TrendingDown, Sparkles, Users, Check, BadgePercent } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BIResponse {
    kpis: {
        studentCount: number;
        collectionRate: number;
        attendanceRate: number;
        passRate: number;
    };
    totalCollected: number;
    monthly: Array<{ label: string; billed: number; collected: number }>;
    paymentMix: Array<{ method: string; amount: number; share: number }>;
    topSubjects: Array<{ subject: string; average: number }>;
    insight: { headline: string; recommendation: string; createdAt: string } | null;
    updatedAt: string;
}

const PIE_COLORS = [
    "var(--eduflow-brand-600)",
    "var(--eduflow-info-600)",
    "var(--eduflow-success-600)",
    "var(--eduflow-warning-500)",
    "var(--eduflow-accent-600)",
    "var(--eduflow-neutral-500)",
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    MOBILE_MONEY: "Mobile Money",
    FLUTTERWAVE: "Flutterwave",
    PAYSTACK: "Paystack",
    BANK_TRANSFER: "Virement",
    CASH: "Espèces",
    CHECK: "Chèque",
    OTHER: "Autre",
};

function fmtFCFA(amount: number): string {
    return new Intl.NumberFormat("fr-FR").format(amount);
}

function fmt1(n: number): string {
    return n.toFixed(1).replace(".", ",");
}

function fmt2(n: number): string {
    return n.toFixed(2).replace(".", ",");
}

interface AnalyticsBIBoardProps {
    schoolId?: string;
    academicYearId?: string;
    onOpenReport?: () => void;
}

export function AnalyticsBIBoard({ schoolId, academicYearId, onOpenReport }: AnalyticsBIBoardProps) {
    const query = new URLSearchParams();
    if (schoolId) query.set("schoolId", schoolId);
    if (academicYearId && academicYearId !== "ALL") query.set("academicYearId", academicYearId);
    const url = `/api/analytics/bi${query.toString() ? `?${query}` : ""}`;

    const { data, error, isLoading } = useSWR<BIResponse>(url, fetcher, { revalidateOnFocus: false });

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
                style={{
                    background: "var(--eduflow-danger-50)",
                    color: "var(--eduflow-danger-800)",
                    fontSize: 13,
                }}
            >
                Impossible de charger le tableau BI pour le contexte sélectionné.
            </div>
        );
    }

    return (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(12, 1fr)", gridAutoRows: "minmax(140px, auto)" }}>
            <MetricCard
                style={{ gridColumn: "span 3" }}
                icon={<Users className="w-4 h-4" />}
                label="Élèves actifs"
                value={fmtFCFA(data.kpis.studentCount)}
                trend={null}
                variant="brand"
            />
            <MetricCard
                style={{ gridColumn: "span 3" }}
                icon={<BadgePercent className="w-4 h-4" />}
                label="Recouvrement"
                value={fmt1(data.kpis.collectionRate)}
                unit="%"
                trend={null}
                variant="success"
            />
            <MetricCard
                style={{ gridColumn: "span 3" }}
                icon={<Check className="w-4 h-4" />}
                label="Présence"
                value={fmt1(data.kpis.attendanceRate)}
                unit="%"
                trend={null}
                variant="info"
            />
            <MetricCard
                style={{ gridColumn: "span 3" }}
                icon={<TrendingUp className="w-4 h-4" />}
                label="Taux de réussite"
                value={fmt1(data.kpis.passRate)}
                unit="%"
                trend={null}
                variant="brand"
            />

            {/* Bar chart */}
            <BillingBarChart
                style={{ gridColumn: "span 8" }}
                monthly={data.monthly}
            />

            {/* Pie chart */}
            <PaymentMixCard
                style={{ gridColumn: "span 4" }}
                paymentMix={data.paymentMix}
                totalCollected={data.totalCollected}
            />

            <TopSubjectsCard
                style={{ gridColumn: "span 6" }}
                subjects={data.topSubjects}
            />

            <InsightCard
                style={{ gridColumn: "span 6" }}
                insight={data.insight}
                onOpenReport={onOpenReport}
            />
        </div>
    );
}

function MetricCard({
    icon,
    label,
    value,
    unit,
    trend,
    variant,
    style,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    unit?: string;
    trend: number | null;
    variant: "brand" | "success" | "info" | "warning" | "danger";
    style?: React.CSSProperties;
}) {
    const palette: Record<typeof variant, { iconBg: string; iconFg: string }> = {
        brand:   { iconBg: "var(--eduflow-brand-100)",   iconFg: "var(--eduflow-brand-700)" },
        success: { iconBg: "var(--eduflow-success-100)", iconFg: "var(--eduflow-success-700)" },
        info:    { iconBg: "var(--eduflow-info-100)",    iconFg: "var(--eduflow-info-700)" },
        warning: { iconBg: "var(--eduflow-warning-100)", iconFg: "var(--eduflow-warning-700)" },
        danger:  { iconBg: "var(--eduflow-danger-100)",  iconFg: "var(--eduflow-danger-700)" },
    };
    const p = palette[variant];

    return (
        <div
            className="rounded-xl p-4 flex flex-col justify-between"
            style={{
                background: "var(--eduflow-surface-card)",
                border: "1px solid var(--eduflow-border-subtle)",
                ...style,
            }}
        >
            <div className="flex items-center justify-between">
                <span
                    className="grid place-items-center rounded-lg"
                    style={{ width: 28, height: 28, background: p.iconBg, color: p.iconFg }}
                >
                    {icon}
                </span>
                {trend !== null && (
                    <span
                        className="inline-flex items-center gap-1"
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: trend >= 0 ? "var(--eduflow-success-700)" : "var(--eduflow-danger-700)",
                        }}
                    >
                        {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trend >= 0 ? "+" : ""}{trend.toFixed(1).replace(".", ",")}
                    </span>
                )}
            </div>
            <div>
                <div
                    className="font-mono"
                    style={{
                        fontSize: 28,
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                        color: "var(--eduflow-text-primary)",
                    }}
                >
                    {value}
                    {unit && (
                        <span style={{ fontSize: 14, marginLeft: 4, color: "var(--eduflow-text-tertiary)" }}>
                            {unit}
                        </span>
                    )}
                </div>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--eduflow-text-tertiary)",
                        marginTop: 2,
                    }}
                >
                    {label}
                </div>
            </div>
        </div>
    );
}

function BillingBarChart({
    monthly,
    style,
}: {
    monthly: Array<{ label: string; billed: number; collected: number }>;
    style?: React.CSSProperties;
}) {
    const max = useMemo(
        () => Math.max(1, ...monthly.flatMap((m) => [m.billed, m.collected])),
        [monthly],
    );

    return (
        <div
            className="rounded-xl p-4"
            style={{
                background: "var(--eduflow-surface-card)",
                border: "1px solid var(--eduflow-border-subtle)",
                ...style,
            }}
        >
            <div className="flex items-end justify-between mb-3.5">
                <h3 className="m-0" style={{ fontSize: 14, fontWeight: 700 }}>
                    Encaissements vs facturation · 12 mois
                </h3>
                <div className="flex gap-3.5" style={{ fontSize: 11 }}>
                    <span className="inline-flex items-center gap-1.5">
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--eduflow-brand-700)" }} />
                        Encaissé
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--eduflow-brand-300)" }} />
                        Facturé
                    </span>
                </div>
            </div>
            <div className="flex items-end gap-2" style={{ height: 160 }}>
                {monthly.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                        <div className="relative w-full flex items-end justify-center gap-1 flex-1">
                            <span
                                style={{
                                    width: "40%",
                                    height: `${(m.billed / max) * 100}%`,
                                    background: "var(--eduflow-brand-300)",
                                    borderRadius: "3px 3px 0 0",
                                    minHeight: 2,
                                }}
                                title={`Facturé · ${fmtFCFA(m.billed)} FCFA`}
                            />
                            <span
                                style={{
                                    width: "40%",
                                    height: `${(m.collected / max) * 100}%`,
                                    background: "var(--eduflow-brand-700)",
                                    borderRadius: "3px 3px 0 0",
                                    minHeight: 2,
                                }}
                                title={`Encaissé · ${fmtFCFA(m.collected)} FCFA`}
                            />
                        </div>
                        <span
                            className="font-mono"
                            style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
                        >
                            {m.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PaymentMixCard({
    paymentMix,
    totalCollected,
    style,
}: {
    paymentMix: BIResponse["paymentMix"];
    totalCollected: number;
    style?: React.CSSProperties;
}) {
    // Build pie segments: each method gets `share`% of the 88-unit dasharray total.
    // Offset for segment N is the cumulative length of segments 0..N-1.
    const segments = useMemo(() => {
        const lengths = paymentMix.map((m) => (m.share / 100) * 88);
        return paymentMix.map((_, idx) => {
            const offset = lengths.slice(0, idx).reduce((sum, l) => sum + l, 0);
            return {
                color: PIE_COLORS[idx % PIE_COLORS.length],
                dash: `${lengths[idx]} 88`,
                offset: -offset,
            };
        });
    }, [paymentMix]);

    const totalInMillions = totalCollected / 1_000_000;

    return (
        <div
            className="rounded-xl p-4"
            style={{
                background: "var(--eduflow-surface-card)",
                border: "1px solid var(--eduflow-border-subtle)",
                ...style,
            }}
        >
            <SubLabel>Mix de paiements</SubLabel>
            <div className="relative mx-auto" style={{ width: 160, height: 160, margin: "14px auto" }}>
                <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                    {segments.length === 0 ? (
                        <circle
                            cx="18" cy="18" r="14"
                            fill="none"
                            stroke="var(--eduflow-neutral-200)"
                            strokeWidth="6"
                        />
                    ) : segments.map((s, i) => (
                        <circle
                            key={i}
                            cx="18" cy="18" r="14"
                            fill="none"
                            stroke={s.color}
                            strokeWidth="6"
                            strokeDasharray={s.dash}
                            strokeDashoffset={s.offset}
                        />
                    ))}
                </svg>
                <div
                    className="absolute inset-0 grid place-items-center text-center"
                    style={{ pointerEvents: "none" }}
                >
                    <div>
                        <div
                            className="font-mono"
                            style={{ fontSize: 20, fontWeight: 700, color: "var(--eduflow-text-primary)" }}
                        >
                            {fmt2(totalInMillions)}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}>
                            M FCFA
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-1" style={{ fontSize: 11 }}>
                {paymentMix.length === 0 ? (
                    <span style={{ color: "var(--eduflow-text-tertiary)" }}>
                        Aucun paiement enregistré sur la période.
                    </span>
                ) : paymentMix.map((m, idx) => (
                    <div key={m.method} className="flex items-center gap-1.5">
                        <span
                            style={{
                                width: 8, height: 8, borderRadius: 2,
                                background: PIE_COLORS[idx % PIE_COLORS.length],
                            }}
                        />
                        <span className="flex-1">{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</span>
                        <span className="font-mono font-bold">
                            {fmt1(m.share)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TopSubjectsCard({
    subjects,
    style,
}: {
    subjects: Array<{ subject: string; average: number }>;
    style?: React.CSSProperties;
}) {
    return (
        <div
            className="rounded-xl p-4"
            style={{
                background: "var(--eduflow-surface-card)",
                border: "1px solid var(--eduflow-border-subtle)",
                ...style,
            }}
        >
            <SubLabel>Top 5 matières · moyennes période courante</SubLabel>
            <div className="mt-3 flex flex-col gap-2.5">
                {subjects.length === 0 ? (
                    <span style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                        Pas encore de moyennes calculées.
                    </span>
                ) : subjects.map((s) => (
                    <div
                        key={s.subject}
                        className="grid gap-2.5 items-center"
                        style={{ gridTemplateColumns: "120px 1fr 50px" }}
                    >
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{s.subject}</span>
                        <div
                            className="rounded-full overflow-hidden"
                            style={{ height: 8, background: "var(--eduflow-neutral-200)" }}
                        >
                            <div
                                style={{
                                    height: "100%",
                                    width: `${Math.min(100, (s.average / 20) * 100)}%`,
                                    background: "var(--eduflow-brand-700)",
                                }}
                            />
                        </div>
                        <span
                            className="font-mono text-right"
                            style={{ fontSize: 14, fontWeight: 700 }}
                        >
                            {fmt1(s.average)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function InsightCard({
    insight,
    onOpenReport,
    style,
}: {
    insight: BIResponse["insight"];
    onOpenReport?: () => void;
    style?: React.CSSProperties;
}) {
    const fallbackHeadline = "Active l'IA pour obtenir les premières analyses hebdomadaires.";
    const fallbackRecommendation = "Branche le module IA (Gemini) puis relance le tableau BI.";
    return (
        <div
            className="rounded-xl p-4"
            style={{
                background: "linear-gradient(135deg, var(--eduflow-brand-800), var(--eduflow-accent-600))",
                color: "#fff",
                border: 0,
                ...style,
            }}
        >
            <div className="flex items-center gap-2.5 mb-3">
                <Sparkles className="w-4 h-4" />
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        opacity: 0.85,
                    }}
                >
                    Top insight IA · semaine
                </span>
            </div>
            <p
                style={{
                    fontSize: 18,
                    fontWeight: 600,
                    lineHeight: 1.35,
                    margin: 0,
                    letterSpacing: "-0.01em",
                }}
            >
                {insight?.headline || fallbackHeadline}
            </p>
            <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.55, marginTop: 12 }}>
                {insight?.recommendation || fallbackRecommendation}
            </p>
            {onOpenReport && (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onOpenReport}
                    style={{
                        background: "#fff",
                        color: "var(--eduflow-brand-800)",
                        border: 0,
                        marginTop: 12,
                    }}
                >
                    Voir l&apos;analyse complète
                </Button>
            )}
        </div>
    );
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
