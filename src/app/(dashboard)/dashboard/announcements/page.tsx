"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

import { PageGuard } from "@/components/guard/page-guard";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { Permission } from "@/lib/rbac/permissions";
import { t } from "@/lib/i18n";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Input,
    Spinner,
    type IconName,
} from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

type Announcement = {
    id: string;
    title: string;
    content: string;
    type: string;
    priority: string;
    isPublished: boolean;
    publishedAt: string | null;
    expiresAt: string | null;
    author: {
        firstName: string;
        lastName: string;
        role: string;
    };
};

const PRIORITY_VARIANT: Record<string, "danger" | "warning" | "brand" | "neutral"> = {
    URGENT: "danger",
    HIGH: "warning",
    NORMAL: "brand",
    LOW: "neutral",
};

const PRIORITY_LABEL: Record<string, string> = {
    URGENT: "Urgent",
    HIGH: "Élevé",
    NORMAL: "Normal",
    LOW: "Faible",
};

const TYPE_ICONS: Record<string, IconName> = {
    EVENT: "calendar",
    URGENT: "warning",
    GENERAL: "bell",
    ACADEMIC: "book",
};

const TYPE_LABELS: Record<string, string> = {
    EVENT: "Événement",
    URGENT: "Urgent",
    GENERAL: "Général",
    ACADEMIC: "Académique",
};

const ROLE_OPTIONS: { id: string; label: string }[] = [
    { id: "TEACHER", label: "Enseignants" },
    { id: "STUDENT", label: "Élèves" },
    { id: "PARENT", label: "Parents" },
    { id: "ACCOUNTANT", label: "Comptabilité" },
    { id: "STAFF", label: "Vie scolaire" },
];

