"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";

import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { Permission } from "@/lib/rbac/permissions";
import { t } from "@/lib/i18n";

import { Badge, Button, Card, Icon, Spinner } from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

type ExamItem = {
    id: string;
    title: string;
    totalPoints: number;
    duration: number;
    isPublished: boolean;
    _count?: { questions: number };
    classSubject?: {
        subject?: { name: string };
        class?: { name: string };
    };
};

type ExamResponse = { exams?: ExamItem[] };

export default function ExamsPage() {
    const { data: response, error, isLoading: loading } = useSWR<ExamResponse | ExamItem[]>(
        "/api/exams",
        fetcher
    );
    const { mutate } = useSWRConfig();
    const { toast } = useToast();

    const exams: ExamItem[] = Array.isArray(response)
        ? response
        : response?.exams ?? [];

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(
        null
    );
    const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

    const handleDelete = (id: string, title: string) => {
        setDeleteTarget({ id, title });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleteConfirmLoading(true);
        try {
            const res = await fetch(`/api/exams/${deleteTarget.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Erreur lors de la suppression");
            toast({ title: "Succès", description: "L'examen a été supprimé." });
            mutate("/api/exams");
        } catch (err) {
            toast({
                title: "Erreur",
                description: err instanceof Error ? err.message : "Erreur inconnue",
                variant: "destructive",
            });
        } finally {
            setIsDeleteConfirmLoading(false);
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
        }
    };

    return (
        <PageGuard
            permission={Permission.EVALUATION_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT"]}
        >
            <div className="eduflow-scope flex flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        greeting="Examens en ligne"
                        sub={`${exams.length} ${
                            exams.length > 1 ? "examens disponibles" : "examen disponible"
                        } · QCM, devoirs surveillés, compositions`}
                        actions={
                            <RoleActionGuard
                                allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
                            >
                                <Link href="/dashboard/exams/new">
                                    <Button icon="plus">Créer un examen</Button>
                                </Link>
                            </RoleActionGuard>
                        }
                    />
                </div>

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
                                }}
                            >
                                Impossible de charger les examens.
                            </p>
                        </div>
                    </Card>
                ) : null}

                {loading ? (
                    <Card padding={20}>
                        <div className="flex items-center gap-3">
                            <Spinner size={18} color="var(--brand-600)" />
                            <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                                Chargement des examens…
                            </span>
                        </div>
                    </Card>
                ) : null}

                {!loading && !error && exams.length === 0 ? (
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
                                <Icon name="cards" size={26} color="var(--brand-700)" />
                            </div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Aucun examen disponible
                            </h3>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--eduflow-text-secondary)",
                                    margin: 0,
                                }}
                            >
                                Crée un examen avec des questions QCM, ouvertes ou rédactionnelles.
                            </p>
                        </div>
                    </Card>
                ) : null}

                {!loading && !error && exams.length > 0 ? (
                    <div
                        className="edu-stagger"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {exams.map((exam) => (
                            <Card
                                key={exam.id}
                                padding={0}
                                style={{
                                    transition:
                                        "transform var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                }}
                                className="hover:-translate-y-0.5 hover:shadow-eduflow-card-brand"
                            >
                                <div className="flex items-start gap-3 px-5 py-4">
                                    <div
                                        className="grid place-items-center"
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 12,
                                            background: "var(--brand-50)",
                                            color: "var(--brand-700)",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Icon name="cards" size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3
                                            className="eduflow-display"
                                            style={{
                                                margin: 0,
                                                fontSize: 16,
                                                fontWeight: 700,
                                                color: "var(--eduflow-text-primary)",
                                                lineHeight: 1.25,
                                            }}
                                        >
                                            {exam.title}
                                        </h3>
                                        <div
                                            className="mt-1 flex flex-wrap items-center gap-2"
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            <span>
                                                {exam.classSubject?.subject?.name ?? "—"}
                                            </span>
                                            <span>·</span>
                                            <span>{exam.classSubject?.class?.name ?? "—"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className="grid border-t"
                                    style={{
                                        gridTemplateColumns: "repeat(3, 1fr)",
                                        borderColor: "var(--eduflow-border-subtle)",
                                    }}
                                >
                                    <Stat
                                        label="Questions"
                                        value={(exam._count?.questions ?? 0).toString()}
                                    />
                                    <Stat
                                        label="Durée"
                                        value={`${exam.duration}'`}
                                        accent
                                    />
                                    <Stat
                                        label="Points"
                                        value={exam.totalPoints.toString()}
                                    />
                                </div>
                                <div
                                    className="flex items-center justify-between border-t px-5 py-3"
                                    style={{
                                        borderColor: "var(--eduflow-border-subtle)",
                                        background: "var(--eduflow-surface-sunken)",
                                    }}
                                >
                                    {exam.isPublished ? (
                                        <Badge variant="success" size="sm" dot>
                                            Publié
                                        </Badge>
                                    ) : (
                                        <Badge variant="neutral" size="sm">
                                            Brouillon
                                        </Badge>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <Link
                                            href={`/dashboard/exams/${exam.id}/take`}
                                            aria-label="Prévisualiser"
                                        >
                                            <Button variant="ghost" size="sm" icon="search">
                                                {""}
                                            </Button>
                                        </Link>
                                        <RoleActionGuard
                                            allowedRoles={[
                                                "SUPER_ADMIN",
                                                "SCHOOL_ADMIN",
                                                "DIRECTOR",
                                                "TEACHER",
                                            ]}
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon="x"
                                                onClick={() => handleDelete(exam.id, exam.title)}
                                            >
                                                {""}
                                            </Button>
                                        </RoleActionGuard>
                                    </div>
                                </div>
                            </Card>
                        ))}
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
                        ? `Supprimer "${deleteTarget.title}" ?`
                        : "Supprimer cet examen ?"
                }
                description="Cette action est définitive. Les soumissions liées seront affectées."
                confirmLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
                variant="destructive"
                isConfirmLoading={isDeleteConfirmLoading}
                onConfirm={confirmDelete}
            />
        </PageGuard>
    );
}

function Stat({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (
        <div
            style={{
                padding: "12px 16px",
                borderRight: "1px solid var(--eduflow-border-subtle)",
                background: accent ? "var(--brand-50)" : "transparent",
            }}
        >
            <div
                style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display eduflow-tabular"
                style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: accent ? "var(--brand-700)" : "var(--eduflow-text-primary)",
                    marginTop: 2,
                    lineHeight: 1.05,
                }}
            >
                {value}
            </div>
        </div>
    );
}
