"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import {
    CalendarClock, AlertCircle, CheckCircle, Video, Phone,
    Users, MapPin, Loader2, Search, ArrowUpDown, Download, X
} from "lucide-react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useDebounce } from "@/hooks/use-debounce";

type Appointment = {
    id: string;
    status: string;
    type: "IN_PERSON" | "VIDEO_CALL" | "PHONE_CALL";
    scheduledAt: string;
    duration: number;
    location: string | null;
    notes: string | null;
    meetingLink: string | null;
    teacher: { user: { firstName: string; lastName: string } };
    parent: { user: { firstName: string; lastName: string } };
    student: { user: { firstName: string; lastName: string } };
};

const getTypeLabel = (type: string) =>
    type === "VIDEO_CALL" ? "Visio" : type === "PHONE_CALL" ? "Appel" : "Présentiel";

const getStatusColor = (status: string) => {
    switch (status) {
        case "CONFIRMED": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        case "PENDING": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
        case "CANCELLED": return "bg-red-500/10 text-red-600 border-red-500/20";
        case "COMPLETED": return "bg-slate-500/10 text-slate-600 border-slate-500/20";
        default: return "bg-primary/10 text-primary border-primary/20";
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case "CONFIRMED": return "Confirmé";
        case "PENDING": return "En Attente";
        case "CANCELLED": return "Annulé";
        case "COMPLETED": return "Terminé";
        default: return status;
    }
};

export default function AppointmentsPage() {
    const { data: session } = useSession();
    const role = session?.user?.role || "";

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 300);

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const statusQuery = statusFilter !== "ALL" ? `&status=${statusFilter}` : "";
            const res = await fetch(`/api/appointments?limit=200${statusQuery}`);
            if (!res.ok) throw new Error("Erreur de récupération des rendez-vous");
            const data = await res.json();
            setAppointments(data.appointments || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, [statusFilter]);

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                setAppointments(prev => prev.map(app => app.id === id ? { ...app, status: newStatus } : app));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const filteredAppointments = appointments.filter(app => {
        if (!debouncedSearch) return true;
        const query = debouncedSearch.toLowerCase();
        return `${app.teacher.user.firstName} ${app.teacher.user.lastName} ${app.parent.user.firstName} ${app.parent.user.lastName} ${app.student.user.firstName} ${app.student.user.lastName}`.toLowerCase().includes(query);
    });

    const exportCSV = () => {
        const headers = ["Date", "Heure", "Parent", "Enseignant", "Élève", "Type", "Statut", "Durée (min)"];
        const rows = filteredAppointments.map(a => [
            new Date(a.scheduledAt).toLocaleDateString("fr-FR"),
            new Date(a.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
            `${a.parent.user.firstName} ${a.parent.user.lastName}`,
            `${a.teacher.user.firstName} ${a.teacher.user.lastName}`,
            `${a.student.user.firstName} ${a.student.user.lastName}`,
            getTypeLabel(a.type),
            getStatusLabel(a.status),
            String(a.duration),
        ]);
        const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "rendez-vous.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    const columns: ColumnDef<Appointment>[] = [
        {
            id: "date",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Date & Heure <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => new Date(row.scheduledAt).getTime(),
            cell: ({ row }) => {
                const app = row.original;
                return (
                    <div>
                        <div className="font-semibold text-foreground">
                            {new Date(app.scheduledAt).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                        </div>
                        <div className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {new Date(app.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            ({app.duration} min)
                        </div>
                    </div>
                );
            },
        },
        {
            id: "participants",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Participants <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => `${row.parent.user.lastName} ${row.teacher.user.lastName}`,
            cell: ({ row }) => {
                const app = row.original;
                return (
                    <div className="flex flex-col gap-1">
                        <div className="text-sm"><span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mr-1">R:</span><span className="font-medium text-foreground">{app.parent.user.firstName} {app.parent.user.lastName}</span></div>
                        <div className="text-sm"><span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mr-1">P:</span><span className="text-foreground/80">{app.teacher.user.firstName} {app.teacher.user.lastName}</span></div>
                        <div className="text-xs text-muted-foreground italic">Élève: {app.student.user.firstName} {app.student.user.lastName}</div>
                    </div>
                );
            },
        },
        {
            id: "type",
            header: "Type & Lieu",
            cell: ({ row }) => {
                const app = row.original;
                const TypeIcon = app.type === "VIDEO_CALL" ? Video : app.type === "PHONE_CALL" ? Phone : Users;
                const iconColor = app.type === "VIDEO_CALL" ? "text-blue-500" : app.type === "PHONE_CALL" ? "text-amber-500" : "text-emerald-500";
                return (
                    <div>
                        <div className="flex items-center gap-2 font-medium text-foreground/80 mb-1">
                            <TypeIcon className={`w-4 h-4 ${iconColor}`} /> {getTypeLabel(app.type)}
                        </div>
                        {app.type === "IN_PERSON" && app.location ? (
                            <div className="flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="w-3.5 h-3.5 shrink-0" /><span>{app.location}</span></div>
                        ) : app.meetingLink ? (
                            <a href={app.meetingLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Lien réunion</a>
                        ) : null}
                    </div>
                );
            },
        },
        {
            id: "status",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Statut <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => row.status,
            cell: ({ row }) => (
                <span className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold uppercase rounded-full border ${getStatusColor(row.original.status)}`}>
                    {getStatusLabel(row.original.status)}
                </span>
            ),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => {
                const app = row.original;
                if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(role) || app.status !== "PENDING") return null;
                return (
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200" onClick={() => handleStatusUpdate(app.id, "CONFIRMED")}>
                            <CheckCircle className="w-4 h-4 mr-1" /> Valider
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => handleStatusUpdate(app.id, "CANCELLED")}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT"]}>
            <div className="space-y-6 max-w-6xl mx-auto pb-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Agenda des Rendez-vous"
                        description="Gérez les rencontres entre les parents et les professeurs."
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Rendez-vous" },
                        ]}
                    />
                    <Button variant="outline" onClick={exportCSV} className="gap-2 shrink-0">
                        <Download className="w-4 h-4" /> Export CSV
                    </Button>
                </div>

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                <Card className="border-border shadow-sm overflow-hidden">
                    <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30">
                        <div className="flex flex-wrap gap-2">
                            {["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].map(s => (
                                <Button
                                    key={s}
                                    variant={statusFilter === s ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setStatusFilter(s)}
                                >
                                    {s === "ALL" ? "Tous" : getStatusLabel(s)}
                                </Button>
                            ))}
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                
                                className="pl-9 h-9"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                        ) : filteredAppointments.length === 0 ? (
                            <div className="text-center py-20 border-dashed rounded-b-xl bg-background">
                                <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                <h3 className="text-lg font-medium">Aucun rendez-vous</h3>
                                <p className="text-sm text-muted-foreground mt-1">Vous n&apos;avez aucun rendez-vous avec ce statut.</p>
                            </div>
                        ) : (
                            <DataTable columns={columns} data={filteredAppointments} searchKey="participants" searchPlaceholder="Filtrer..." />
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageGuard>
    );
}