export default function AnnouncementsPage() {
    const { data: session } = useSession();
    const isDirectorOrAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(
        session?.user?.role || ""
    );

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [isAdding, setIsAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(
        null
    );
    const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [type, setType] = useState("GENERAL");
    const [priority, setPriority] = useState("NORMAL");
    const [targetRoles, setTargetRoles] = useState<string[]>([]);
    const [publishNow, setPublishNow] = useState(true);

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/announcements");
            if (!res.ok) throw new Error("Erreur de récupération des annonces");
            const data = await res.json();
            setAnnouncements(data.announcements || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const toggleRole = (role: string) => {
        setTargetRoles((prev) =>
            prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
        );
    };

    const resetForm = () => {
        setTitle("");
        setContent("");
        setType("GENERAL");
        setPriority("NORMAL");
        setTargetRoles([]);
        setPublishNow(true);
    };

    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    content,
                    type,
                    priority,
                    targetRoles: targetRoles.length > 0 ? targetRoles : undefined,
                    isPublished: publishNow,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Erreur lors de la création");
            }
            setSuccessMsg("Annonce publiée avec succès !");
            setIsAdding(false);
            resetForm();
            fetchAnnouncements();
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: string, title: string) => {
        setDeleteTarget({ id, title });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleteConfirmLoading(true);
        try {
            const res = await fetch(`/api/announcements/${deleteTarget.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setAnnouncements((prev) =>
                    prev.filter((a) => a.id !== deleteTarget.id)
                );
            } else {
                throw new Error("Réponse non valide");
            }
        } catch {
            setError("Erreur lors de la suppression de l'annonce.");
        } finally {
            setIsDeleteConfirmLoading(false);
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
        }
    };

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-5xl flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        greeting="Fil d'annonces"
                        sub={`${announcements.length} ${
                            announcements.length > 1 ? "annonces actives" : "annonce active"
                        } · tableau d'affichage numérique`}
                        breadcrumb={["Tableau de bord", "Fil d'annonces"]}
                    />
                    {isDirectorOrAdmin && !isAdding ? (
                        <Button icon="plus" onClick={() => setIsAdding(true)}>
                            Nouvelle annonce
                        </Button>
                    ) : null}
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
                                    fontWeight: 500,
                                }}
                            >
                                {error}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {successMsg ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-success-500)",
                            background: "var(--eduflow-success-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="success" size={18} color="var(--eduflow-success-700)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-success-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {successMsg}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {/* Create Form */}
                {isAdding && isDirectorOrAdmin ? (
                    <Card padding={0} style={{ background: "var(--brand-50)" }}>
                        <div
                            className="flex items-center gap-2 border-b px-5 py-4"
                            style={{ borderColor: "var(--brand-100)" }}
                        >
                            <Icon name="bell" size={18} color="var(--brand-700)" />
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Rédiger une nouvelle annonce
                            </h3>
                        </div>
                        <form
                            onSubmit={handleCreateAnnouncement}
                            className="flex flex-col gap-4 px-5 py-5"
                        >
                            <Input
                                label="Titre"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                icon="bell"
                            />
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
                                    Contenu
                                </span>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    rows={5}
                                    placeholder="Décris l'annonce, l'événement, l'information…"
                                    style={{
                                        width: "100%",
                                        padding: "12px 14px",
                                        borderRadius: "var(--eduflow-radius-input)",
                                        border: "1px solid var(--eduflow-border-default)",
                                        background: "var(--eduflow-surface-card)",
                                        fontFamily: "inherit",
                                        fontSize: 13,
                                        color: "var(--eduflow-text-primary)",
                                        outline: "none",
                                        resize: "vertical",
                                        minHeight: 100,
                                    }}
                                />
                            </label>

                            <div
                                className="grid gap-3"
                                style={{
                                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                }}
                            >
                                <FieldSelect
                                    label="Type"
                                    value={type}
                                    onChange={setType}
                                    options={[
                                        { value: "GENERAL", label: "Général" },
                                        { value: "EVENT", label: "Événement" },
                                        { value: "URGENT", label: "Urgent" },
                                        { value: "ACADEMIC", label: "Académique" },
                                    ]}
                                />
                                <FieldSelect
                                    label="Priorité"
                                    value={priority}
                                    onChange={setPriority}
                                    options={[
                                        { value: "URGENT", label: "Urgente" },
                                        { value: "HIGH", label: "Élevée" },
                                        { value: "NORMAL", label: "Normale" },
                                        { value: "LOW", label: "Faible" },
                                    ]}
                                />
                            </div>

                            <div>
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
                                    Destinataires (vide = tous)
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {ROLE_OPTIONS.map((r) => {
                                        const active = targetRoles.includes(r.id);
                                        return (
                                            <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => toggleRole(r.id)}
                                                style={{
                                                    padding: "6px 12px",
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
                                                {r.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <label className="flex items-center gap-3">
                                <ToggleSwitch
                                    checked={publishNow}
                                    onChange={setPublishNow}
                                />
                                <span style={{ fontSize: 13, color: "var(--eduflow-text-primary)" }}>
                                    Publier immédiatement
                                </span>
                            </label>

                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setIsAdding(false);
                                        resetForm();
                                    }}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    type="submit"
                                    icon={saving ? undefined : "check"}
                                    loading={saving}
                                    disabled={saving || !title.trim() || !content.trim()}
                                >
                                    {saving ? "Publication…" : "Publier l'annonce"}
                                </Button>
                            </div>
                        </form>
                    </Card>
                ) : null}

                {/* Feed */}
                {loading ? (
                    <Card padding={20}>
                        <div className="flex items-center gap-3">
                            <Spinner size={20} color="var(--brand-600)" />
                            <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                                Chargement des annonces…
                            </span>
                        </div>
                    </Card>
                ) : announcements.length === 0 ? (
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
                                <Icon name="bell" size={26} color="var(--brand-700)" />
                            </div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Aucune annonce publiée
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
                                {isDirectorOrAdmin
                                    ? "Crée la première annonce pour informer la communauté scolaire."
                                    : "Les annonces de l'établissement apparaîtront ici dès leur publication."}
                            </p>
                        </div>
                    </Card>
                ) : (
                    <div className="flex flex-col gap-3">
                        {announcements.map((a) => (
                            <AnnouncementCard
                                key={a.id}
                                announcement={a}
                                canDelete={isDirectorOrAdmin}
                                onDelete={() => handleDelete(a.id, a.title)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <ConfirmActionDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setDeleteTarget(null);
                }}
                title="Supprimer l'annonce"
                description={
                    deleteTarget
                        ? `Cette action supprimera "${deleteTarget.title}".`
                        : undefined
                }
                confirmLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
                variant="destructive"
                isConfirmLoading={isDeleteConfirmLoading}
                onConfirm={confirmDelete}
            />
        </PageGuard>
    );
}

function AnnouncementCard({
    announcement,
    canDelete,
    onDelete,
}: {
    announcement: Announcement;
    canDelete: boolean;
    onDelete: () => void;
}) {
    const priorityVariant = PRIORITY_VARIANT[announcement.priority] ?? "neutral";
    const typeIcon = TYPE_ICONS[announcement.type] ?? "bell";
    const typeLabel = TYPE_LABELS[announcement.type] ?? announcement.type;
    const authorName = `${announcement.author.firstName} ${announcement.author.lastName}`;
    const isUrgent = announcement.priority === "URGENT" || announcement.type === "URGENT";

    return (
        <Card
            padding={0}
            style={{
                borderLeft: isUrgent ? "3px solid var(--eduflow-danger-500)" : undefined,
                background: isUrgent
                    ? "var(--eduflow-danger-50)"
                    : "var(--eduflow-surface-card)",
            }}
        >
            <div className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <div
                            className="grid place-items-center"
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: isUrgent
                                    ? "var(--eduflow-danger-100)"
                                    : "var(--brand-50)",
                                color: isUrgent
                                    ? "var(--eduflow-danger-700)"
                                    : "var(--brand-700)",
                                flexShrink: 0,
                            }}
                        >
                            <Icon name={typeIcon} size={18} />
                        </div>
                        <div className="min-w-0">
                            <h3
                                style={{
                                    margin: 0,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: "var(--eduflow-text-primary)",
                                    lineHeight: 1.25,
                                }}
                            >
                                {announcement.title}
                            </h3>
                            <div
                                className="mt-1 flex flex-wrap items-center gap-2"
                                style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}
                            >
                                <Badge variant="neutral" size="sm">
                                    {typeLabel}
                                </Badge>
                                <Badge variant={priorityVariant} size="sm" dot>
                                    {PRIORITY_LABEL[announcement.priority] ??
                                        announcement.priority}
                                </Badge>
                                {!announcement.isPublished ? (
                                    <Badge variant="warning" size="sm">
                                        Brouillon
                                    </Badge>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    {canDelete ? (
                        <button
                            type="button"
                            onClick={onDelete}
                            aria-label="Supprimer l'annonce"
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
                    ) : null}
                </div>
                <p
                    style={{
                        margin: "12px 0 0",
                        fontSize: 13,
                        color: "var(--eduflow-text-secondary)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                    }}
                >
                    {announcement.content}
                </p>
            </div>
            <div
                className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3"
                style={{
                    borderColor: "var(--eduflow-border-subtle)",
                    background: isUrgent ? "transparent" : "var(--eduflow-surface-sunken)",
                }}
            >
                <div className="flex items-center gap-2">
                    <Avatar name={authorName} size="xs" />
                    <span style={{ fontSize: 11, color: "var(--eduflow-text-secondary)" }}>
                        Par <strong style={{ color: "var(--eduflow-text-primary)" }}>{authorName}</strong>
                    </span>
                </div>
                {announcement.publishedAt ? (
                    <span
                        className="eduflow-mono"
                        style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
                    >
                        {new Date(announcement.publishedAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                        })}
                    </span>
                ) : null}
            </div>
        </Card>
    );
}

function ToggleSwitch({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (c: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            style={{
                width: 36,
                height: 20,
                padding: 2,
                borderRadius: 10,
                border: 0,
                background: checked ? "var(--brand-600)" : "var(--eduflow-neutral-300)",
                cursor: "pointer",
                transition:
                    "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
            }}
        >
            <span
                aria-hidden
                style={{
                    display: "block",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#fff",
                    transform: checked ? "translateX(8px)" : "translateX(-8px)",
                    transition:
                        "transform var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.15)",
                }}
            />
        </button>
    );
}

function FieldSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
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
                    fontWeight: 600,
                    color: "var(--eduflow-text-primary)",
                    cursor: "pointer",
                    outline: "none",
                }}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
