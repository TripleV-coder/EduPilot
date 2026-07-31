"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";

import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { PageGuard } from "@/components/guard/page-guard";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { Permission } from "@/lib/rbac/permissions";
import { t } from "@/lib/i18n";
import { formatDateShort } from "@/lib/utils/formatters";

import { Badge, Button, Card, Icon } from "@/components/edu";
import { DataTable } from "@/components/layout/data-table";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";

type HomeworkItem = {
    id: string;
    title: string;
    description: string;
    dueDate: string;
    maxGrade?: number;
    coefficient?: number;
    isPublished: boolean;
    classSubject?: {
        subject?: { name: string };
        class?: { name: string };
    };
    _count?: { submissions: number };
    createdBy?: { firstName: string; lastName: string };
};

type HomeworkResponse = { homeworks?: HomeworkItem[] };

export default function HomeworkPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(
        null
    );
    const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

    const {
        data: response,
        error,
        isLoading,
        mutate: mutateHomework,
    } = useSWR<HomeworkResponse | HomeworkItem[]>("/api/homework?limit=100", fetcher);
    const { mutate } = useSWRConfig();
    const { toast } = useToast();

    const allHomeworks: HomeworkItem[] = Array.isArray(response)
        ? response
        : response?.homeworks ?? [];

    const homeworks = allHomeworks.filter((hw) => {
        if (selectedStatus === "PUBLISHED" && !hw.isPublished) return false;
        if (selectedStatus === "DRAFT" && hw.isPublished) return false;
        if (debouncedSearch) {
            const s = debouncedSearch.toLowerCase();
            if (
                !hw.title.toLowerCase().includes(s) &&
                !(hw.classSubject?.subject?.name || "").toLowerCase().includes(s) &&
                !(hw.classSubject?.class?.name || "").toLowerCase().includes(s)
            )
                return false;
        }
        return true;
    });

    const now = Date.now();
    const overdue = homeworks.filter(
        (h) => h.isPublished && new Date(h.dueDate).getTime() < now
    ).length;
    const upcoming = homeworks.filter(
        (h) =>
            h.isPublished &&
            new Date(h.dueDate).getTime() >= now &&
            new Date(h.dueDate).getTime() - now < 7 * 24 * 60 * 60 * 1000
    ).length;

    const activeFiltersCount = [
        selectedStatus !== "ALL",
        !!searchTerm.trim(),
    ].filter(Boolean).length;

    const resetFilters = () => {
        setSearchTerm("");
        setSelectedStatus("ALL");
    };

    const handleDelete = (id: string, title: string) => {
        setDeleteTarget({ id, title });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleteConfirmLoading(true);
        try {
            const res = await fetch(`/api/homework/${deleteTarget.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Erreur lors de la suppression");
            toast({ title: "Succès", description: "Le devoir a été supprimé." });
            mutate("/api/homework?limit=100");
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
        } catch (err) {
            toast({
                title: "Erreur",
                description: err instanceof Error ? err.message : "Erreur inconnue",
                variant: "destructive",
            });
        } finally {
            setIsDeleteConfirmLoading(false);
        }
    };

    return (
        <PageGuard
            permission={Permission.EVALUATION_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <PageShell className="pb-12">
                <PageHeader
                    title="Devoirs"
                    description={`${homeworks.length} devoirs · ${upcoming} cette semaine · ${overdue} en retard`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Devoirs" },
                    ]}
                    actions={
                        <>
                            <Button variant="ghost" icon="download">
                                {t("common.export")}
                            </Button>
                            <Link href="/dashboard/homework/new">
                                <Button icon="plus">Nouveau devoir</Button>
                            </Link>
                        </>
                    }
                />

                <Card padding={14}>
                    <div className="flex flex-wrap items-center gap-3">
                        <label
                            className="flex h-[38px] flex-1 items-center gap-2 px-3"
                            style={{
                                minWidth: 220,
                                maxWidth: 320,
                                borderRadius: "var(--eduflow-radius-input)",
                                border: "1px solid var(--eduflow-border-default)",
                                background: "var(--eduflow-surface-card)",
                            }}
                        >
                            <Icon name="search" size={14} color="var(--eduflow-text-tertiary)" />
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Titre, matière, classe…"
                                aria-label="Rechercher un devoir"
                                className="flex-1 bg-transparent outline-none"
                                style={{
                                    border: 0,
                                    fontFamily: "inherit",
                                    fontSize: 13,
                                    color: "var(--eduflow-text-primary)",
                                }}
                            />
                        </label>
                        <SegmentedToggle
                            value={selectedStatus}
                            onChange={setSelectedStatus}
                            options={[
                                { value: "ALL", label: "Tous" },
                                { value: "PUBLISHED", label: "Publiés" },
                                { value: "DRAFT", label: "Brouillons" },
                            ]}
                        />
                        {activeFiltersCount > 0 ? (
                            <Button variant="ghost" size="sm" icon="x" onClick={resetFilters}>
                                Réinitialiser
                            </Button>
                        ) : null}
                    </div>
                </Card>

                {isLoading ? <PageLoading label="Chargement des devoirs…" /> : null}
                {error ? (
                    <PageError
                        message="Impossible de charger les devoirs."
                        onRetry={() => void mutateHomework()}
                    />
                ) : null}

                {!isLoading && !error && homeworks.length === 0 ? (
                    <PageEmpty
                        icon="book"
                        title="Aucun devoir trouvé"
                        description={
                            activeFiltersCount > 0
                                ? "Aucun devoir ne correspond aux filtres actuels. Élargissez la recherche ou réinitialisez les filtres."
                                : "Créez le premier devoir pour démarrer le suivi des soumissions."
                        }
                        actions={
                            activeFiltersCount > 0
                                ? [{ label: "Réinitialiser les filtres", onClick: resetFilters }]
                                : [{ label: "Nouveau devoir", href: "/dashboard/homework/new" }]
                        }
                    />
                ) : null}

                {!isLoading && !error && homeworks.length > 0 ? (
                    <DataTable
                        caption="Liste des devoirs"
                        data={homeworks}
                        getRowKey={(hw) => hw.id}
                        columns={[
                            {
                                id: "devoir",
                                header: "Devoir",
                                cell: (hw) => (
                                    <div>
                                        <div className="text-[13px] font-semibold">{hw.title}</div>
                                        {hw.createdBy ? (
                                            <div
                                                className="mt-0.5 text-[11px]"
                                                style={{ color: "var(--eduflow-text-tertiary)" }}
                                            >
                                                Par {hw.createdBy.firstName} {hw.createdBy.lastName}
                                            </div>
                                        ) : null}
                                    </div>
                                ),
                            },
                            {
                                id: "classe",
                                header: "Classe & matière",
                                cell: (hw) => (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[13px] font-medium">
                                            {hw.classSubject?.subject?.name || "—"}
                                        </span>
                                        <span
                                            className="text-[11px]"
                                            style={{ color: "var(--eduflow-text-tertiary)" }}
                                        >
                                            {hw.classSubject?.class?.name || "—"}
                                        </span>
                                    </div>
                                ),
                            },
                            {
                                id: "echeance",
                                header: "Échéance",
                                cell: (hw) => {
                                    const dueDate = new Date(hw.dueDate);
                                    const isOverdue =
                                        hw.isPublished && dueDate.getTime() < now;
                                    const daysUntil = Math.round(
                                        (dueDate.getTime() - now) / (1000 * 60 * 60 * 24)
                                    );
                                    const dueVariant:
                                        | "danger"
                                        | "warning"
                                        | "success"
                                        | "neutral" = isOverdue
                                        ? "danger"
                                        : daysUntil <= 2
                                          ? "warning"
                                          : daysUntil <= 7
                                            ? "success"
                                            : "neutral";
                                    return (
                                        <Badge variant={dueVariant} size="sm" icon="calendar">
                                            {formatDateShort(hw.dueDate)}
                                        </Badge>
                                    );
                                },
                            },
                            {
                                id: "soumissions",
                                header: "Soumissions",
                                cell: (hw) => (
                                    <span className="eduflow-tabular text-[13px] font-semibold">
                                        {hw._count?.submissions ?? 0}
                                    </span>
                                ),
                            },
                            {
                                id: "statut",
                                header: "Statut",
                                cell: (hw) =>
                                    hw.isPublished ? (
                                        <Badge variant="success" size="sm" dot>
                                            Publié
                                        </Badge>
                                    ) : (
                                        <Badge variant="neutral" size="sm">
                                            Brouillon
                                        </Badge>
                                    ),
                            },
                            {
                                id: "actions",
                                header: "Actions",
                                cell: (hw) => (
                                    <div className="flex items-center justify-end gap-1">
                                        <Link
                                            href={`/dashboard/homework/${hw.id}`}
                                            aria-label="Voir le devoir"
                                        >
                                            <Button variant="ghost" size="sm" icon="search">
                                                {""}
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon="x"
                                            onClick={() => handleDelete(hw.id, hw.title)}
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
                    if (!open) setDeleteTarget(null);
                }}
                title={
                    deleteTarget
                        ? `Supprimer « ${deleteTarget.title} » ?`
                        : "Supprimer ce devoir ?"
                }
                description="Cette action est définitive. Les soumissions liées peuvent être affectées."
                confirmLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
                variant="destructive"
                isConfirmLoading={isDeleteConfirmLoading}
                onConfirm={confirmDelete}
            />
        </PageGuard>
    );
}

function SegmentedToggle({
    value,
    onChange,
    options,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
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
                        className="px-3 py-1.5"
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
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
