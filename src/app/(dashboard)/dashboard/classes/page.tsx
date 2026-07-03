"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";

import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { PageGuard } from "@/components/guard/page-guard";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { Permission } from "@/lib/rbac/permissions";
import { t } from "@/lib/i18n";

import {
    Badge,
    Button,
    Card,
    Icon,
    type IconName,
} from "@/components/edu";
import { DataTable } from "@/components/layout/data-table";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";

type ClassItem = {
    id: string;
    name: string;
    classLevel?: { id: string; name: string; level: string; sequence: number };
    _count?: { enrollments: number; classSubjects: number };
};

type ClassesResponse = {
    data?: ClassItem[];
    classes?: ClassItem[];
};

const CYCLE_LABELS: Record<string, string> = {
    PRIMARY: "Primaire",
    SECONDARY_COLLEGE: "Collège",
    SECONDARY_LYCEE: "Lycée",
    MIXED: "Mixte",
};

const CYCLE_VARIANTS: Record<string, "success" | "brand" | "warning" | "neutral"> = {
    PRIMARY: "success",
    SECONDARY_COLLEGE: "brand",
    SECONDARY_LYCEE: "warning",
    MIXED: "neutral",
};

const CYCLE_FILTERS: { value: string; label: string }[] = [
    { value: "ALL", label: "Tous les cycles" },
    { value: "PRIMARY", label: "Primaire" },
    { value: "SECONDARY_COLLEGE", label: "Collège" },
    { value: "SECONDARY_LYCEE", label: "Lycée" },
];

