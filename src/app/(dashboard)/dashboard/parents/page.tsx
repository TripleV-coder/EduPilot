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
import { PageHeader } from "@/components/edu-homes/_shared";

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
            <div className="eduflow-scope flex flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        greeting="Parents"
                        sub={`${totalParents} ${
                            totalParents > 1 ? "comptes parents" : "compte parent"
                        } enregistrés dans l'établissement`}
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
                </div>

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

                {error ? <ErrorCard label="Impossible de charger les parents." /> : null}

                {loading ? <SkeletonGrid /> : null}

                {!loading && !error && parents.length === 0 ? (
                    <EmptyState
                        title="Aucun parent enregistré"
                        body={
                            searchTerm
                                ? "Aucun parent ne correspond à la recherche."
                                : "Les comptes parents permettent de suivre la scolarité de leurs enfants. Ajoute-les manuellement ou via import."
                        }
                        primaryCta={
                            searchTerm ? (
                                <Button
                                    variant="secondary"
                                    icon="x"
                                    onClick={() => {
                                        setSearchTerm("");
                                        setCurrentPage(1);
                                    }}
                                >
                                    Effacer la recherche
                                </Button>
                            ) : (
                                <RoleActionGuard
                                    allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
                                >
                                    <Link href="/dashboard/parents/new">
                                        <Button icon="plus">Ajouter un parent</Button>
                                    </Link>
                                </RoleActionGuard>
                            )
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
                                        <Th>Parent</Th>
                                        <Th width={160}>Téléphone</Th>
                                        <Th width={140}>Inscrit le</Th>
                                        <Th width={120}>Statut</Th>
                                        <Th width={80} center>
                                            Actions
                                        </Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parents.map((parent) => {
                                        const fullName = `${parent.firstName} ${parent.lastName}`;
                                        return (
                                            <tr
                                                key={parent.id}
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
                                                                {parent.email}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Td>
                                                <Td>
                                                    <span
                                                        className="eduflow-mono"
                                                        style={{
                                                            fontSize: 12,
                                                            color: "var(--eduflow-text-secondary)",
                                                        }}
                                                    >
                                                        {parent.phone || "—"}
                                                    </span>
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
                                                            new Date(parent.createdAt),
                                                            "dd MMM yyyy",
                                                            { locale: fr }
                                                        )}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    {parent.isActive ? (
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
                                                </Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                ) : null}

                {!loading && !error && totalParents > 0 ? (
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
            </div>

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
