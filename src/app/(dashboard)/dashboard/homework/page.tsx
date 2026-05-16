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

import { Avatar, Badge, Button, Card, Icon } from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

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

    const { data: response, error } = useSWR<HomeworkResponse | HomeworkItem[]>(
        "/api/homework?limit=100",
        fetcher
    );
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
            <div className="eduflow-scope flex flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        greeting="Devoirs"
                        sub={`${homeworks.length} devoirs · ${upcoming} cette semaine · ${overdue} en retard`}
                        breadcrumb={["Tableau de bord", "Devoirs"]}
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
                </div>

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
                    </div>
                </Card>

                {error ? <ErrorCard /> : null}

                {homeworks.length === 0 ? (
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
                                Aucun devoir trouvé
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
                                Crée le premier devoir pour démarrer le suivi des soumissions.
                            </p>
                        </div>
                    </Card>
                ) : (
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
                                        <Th>Devoir</Th>
                                        <Th>Classe & matière</Th>
                                        <Th width={140}>Échéance</Th>
                                        <Th width={120} center>
                                            Soumissions
                                        </Th>
                                        <Th width={120}>Statut</Th>
                                        <Th width={100} center>
                                            Actions
                                        </Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {homeworks.map((hw) => {
                                        const dueDate = new Date(hw.dueDate);
                                        const isOverdue =
                                            hw.isPublished && dueDate.getTime() < now;
                                        const daysUntil = Math.round(
                                            (dueDate.getTime() - now) / (1000 * 60 * 60 * 24)
                                        );
                                        const dueVariant: "danger" | "warning" | "success" | "neutral" =
                                            isOverdue
                                                ? "danger"
                                                : daysUntil <= 2
                                                ? "warning"
                                                : daysUntil <= 7
                                                ? "success"
                                                : "neutral";
                                        return (
                                            <tr
                                                key={hw.id}
                                                style={{
                                                    borderTop: "1px solid var(--eduflow-border-subtle)",
                                                }}
                                            >
                                                <Td>
                                                    <div
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            color: "var(--eduflow-text-primary)",
                                                        }}
                                                    >
                                                        {hw.title}
                                                    </div>
                                                    {hw.createdBy ? (
                                                        <div
                                                            style={{
                                                                fontSize: 11,
                                                                color:
                                                                    "var(--eduflow-text-tertiary)",
                                                                marginTop: 2,
                                                            }}
                                                        >
                                                            Par {hw.createdBy.firstName} {hw.createdBy.lastName}
                                                        </div>
                                                    ) : null}
                                                </Td>
                                                <Td>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                                                            {hw.classSubject?.subject?.name || "—"}
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                color: "var(--eduflow-text-tertiary)",
                                                            }}
                                                        >
                                                            {hw.classSubject?.class?.name || "—"}
                                                        </span>
                                                    </div>
                                                </Td>
                                                <Td>
                                                    <Badge variant={dueVariant} size="sm" icon="calendar">
                                                        {formatDateShort(hw.dueDate)}
                                                    </Badge>
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
                                                        {hw._count?.submissions ?? 0}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    {hw.isPublished ? (
                                                        <Badge variant="success" size="sm" dot>
                                                            Publié
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="neutral" size="sm">
                                                            Brouillon
                                                        </Badge>
                                                    )}
                                                </Td>
                                                <Td center>
                                                    <div className="flex items-center justify-center gap-1">
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
                                                </Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>

            <ConfirmActionDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setDeleteTarget(null);
                }}
                title={
                    deleteTarget
                        ? `Supprimer "${deleteTarget.title}" ?`
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

function ErrorCard() {
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
                    Impossible de charger les devoirs.
                </p>
            </div>
        </Card>
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
