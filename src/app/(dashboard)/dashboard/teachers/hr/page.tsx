"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Chip,
    Icon,
    MetricCard,
    Spinner,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type Teacher = {
    id: string;
    matricule: string | null;
    specialization: string | null;
    hireDate: string | null;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string | null;
        isActive: boolean;
    };
    classSubjects?: {
        subject?: { name: string };
        class?: { name: string };
    }[];
    mainClasses?: { name: string }[];
};

type TeachersResponse =
    | Teacher[]
    | {
          data?: Teacher[];
          teachers?: Teacher[];
          pagination?: { total?: number };
      };

type Filter = "all" | "titulaires" | "vacataires" | "inactive";

function classifyContract(
    spec: string | null,
    hireDate: string | null
): "titulaire" | "vacataire" {
    // Heuristic: titulaire if hireDate > 2 years ago, vacataire otherwise.
    if (!hireDate) return "titulaire";
    const hired = new Date(hireDate);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    return hired < twoYearsAgo ? "titulaire" : "vacataire";
}

function classNameList(t: Teacher): string {
    const classes = new Set<string>();
    for (const cs of t.classSubjects ?? []) {
        if (cs.class?.name) classes.add(cs.class.name);
    }
    for (const c of t.mainClasses ?? []) {
        if (c?.name) classes.add(c.name);
    }
    return Array.from(classes).slice(0, 4).join(", ") || "—";
}

function subjectsList(t: Teacher): string {
    const subjects = new Set<string>();
    for (const cs of t.classSubjects ?? []) {
        if (cs.subject?.name) subjects.add(cs.subject.name);
    }
    return t.specialization ?? (Array.from(subjects).slice(0, 2).join(", ") || "—");
}

