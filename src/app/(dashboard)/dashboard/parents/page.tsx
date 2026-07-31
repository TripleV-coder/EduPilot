"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

type ParentUser = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: string;
    isActive: boolean;
    createdAt: string;
};

type ParentsResponse = {
    data?: ParentUser[];
    users?: ParentUser[];
    pagination?: { total?: number; totalPages?: number };
};

const PAGE_SIZE = 30;

export default function ParentsPage() {
    const { mutate } = useSWRConfig();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{
        id: string;
        name: string;
        email: string;
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const searchParams = new URLSearchParams();
    searchParams.set("role", "PARENT");
    searchParams.set("limit", String(PAGE_SIZE));
    searchParams.set("page", String(currentPage));
    if (debouncedSearch) searchParams.set("search", debouncedSearch);
    const url = `/api/users?${searchParams.toString()}`;

    const {
        data: response,
        error,
        isLoading: loading,
        mutate: mutateParents,
    } = useSWR<ParentsResponse | ParentUser[]>(url, fetcher);

    const parents: ParentUser[] = Array.isArray(response)
        ? response
        : response?.data ?? response?.users ?? [];
    const pagination = !Array.isArray(response) ? response?.pagination : undefined;
    const totalParents = pagination?.total ?? parents.length;
    const totalPages = pagination?.totalPages ?? 1;

    const requestDelete = (
        e: React.MouseEvent,
        id: string,
        name: string,
        email: string
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteTarget({ id, name, email });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/users/${deleteTarget.id}/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    confirmEmail: deleteTarget.email,
                    deleteType: "SOFT",
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || "Erreur de suppression");
            toast({
                title: "Succès",
                description: data?.message || "Le compte parent a été anonymisé.",
            });
            mutate(url);
        } catch (err) {
            toast({
                title: "Erreur",
                description: err instanceof Error ? err.message : "Erreur inconnue",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
        }
    };

    const handleExportCSV = () => {
        if (!parents.length) {
            toast({
                title: "Export impossible",
                description: "Aucune donnée à exporter.",
                variant: "destructive",
            });
            return;
        }
        const headers = ["Nom", "Prénom", "Email", "Téléphone", "Statut", "Inscrit le"];
        const rows = parents.map((p) => [
            p.lastName,
            p.firstName,
            p.email,
            p.phone || "N/A",
            p.isActive ? "Actif" : "Inactif",
            format(new Date(p.createdAt), "dd/MM/yyyy", { locale: fr }),
        ]);
        const csv = [headers, ...rows]
            .map((r) => r.map((c) => `"${c}"`).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const dlUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", dlUrl);
        link.setAttribute(
            "download",
            `parents_export_${new Date().toISOString().split("T")[0]}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(dlUrl);
    };

    return (
        <PageGuard
            permission={[Permission.USER_READ]}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <PageShell className="pb-12">
                <PageHeader
                    title="Parents"
                    description={`${totalParents} ${
                        totalParents > 1 ? "comptes parents" : "compte parent"
                    } enregistrés dans l'établissement`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Parents" },
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
                                    <Link href="/dashboard/parents/new">
                                        <Button icon="plus">Ajouter un parent</Button>
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
                            gridTemplateColumns: "minmax(220px, 1fr) auto",
                        }}
                    >
                        <FieldSearch
                            label="Rechercher"
                            value={searchTerm}
                            onChange={(v) => {
                                setSearchTerm(v);
                                setCurrentPage(1);
                            }}
                            placeholder="Nom, prénom, email…"
                        />
                        {searchTerm ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                icon="x"
                                onClick={() => {
                                    setSearchTerm("");
                                    setCurrentPage(1);
                                }}
                            >
                                Effacer
                            </Button>
                        ) : (
                            <div />
                        )}
                    </div>
                </Card>

                {loading ? <PageLoading label="Chargement des parents…" /> : null}
                {error ? (
                    <PageError
                        message="Impossible de charger les parents."
                        onRetry={() => void mutateParents()}
                    />
                ) : null}

                {!loading && !error && parents.length === 0 ? (
                    <PageEmpty
                        icon="users"
                        title="Aucun parent enregistré"
                        description={
                            searchTerm
                                ? "Aucun parent ne correspond à la recherche."
                                : "Les comptes parents permettent de suivre la scolarité de leurs enfants. Ajoutez-les manuellement ou par import."
                        }
                        actions={
                            searchTerm
                                ? [
                                      {
                                          label: "Effacer la recherche",
                                          onClick: () => {
                                              setSearchTerm("");
                                              setCurrentPage(1);
                                          },
                                      },
                                  ]
                                : [{ label: "Ajouter un parent", href: "/dashboard/parents/new" }]
                        }
                    />
                ) : null}

                {!loading && !error && parents.length > 0 && viewMode === "grid" ? (
                    <div
                        className="edu-stagger"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {parents.map((parent) => (
                            <ParentCard
                                key={parent.id}
                                parent={parent}
                                onRequestDelete={(e) => {
                                    requestDelete(
                                        e,
                                        parent.id,
                                        `${parent.firstName} ${parent.lastName}`,
                                        parent.email
                                    );
                                }}
                            />
                        ))}
                    </div>
                ) : null}

                {!loading && !error && parents.length > 0 && viewMode === "table" ? (
                    <DataTable
                        caption="Liste des parents"
                        data={parents}
                        getRowKey={(parent) => parent.id}
                        page={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        columns={[
                            {
                                id: "parent",
                                header: "Parent",
                                cell: (parent) => {
                                    const fullName = `${parent.firstName} ${parent.lastName}`;
                                    return (
                                        <div className="flex items-center gap-2.5">
                                            <Avatar name={fullName} size="sm" />
                                            <div className="min-w-0">
                                                <div className="text-[13px] font-semibold">
                                                    {fullName}
                                                </div>
                                                <div
                                                    className="truncate text-[11px]"
                                                    style={{ color: "var(--eduflow-text-tertiary)" }}
                                                >
                                                    {parent.email}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                },
                            },
                            {
                                id: "phone",
                                header: "Téléphone",
                                cell: (parent) => (
                                    <span
                                        className="eduflow-mono text-xs"
                                        style={{ color: "var(--eduflow-text-secondary)" }}
                                    >
                                        {parent.phone || "—"}
                                    </span>
                                ),
                            },
                            {
                                id: "created",
                                header: "Inscrit le",
                                cell: (parent) => (
                                    <span
                                        className="eduflow-tabular text-xs"
                                        style={{ color: "var(--eduflow-text-secondary)" }}
                                    >
                                        {format(new Date(parent.createdAt), "dd MMM yyyy", {
                                            locale: fr,
                                        })}
                                    </span>
                                ),
                            },
                            {
                                id: "status",
                                header: "Statut",
                                cell: (parent) =>
                                    parent.isActive ? (
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
                                cell: (parent) => {
                                    const fullName = `${parent.firstName} ${parent.lastName}`;
                                    return (
                                        <RoleActionGuard
                                            allowedRoles={[
                                                "SUPER_ADMIN",
                                                "SCHOOL_ADMIN",
                                                "DIRECTOR",
                                            ]}
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon="x"
                                                onClick={(e) =>
                                                    requestDelete(
                                                        e,
                                                        parent.id,
                                                        fullName,
                                                        parent.email
                                                    )
                                                }
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

                {!loading && !error && totalParents > 0 && viewMode === "grid" ? (
                    <div
                        className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                margin: 0,
                            }}
                        >
                            <span className="eduflow-tabular">{totalParents}</span> parent
                            {totalParents > 1 ? "s" : ""} — Page{" "}
                            <span className="eduflow-tabular">{currentPage}</span> sur{" "}
                            <span className="eduflow-tabular">{totalPages}</span>
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                Précédent
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                iconRight="chevron"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => p + 1)}
                            >
                                Suivant
                            </Button>
                        </div>
                    </div>
                ) : null}
            </PageShell>

            <ConfirmActionDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setDeleteTarget(null);
                }}
                title={
                    deleteTarget
                        ? `Supprimer ${deleteTarget.name} ?`
                        : "Supprimer ce parent ?"
                }
                description="Le compte sera anonymisé (soft delete). L'historique reste préservé."
                confirmLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
                variant="destructive"
                isConfirmLoading={isDeleting}
                onConfirm={confirmDelete}
            />
        </PageGuard>
    );
}

function ParentCard({
    parent,
    onRequestDelete,
}: {
    parent: ParentUser;
    onRequestDelete: (e: React.MouseEvent) => void;
}) {
    const fullName = `${parent.firstName} ${parent.lastName}`;
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
                    status={parent.isActive ? "online" : undefined}
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
                    <div
                        className="truncate"
                        style={{
                            fontSize: 11,
                            color: "var(--eduflow-text-tertiary)",
                            marginTop: 2,
                        }}
                    >
                        {parent.email}
                    </div>
                    {parent.phone ? (
                        <div
                            className="eduflow-mono"
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-secondary)",
                                marginTop: 4,
                            }}
                        >
                            {parent.phone}
                        </div>
                    ) : null}
                </div>
                <RoleActionGuard
                    allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
                >
                    <button
                        type="button"
                        onClick={onRequestDelete}
                        aria-label="Supprimer le parent"
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
                {parent.isActive ? (
                    <Badge variant="success" size="sm" dot>
                        Actif
                    </Badge>
                ) : (
                    <Badge variant="neutral" size="sm">
                        Inactif
                    </Badge>
                )}
                <Badge variant="neutral" size="sm" icon="calendar">
                    {format(new Date(parent.createdAt), "dd MMM yyyy", { locale: fr })}
                </Badge>
            </div>
        </Card>
    );
}

// ─── Shared sub-components (locally inlined for brevity) ───────────────────

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