export default function ClassesPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [selectedCycle, setSelectedCycle] = useState<string>("ALL");
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const queryParams = new URLSearchParams();
    if (debouncedSearch) queryParams.set("search", debouncedSearch);
    const url = `/api/classes?${queryParams.toString()}`;

    const {
        data: response,
        error,
        isLoading: loading,
        mutate: mutateClasses,
    } = useSWR<ClassesResponse | ClassItem[]>(url, fetcher);
    const { mutate } = useSWRConfig();
    const { toast } = useToast();

    const allClasses: ClassItem[] = Array.isArray(response)
        ? response
        : response?.data ?? response?.classes ?? [];

    const classes = useMemo(() => {
        if (selectedCycle === "ALL") return allClasses;
        return allClasses.filter((cls) => cls.classLevel?.level === selectedCycle);
    }, [allClasses, selectedCycle]);

    const cycleCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: allClasses.length };
        allClasses.forEach((cls) => {
            const level = cls.classLevel?.level || "UNKNOWN";
            counts[level] = (counts[level] || 0) + 1;
        });
        return counts;
    }, [allClasses]);

    const totalEnrollments = useMemo(
        () => allClasses.reduce((s, c) => s + (c._count?.enrollments ?? 0), 0),
        [allClasses]
    );

    const handleExportCSV = () => {
        if (!classes.length) {
            toast({
                title: "Export impossible",
                description: "Aucune donnée à exporter.",
                variant: "destructive",
            });
            return;
        }
        const headers = ["Nom de la classe", "Niveau", "Cycle", "Nombre d'élèves"];
        const rows = classes.map((cls) => [
            cls.name || "",
            cls.classLevel?.name || "",
            CYCLE_LABELS[cls.classLevel?.level || ""] || "",
            (cls._count?.enrollments ?? 0).toString(),
        ]);
        const csv =
            "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csv));
        link.setAttribute(
            "download",
            `classes_export_${new Date().toISOString().split("T")[0]}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const requestDelete = (e: React.MouseEvent, id: string, name: string) => {
        e.preventDefault();
        e.stopPropagation();
        setPendingDelete({ id, name });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/classes/${pendingDelete.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Erreur lors de la suppression");
            toast({ title: "Succès", description: "La classe a été supprimée." });
            setDeleteDialogOpen(false);
            setPendingDelete(null);
            mutate(url);
        } catch (err) {
            toast({
                title: "Erreur",
                description: err instanceof Error ? err.message : "Erreur inconnue",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <PageGuard
            permission={Permission.CLASS_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
        >
            <PageShell className="pb-12">
                <PageHeader
                    title="Classes"
                    description={`${allClasses.length} ${
                        allClasses.length > 1 ? "classes" : "classe"
                    } · ${totalEnrollments} élèves inscrits au total`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Classes" },
                    ]}
                    actions={
                            <>
                                <SegmentedToggle
                                    value={viewMode}
                                    onChange={setViewMode}
                                    options={[
                                        { value: "grid", label: "Grille", icon: "grid" },
                                        { value: "table", label: "Tableau", icon: "cards" },
                                    ]}
                                />
                                <Button variant="ghost" icon="download" onClick={handleExportCSV}>
                                    {t("common.exportCsv")}
                                </Button>
                                <Link href="/dashboard/classes/new">
                                    <Button icon="plus">Ajouter une classe</Button>
                                </Link>
                            </>
                        }
                />

                {/* Filters */}
                <Card padding={14}>
                    <div className="flex flex-wrap items-center gap-3">
                        <FieldSearch
                            label="Rechercher"
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Nom, niveau…"
                        />
                        <CyclePills
                            selected={selectedCycle}
                            onChange={setSelectedCycle}
                            counts={cycleCounts}
                        />
                    </div>
                </Card>

                {loading ? <PageLoading label="Chargement des classes…" /> : null}
                {error ? (
                    <PageError
                        message="Impossible de charger les classes."
                        onRetry={() => void mutateClasses()}
                    />
                ) : null}

                {!loading && !error && classes.length === 0 ? (
                    <PageEmpty
                        icon="book"
                        title={
                            selectedCycle !== "ALL"
                                ? `Aucune classe en ${CYCLE_LABELS[selectedCycle] || selectedCycle}`
                                : "Aucune classe enregistrée"
                        }
                        description="Créez vos classes pour inscrire des élèves, planifier l'emploi du temps et saisir des notes."
                        actions={[{ label: "Ajouter une classe", href: "/dashboard/classes/new" }]}
                    />
                ) : null}

                {!loading && !error && classes.length > 0 && viewMode === "grid" ? (
                    <div
                        className="edu-stagger"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {classes.map((cls) => (
                            <ClassCard
                                key={cls.id}
                                cls={cls}
                                onRequestDelete={(e) => requestDelete(e, cls.id, cls.name)}
                            />
                        ))}
                    </div>
                ) : null}

                {!loading && !error && classes.length > 0 && viewMode === "table" ? (
                    <DataTable
                        caption="Liste des classes"
                        data={classes}
                        getRowKey={(cls) => cls.id}
                        columns={[
                            {
                                id: "classe",
                                header: "Classe",
                                cell: (cls) => (
                                    <Link
                                        href={`/dashboard/classes/${cls.id}`}
                                        className="flex items-center gap-2.5 no-underline"
                                        style={{ color: "inherit" }}
                                    >
                                        <div
                                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                                            style={{
                                                background: "var(--brand-50)",
                                                color: "var(--brand-700)",
                                            }}
                                        >
                                            <Icon name="book" size={15} />
                                        </div>
                                        <span className="text-[13px] font-semibold">{cls.name}</span>
                                    </Link>
                                ),
                            },
                            {
                                id: "niveau",
                                header: "Niveau",
                                cell: (cls) => (
                                    <span
                                        className="text-xs"
                                        style={{ color: "var(--eduflow-text-secondary)" }}
                                    >
                                        {cls.classLevel?.name || "—"}
                                    </span>
                                ),
                            },
                            {
                                id: "cycle",
                                header: "Cycle",
                                cell: (cls) => {
                                    const cycleVariant =
                                        CYCLE_VARIANTS[cls.classLevel?.level || ""] || "neutral";
                                    return cls.classLevel?.level ? (
                                        <Badge variant={cycleVariant} size="sm">
                                            {CYCLE_LABELS[cls.classLevel.level] || cls.classLevel.level}
                                        </Badge>
                                    ) : (
                                        <span
                                            className="text-xs"
                                            style={{ color: "var(--eduflow-text-tertiary)" }}
                                        >
                                            —
                                        </span>
                                    );
                                },
                            },
                            {
                                id: "eleves",
                                header: "Élèves",
                                cell: (cls) => (
                                    <span className="eduflow-tabular text-[13px] font-semibold">
                                        {cls._count?.enrollments ?? 0}
                                    </span>
                                ),
                            },
                            {
                                id: "matieres",
                                header: "Matières",
                                cell: (cls) => (
                                    <span
                                        className="eduflow-tabular text-xs"
                                        style={{ color: "var(--eduflow-text-secondary)" }}
                                    >
                                        {cls._count?.classSubjects ?? 0}
                                    </span>
                                ),
                            },
                            {
                                id: "actions",
                                header: "Actions",
                                cell: (cls) => (
                                    <div className="flex items-center justify-end gap-1">
                                        <Link href={`/dashboard/classes/${cls.id}`} aria-label="Voir la classe">
                                            <Button variant="ghost" size="sm" icon="search">
                                                {""}
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon="x"
                                            onClick={(e) => requestDelete(e, cls.id, cls.name)}
                                        >
                                            {""}
                                        </Button>
                                    </div>
                                ),
                            },
                        ]}
                    />
                ) : null}
            </PageShell>

            <ConfirmActionDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setPendingDelete(null);
                }}
                title={
                    pendingDelete
                        ? `Supprimer la classe ${pendingDelete.name} ?`
                        : "Supprimer cette classe ?"
                }
                description="Cette action est définitive. Les inscriptions et emplois du temps liés peuvent être impactés."
                confirmLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
                variant="destructive"
                isConfirmLoading={isDeleting}
                onConfirm={confirmDelete}
            />
        </PageGuard>
    );
}

function ClassCard({
    cls,
    onRequestDelete,
}: {
    cls: ClassItem;
    onRequestDelete: (e: React.MouseEvent) => void;
}) {
    const cycleVariant = CYCLE_VARIANTS[cls.classLevel?.level || ""] || "neutral";
    const cycleLabel = cls.classLevel?.level
        ? CYCLE_LABELS[cls.classLevel.level] || cls.classLevel.level
        : null;
    return (
        <Link
            href={`/dashboard/classes/${cls.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
        >
            <Card
                padding={16}
                style={{
                    cursor: "pointer",
                    transition:
                        "transform var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                }}
                className="hover:-translate-y-0.5 hover:shadow-eduflow-card-brand"
            >
                <div className="flex items-start gap-3">
                    <div
                        className="grid place-items-center"
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: `var(--eduflow-${cycleVariant === "brand" ? "info" : cycleVariant}-50)`,
                            color: `var(--eduflow-${cycleVariant === "brand" ? "info" : cycleVariant}-700)`,
                            flexShrink: 0,
                        }}
                    >
                        <Icon name="book" size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div
                            className="eduflow-display truncate"
                            style={{
                                fontSize: 18,
                                fontWeight: 700,
                                color: "var(--eduflow-text-primary)",
                                letterSpacing: "-0.02em",
                                lineHeight: 1.15,
                            }}
                        >
                            {cls.name}
                        </div>
                        <div
                            className="truncate"
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-tertiary)",
                                marginTop: 2,
                            }}
                        >
                            {cls.classLevel?.name || "Niveau non défini"}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onRequestDelete}
                        aria-label="Supprimer la classe"
                        className="grid place-items-center"
                        style={{
                            width: 30,
                            height: 30,
                            border: 0,
                            background: "transparent",
                            borderRadius: 8,
                            color: "var(--eduflow-text-tertiary)",
                            cursor: "pointer",
                            transition:
                                "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--eduflow-danger-50)";
                            e.currentTarget.style.color = "var(--eduflow-danger-700)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "var(--eduflow-text-tertiary)";
                        }}
                    >
                        <Icon name="x" size={14} />
                    </button>
                </div>

                <div
                    className="mt-4 flex items-center justify-between border-t pt-3"
                    style={{ borderColor: "var(--eduflow-border-subtle)" }}
                >
                    <div className="flex items-center gap-2">
                        <Icon name="users" size={14} color="var(--eduflow-text-tertiary)" />
                        <span
                            className="eduflow-tabular"
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--eduflow-text-primary)",
                            }}
                        >
                            {cls._count?.enrollments ?? 0}
                            <span
                                style={{
                                    color: "var(--eduflow-text-tertiary)",
                                    fontWeight: 500,
                                    marginLeft: 4,
                                }}
                            >
                                élève{(cls._count?.enrollments ?? 0) > 1 ? "s" : ""}
                            </span>
                        </span>
                    </div>
                    {cycleLabel ? (
                        <Badge variant={cycleVariant} size="sm">
                            {cycleLabel}
                        </Badge>
                    ) : null}
                </div>
            </Card>
        </Link>
    );
}

