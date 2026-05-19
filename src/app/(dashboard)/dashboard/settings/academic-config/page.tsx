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
    type IconName,
} from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

type PeriodType = "TRIMESTER" | "SEMESTER" | "HYBRID";

type Period = {
    id: string;
    name: string;
    type: PeriodType;
    sequence: number;
    startDate: string;
    endDate: string;
};

type Holiday = {
    id: string;
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    description: string | null;
};

type ConfigData = {
    config: {
        periodType: PeriodType;
        periodsCount: number;
        maxGrade: number;
        passingGrade: number;
    };
    academicYear: {
        id: string;
        name: string;
        startDate: string;
        endDate: string;
    } | null;
    periods: Period[];
    holidays: Holiday[];
};

const FR_DATE = (iso: string): string => {
    try {
        return new Date(iso).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return iso;
    }
};

const FR_DATE_RANGE = (a: string, b: string): string => {
    try {
        const da = new Date(a);
        const db = new Date(b);
        const fmt = (d: Date) =>
            d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        return `${fmt(da)} → ${fmt(db)}`;
    } catch {
        return `${a} → ${b}`;
    }
};

const PERIOD_COLOR_BY_SEQ = ["brand", "info", "success", "warning"] as const;

export default function AcademicConfigPage() {
    const [data, setData] = useState<ConfigData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [draftSystem, setDraftSystem] = useState<PeriodType>("TRIMESTER");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/config/academic");
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || "Erreur");
                setData(body);
                setDraftSystem(body.config.periodType);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const dirty = useMemo(
        () => Boolean(data && draftSystem !== data.config.periodType),
        [data, draftSystem]
    );

    const handleSave = async () => {
        if (!dirty || !data) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch("/api/config/academic", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodType: draftSystem }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Erreur");
            setData((prev) =>
                prev
                    ? {
                          ...prev,
                          config: {
                              ...prev.config,
                              periodType: body.config.periodType,
                              periodsCount: body.config.periodsCount,
                          },
                      }
                    : prev
            );
            setSuccess(
                "Configuration enregistrée. Les nouvelles périodes pourront être créées depuis Périodes."
            );
            setTimeout(() => setSuccess(null), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageGuard
            permission={Permission.SCHOOL_UPDATE}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center gap-3">
                    <Link href="/dashboard/settings">
                        <Button variant="secondary" size="sm">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Icon
                                    name="chevron"
                                    size={14}
                                    style={{ transform: "scaleX(-1)" }}
                                />
                                Retour
                            </span>
                        </Button>
                    </Link>
                </div>
                <PageHeader
                    greeting={
                        data?.academicYear
                            ? `Année académique · ${data.academicYear.name}`
                            : "Année académique"
                    }
                    sub="Définissez votre découpage, les vacances et les dates clés. L'app s'adapte automatiquement."
                    breadcrumb={["Paramètres", "Établissement", "Année académique"]}
                    actions={
                        <>
                            <Link href="/dashboard/calendar">
                                <Button variant="secondary" icon="download">
                                    Calendrier MEMP
                                </Button>
                            </Link>
                            <Button
                                icon={saving ? undefined : "check"}
                                loading={saving}
                                onClick={handleSave}
                                disabled={!dirty || saving}
                            >
                                {dirty ? "Valider la configuration" : "Configuration à jour"}
                            </Button>
                        </>
                    }
                />

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
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
                        </div>
                    </Card>
                ) : null}

                {success ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-success-500)",
                            background: "var(--eduflow-success-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="check" size={18} color="var(--eduflow-success-600)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-success-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {success}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {loading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Chargement de la configuration…
                        </span>
                    </div>
                ) : null}

                {data ? (
                    <>
                        {/* System toggle */}
                        <Card padding={24}>
                            <h3
                                className="eduflow-display"
                                style={{ fontSize: 18, margin: "0 0 6px" }}
                            >
                                Système de découpage
                            </h3>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--eduflow-text-secondary)",
                                    margin: "0 0 18px",
                                }}
                            >
                                Bulletins, moyennes, conseils de classe et finances s'adapteront à ce
                                choix.
                            </p>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 14,
                                }}
                                className="system-grid"
                            >
                                <SystemOption
                                    optionKey="TRIMESTER"
                                    icon="cards"
                                    title="3 trimestres"
                                    sub="Système standard MEMP — par défaut"
                                    detail="T1 (oct-déc) · T2 (jan-mars) · T3 (avr-juil) · 3 bulletins par an"
                                    active={draftSystem === "TRIMESTER"}
                                    onClick={() => setDraftSystem("TRIMESTER")}
                                />
                                <SystemOption
                                    optionKey="SEMESTER"
                                    icon="book"
                                    title="2 semestres"
                                    sub="Système universitaire / lycées techniques"
                                    detail="S1 (sep-jan) · S2 (fév-juin) · 2 bulletins + contrôle continu"
                                    active={draftSystem === "SEMESTER"}
                                    onClick={() => setDraftSystem("SEMESTER")}
                                />
                            </div>
                        </Card>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1.4fr 1fr",
                                gap: 14,
                            }}
                            className="periods-grid"
                        >
                            {/* Periods detail */}
                            <Card padding={0}>
                                <div
                                    style={{
                                        padding: "14px 18px",
                                        borderBottom:
                                            "1px solid var(--eduflow-border-subtle)",
                                    }}
                                >
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 16, margin: 0 }}
                                    >
                                        {draftSystem === "TRIMESTER"
                                            ? "3 trimestres"
                                            : draftSystem === "SEMESTER"
                                            ? "2 semestres"
                                            : "Périodes"}{" "}
                                        · dates
                                    </h3>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color:
                                                "var(--eduflow-text-tertiary)",
                                            margin: "2px 0 0",
                                        }}
                                    >
                                        {data.periods.length === 0
                                            ? "Aucune période créée pour cette année — utilise « Périodes » pour les définir."
                                            : "Modifie depuis l'écran Périodes si nécessaire."}
                                    </p>
                                </div>
                                {data.periods.length === 0 ? (
                                    <div
                                        style={{
                                            padding: "32px 18px",
                                            textAlign: "center",
                                            fontSize: 12,
                                            color:
                                                "var(--eduflow-text-tertiary)",
                                        }}
                                    >
                                        Crée les périodes depuis{" "}
                                        <Link
                                            href="/dashboard/settings/periods"
                                            style={{
                                                color: "var(--brand-700)",
                                                fontWeight: 600,
                                            }}
                                        >
                                            Paramètres → Périodes
                                        </Link>{" "}
                                        après avoir choisi le système.
                                    </div>
                                ) : (
                                    data.periods.map((p, i) => {
                                        const color =
                                            PERIOD_COLOR_BY_SEQ[
                                                (p.sequence - 1) %
                                                    PERIOD_COLOR_BY_SEQ.length
                                            ];
                                        const weeks = Math.max(
                                            1,
                                            Math.round(
                                                (new Date(p.endDate).getTime() -
                                                    new Date(p.startDate).getTime()) /
                                                    (1000 * 60 * 60 * 24 * 7)
                                            )
                                        );
                                        return (
                                            <div
                                                key={p.id}
                                                style={{
                                                    padding: "16px 18px",
                                                    borderTop:
                                                        i > 0
                                                            ? "1px solid var(--eduflow-border-subtle)"
                                                            : 0,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 12,
                                                        marginBottom: 10,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: 6,
                                                            height: 36,
                                                            borderRadius: 3,
                                                            background: `var(--eduflow-${color}-600)`,
                                                        }}
                                                    />
                                                    <div
                                                        className="eduflow-display"
                                                        style={{
                                                            fontSize: 16,
                                                            fontWeight: 700,
                                                            color: `var(--eduflow-${color}-900, var(--eduflow-${color}-800))`,
                                                        }}
                                                    >
                                                        {p.name}
                                                    </div>
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                        }}
                                                    >
                                                        · {weeks} semaines de cours
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns:
                                                            "repeat(2, 1fr)",
                                                        gap: 10,
                                                        marginLeft: 18,
                                                    }}
                                                >
                                                    <PeriodDetail
                                                        label="Début"
                                                        value={FR_DATE(p.startDate)}
                                                    />
                                                    <PeriodDetail
                                                        label="Fin"
                                                        value={FR_DATE(p.endDate)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </Card>

                            {/* Holidays */}
                            <Card padding={0}>
                                <div
                                    style={{
                                        padding: "14px 18px",
                                        borderBottom:
                                            "1px solid var(--eduflow-border-subtle)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 16, margin: 0 }}
                                    >
                                        Vacances &amp; jours fériés
                                    </h3>
                                    <Link
                                        href="/dashboard/calendar"
                                        style={{ textDecoration: "none" }}
                                    >
                                        <Button variant="ghost" size="sm" icon="plus" />
                                    </Link>
                                </div>
                                {data.holidays.length === 0 ? (
                                    <div
                                        style={{
                                            padding: "24px 18px",
                                            fontSize: 12,
                                            color:
                                                "var(--eduflow-text-tertiary)",
                                            textAlign: "center",
                                        }}
                                    >
                                        Aucune vacance enregistrée pour cette année.
                                    </div>
                                ) : (
                                    data.holidays.map((h, i) => {
                                        const isHoliday =
                                            h.type === "PUBLIC_HOLIDAY" ||
                                            h.type.toLowerCase().includes("ferie") ||
                                            h.type.toLowerCase().includes("holiday");
                                        return (
                                            <div
                                                key={h.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                    padding: "10px 18px",
                                                    borderTop:
                                                        i > 0
                                                            ? "1px solid var(--eduflow-border-subtle)"
                                                            : 0,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: 3,
                                                        background: isHoliday
                                                            ? "var(--eduflow-warning-500)"
                                                            : "var(--eduflow-info-500)",
                                                    }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {h.name}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 10,
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                        }}
                                                    >
                                                        {FR_DATE_RANGE(h.startDate, h.endDate)}
                                                    </div>
                                                </div>
                                                <Badge
                                                    variant={isHoliday ? "warning" : "info"}
                                                    size="sm"
                                                >
                                                    {isHoliday ? "Férié" : "Vacances"}
                                                </Badge>
                                            </div>
                                        );
                                    })
                                )}
                            </Card>
                        </div>

                        <Card
                            padding={18}
                            style={{
                                background: "var(--brand-50)",
                                border: "1px solid var(--brand-200)",
                            }}
                        >
                            <div style={{ display: "flex", gap: 12 }}>
                                <Icon
                                    name="sparkle"
                                    size={18}
                                    color="var(--brand-700)"
                                    style={{ marginTop: 2, flexShrink: 0 }}
                                />
                                <div
                                    style={{
                                        fontSize: 13,
                                        color: "var(--brand-900)",
                                        lineHeight: 1.6,
                                    }}
                                >
                                    <strong>Impact du changement :</strong> en passant de trimestre
                                    à semestre (ou inverse), EduPilot recalcule automatiquement les
                                    moyennes via la pondération des coefficients, met à jour les
                                    échéances de paiement et notifie les enseignants concernés. Tu
                                    devras toutefois recréer les périodes (Paramètres → Périodes)
                                    pour que les bulletins suivants utilisent le nouveau découpage.
                                </div>
                            </div>
                        </Card>
                    </>
                ) : null}
            </div>

            <style jsx global>{`
                @media (max-width: 760px) {
                    .system-grid,
                    .periods-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}

function SystemOption({
    optionKey: _optionKey,
    icon,
    title,
    sub,
    detail,
    active,
    onClick,
}: {
    optionKey: PeriodType;
    icon: IconName;
    title: string;
    sub: string;
    detail: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: 20,
                borderRadius: 14,
                textAlign: "left",
                border: active
                    ? "2px solid var(--brand-600)"
                    : "1px solid var(--eduflow-border-default)",
                background: active ? "var(--brand-50)" : "var(--eduflow-surface-card)",
                cursor: "pointer",
                fontFamily: "inherit",
                position: "relative",
            }}
            aria-pressed={active}
        >
            {active ? (
                <div style={{ position: "absolute", top: 14, right: 14 }}>
                    <Badge variant="brand" size="sm" icon="check">
                        Choisi
                    </Badge>
                </div>
            ) : null}
            <div
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: active
                        ? "var(--brand-600)"
                        : "var(--eduflow-surface-sunken)",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 12,
                }}
            >
                <Icon
                    name={icon}
                    size={20}
                    color={active ? "#fff" : "var(--brand-700)"}
                />
            </div>
            <div
                className="eduflow-display"
                style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: active
                        ? "var(--brand-900, var(--brand-800))"
                        : "var(--eduflow-text-primary)",
                }}
            >
                {title}
            </div>
            <div
                style={{
                    fontSize: 12,
                    color: active ? "var(--brand-800)" : "var(--eduflow-text-tertiary)",
                    marginTop: 4,
                }}
            >
                {sub}
            </div>
            <div
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    marginTop: 10,
                    lineHeight: 1.55,
                }}
            >
                {detail}
            </div>
        </button>
    );
}

function PeriodDetail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div
                style={{
                    fontSize: 9,
                    color: "var(--eduflow-text-tertiary)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{value}</div>
        </div>
    );
}
