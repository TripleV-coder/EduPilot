"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Input,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";

type EventType =
    | "GENERAL"
    | "SPORTS"
    | "CULTURAL"
    | "ACADEMIC"
    | "FIELD_TRIP"
    | "ASSEMBLY"
    | "PARENT_MEETING"
    | "GRADUATION"
    | "COMPETITION"
    | "WORKSHOP";

type SchoolEvent = {
    id: string;
    title: string;
    description: string | null;
    type: EventType;
    startDate: string;
    endDate: string | null;
    location: string | null;
    maxParticipants: number | null;
    fee: number | null;
    requiresPermission: boolean;
    isPublished: boolean;
    createdBy: { firstName: string; lastName: string };
    _count: { participations: number };
    /** Élèves de la famille déjà inscrits (élève ou parent connecté). */
    myRegistrations?: string[];
};

type FamilyStudent = { id: string; firstName: string };

const TYPE_LABEL: Record<EventType, string> = {
    GENERAL: "Général",
    SPORTS: "Sport",
    CULTURAL: "Culturel",
    ACADEMIC: "Académique",
    FIELD_TRIP: "Sortie scolaire",
    ASSEMBLY: "Assemblée",
    PARENT_MEETING: "Réunion parents",
    GRADUATION: "Remise diplôme",
    COMPETITION: "Compétition",
    WORKSHOP: "Atelier",
};

const TYPE_VARIANT: Record<EventType, "brand" | "info" | "success" | "warning" | "neutral"> = {
    GENERAL: "brand",
    SPORTS: "success",
    CULTURAL: "warning",
    ACADEMIC: "brand",
    FIELD_TRIP: "info",
    ASSEMBLY: "brand",
    PARENT_MEETING: "info",
    GRADUATION: "warning",
    COMPETITION: "warning",
    WORKSHOP: "brand",
};

export default function EventsPage() {
    // Garde avant chargement (TD-024) : aucune requête tant que le rôle n'est pas admis.
    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]} >
            <EventsPageContent />
        </PageGuard>
    );
}

