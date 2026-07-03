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
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { Permission } from "@/lib/rbac/permissions";
import { formatUserRoleLabel } from "@/lib/utils/role-label";
import { t } from "@/lib/i18n";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    type IconName,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";

type User = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    schoolId: string | null;
    school?: { name: string } | null;
};

type UsersResponse = {
    data?: User[];
    users?: User[];
};

const roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super administrateur",
    SCHOOL_ADMIN: "Administrateur établissement",
    DIRECTOR: "Directeur",
    SECRETAIRE: "Secrétaire",
    ACCOUNTANT: "Comptable",
    TEACHER: "Enseignant",
    STUDENT: "Élève",
    PARENT: "Parent",
};

const ROLE_VARIANTS: Record<string, "brand" | "info" | "success" | "warning" | "neutral"> = {
    SUPER_ADMIN: "warning",
    SCHOOL_ADMIN: "warning",
    DIRECTOR: "brand",
    ACCOUNTANT: "info",
    TEACHER: "success",
    STUDENT: "neutral",
    PARENT: "neutral",
    SECRETAIRE: "info",
};

export default function UsersPage() {
    const { mutate } = useSWRConfig();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [viewMode, setViewMode] = useState<"grid" | "table">("table");
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{
        id: string;
        name: string;
        email: string;
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const searchParams = new URLSearchParams();
    if (debouncedSearch) searchParams.set("search", debouncedSearch);
    if (roleFilter !== "ALL") searchParams.set("role", roleFilter);
    const queryString = searchParams.toString();
    const url = `/api/users${queryString ? `?${queryString}` : ""}`;

    const {
        data: response,
        error,
        isLoading: loading,
        mutate: mutateUsers,
    } = useSWR<UsersResponse | User[]>(url, fetcher);

    const users: User[] = Array.isArray(response)
        ? response
        : response?.data ?? response?.users ?? [];

    const activeFiltersCount = [
        roleFilter !== "ALL",
        !!searchTerm.trim(),
    ].filter(Boolean).length;

    const resetFilters = () => {
        setSearchTerm("");
        setRoleFilter("ALL");
    };

    const requestDelete = (
        e: React.MouseEvent,
        id: string,
        name: string,
        email: string
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setPendingDelete({ id, name, email });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/users/${pendingDelete.id}/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    confirmEmail: pendingDelete.email,
                    deleteType: "SOFT",
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || "Erreur de suppression");
            toast({
                title: "Succès",
                description: data?.message || "Le compte a été anonymisé.",
            });
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

    const handleExportCSV = () => {
        if (!users.length) {
            toast({
                title: "Export impossible",
                description: "Aucune donnée à exporter.",
                variant: "destructive",
            });
            return;
        }
        const headers = [
            "Nom",
            "Prénom",
            "Email",
            "Rôle",
            "École",
            "Statut",
            "Inscrit le",
        ];
        const rows = users.map((u) => [
            u.lastName,
            u.firstName,
            u.email,
            roleLabels[u.role] || formatUserRoleLabel(u.role),
            u.school?.name || "Global",
            u.isActive ? "Actif" : "Inactif",
            format(new Date(u.createdAt), "dd/MM/yyyy", { locale: fr }),
        ]);
        const csv = [headers, ...rows]
            .map((r) => r.map((c) => `"${c}"`).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = `utilisateurs_${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(dlUrl);
    };

    const roleOptions = [
        { value: "ALL", label: "Tous les rôles" },
        ...Object.entries(roleLabels).map(([value, label]) => ({ value, label })),
    ];

    return (
        <PageGuard
            permission={Permission.USER_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN"]}
        >
            <PageShell className="pb-12">
                <PageHeader
                    title="Utilisateurs et comptes"
                    description={`${users.length} ${
                        users.length > 1 ? "comptes actifs" : "compte actif"
                    } dans le système`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Utilisateurs" },
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
                                <Link href="/dashboard/users/new">
                                    <Button icon="plus">Ajouter un compte</Button>
                                </Link>
                            </>
                        }
                />

                {/* Filters */}
                <Card padding={14}>
                    <div
                        className="grid items-end gap-3"
                        style={{
                            gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 220px) auto",
                        }}
                    >
                        <FieldSearch
                            label="Rechercher"
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Nom, prénom, email…"
                        />
                        <FieldSelect
                            label="Rôle"
                            value={roleFilter}
                            onChange={setRoleFilter}
                            options={roleOptions}
                            placeholder="Tous les rôles"
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

                {loading ? <PageLoading label="Chargement des utilisateurs…" /> : null}
                {error ? (
                    <PageError
                        message="Impossible de charger les utilisateurs."
                        onRetry={() => void mutateUsers()}
                    />
                ) : null}

                {!loading && !error && users.length === 0 ? (
                    <PageEmpty
                        icon="users"
                        title="Aucun utilisateur trouvé"
                        description={
                            activeFiltersCount > 0
                                ? "Aucun compte ne correspond aux filtres actuels."
                                : "Le premier compte sera créé lors de l'inscription d'un membre du personnel ou d'un élève."
                        }
                        actions={
                            activeFiltersCount > 0
                                ? [{ label: "Réinitialiser les filtres", onClick: resetFilters }]
                                : [{ label: "Ajouter un compte", href: "/dashboard/users/new" }]
                        }
                    />
                ) : null}

                {!loading && !error && users.length > 0 && viewMode === "grid" ? (
                    <div
                        className="edu-stagger"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {users.map((user) => (
                            <UserCard
                                key={user.id}
                                user={user}
                                onRequestDelete={(e) => {
                                    requestDelete(
                                        e,
                                        user.id,
                                        `${user.firstName} ${user.lastName}`,
                                        user.email
                                    );
                                }}
                            />
                        ))}
                    </div>
                ) : null}

                {!loading && !error && users.length > 0 && viewMode === "table" ? (
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
                                        <Th>Utilisateur</Th>
                                        <Th width={180}>Rôle</Th>
                                        <Th>École</Th>
                                        <Th width={120}>Inscrit</Th>
                                        <Th width={100}>Statut</Th>
                                        <Th width={80} center>
                                            Actions
                                        </Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => {
                                        const fullName = `${user.firstName} ${user.lastName}`;
                                        const roleLabel =
                                            roleLabels[user.role] || formatUserRoleLabel(user.role);
                                        const roleVariant =
                                            ROLE_VARIANTS[user.role] || "neutral";
                                        return (
                                            <tr
                                                key={user.id}
                                                style={{
                                                    borderTop:
                                                        "1px solid var(--eduflow-border-subtle)",
                                                }}
                                            >
                                                <Td>
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar name={fullName} size="sm" />
                                                        <div className="min-w-0">
                                                            <div
                                                                style={{
                                                                    fontSize: 13,
                                                                    fontWeight: 600,
                                                                    color:
                                                                        "var(--eduflow-text-primary)",
                                                                }}
                                                            >
                                                                {fullName}
                                                            </div>
                                                            <div
                                                                className="truncate"
                                                                style={{
                                                                    fontSize: 11,
                                                                    color:
                                                                        "var(--eduflow-text-tertiary)",
                                                                }}
                                                            >
                                                                {user.email}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Td>
                                                <Td>
                                                    <Badge variant={roleVariant} size="sm">
                                                        {roleLabel}
                                                    </Badge>
                                                </Td>
                                                <Td>
                                                    {user.school?.name ? (
                                                        <span style={{ fontSize: 12 }}>
                                                            {user.school.name}
                                                        </span>
                                                    ) : (
                                                        <Badge variant="neutral" size="sm">
                                                            Global
                                                        </Badge>
                                                    )}
                                                </Td>
                                                <Td>
                                                    <span
                                                        className="eduflow-tabular"
                                                        style={{
                                                            fontSize: 12,
                                                            color: "var(--eduflow-text-secondary)",
                                                        }}
                                                    >
                                                        {format(
                                                            new Date(user.createdAt),
                                                            "dd MMM yyyy",
                                                            { locale: fr }
                                                        )}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    {user.isActive ? (
                                                        <Badge variant="success" size="sm" dot>
                                                            Actif
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="neutral" size="sm">
                                                            Inactif
                                                        </Badge>
                                                    )}
                                                </Td>
                                                <Td center>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon="x"
                                                        onClick={(e) =>
                                                            requestDelete(
                                                                e,
                                                                user.id,
                                                                fullName,
                                                                user.email
                                                            )
                                                        }
                                                    >
                                                        {""}
                                                    </Button>
                                                </Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
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
                        : "Supprimer ce compte ?"
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

function UserCard({
    user,
    onRequestDelete,
}: {
    user: User;
    onRequestDelete: (e: React.MouseEvent) => void;
}) {
    const fullName = `${user.firstName} ${user.lastName}`;
    const roleLabel = roleLabels[user.role] || formatUserRoleLabel(user.role);
    const roleVariant = ROLE_VARIANTS[user.role] || "neutral";
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
                    status={user.isActive ? "online" : undefined}
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
                        {user.email}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onRequestDelete}
                    aria-label="Supprimer le compte"
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={roleVariant} size="sm">
                    {roleLabel}
                </Badge>
                {user.school?.name ? (
                    <Badge variant="neutral" size="sm" icon="school">
                        {user.school.name}
                    </Badge>
                ) : (
                    <Badge variant="neutral" size="sm">
                        Global
                    </Badge>
                )}
                {user.isActive ? (
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

// ─── Shared sub-components ─────────────────────────────────────────────────

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
                    <Icon name="users" size={26} color="var(--brand-700)" />
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
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 14,
            }}
        >
            {Array.from({ length: 6 }).map((_, idx) => (
                <Card key={idx} padding={16}>
                    <div className="flex items-start gap-3">
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                background: "var(--eduflow-surface-sunken)",
                            }}
                        />
                        <div className="flex-1 space-y-2">
                            <div
                                style={{
                                    height: 14,
                                    width: "70%",
                                    background: "var(--eduflow-surface-sunken)",
                                    borderRadius: 4,
                                }}
                            />
                            <div
                                style={{
                                    height: 10,
                                    width: "50%",
                                    background: "var(--eduflow-surface-sunken)",
                                    borderRadius: 4,
                                }}
                            />
                        </div>
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
