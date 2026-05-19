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

type Wish = {
    id: string;
    rank: number;
    series: string | null;
    seriesEnum: string;
    score: number;
    justification: string;
    strengths: string[];
    warnings: string[];
    isValidated: boolean;
};

type SubjectAverage = { name: string; average: number };

type MeData = {
    student: { firstName: string; lastName: string };
    academicYear: { id: string; name: string };
    enrollment: {
        classId: string;
        className: string;
        levelName: string;
    } | null;
    orientationId?: string;
    status?: string;
    hasOrientation: boolean;
    aiTop: Wish | null;
    wishes: Wish[];
    recommendations: Wish[];
    subjectAverages: SubjectAverage[];
};

type SeriesColor = "brand" | "info" | "success" | "warning" | "danger";

const SERIES_META: Record<
    string,
    { full: string; color: SeriesColor; family: string; targetMention: string }
> = {
    A1: {
        full: "Lettres-Langues · bac littéraire",
        color: "brand",
        family: "Littéraire",
        targetMention: "Bien",
    },
    A2: {
        full: "Lettres-Sciences humaines · bac littéraire",
        color: "brand",
        family: "Littéraire",
        targetMention: "Bien",
    },
    B: {
        full: "Lettres-Sciences sociales · bac littéraire",
        color: "brand",
        family: "Littéraire",
        targetMention: "Bien",
    },
    C: {
        full: "Sciences & Mathématiques · bac scientifique",
        color: "info",
        family: "Scientifique",
        targetMention: "Bien",
    },
    D: {
        full: "Biologie-Géologie · bac scientifique",
        color: "success",
        family: "Scientifique",
        targetMention: "Bien",
    },
    E: {
        full: "Mathématiques & Techniques · bac sci. & tech.",
        color: "info",
        family: "Sci. & Tech.",
        targetMention: "Bien",
    },
    F1: {
        full: "Construction mécanique · bac sci. & tech.",
        color: "warning",
        family: "Sci. & Tech.",
        targetMention: "Assez Bien",
    },
    F2: {
        full: "Électronique · bac sci. & tech.",
        color: "warning",
        family: "Sci. & Tech.",
        targetMention: "Assez Bien",
    },
    F3: {
        full: "Électrotechnique · bac sci. & tech.",
        color: "warning",
        family: "Sci. & Tech.",
        targetMention: "Assez Bien",
    },
    F4: {
        full: "Génie civil · bac sci. & tech.",
        color: "warning",
        family: "Sci. & Tech.",
        targetMention: "Assez Bien",
    },
    G1: {
        full: "Administration · bac tech. & comm.",
        color: "warning",
        family: "Tech. & Comm.",
        targetMention: "Assez Bien",
    },
    G2: {
        full: "Gestion · bac tech. & comm.",
        color: "warning",
        family: "Tech. & Comm.",
        targetMention: "Assez Bien",
    },
    G3: {
        full: "Commerce · bac tech. & comm.",
        color: "warning",
        family: "Tech. & Comm.",
        targetMention: "Assez Bien",
    },
    DT: {
        full: "Diplôme de Technicien · filière professionnelle",
        color: "danger",
        family: "Pro / DT",
        targetMention: "Passable",
    },
};

const CAREERS: Record<string, string[]> = {
    A1: ["Traduction", "Lettres", "Journalisme", "Droit", "Enseignement"],
    A2: ["Histoire", "Sociologie", "Sciences politiques", "Enseignement"],
    B: ["Économie", "Sciences sociales", "Sciences politiques"],
    C: [
        "Ingénieur",
        "Mathématicien",
        "Informaticien",
        "Architecte",
        "Chercheur",
    ],
    D: [
        "Médecin",
        "Pharmacien",
        "Vétérinaire",
        "Sage-femme",
        "Ingénieur agro",
        "Biologiste",
        "Kiné",
        "Dentiste",
        "Chercheur",
    ],
    E: [
        "Ingénieur technique",
        "Génie industriel",
        "Énergie",
        "Maintenance avancée",
    ],
    F1: ["Mécanique", "Maintenance industrielle", "Automobile"],
    F2: ["Électronique", "Télécoms", "Domotique"],
    F3: ["Électrotechnique", "Énergie", "Génie électrique"],
    F4: ["Génie civil", "BTP", "Géomètre", "Urbanisme"],
    G1: ["Administration", "Ressources humaines", "Secrétariat de direction"],
    G2: ["Gestion", "Comptabilité", "Audit", "Banque"],
    G3: ["Commerce", "Marketing", "Vente", "E-commerce"],
    DT: ["Mode", "Hôtellerie", "BTP", "Eau & assainissement", "Informatique"],
};

