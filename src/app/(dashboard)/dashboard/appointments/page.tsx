"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";

import { PageGuard } from "@/components/guard/page-guard";
import { DataTable } from "@/components/layout/data-table";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";
import { Badge, Button, Card, Input } from "@/components/edu";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";
import { useDebounce } from "@/hooks/use-debounce";

type Appointment = {
    id: string;
    status: string;
    type: "IN_PERSON" | "VIDEO_CALL" | "PHONE_CALL";
    scheduledAt: string;
    duration: number;
    location: string | null;
    meetingLink: string | null;
    teacher: { user: { firstName: string; lastName: string } };
    parent: { user: { firstName: string; lastName: string } };
    student: { user: { firstName: string; lastName: string } };
};

const getTypeLabel = (type: string) =>
    type === "VIDEO_CALL" ? "Visio" : type === "PHONE_CALL" ? "Appel" : "Présentiel";

const getStatusLabel = (status: string) => {
    switch (status) {
        case "CONFIRMED":
            return "Confirmé";
        case "PENDING":
            return "En attente";
        case "CANCELLED":
            return "Annulé";
        case "COMPLETED":
            return "Terminé";
        default:
            return status;
    }
};

export default function AppointmentsPage() {
    const { data: session } = useSession();
    const role = session?.user?.role || "";
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 300);

    const statusQuery = statusFilter !== "ALL" ? `&status=${statusFilter}` : "";
    const { data, error, isLoading, mutate } = useSWR<{ appointments?: Appointment[] }>(
        `/api/appointments?limit=200${statusQuery}`,
        fetcher
    );

    const appointments = data?.appointments ?? [];

    const filteredAppointments = useMemo(() => {
        if (!debouncedSearch) return appointments;
        const query = debouncedSearch.toLowerCase();
        return appointments.filter((appointment) =>
            `${appointment.teacher.user.firstName} ${appointment.teacher.user.lastName} ${appointment.parent.user.firstName} ${appointment.parent.user.lastName} ${appointment.student.user.firstName} ${appointment.student.user.lastName}`
                .toLowerCase()
                .includes(query)
        );
    }, [appointments, debouncedSearch]);

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) void mutate();
        } catch {
            // silencieux — l'état SWR reste inchangé
        }
    };

    const exportCSV = () => {
        const headers = ["Date", "Heure", "Parent", "Enseignant", "Élève", "Type", "Statut", "Durée (min)"];
        const rows = filteredAppointments.map((appointment) => [
            new Date(appointment.scheduledAt).toLocaleDateString("fr-FR"),
            new Date(appointment.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
            `${appointment.parent.user.firstName} ${appointment.parent.user.lastName}`,
            `${appointment.teacher.user.firstName} ${appointment.teacher.user.lastName}`,
            `${appointment.student.user.firstName} ${appointment.student.user.lastName}`,
            getTypeLabel(appointment.type),
            getStatusLabel(appointment.status),
            String(appointment.duration),
        ]);
        const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "rendez-vous.csv";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const canModerate = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(role);

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT"]}>
            <PageShell className="max-w-6xl pb-12">
                <PageHeader
                    title="Agenda des rendez-vous"
                    description="Gérez les rencontres entre les parents et les enseignants."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Rendez-vous" },
                    ]}
                    actions={
                        <Button variant="secondary" size="sm" icon="download" onClick={exportCSV}>
                            Exporter CSV
                        </Button>
                    }
                />

                <Card padding={0}>
                    <div
                        className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between"
                        style={{
                            borderColor: "var(--eduflow-border-subtle)",
                            background: "var(--eduflow-surface-sunken)",
                        }}
                    >
                        <div className="flex flex-wrap gap-2">
                            {["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].map((status) => (
                                <Button
                                    key={status}
                                    type="button"
                                    size="sm"
                                    variant={statusFilter === status ? "primary" : "secondary"}
                                    onClick={() => setStatusFilter(status)}
                                >
                                    {status === "ALL" ? "Tous" : getStatusLabel(status)}
                                </Button>
                            ))}
                        </div>
                        <div className="w-full sm:w-72">
                            <Input
                                aria-label="Rechercher un rendez-vous"
                                icon="search"
                                placeholder="Parent, professeur, élève…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {isLoading ? <PageLoading label="Chargement des rendez-vous…" /> : null}
                    {error ? (
                        <PageError
                            message={error.message || "Erreur de récupération des rendez-vous"}
                            onRetry={() => void mutate()}
                        />
                    ) : null}

                    {!isLoading && !error && filteredAppointments.length === 0 ? (
                        <PageEmpty
                            icon="calendar"
                            title="Aucun rendez-vous"
                            description="Aucun rendez-vous ne correspond à ces critères."
                        />
                    ) : null}

                    {!isLoading && !error && filteredAppointments.length > 0 ? (
                        <div className="p-4">
                            <DataTable
                                caption="Liste des rendez-vous parents-enseignants"
                                data={filteredAppointments}
                                getRowKey={(row) => row.id}
                                columns={[
                                    {
                                        id: "date",
                                        header: "Date et heure",
                                        cell: (appointment) => (
                                            <div>
                                                <div className="font-semibold">
                                                    {new Date(appointment.scheduledAt).toLocaleDateString("fr-FR", {
                                                        weekday: "short",
                                                        day: "numeric",
                                                        month: "short",
                                                    })}
                                                </div>
                                                <div className="text-xs" style={{ color: "var(--eduflow-text-secondary)" }}>
                                                    {new Date(appointment.scheduledAt).toLocaleTimeString("fr-FR", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}{" "}
                                                    · {appointment.duration} min
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        id: "participants",
                                        header: "Participants",
                                        cell: (appointment) => (
                                            <div className="space-y-1 text-sm">
                                                <div>
                                                    <span style={{ color: "var(--eduflow-text-tertiary)" }}>Parent · </span>
                                                    {appointment.parent.user.firstName} {appointment.parent.user.lastName}
                                                </div>
                                                <div>
                                                    <span style={{ color: "var(--eduflow-text-tertiary)" }}>Enseignant · </span>
                                                    {appointment.teacher.user.firstName} {appointment.teacher.user.lastName}
                                                </div>
                                                <div className="text-xs italic" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                                    Élève : {appointment.student.user.firstName} {appointment.student.user.lastName}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        id: "type",
                                        header: "Type",
                                        cell: (appointment) => (
                                            <div>
                                                <div>{getTypeLabel(appointment.type)}</div>
                                                {appointment.meetingLink ? (
                                                    <a
                                                        href={appointment.meetingLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs"
                                                        style={{ color: "var(--brand-600)" }}
                                                    >
                                                        Lien réunion
                                                    </a>
                                                ) : appointment.location ? (
                                                    <div className="text-xs" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                                        {appointment.location}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ),
                                    },
                                    {
                                        id: "status",
                                        header: "Statut",
                                        cell: (appointment) => (
                                            <Badge
                                                variant={
                                                    appointment.status === "CONFIRMED" || appointment.status === "COMPLETED"
                                                        ? "success"
                                                        : appointment.status === "PENDING"
                                                            ? "warning"
                                                            : appointment.status === "CANCELLED"
                                                                ? "danger"
                                                                : "neutral"
                                                }
                                                size="sm"
                                            >
                                                {getStatusLabel(appointment.status)}
                                            </Badge>
                                        ),
                                    },
                                    {
                                        id: "actions",
                                        header: "Actions",
                                        cell: (appointment) =>
                                            canModerate && appointment.status === "PENDING" ? (
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => void handleStatusUpdate(appointment.id, "CONFIRMED")}
                                                    >
                                                        Valider
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        onClick={() => void handleStatusUpdate(appointment.id, "CANCELLED")}
                                                    >
                                                        Refuser
                                                    </Button>
                                                </div>
                                            ) : null,
                                    },
                                ]}
                            />
                        </div>
                    ) : null}
                </Card>
            </PageShell>
        </PageGuard>
    );
}
