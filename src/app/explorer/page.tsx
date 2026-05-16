"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    MetricCard,
    Spinner,
} from "@/components/edu";
import { PageHeader, formatNumber } from "@/components/edu-homes/_shared";

interface SchoolPoint {
    id: string;
    name: string;
    code: string | null;
    city: string | null;
    address: string | null;
    level: string | null;
    type: string | null;
    studentsCount: number;
    teachersCount: number;
    classesCount: number;
    lat: number;
    lng: number;
}

interface Overview {
    schools: number;
    students: number;
    classes: number;
    teachers: number;
}

const LEVEL_VARIANTS: Record<string, "success" | "brand" | "warning" | "neutral"> = {
    PRIMARY: "success",
    SECONDARY_COLLEGE: "brand",
    SECONDARY_LYCEE: "warning",
    MIXED: "neutral",
};

const LEVEL_LABELS: Record<string, string> = {
    PRIMARY: "Primaire",
    SECONDARY_COLLEGE: "Collège",
    SECONDARY_LYCEE: "Lycée",
    MIXED: "Mixte",
};

export default function ExplorerRoutePage() {
    const [overview, setOverview] = useState<Overview | null>(null);
    const [schools, setSchools] = useState<SchoolPoint[]>([]);
    const [loadingOverview, setLoadingOverview] = useState(true);
    const [loadingSchools, setLoadingSchools] = useState(true);
    const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const fetchOverview = useCallback(async () => {
        try {
            const res = await fetch("/api/explorer/overview", { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                setOverview(data);
            }
        } catch {
            setOverview({ schools: 0, students: 0, classes: 0, teachers: 0 });
        } finally {
            setLoadingOverview(false);
        }
    }, []);

    const fetchSchools = useCallback(async () => {
        try {
            const res = await fetch("/api/explorer/schools");
            if (res.ok) {
                const data = (await res.json()) as { schools: SchoolPoint[] };
                setSchools(data.schools ?? []);
            }
        } catch {
            setSchools([]);
        } finally {
            setLoadingSchools(false);
        }
    }, []);

    useEffect(() => {
        fetchOverview();
        fetchSchools();
    }, [fetchOverview, fetchSchools]);

    const filteredSchools = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return schools;
        return schools.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                (s.city?.toLowerCase() ?? "").includes(q) ||
                (s.code?.toLowerCase() ?? "").includes(q)
        );
    }, [schools, search]);

    const selectedSchool = useMemo(
        () => schools.find((s) => s.id === selectedSchoolId) ?? null,
        [schools, selectedSchoolId]
    );

    return (
        <div
            className="eduflow-scope min-h-screen"
            style={{
                background:
                    "radial-gradient(circle at 50% 30%, var(--eduflow-surface-card) 0%, var(--eduflow-surface-page) 60%)",
                padding: "32px clamp(16px, 4vw, 44px) 64px",
            }}
        >
            <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link href="/" style={{ textDecoration: "none" }}>
                            <Button variant="secondary" size="sm">
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                    <Icon
                                        name="chevron"
                                        size={14}
                                        style={{ transform: "scaleX(-1)" }}
                                    />
                                    Accueil
                                </span>
                            </Button>
                        </Link>
                        <PageHeader
                            greeting="Cartographie réseau"
                            sub="Vue géographique du réseau d'établissements EduPilot"
                        />
                    </div>
                </div>

                {/* KPIs */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: 12,
                    }}
                >
                    <MetricCard
                        label="Établissements"
                        value={loadingOverview ? "…" : formatNumber(overview?.schools ?? 0)}
                        icon="school"
                        variant="brand"
                    />
                    <MetricCard
                        label="Élèves"
                        value={loadingOverview ? "…" : formatNumber(overview?.students ?? 0)}
                        icon="users"
                        variant="info"
                    />
                    <MetricCard
                        label="Classes"
                        value={loadingOverview ? "…" : formatNumber(overview?.classes ?? 0)}
                        icon="cards"
                        variant="success"
                    />
                    <MetricCard
                        label="Enseignants"
                        value={loadingOverview ? "…" : formatNumber(overview?.teachers ?? 0)}
                        icon="users"
                        variant="warning"
                    />
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: selectedSchool
                            ? "minmax(0, 1.6fr) minmax(320px, 1fr)"
                            : "minmax(0, 1fr)",
                        gap: 16,
                    }}
                    className="dashboard-grid-collapse"
                >
                    <Card padding={0}>
                        <div
                            className="flex flex-wrap items-center gap-3 border-b px-5 py-4"
                            style={{ borderColor: "var(--eduflow-border-subtle)" }}
                        >
                            <Icon name="grid" size={18} color="var(--brand-700)" />
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Établissements
                            </h3>
                            <Badge variant="neutral" size="sm">
                                {filteredSchools.length} sur {schools.length}
                            </Badge>
                            <label
                                className="ml-auto flex h-9 items-center gap-2 px-3"
                                style={{
                                    minWidth: 220,
                                    background: "var(--eduflow-surface-sunken)",
                                    border: "1px solid transparent",
                                    borderRadius: "var(--eduflow-radius-md)",
                                }}
                            >
                                <Icon
                                    name="search"
                                    size={14}
                                    color="var(--eduflow-text-tertiary)"
                                />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Nom, ville, code…"
                                    className="flex-1 bg-transparent outline-none"
                                    style={{
                                        border: 0,
                                        fontFamily: "inherit",
                                        fontSize: 13,
                                        color: "var(--eduflow-text-primary)",
                                    }}
                                />
                            </label>
                        </div>

                        {loadingSchools ? (
                            <div className="flex items-center gap-3 px-5 py-12">
                                <Spinner size={20} color="var(--brand-600)" />
                                <span
                                    style={{
                                        fontSize: 13,
                                        color: "var(--eduflow-text-secondary)",
                                    }}
                                >
                                    Chargement de la cartographie…
                                </span>
                            </div>
                        ) : filteredSchools.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                                <Icon
                                    name="school"
                                    size={28}
                                    color="var(--eduflow-text-tertiary)"
                                />
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 13,
                                        color: "var(--eduflow-text-secondary)",
                                    }}
                                >
                                    Aucun établissement ne correspond à la recherche.
                                </p>
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                                    gap: 12,
                                    padding: 16,
                                }}
                            >
                                {filteredSchools.map((school) => {
                                    const variant =
                                        LEVEL_VARIANTS[school.level ?? ""] || "neutral";
                                    const isSelected = selectedSchoolId === school.id;
                                    return (
                                        <button
                                            key={school.id}
                                            type="button"
                                            onClick={() =>
                                                setSelectedSchoolId(
                                                    isSelected ? null : school.id
                                                )
                                            }
                                            style={{
                                                padding: 14,
                                                borderRadius: "var(--eduflow-radius-card)",
                                                border: isSelected
                                                    ? "2px solid var(--brand-600)"
                                                    : "1px solid var(--eduflow-border-default)",
                                                background: isSelected
                                                    ? "var(--brand-50)"
                                                    : "var(--eduflow-surface-card)",
                                                fontFamily: "inherit",
                                                cursor: "pointer",
                                                textAlign: "left",
                                                transition:
                                                    "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                                boxShadow: isSelected
                                                    ? "var(--eduflow-shadow-card-brand)"
                                                    : "none",
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <Avatar name={school.name} size="md" />
                                                <div className="min-w-0 flex-1">
                                                    <div
                                                        style={{
                                                            fontSize: 14,
                                                            fontWeight: 700,
                                                            color: isSelected
                                                                ? "var(--brand-800)"
                                                                : "var(--eduflow-text-primary)",
                                                            lineHeight: 1.2,
                                                        }}
                                                    >
                                                        {school.name}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            color: "var(--eduflow-text-tertiary)",
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        {school.city ?? "Ville inconnue"}
                                                        {school.code ? ` · ${school.code}` : ""}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                {school.level ? (
                                                    <Badge variant={variant} size="sm">
                                                        {LEVEL_LABELS[school.level] ??
                                                            school.level}
                                                    </Badge>
                                                ) : null}
                                                <span
                                                    className="eduflow-tabular flex items-center gap-1"
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--eduflow-text-secondary)",
                                                    }}
                                                >
                                                    <Icon name="users" size={11} />
                                                    {school.studentsCount}
                                                </span>
                                                <span
                                                    className="eduflow-tabular flex items-center gap-1"
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--eduflow-text-secondary)",
                                                    }}
                                                >
                                                    <Icon name="book" size={11} />
                                                    {school.classesCount}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </Card>

                    {selectedSchool ? (
                        <SchoolDetailPanel
                            school={selectedSchool}
                            onClose={() => setSelectedSchoolId(null)}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function SchoolDetailPanel({
    school,
    onClose,
}: {
    school: SchoolPoint;
    onClose: () => void;
}) {
    const variant = LEVEL_VARIANTS[school.level ?? ""] || "neutral";
    const ratio =
        school.classesCount > 0
            ? Math.round(school.studentsCount / school.classesCount)
            : 0;

    return (
        <Card padding={0} style={{ position: "sticky", top: 16 }}>
            <div
                className="flex items-start justify-between gap-3 border-b px-5 py-4"
                style={{ borderColor: "var(--eduflow-border-subtle)" }}
            >
                <div className="flex items-start gap-3">
                    <Avatar name={school.name} size="lg" status="online" />
                    <div className="min-w-0">
                        <h3
                            className="eduflow-display"
                            style={{
                                margin: 0,
                                fontSize: 18,
                                fontWeight: 700,
                                color: "var(--eduflow-text-primary)",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {school.name}
                        </h3>
                        <div
                            className="mt-1 flex flex-wrap items-center gap-2"
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-tertiary)",
                            }}
                        >
                            {school.code ? (
                                <span className="eduflow-mono">{school.code}</span>
                            ) : null}
                            {school.level ? (
                                <Badge variant={variant} size="sm">
                                    {LEVEL_LABELS[school.level] ?? school.level}
                                </Badge>
                            ) : null}
                            {school.type ? (
                                <Badge variant="neutral" size="sm">
                                    {school.type}
                                </Badge>
                            ) : null}
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fermer"
                    className="grid place-items-center"
                    style={{
                        width: 30,
                        height: 30,
                        border: 0,
                        background: "transparent",
                        borderRadius: 8,
                        color: "var(--eduflow-text-tertiary)",
                        cursor: "pointer",
                    }}
                >
                    <Icon name="x" size={16} />
                </button>
            </div>

            <div className="px-5 py-5">
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 12,
                    }}
                >
                    <Stat
                        label="Élèves"
                        value={school.studentsCount.toString()}
                        accent="brand"
                    />
                    <Stat
                        label="Enseignants"
                        value={school.teachersCount.toString()}
                        accent="info"
                    />
                    <Stat
                        label="Classes"
                        value={school.classesCount.toString()}
                        accent="success"
                    />
                </div>

                <div
                    className="mt-4 flex items-center justify-between border-t pt-3"
                    style={{ borderColor: "var(--eduflow-border-subtle)" }}
                >
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: "var(--eduflow-text-tertiary)",
                        }}
                    >
                        Ratio classes
                    </span>
                    <span
                        className="eduflow-display eduflow-tabular"
                        style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: "var(--eduflow-text-primary)",
                        }}
                    >
                        {ratio}
                        <span
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-tertiary)",
                                fontWeight: 600,
                                marginLeft: 4,
                            }}
                        >
                            élèves / classe
                        </span>
                    </span>
                </div>

                {school.address || school.city ? (
                    <div
                        className="mt-4 border-t pt-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                color: "var(--eduflow-text-tertiary)",
                                marginBottom: 6,
                            }}
                        >
                            Localisation
                        </div>
                        <div className="flex items-start gap-2">
                            <Icon name="school" size={14} color="var(--brand-700)" />
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-text-secondary)",
                                    lineHeight: 1.55,
                                }}
                            >
                                {school.address ? <div>{school.address}</div> : null}
                                {school.city ? (
                                    <div style={{ fontWeight: 600 }}>{school.city}</div>
                                ) : null}
                                <div
                                    className="eduflow-mono"
                                    style={{
                                        fontSize: 10,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginTop: 2,
                                    }}
                                >
                                    {school.lat.toFixed(4)}°, {school.lng.toFixed(4)}°
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="mt-5">
                    <Link href={`/dashboard/root-control/schools`}>
                        <Button full iconRight="arrowRight">
                            Ouvrir la fiche établissement
                        </Button>
                    </Link>
                </div>
            </div>
        </Card>
    );
}

function Stat({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent: "brand" | "info" | "success";
}) {
    return (
        <div>
            <div
                style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display eduflow-tabular"
                style={{
                    fontSize: 26,
                    fontWeight: 700,
                    marginTop: 2,
                    color:
                        accent === "brand"
                            ? "var(--brand-700)"
                            : `var(--eduflow-${accent}-700)`,
                    lineHeight: 1.05,
                }}
            >
                {value}
            </div>
        </div>
    );
}