export default function TeachersHRPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>("all");

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/teachers?limit=100");
                const body: TeachersResponse = await res.json();
                if (!res.ok)
                    throw new Error(
                        (body as { error?: string }).error || "Erreur"
                    );
                const list = Array.isArray(body)
                    ? body
                    : body.teachers ?? body.data ?? [];
                setTeachers(list);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const partitioned = useMemo(() => {
        const titulaires: Teacher[] = [];
        const vacataires: Teacher[] = [];
        const inactive: Teacher[] = [];
        for (const t of teachers) {
            if (!t.user.isActive) {
                inactive.push(t);
                continue;
            }
            const c = classifyContract(t.specialization, t.hireDate);
            if (c === "titulaire") titulaires.push(t);
            else vacataires.push(t);
        }
        return { titulaires, vacataires, inactive };
    }, [teachers]);

    const view = useMemo(() => {
        if (filter === "titulaires") return partitioned.titulaires;
        if (filter === "vacataires") return partitioned.vacataires;
        if (filter === "inactive") return partitioned.inactive;
        return teachers;
    }, [filter, partitioned, teachers]);

    return (
        <PageGuard
            permission={Permission.SCHOOL_UPDATE}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center gap-3">
                    <Link href="/dashboard/teachers" style={{ textDecoration: "none" }}>
                        <Button variant="secondary" size="sm">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Icon
                                    name="chevron"
                                    size={14}
                                    style={{ transform: "scaleX(-1)" }}
                                />
                                Annuaire enseignants
                            </span>
                        </Button>
                    </Link>
                </div>
                <PageHeader
                    greeting="Ressources humaines · enseignants"
                    sub={`${teachers.length} contrats · ${partitioned.titulaires.length} titulaires · ${partitioned.vacataires.length} vacataires`}
                    breadcrumb={["Administration", "RH", "Enseignants"]}
                    actions={
                        <>
                            <Button variant="secondary" icon="download" disabled>
                                Fiche de paie
                            </Button>
                            <Link
                                href="/dashboard/teachers/new"
                                style={{ textDecoration: "none" }}
                            >
                                <Button icon="plus">Recruter</Button>
                            </Link>
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
                        gridTemplateColumns: "repeat(5, 1fr)",
                        gap: 12,
                    }}
                    className="kpi-grid"
                >
                    <MetricCard
                        label="Enseignants"
                        value={String(teachers.length)}
                        icon="users"
                        variant="brand"
                    />
                    <MetricCard
                        label="Titulaires"
                        value={String(partitioned.titulaires.length)}
                        icon="check"
                        variant="success"
                    />
                    <MetricCard
                        label="Vacataires"
                        value={String(partitioned.vacataires.length)}
                        icon="clock"
                        variant="info"
                    />
                    <MetricCard
                        label="Inactifs"
                        value={String(partitioned.inactive.length)}
                        icon="warning"
                        variant={
                            partitioned.inactive.length > 0 ? "warning" : "neutral"
                        }
                    />
                    <MetricCard
                        label="Paie · ce mois"
                        value="—"
                        unit="M FCFA"
                        icon="money"
                        variant="neutral"
                    />
                </div>

                {loading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Chargement de l'équipe…
                        </span>
                    </div>
                ) : null}

                {!loading ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1.6fr 1fr",
                            gap: 14,
                        }}
                        className="hr-grid"
                    >
                        <Card padding={0}>
                            <div
                                style={{
                                    padding: "12px 18px",
                                    display: "flex",
                                    gap: 8,
                                    borderBottom: "1px solid var(--eduflow-border-subtle)",
                                    flexWrap: "wrap",
                                }}
                            >
                                <Chip
                                    active={filter === "all"}
                                    count={teachers.length}
                                    onClick={() => setFilter("all")}
                                >
                                    Tous
                                </Chip>
                                <Chip
                                    active={filter === "titulaires"}
                                    count={partitioned.titulaires.length}
                                    onClick={() => setFilter("titulaires")}
                                >
                                    Titulaires
                                </Chip>
                                <Chip
                                    active={filter === "vacataires"}
                                    count={partitioned.vacataires.length}
                                    onClick={() => setFilter("vacataires")}
                                >
                                    Vacataires
                                </Chip>
                                <Chip
                                    active={filter === "inactive"}
                                    count={partitioned.inactive.length}
                                    onClick={() => setFilter("inactive")}
                                >
                                    Inactifs
                                </Chip>
                            </div>
                            <div style={{ overflowX: "auto" }}>
                                <table
                                    style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        fontSize: 12,
                                    }}
                                >
                                    <thead>
                                        <tr
                                            style={{
                                                background:
                                                    "var(--eduflow-surface-sunken)",
                                            }}
                                        >
                                            {[
                                                "Enseignant",
                                                "Matière · classes",
                                                "Contrat",
                                                "État",
                                                "Action",
                                            ].map((h) => (
                                                <th
                                                    key={h}
                                                    style={{
                                                        padding: "10px 14px",
                                                        textAlign: "left",
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color:
                                                            "var(--eduflow-text-tertiary)",
                                                        letterSpacing: "0.06em",
                                                        textTransform: "uppercase",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {view.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    style={{
                                                        padding: "32px 14px",
                                                        textAlign: "center",
                                                        fontSize: 12,
                                                        color:
                                                            "var(--eduflow-text-tertiary)",
                                                    }}
                                                >
                                                    Aucun enseignant dans cette catégorie.
                                                </td>
                                            </tr>
                                        ) : (
                                            view.map((t, i) => {
                                                const name = `${t.user.firstName} ${t.user.lastName}`;
                                                const contract = classifyContract(
                                                    t.specialization,
                                                    t.hireDate
                                                );
                                                const isActive = t.user.isActive;
                                                return (
                                                    <tr
                                                        key={t.id}
                                                        style={{
                                                            borderTop:
                                                                i > 0
                                                                    ? "1px solid var(--eduflow-border-subtle)"
                                                                    : 0,
                                                        }}
                                                    >
                                                        <td
                                                            style={{
                                                                padding: "12px 14px",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 10,
                                                                }}
                                                            >
                                                                <Avatar
                                                                    name={name}
                                                                    size="sm"
                                                                    status={
                                                                        isActive ? "online" : undefined
                                                                    }
                                                                />
                                                                <div>
                                                                    <div
                                                                        style={{
                                                                            fontSize: 13,
                                                                            fontWeight: 700,
                                                                        }}
                                                                    >
                                                                        {name}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            fontSize: 10,
                                                                            color:
                                                                                "var(--eduflow-text-tertiary)",
                                                                        }}
                                                                    >
                                                                        {t.matricule
                                                                            ? `Mat. ${t.matricule}`
                                                                            : t.user.email}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px 14px",
                                                                color:
                                                                    "var(--eduflow-text-secondary)",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    fontSize: 12,
                                                                    fontWeight: 600,
                                                                    color:
                                                                        "var(--eduflow-text-primary)",
                                                                }}
                                                            >
                                                                {subjectsList(t)}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    fontSize: 10,
                                                                    color:
                                                                        "var(--eduflow-text-tertiary)",
                                                                    marginTop: 2,
                                                                }}
                                                            >
                                                                {classNameList(t)}
                                                            </div>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px 14px",
                                                            }}
                                                        >
                                                            <Badge
                                                                variant={
                                                                    contract === "titulaire"
                                                                        ? "brand"
                                                                        : "info"
                                                                }
                                                                size="sm"
                                                            >
                                                                {contract === "titulaire"
                                                                    ? "Titulaire"
                                                                    : "Vacataire"}
                                                            </Badge>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px 14px",
                                                            }}
                                                        >
                                                            <Badge
                                                                variant={
                                                                    isActive ? "success" : "warning"
                                                                }
                                                                size="sm"
                                                                dot={!isActive}
                                                            >
                                                                {isActive ? "Actif" : "Inactif"}
                                                            </Badge>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px 14px",
                                                            }}
                                                        >
                                                            <Link
                                                                href={`/dashboard/teachers/${t.id}`}
                                                                style={{
                                                                    textDecoration: "none",
                                                                }}
                                                            >
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    iconRight="chevron"
                                                                >
                                                                    Fiche
                                                                </Button>
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <Card>
                                <SubLabel>Demandes de congé · à valider</SubLabel>
                                <div
                                    style={{
                                        marginTop: 8,
                                        fontSize: 12,
                                        color: "var(--eduflow-text-tertiary)",
                                        lineHeight: 1.6,
                                    }}
                                >
                                    Module en préparation · le modèle <code>LeaveRequest</code>{" "}
                                    + workflow validation seront branchés ici. Pour l'instant,
                                    aucune demande ne peut être enregistrée.
                                </div>
                            </Card>

                            <Card>
                                <SubLabel>Paie · ce mois</SubLabel>
                                <div
                                    className="eduflow-display tabular"
                                    style={{
                                        fontSize: 32,
                                        fontWeight: 800,
                                        color: "var(--brand-700)",
                                        marginTop: 6,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    —{" "}
                                    <span
                                        style={{
                                            fontSize: 13,
                                            color: "var(--eduflow-text-tertiary)",
                                            fontWeight: 600,
                                        }}
                                    >
                                        M FCFA
                                    </span>
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-secondary)",
                                        marginTop: 4,
                                    }}
                                >
                                    Calcul à brancher · grille salariale + heures contractuelles
                                    + bonus / pénalités à modéliser.
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    style={{ width: "100%", marginTop: 12 }}
                                    icon="download"
                                    disabled
                                >
                                    Télécharger toutes les fiches
                                </Button>
                            </Card>

                            <Card
                                style={{
                                    background: "var(--brand-50)",
                                    border: "1px solid var(--brand-200)",
                                }}
                            >
                                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                    <Icon
                                        name="sparkle"
                                        size={16}
                                        color="var(--brand-700)"
                                        style={{ marginTop: 2 }}
                                    />
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "var(--brand-800)",
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        Cette vue HR consolide les profils existants. Le suivi temps réel
                                        de présence enseignants, gestion des congés, et calcul paie
                                        seront ajoutés lorsque les modèles correspondants
                                        (<code>LeaveRequest</code>, <code>PayrollPeriod</code>) seront
                                        en place.
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                ) : null}
            </div>

            <style jsx global>{`
                @media (max-width: 1200px) {
                    .kpi-grid {
                        grid-template-columns: repeat(3, 1fr) !important;
                    }
                }
                @media (max-width: 760px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .hr-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