function EventsPageContent() {
    const { data: session } = useSession();
    const isDirectorOrAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(
        session?.user?.role || ""
    );

    const [events, setEvents] = useState<SchoolEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [isAdding, setIsAdding] = useState(false);
    const [saving, setSaving] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState<EventType>("GENERAL");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [location, setLocation] = useState("");
    const [maxParticipants, setMaxParticipants] = useState("");
    const [fee, setFee] = useState("");
    const [requiresPermission, setRequiresPermission] = useState(false);
    const [isPublished, setIsPublished] = useState(true);

    const [viewerStudents, setViewerStudents] = useState<FamilyStudent[]>([]);
    const [pendingKey, setPendingKey] = useState<string | null>(null);

    // Inscription : la route existait, aucun bouton ne l'appelait
    const toggleRegistration = async (ev: SchoolEvent, student: FamilyStudent, registered: boolean) => {
        const key = `${ev.id}:${student.id}`;
        setPendingKey(key);
        try {
            const res = registered
                ? await fetch(`/api/events/${ev.id}/participate?studentId=${encodeURIComponent(student.id)}`, { method: "DELETE" })
                : await fetch(`/api/events/${ev.id}/participate`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      // Parent : inscrire son enfant vaut autorisation quand elle est requise
                      body: JSON.stringify({ studentId: student.id, permissionGiven: session?.user?.role === "PARENT" && ev.requiresPermission }),
                  });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error || "L'inscription n'a pas été modifiée.");
                return;
            }
            toast.success(registered ? "Inscription annulée." : `${student.firstName} est inscrit·e.`);
            await fetchEvents();
        } catch {
            toast.error("Connexion impossible : l'inscription n'a pas été modifiée.");
        } finally {
            setPendingKey(null);
        }
    };

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/events?limit=50");
            if (!res.ok) throw new Error("Erreur de récupération des événements");
            const data = await res.json();
            // Format paginé du projet : { data, pagination } (+ élèves de la famille)
            setEvents(data.data || []);
            setViewerStudents(Array.isArray(data.viewerStudents) ? data.viewerStudents : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description: description || undefined,
                    type,
                    startDate: new Date(startDate).toISOString(),
                    endDate: endDate ? new Date(endDate).toISOString() : undefined,
                    location: location || undefined,
                    maxParticipants: maxParticipants
                        ? parseInt(maxParticipants)
                        : undefined,
                    fee: fee ? parseFloat(fee) : undefined,
                    requiresPermission,
                    isPublished,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Erreur de création");
            }
            setSuccessMsg("Événement créé avec succès");
            setIsAdding(false);
            fetchEvents();
            setTimeout(() => setSuccessMsg(null), 3000);
            setTitle("");
            setDescription("");
            setType("GENERAL");
            setStartDate("");
            setEndDate("");
            setLocation("");
            setMaxParticipants("");
            setFee("");
            setRequiresPermission(false);
            setIsPublished(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <PageShell>
                <PageHeader
                    title="Agenda & événements"
                    description={`${events.length} ${
                        events.length > 1 ? "événements à venir" : "événement à venir"
                    } · sorties scolaires, ateliers, compétitions`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Agenda & événements" },
                    ]}
                    actions={
                        isDirectorOrAdmin && !isAdding ? (
                            <Button icon="plus" onClick={() => setIsAdding(true)}>
                                Créer un événement
                            </Button>
                        ) : undefined
                    }
                />

                {error ? <PageError error={error} message={error} onRetry={fetchEvents} /> : null}

                {successMsg ? (
                    <Card
                        padding={14}
                        style={{
                            border: "1px solid var(--eduflow-success-200)",
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
                                }}
                            >
                                {successMsg}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {isAdding && isDirectorOrAdmin ? (
                    <Card padding={0} style={{ background: "var(--brand-50)" }}>
                        <div
                            className="flex items-center gap-2 border-b px-5 py-4"
                            style={{ borderColor: "var(--brand-100)" }}
                        >
                            <Icon name="calendar" size={18} color="var(--brand-700)" />
                            <h2 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                                Nouvel événement
                            </h2>
                        </div>
                        <form
                            onSubmit={handleCreateEvent}
                            className="flex flex-col gap-3 px-5 py-5"
                        >
                            <Input
                                label="Titre"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                icon="calendar"
                            />
                            <label className="block">
                                <span
                                    style={{
                                        display: "block",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginBottom: 6,
                                    }}
                                >
                                    Description
                                </span>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Décris l'événement…"
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
                                        minHeight: 80,
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
                                    onChange={(v) => setType(v as EventType)}
                                    options={(
                                        Object.entries(TYPE_LABEL) as [EventType, string][]
                                    ).map(([v, l]) => ({ value: v, label: l }))}
                                />
                                <Input
                                    label="Date début"
                                    type="datetime-local"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    icon="calendar"
                                />
                                <Input
                                    label="Date fin"
                                    type="datetime-local"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    icon="calendar"
                                />
                                <Input
                                    label="Lieu"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    icon="school"
                                />
                                <Input
                                    label="Max participants"
                                    type="number"
                                    value={maxParticipants}
                                    onChange={(e) => setMaxParticipants(e.target.value)}
                                    icon="users"
                                />
                                <Input
                                    label="Tarif (FCFA)"
                                    type="number"
                                    value={fee}
                                    onChange={(e) => setFee(e.target.value)}
                                    icon="money"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2">
                                    <ToggleSwitch
                                        checked={isPublished}
                                        onChange={setIsPublished}
                                    />
                                    <span style={{ fontSize: 13 }}>Publier maintenant</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <ToggleSwitch
                                        checked={requiresPermission}
                                        onChange={setRequiresPermission}
                                    />
                                    <span style={{ fontSize: 13 }}>
                                        Autorisation parentale requise
                                    </span>
                                </label>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setIsAdding(false)}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    type="submit"
                                    icon={saving ? undefined : "check"}
                                    loading={saving}
                                    disabled={saving || !title.trim() || !startDate}
                                >
                                    Créer l&apos;événement
                                </Button>
                            </div>
                        </form>
                    </Card>
                ) : null}

                {loading ? (
                    <PageLoading label="Chargement des événements…" />
                ) : events.length === 0 ? (
                    <PageEmpty
                        icon="calendar"
                        title="Aucun événement programmé"
                        description={
                            isDirectorOrAdmin
                                ? "Créez le premier événement pour mobiliser la communauté scolaire."
                                : "Les événements à venir s'afficheront ici."
                        }
                        actions={
                            isDirectorOrAdmin
                                ? [{ label: "Créer un événement", onClick: () => setIsAdding(true) }]
                                : undefined
                        }
                    />
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {events.map((ev) => (
                            <EventCard
                                key={ev.id}
                                event={ev}
                                students={viewerStudents}
                                isStudent={session?.user?.role === "STUDENT"}
                                pendingKey={pendingKey}
                                onToggle={toggleRegistration}
                            />
                        ))}
                    </div>
                )}
            </PageShell>
        </>
    );
}

