"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";

import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { Permission } from "@/lib/rbac/permissions";
import { t } from "@/lib/i18n";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    type IconName,
} from "@/components/edu";
import { DataTable } from "@/components/layout/data-table";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";

type Teacher = {
    id: string;
    specialization?: string;
    hireDate?: string;
    user?: {
        firstName: string;
        lastName: string;
        email: string;
        isActive: boolean;
    };
    classSubjects?: { subject?: { name: string } }[];
};

type TeachersResponse = {
    data?: Teacher[];
    teachers?: Teacher[];
};

export default function TeachersPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [selectedStatus, setSelectedStatus] = useState("ALL");
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(
        null
    );
    const [isDeleting, setIsDeleting] = useState(false);

    const queryParams = new URLSearchParams();
    if (debouncedSearch) queryParams.set("search", debouncedSearch);
    if (selectedStatus !== "ALL") queryParams.set("status", selectedStatus);

    const url = `/api/teachers?${queryParams.toString()}`;
    const {
        data: response,
        error,
        isLoading: loading,
        mutate: mutateTeachers,
    } = useSWR<TeachersResponse | Teacher[]>(url, fetcher);
    const { mutate } = useSWRConfig();
    const { toast } = useToast();

    const teachers: Teacher[] = Array.isArray(response)
        ? response
        : response?.data ?? response?.teachers ?? [];

    const activeFiltersCount = [
        selectedStatus !== "ALL",
        !!searchTerm.trim(),
    ].filter(Boolean).length;

    const resetFilters = () => {
        setSearchTerm("");
        setSelectedStatus("ALL");
    };

    const handleExportCSV = () => {
        if (!teachers.length) {
            toast({
                title: "Export impossible",
                description: "Aucune donnée à exporter.",
                variant: "destructive",
            });
            return;
        }
        const headers = ["Nom", "Prénom", "Email", "Statut", "Matières", "Date d'embauche"];
        const rows = teachers.map((t) => [
            t.user?.lastName || "",
            t.user?.firstName || "",
            t.user?.email || "",
            t.user?.isActive ? "Actif" : "Inactif",
            Array.from(
                new Set(t.classSubjects?.map((cs) => cs.subject?.name).filter(Boolean) ?? [])
            ).join(" - "),
            t.hireDate ? new Date(t.hireDate).toLocaleDateString("fr-FR") : "",
        ]);
        const csv =
            "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csv));
        link.setAttribute(
            "download",
            `enseignants_export_${new Date().toISOString().split("T")[0]}.csv`
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
            const res = await fetch(`/api/teachers/${pendingDelete.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Erreur de suppression");
            toast({ title: "Succès", description: "L'enseignant a été supprimé." });
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
            permission={Permission.TEACHER_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <PageShell className="pb-12">
                <PageHeader
                    title="Enseignants"
                    description={`${teachers.length} ${
                        teachers.length > 1 ? "enseignants" : "enseignant"
                    } dans l'équipe pédagogique`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Enseignants" },
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
                                <RoleActionGuard
                                    allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
                                >
                                    <Button variant="ghost" icon="download" onClick={handleExportCSV}>
                                        {t("common.exportCsv")}
                                    </Button>
                                    <Link href="/dashboard/teachers/new">
                                        <Button icon="plus">Ajouter un enseignant</Button>
                                    </Link>
                                </RoleActionGuard>
                            </>
                        }
                />

                {/* Filters */}
                <Card padding={14}>
                    <div
                        className="grid items-end gap-3"
                        style={{
                            gridTemplateColumns: "minmax(220px, 1fr) minmax(160px, 200px) auto",
                        }}
                    >
                        <FieldSearch
                            label="Rechercher"
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Nom, prénom, email…"
                        />
                        <FieldSelect
                            label="Statut"
                            value={selectedStatus}
                            onChange={setSelectedStatus}
                            options={[
                                { value: "ALL", label: "Tous les statuts" },
                                { value: "ACTIVE", label: "Actif" },
                                { value: "INACTIVE", label: "Inactif" },
                            ]}
                            placeholder="Tous les statuts"
                        />
                        {activeFiltersCount > 0 ? (
                            <Button variant="ghost" size="sm" icon="x" onClick={resetFilters}>
                                Réinitialiser ({activeFiltersCount})
                            </Button>
                        ) : (
                            <div />
                        )}
                    </div>
                </Card>

                {loading ? <PageLoading label="Chargement des enseignants…" /> : null}
                {error ? (
                    <PageError
                        message="Impossible de charger les enseignants."
                        onRetry={() => void mutateTeachers()}
                    />
                ) : null}

                {!loading && !error && teachers.length === 0 ? (
                    <PageEmpty
                        icon="users"
                        title="Aucun enseignant trouvé"
                        description={
                            activeFiltersCount > 0
                                ? "Aucun enseignant ne correspond aux filtres actuels."
                                : "Ajoutez des enseignants pour démarrer l'affectation des matières et la saisie des notes."
                        }
                        actions={
                            activeFiltersCount > 0
                                ? [{ label: "Réinitialiser les filtres", onClick: resetFilters }]
                                : [{ label: "Ajouter un enseignant", href: "/dashboard/teachers/new" }]
                        }
                    />
                ) : null}

                {!loading && !error && teachers.length > 0 && viewMode === "grid" ? (
                    <div
                        className="edu-stagger"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {teachers.map((teacher) => (
                            <TeacherCard
                                key={teacher.id}
                                teacher={teacher}
                                onRequestDelete={(e) => {
                                    const name = teacher.user
                                        ? `${teacher.user.firstName} ${teacher.user.lastName}`
                                        : "—";
                                    requestDelete(e, teacher.id, name);
                                }}
                            />
                        ))}
                    </div>
                ) : null}

                {!loading && !error && teachers.length > 0 && viewMode === "table" ? (
                    <DataTable
                        caption="Liste des enseignants"
                        data={teachers}
                        getRowKey={(teacher) => teacher.id}
                        columns={[
                            {
                                id: "enseignant",
                                header: "Enseignant",
                                cell: (teacher) => {
                                    const fullName = teacher.user
                                        ? `${teacher.user.firstName} ${teacher.user.lastName}`
                                        : "—";
                                    return (
                                        <div className="flex items-center gap-2.5">
                                            <Avatar name={fullName} size="sm" />
                                            <div className="min-w-0">
                                                <div className="text-[13px] font-semibold">{fullName}</div>
                                                {teacher.user?.email ? (
                                                    <div
                                                        className="truncate text-[11px]"
                                                        style={{ color: "var(--eduflow-text-tertiary)" }}
                                                    >
                                                        {teacher.user.email}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                },
                            },
                            {
                                id: "matieres",
                                header: "Matières",
                                cell: (teacher) => {
                                    const subjects = Array.from(
                                        new Set(
                                            teacher.classSubjects
                                                ?.map((cs) => cs.subject?.name)
                                                .filter(Boolean) ?? []
                                        )
                                    );
                                    return subjects.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {subjects.slice(0, 3).map((s) => (
                                                <Badge key={s} variant="brand" size="sm">
                                                    {s}
                                                </Badge>
                                            ))}
                                            {subjects.length > 3 ? (
                                                <Badge variant="neutral" size="sm">
                                                    +{subjects.length - 3}
                                                </Badge>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <span
                                            className="text-xs"
                                            style={{ color: "var(--eduflow-text-tertiary)" }}
                                        >
                                            Aucune affectation
                                        </span>
                                    );
                                },
                            },
                            {
                                id: "embauche",
                                header: "Embauche",
                                cell: (teacher) => (
                                    <span
                                        className="eduflow-tabular text-xs"
                                        style={{ color: "var(--eduflow-text-secondary)" }}
                                    >
                                        {teacher.hireDate
                                            ? new Date(teacher.hireDate).toLocaleDateString("fr-FR")
                                            : "—"}
                                    </span>
                                ),
                            },
                            {
                                id: "statut",
                                header: "Statut",
                                cell: (teacher) =>
                                    teacher.user?.isActive ? (
                                        <Badge variant="success" size="sm" dot>
                                            Actif
                                        </Badge>
                                    ) : (
                                        <Badge variant="neutral" size="sm">
                                            Inactif
                                        </Badge>
                                    ),
                            },
                            {
                                id: "actions",
                                header: "Actions",
                                cell: (teacher) => {
                                    const fullName = teacher.user
                                        ? `${teacher.user.firstName} ${teacher.user.lastName}`
                                        : "—";
                                    return (
                                        <RoleActionGuard
                                            allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon="x"
                                                onClick={(e) => requestDelete(e, teacher.id, fullName)}
                                            >
                                                {""}
                                            </Button>
                                        </RoleActionGuard>
                                    );
                                },
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
                        ? `Supprimer ${pendingDelete.name} ?`
                        : "Supprimer cet enseignant ?"
                }
                description="Cette action est définitive. Les affectations et historiques liés peuvent être affectés."
                confirmLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
                variant="destructive"
                isConfirmLoading={isDeleting}
                onConfirm={confirmDelete}
            />
        </PageGuard>
    );
}

function TeacherCard({
    teacher,
    onRequestDelete,
}: {
    teacher: Teacher;
    onRequestDelete: (e: React.MouseEvent) => void;
}) {
    const fullName = teacher.user
        ? `${teacher.user.firstName} ${teacher.user.lastName}`
        : "—";
    const isActive = teacher.user?.isActive ?? false;
    const subjects = Array.from(
        new Set(
            teacher.classSubjects?.map((cs) => cs.subject?.name).filter(Boolean) ?? []
        )
    );

    return (
        <Card
            padding={16}
            style={{
                cursor: "default",
                transition:
                    "transform var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out)",
            }}
            className="hover:-translate-y-0.5 hover:shadow-eduflow-card-brand"
        >
            <div className="flex items-start gap-3">
                <Avatar
                    name={fullName}
                    size="md"
                    status={isActive ? "online" : undefined}
                />
                <div className="min-w-0 flex-1">
                    <div
                        className="truncate"
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--eduflow-text-primary)",
                            lineHeight: 1.2,
                        }}
                    >
                        {fullName}
                    </div>
                    {teacher.user?.email ? (
                        <div
                            className="truncate"
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-tertiary)",
                                marginTop: 2,
                            }}
                        >
                            {teacher.user.email}
                        </div>
                    ) : null}
                    {teacher.specialization ? (
                        <div
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-secondary)",
                                marginTop: 4,
                                fontStyle: "italic",
                            }}
                        >
                            {teacher.specialization}
                        </div>
                    ) : null}
                </div>
                <RoleActionGuard
                    allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
                >
                    <button
                        type="button"
                        onClick={onRequestDelete}
                        aria-label="Supprimer l'enseignant"
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
                </RoleActionGuard>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                {subjects.slice(0, 3).map((s) => (
                    <Badge key={s} variant="brand" size="sm" icon="book">
                        {s}
                    </Badge>
                ))}
                {subjects.length > 3 ? (
                    <Badge variant="neutral" size="sm">
                        +{subjects.length - 3}
                    </Badge>
                ) : null}
                {subjects.length === 0 ? (
                    <Badge variant="neutral" size="sm">
                        Aucune affectation
                    </Badge>
                ) : null}
                {isActive ? (
                    <Badge variant="success" size="sm" dot>
                        Actif
                    </Badge>
                ) : (
                    <Badge variant="neutral" size="sm">
                        Inactif
                    </Badge>
                )}
            </div>
        </Card>
    );
}

// ─── Shared sub-components (reused across teachers/parents/users) ──────────

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

function FieldSelect({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
}) {
    return (
        <label className="block">
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
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: value && value !== "ALL" ? 600 : 500,
                    color:
                        value && value !== "ALL"
                            ? "var(--eduflow-text-primary)"
                            : "var(--eduflow-text-secondary)",
                    cursor: "pointer",
                    outline: "none",
                }}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
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
        <label className="block">
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
