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
import { PageHeader } from "@/components/edu-homes/_shared";

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
            <div className="eduflow-scope flex flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        greeting="Classes"
                        sub={`${allClasses.length} ${
                            allClasses.length > 1 ? "classes" : "classe"
                        } · ${totalEnrollments} élèves inscrits au total`}
                        breadcrumb={["Tableau de bord", "Classes"]}
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
                </div>

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

                {error ? <ErrorCard label="Impossible de charger les classes." /> : null}

                {loading ? <SkeletonGrid /> : null}

                {!loading && !error && classes.length === 0 ? (
                    <EmptyState
                        title={
                            selectedCycle !== "ALL"
                                ? `Aucune classe en ${CYCLE_LABELS[selectedCycle] || selectedCycle}`
                                : "Aucune classe enregistrée"
                        }
                        body="Crée tes classes pour pouvoir inscrire des élèves, planifier l'emploi du temps et saisir des notes."
                        primaryCta={
                            <Link href="/dashboard/classes/new">
                                <Button icon="plus">Ajouter une classe</Button>
                            </Link>
                        }
                    />
                ) : null}

                {!loading && !error && classes.length > 0 && viewMode === "grid" ? (
                    <div
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
                    <Card padding={0}>
                        <div className="overflow-x-auto">
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr
                                        style={{
                                            background: "var(--eduflow-surface-sunken)",
                                            textAlign: "left",
                                        }}
                                    >
                                        <Th>Classe</Th>
                                        <Th>Niveau</Th>
                                        <Th width={130}>Cycle</Th>
                                        <Th width={110} center>
                                            Élèves
                                        </Th>
                                        <Th width={110} center>
                                            Matières
                                        </Th>
                                        <Th width={100} center>
                                            Actions
                                        </Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {classes.map((cls) => {
                                        const cycleVariant =
                                            CYCLE_VARIANTS[cls.classLevel?.level || ""] || "neutral";
                                        return (
                                            <tr
                                                key={cls.id}
                                                style={{
                                                    borderTop:
                                                        "1px solid var(--eduflow-border-subtle)",
                                                }}
                                            >
                                                <Td>
                                                    <Link
                                                        href={`/dashboard/classes/${cls.id}`}
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 10,
                                                            textDecoration: "none",
                                                            color: "inherit",
                                                        }}
                                                    >
                                                        <div
                                                            className="grid place-items-center"
                                                            style={{
                                                                width: 32,
                                                                height: 32,
                                                                borderRadius: 8,
                                                                background: "var(--brand-50)",
                                                                color: "var(--brand-700)",
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            <Icon name="book" size={15} />
                                                        </div>
                                                        <span
                                                            style={{
                                                                fontSize: 13,
                                                                fontWeight: 600,
                                                                color: "var(--eduflow-text-primary)",
                                                            }}
                                                        >
                                                            {cls.name}
                                                        </span>
                                                    </Link>
                                                </Td>
                                                <Td>
                                                    <span
                                                        style={{
                                                            fontSize: 12,
                                                            color: "var(--eduflow-text-secondary)",
                                                        }}
                                                    >
                                                        {cls.classLevel?.name || "—"}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    {cls.classLevel?.level ? (
                                                        <Badge variant={cycleVariant} size="sm">
                                                            {CYCLE_LABELS[cls.classLevel.level] ||
                                                                cls.classLevel.level}
                                                        </Badge>
                                                    ) : (
                                                        <span
                                                            style={{
                                                                fontSize: 12,
                                                                color:
                                                                    "var(--eduflow-text-tertiary)",
                                                            }}
                                                        >
                                                            —
                                                        </span>
                                                    )}
                                                </Td>
                                                <Td center>
                                                    <span
                                                        className="eduflow-tabular"
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            color: "var(--eduflow-text-primary)",
                                                        }}
                                                    >
                                                        {cls._count?.enrollments ?? 0}
                                                    </span>
                                                </Td>
                                                <Td center>
                                                    <span
                                                        className="eduflow-tabular"
                                                        style={{
                                                            fontSize: 12,
                                                            color: "var(--eduflow-text-secondary)",
                                                        }}
                                                    >
                                                        {cls._count?.classSubjects ?? 0}
                                                    </span>
                                                </Td>
                                                <Td center>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Link
                                                            href={`/dashboard/classes/${cls.id}`}
                                                            aria-label="Voir la classe"
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                icon="search"
                                                            >
                                                                {""}
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            icon="x"
                                                            onClick={(e) =>
                                                                requestDelete(e, cls.id, cls.name)
                                                            }
                                                        >
                                                            {""}
                                                        </Button>
                                                    </div>
                                                </Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                ) : null}
            </div>

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

function ErrorCard({ label }: { label: string }) {
    return (
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
                    {label}
                </p>
            </div>
        </Card>
    );
}

function EmptyState({
    title,
    body,
    primaryCta,
}: {
    title: string;
    body: string;
    primaryCta?: React.ReactNode;
}) {
    return (
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
                    <Icon name="book" size={26} color="var(--brand-700)" />
                </div>
                <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                    {title}
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
                    {body}
                </p>
                {primaryCta ? <div className="mt-2">{primaryCta}</div> : null}
            </div>
        </Card>
    );
}

function SkeletonGrid() {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
            }}
        >
            {Array.from({ length: 8 }).map((_, idx) => (
                <Card key={idx} padding={16}>
                    <div className="flex items-start gap-3">
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: "var(--eduflow-surface-sunken)",
                            }}
                        />
                        <div className="flex-1 space-y-2">
                            <div
                                style={{
                                    height: 18,
                                    width: "60%",
                                    background: "var(--eduflow-surface-sunken)",
                                    borderRadius: 4,
                                }}
                            />
                            <div
                                style={{
                                    height: 10,
                                    width: "40%",
                                    background: "var(--eduflow-surface-sunken)",
                                    borderRadius: 4,
                                }}
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-between">
                        <div
                            style={{
                                height: 14,
                                width: 80,
                                background: "var(--eduflow-surface-sunken)",
                                borderRadius: 4,
                            }}
                        />
                        <div
                            style={{
                                height: 18,
                                width: 70,
                                background: "var(--eduflow-surface-sunken)",
                                borderRadius: 9,
                            }}
                        />
                    </div>
                </Card>
            ))}
        </div>
    );
}

function Th({
    children,
    width,
    center,
}: {
    children: React.ReactNode;
    width?: number;
    center?: boolean;
}) {
    return (
        <th
            style={{
                padding: "10px 16px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--eduflow-text-tertiary)",
                textAlign: center ? "center" : "left",
                width,
            }}
        >
            {children}
        </th>
    );
}

function Td({
    children,
    style,
    center,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    center?: boolean;
}) {
    return (
        <td
            style={{
                padding: "12px 16px",
                fontSize: 13,
                textAlign: center ? "center" : "left",
                ...style,
            }}
        >
            {children}
        </td>
    );
}