function EventCard({
    event,
    students = [],
    isStudent = false,
    pendingKey = null,
    onToggle,
}: {
    event: SchoolEvent;
    students?: FamilyStudent[];
    isStudent?: boolean;
    pendingKey?: string | null;
    onToggle?: (ev: SchoolEvent, student: FamilyStudent, registered: boolean) => void;
}) {
    const variant = TYPE_VARIANT[event.type] ?? "brand";
    const label = TYPE_LABEL[event.type] ?? event.type;
    const start = new Date(event.startDate);
    const formatter = new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <Card
            padding={0}
            style={{
                cursor: "default",
                transition:
                    "transform var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out)",
            }}
            className="hover:-translate-y-0.5 hover:shadow-eduflow-card-brand"
        >
            <div className="flex items-start gap-3 px-5 py-4">
                <div
                    className="grid place-items-center"
                    style={{
                        width: 50,
                        height: 50,
                        borderRadius: 12,
                        background:
                            variant === "brand" ? "var(--brand-50)" : `var(--eduflow-${variant}-50)`,
                        color:
                            variant === "brand" ? "var(--brand-700)" : `var(--eduflow-${variant}-700)`,
                        flexShrink: 0,
                    }}
                >
                    <span
                        className="eduflow-display eduflow-tabular"
                        style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}
                    >
                        {start.getDate()}
                    </span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <h2
                            style={{
                                margin: 0,
                                fontSize: 15,
                                fontWeight: 700,
                                color: "var(--eduflow-text-primary)",
                                lineHeight: 1.25,
                            }}
                        >
                            {event.title}
                        </h2>
                        <Badge variant={variant} size="sm">
                            {label}
                        </Badge>
                    </div>
                    {event.description ? (
                        <p
                            style={{
                                margin: "6px 0 0",
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                lineHeight: 1.5,
                            }}
                        >
                            {event.description}
                        </p>
                    ) : null}
                </div>
            </div>
            <div
                className="flex flex-wrap items-center gap-3 border-t px-5 py-3"
                style={{
                    borderColor: "var(--eduflow-border-subtle)",
                    background: "var(--eduflow-surface-sunken)",
                }}
            >
                <span
                    className="flex items-center gap-1.5"
                    style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}
                >
                    <Icon name="calendar" size={12} />
                    {formatter.format(start)}
                </span>
                {event.location ? (
                    <span
                        className="flex items-center gap-1.5"
                        style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}
                    >
                        <Icon name="school" size={12} />
                        {event.location}
                    </span>
                ) : null}
                {event.maxParticipants ? (
                    <span
                        className="flex items-center gap-1.5"
                        style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}
                    >
                        <Icon name="users" size={12} />
                        <span className="eduflow-tabular">
                            {event._count?.participations ?? 0} / {event.maxParticipants}
                        </span>
                    </span>
                ) : null}
                {event.requiresPermission ? (
                    <Badge variant="warning" size="sm" icon="warning">
                        Autorisation
                    </Badge>
                ) : null}
                {!event.isPublished ? (
                    <Badge variant="neutral" size="sm">
                        Brouillon
                    </Badge>
                ) : null}
                <div className="ml-auto flex items-center gap-1.5">
                    <Avatar
                        name={`${event.createdBy.firstName} ${event.createdBy.lastName}`}
                        size="xs"
                    />
                    <span
                        style={{
                            fontSize: 12,
                            color: "var(--eduflow-text-tertiary)",
                        }}
                    >
                        {event.createdBy.firstName[0]}. {event.createdBy.lastName}
                    </span>
                </div>
            </div>
            {onToggle && students.length > 0 && event.isPublished && new Date(event.startDate) > new Date() ? (
                <div className="flex flex-wrap gap-2 border-t px-5 py-3" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                    {students.map((student) => {
                        const registered = (event.myRegistrations ?? []).includes(student.id);
                        const full = !registered && event.maxParticipants !== null && (event._count?.participations ?? 0) >= event.maxParticipants;
                        const label = isStudent
                            ? registered ? "Je ne participe plus" : "Je participe"
                            : registered ? `${student.firstName} inscrit·e · Annuler` : `Inscrire ${student.firstName}`;
                        return (
                            <Button
                                key={student.id}
                                size="sm"
                                variant={registered ? "secondary" : "primary"}
                                disabled={full}
                                loading={pendingKey === `${event.id}:${student.id}`}
                                onClick={() => onToggle(event, student, registered)}
                            >
                                {full ? "Complet" : label}
                            </Button>
                        );
                    })}
                </div>
            ) : null}
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
                width: 32,
                height: 18,
                padding: 2,
                borderRadius: 9,
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
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#fff",
                    transform: checked ? "translateX(7px)" : "translateX(-7px)",
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
                    fontSize: 12,
                    fontWeight: 600,
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