function CyclePills({
    selected,
    onChange,
    counts,
}: {
    selected: string;
    onChange: (v: string) => void;
    counts: Record<string, number>;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {CYCLE_FILTERS.map((cycle) => {
                const active = selected === cycle.value;
                const count = counts[cycle.value] ?? 0;
                return (
                    <button
                        key={cycle.value}
                        type="button"
                        onClick={() => onChange(cycle.value)}
                        className="flex items-center gap-1.5 px-3 py-1.5"
                        style={{
                            background: active
                                ? "var(--brand-700)"
                                : "var(--eduflow-surface-card)",
                            color: active
                                ? "var(--eduflow-text-on-brand)"
                                : "var(--eduflow-text-secondary)",
                            border: active
                                ? "1px solid transparent"
                                : "1px solid var(--eduflow-border-default)",
                            borderRadius: "var(--eduflow-radius-full)",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: active ? 700 : 500,
                            cursor: "pointer",
                            transition:
                                "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                        }}
                    >
                        {cycle.label}
                        <span
                            className="eduflow-tabular"
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                opacity: active ? 0.85 : 0.6,
                            }}
                        >
                            ({count})
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function SegmentedToggle<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string; icon: IconName }[];
}) {
    return (
        <div
            className="flex gap-1 rounded-md p-1"
            style={{
                background: "var(--eduflow-surface-sunken)",
                border: "1px solid var(--eduflow-border-subtle)",
            }}
        >
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className="flex items-center gap-1.5 px-3 py-1.5"
                        style={{
                            background: active ? "var(--eduflow-surface-card)" : "transparent",
                            border: 0,
                            borderRadius: 6,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: active ? 700 : 500,
                            color: active
                                ? "var(--brand-700)"
                                : "var(--eduflow-text-secondary)",
                            boxShadow: active ? "var(--eduflow-shadow-sm)" : "none",
                            transition:
                                "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                        }}
                    >
                        <Icon name={opt.icon} size={13} />
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

function FieldSearch({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
}) {
    return (
        <label className="block flex-1 min-w-[200px] max-w-[320px]">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <div
                className="flex h-[38px] items-center gap-2 px-3"
                style={{
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                }}
            >
                <Icon name="search" size={14} color="var(--eduflow-text-tertiary)" />
                <input
                    type="search"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-label={label}
                    className="flex-1 bg-transparent outline-none"
                    style={{
                        border: 0,
                        fontFamily: "inherit",
                        fontSize: 13,
                        color: "var(--eduflow-text-primary)",
                    }}
                />
            </div>
        </label>
    );
}