const MENTIONS = [
    { m: "Passable", r: "10,00 → 11,99", c: "neutral" as const },
    { m: "Assez Bien", r: "12,00 → 13,99", c: "info" as const },
    { m: "Bien", r: "14,00 → 15,99", c: "success" as const },
    { m: "Très Bien", r: "≥ 16,00", c: "warning" as const },
];

const FR_NUM = (v: number | null, digits = 1): string =>
    v === null ? "—" : v.toFixed(digits).replace(".", ",");

export default function OrientationMePage() {
    const [data, setData] = useState<MeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/orientation/me");
                const body = await res.json();
                if (!res.ok)
                    throw new Error(body.error || "Erreur lors du chargement");
                setData(body);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const aiSeries = data?.aiTop?.series ?? null;
    const aiMeta = aiSeries ? SERIES_META[aiSeries] : null;
    const careers = aiSeries ? CAREERS[aiSeries] ?? [] : [];

    const strongSubjects = useMemo(() => {
        if (!data) return [];
        return data.subjectAverages.slice(0, 5);
    }, [data]);

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["STUDENT"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Mon orientation post-BEPC"
                    sub="Choisis tes 3 vœux de série pour la 2nde · à remplir avant le conseil d'orientation"
                    actions={
                        <Badge variant="brand" icon="sparkle">
                            IA t'aide
                        </Badge>
                    }
                />

                {loading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Chargement de ton dossier…
                        </span>
                    </div>
                ) : null}

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

                {data && !data.hasOrientation ? (
                    <Card padding={36}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div
                                className="grid place-items-center"
                                style={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: 16,
                                    background: "var(--brand-50)",
                                }}
                            >
                                <Icon name="sparkle" size={26} color="var(--brand-700)" />
                            </div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Tes recommandations arrivent bientôt
                            </h3>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--eduflow-text-secondary)",
                                    maxWidth: 480,
                                    lineHeight: 1.55,
                                    margin: 0,
                                }}
                            >
                                L'équipe pédagogique prépare ton analyse personnalisée. Reviens
                                consulter cette page après le BEPC blanc — tu pourras alors
                                ordonner tes 3 vœux.
                            </p>
                        </div>
                    </Card>
                ) : null}

                {data && data.hasOrientation && data.aiTop && aiMeta ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1.4fr 1fr",
                            gap: 14,
                        }}
                        className="me-grid"
                    >
                        {/* LEFT column */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {/* Gradient hero */}
                            <Card
                                style={{
                                    background:
                                        "linear-gradient(135deg, var(--eduflow-success-700, #047857), var(--brand-700))",
                                    color: "#fff",
                                    border: 0,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        letterSpacing: "0.12em",
                                        textTransform: "uppercase",
                                        opacity: 0.85,
                                        marginBottom: 12,
                                    }}
                                >
                                    <Icon name="sparkle" size={14} />
                                    Recommandation EduPilot AI · pour toi
                                </div>
                                <div
                                    className="eduflow-display"
                                    style={{
                                        fontSize: 36,
                                        fontWeight: 800,
                                        lineHeight: 1,
                                        letterSpacing: "-0.03em",
                                    }}
                                >
                                    Série {aiSeries} ·{" "}
                                    {aiMeta.full.split("·")[0].trim()}
                                </div>
                                <p
                                    style={{
                                        fontSize: 14,
                                        opacity: 0.92,
                                        lineHeight: 1.6,
                                        marginTop: 10,
                                    }}
                                >
                                    {data.aiTop.justification ||
                                        "Tes résultats récents s'alignent avec cette série. Confirme avec ton équipe pédagogique avant de valider."}
                                </p>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 18,
                                        marginTop: 18,
                                        paddingTop: 16,
                                        borderTop: "1px solid rgba(255,255,255,0.2)",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <HeroStat
                                        label="Compatibilité"
                                        value={`${Math.round(data.aiTop.score)}%`}
                                    />
                                    <HeroStat
                                        label="Mention bac visée"
                                        value={aiMeta.targetMention}
                                    />
                                    <HeroStat
                                        label="Famille"
                                        value={aiMeta.family}
                                    />
                                </div>
                            </Card>

                            {/* Wishes */}
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
                                        Tes 3 vœux · classés par préférence
                                    </h3>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            margin: "2px 0 0",
                                        }}
                                    >
                                        Tes parents valideront ensuite avant le conseil d'orientation.
                                    </p>
                                </div>
                                {data.wishes.length === 0 ? (
                                    <div
                                        style={{
                                            padding: "18px 18px",
                                            fontSize: 12,
                                            color: "var(--eduflow-text-tertiary)",
                                        }}
                                    >
                                        Aucun vœu enregistré pour l'instant.
                                    </div>
                                ) : (
                                    data.wishes.map((w, i) => {
                                        const meta = w.series ? SERIES_META[w.series] : null;
                                        const color = meta?.color ?? "neutral";
                                        const colorVar =
                                            color === "neutral"
                                                ? "eduflow-neutral"
                                                : `eduflow-${color}`;
                                        return (
                                            <div
                                                key={w.id}
                                                style={{
                                                    padding: "16px 18px",
                                                    borderTop:
                                                        i > 0
                                                            ? "1px solid var(--eduflow-border-subtle)"
                                                            : 0,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 16,
                                                }}
                                            >
                                                <div
                                                    className="eduflow-display tabular"
                                                    style={{
                                                        fontSize: 32,
                                                        fontWeight: 800,
                                                        color: `var(--${colorVar}-700)`,
                                                        width: 36,
                                                        textAlign: "center",
                                                        fontVariantNumeric: "tabular-nums",
                                                    }}
                                                >
                                                    {w.rank}
                                                </div>
                                                <div
                                                    style={{
                                                        width: 64,
                                                        height: 56,
                                                        borderRadius: 14,
                                                        background: `var(--${colorVar}-100, var(--brand-100))`,
                                                        display: "grid",
                                                        placeItems: "center",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <span
                                                        className="eduflow-display"
                                                        style={{
                                                            fontSize: 22,
                                                            fontWeight: 800,
                                                            color: `var(--${colorVar}-700)`,
                                                            letterSpacing: "-0.02em",
                                                        }}
                                                    >
                                                        {w.series ?? "—"}
                                                    </span>
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            fontSize: 14,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        Série {w.series} —{" "}
                                                        {meta?.full ?? ""}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                        }}
                                                    >
                                                        Compatibilité IA ·{" "}
                                                        {Math.round(w.score)}%
                                                    </div>
                                                    <div
                                                        style={{
                                                            height: 4,
                                                            background:
                                                                "var(--eduflow-neutral-200)",
                                                            borderRadius: 2,
                                                            marginTop: 6,
                                                            overflow: "hidden",
                                                            width: 200,
                                                            maxWidth: "100%",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                height: "100%",
                                                                width: `${Math.min(
                                                                    100,
                                                                    Math.round(w.score)
                                                                )}%`,
                                                                background: `var(--${colorVar}-600)`,
                                                                transition:
                                                                    "width var(--motion-base, 280ms) var(--ease-out, ease)",
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                {w.isValidated ? (
                                                    <Badge
                                                        variant="success"
                                                        size="sm"
                                                        icon="check"
                                                    >
                                                        Validé
                                                    </Badge>
                                                ) : null}
                                            </div>
                                        );
                                    })
                                )}
                            </Card>
                        </div>

                        {/* RIGHT rail */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 14,
                            }}
                        >
                            <Card>
                                <SubLabel>
                                    Pourquoi série {aiSeries} te correspond
                                </SubLabel>
                                <div style={{ marginTop: 10 }}>
                                    {strongSubjects.length === 0 ? (
                                        <p
                                            style={{
                                                fontSize: 11,
                                                color:
                                                    "var(--eduflow-text-tertiary)",
                                                margin: 0,
                                            }}
                                        >
                                            Aucune note disponible pour le moment.
                                        </p>
                                    ) : (
                                        strongSubjects.map((s) => {
                                            const tone =
                                                s.average >= 14
                                                    ? "success"
                                                    : s.average >= 12
                                                    ? "info"
                                                    : "warning";
                                            return (
                                                <div
                                                    key={s.name}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        padding: "6px 0",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 12,
                                                            flex: 1,
                                                        }}
                                                    >
                                                        {s.name}
                                                    </span>
                                                    <div
                                                        style={{
                                                            height: 4,
                                                            width: 80,
                                                            background:
                                                                "var(--eduflow-neutral-200)",
                                                            borderRadius: 2,
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                height: "100%",
                                                                width: `${Math.min(
                                                                    100,
                                                                    (s.average / 20) * 100
                                                                )}%`,
                                                                background: `var(--eduflow-${tone}-500)`,
                                                                transition:
                                                                    "width var(--motion-base, 280ms) var(--ease-out, ease)",
                                                            }}
                                                        />
                                                    </div>
                                                    <span
                                                        className="eduflow-display tabular"
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                            width: 40,
                                                            textAlign: "right",
                                                            color: `var(--eduflow-${tone}-700)`,
                                                            fontVariantNumeric: "tabular-nums",
                                                        }}
                                                    >
                                                        {FR_NUM(s.average)}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </Card>

                            <Card>
                                <SubLabel>Mentions du bac · barème DOB</SubLabel>
                                <div
                                    style={{
                                        marginTop: 8,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                    }}
                                >
                                    {MENTIONS.map((mention) => {
                                        const isTarget = mention.m === aiMeta.targetMention;
                                        return (
                                            <div
                                                key={mention.m}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                    padding: "6px 10px",
                                                    borderRadius: 8,
                                                    background: isTarget
                                                        ? "var(--eduflow-success-50)"
                                                        : "transparent",
                                                    border: isTarget
                                                        ? "1px solid var(--eduflow-success-200)"
                                                        : "1px solid transparent",
                                                }}
                                            >
                                                <Badge variant={mention.c} size="sm">
                                                    {mention.m}
                                                </Badge>
                                                <span
                                                    className="tabular"
                                                    style={{
                                                        fontSize: 11,
                                                        color:
                                                            "var(--eduflow-text-secondary)",
                                                        fontVariantNumeric: "tabular-nums",
                                                    }}
                                                >
                                                    {mention.r}
                                                </span>
                                                {isTarget ? (
                                                    <span
                                                        style={{
                                                            marginLeft: "auto",
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color:
                                                                "var(--eduflow-success-700)",
                                                        }}
                                                    >
                                                        ← Ton objectif
                                                    </span>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>

                            <Card>
                                <SubLabel>
                                    Après le bac {aiSeries} · métiers possibles
                                </SubLabel>
                                <div
                                    style={{
                                        marginTop: 8,
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 6,
                                    }}
                                >
                                    {careers.length === 0 ? (
                                        <span
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            À discuter avec un conseiller.
                                        </span>
                                    ) : (
                                        careers.map((m) => (
                                            <Badge key={m} variant="success" size="sm">
                                                {m}
                                            </Badge>
                                        ))
                                    )}
                                </div>
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginTop: 12,
                                        lineHeight: 1.55,
                                    }}
                                >
                                    Études entre 4 et 9 ans après le bac · démarrage de carrière entre
                                    22 et 27 ans.
                                </p>
                            </Card>

                            <Button
                                size="lg"
                                iconRight="chevron"
                                style={{
                                    width: "100%",
                                    background: "var(--gradient-cta, var(--brand-700))",
                                }}
                            >
                                Valider mes 3 vœux
                            </Button>
                            <Link href="/dashboard/messages" style={{ textDecoration: "none" }}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon="sparkle"
                                    style={{ width: "100%" }}
                                >
                                    Discuter avec un conseiller
                                </Button>
                            </Link>
                        </div>
                    </div>
                ) : null}
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .me-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}

function HeroStat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div
                style={{
                    fontSize: 10,
                    opacity: 0.7,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
            </div>
        </div>
    );
}
