"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Permission } from "@/lib/rbac/permissions";
import { Switch } from "@/components/ui/switch";
import { Calendar, Plus, MapPin, Users, Ticket, CheckCircle, AlertCircle, CalendarDays, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { t } from "@/lib/i18n";

type EventType = "GENERAL" | "SPORTS" | "CULTURAL" | "ACADEMIC" | "FIELD_TRIP" | "ASSEMBLY" | "PARENT_MEETING" | "GRADUATION" | "COMPETITION" | "WORKSHOP";

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
};

export default function EventsPage() {
    const { data: session } = useSession();
    const isDirectorOrAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session?.user?.role || "");

    const [events, setEvents] = useState<SchoolEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [isAdding, setIsAdding] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form Stats
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

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/events?limit=50");
            if (!res.ok) throw new Error("Erreur de récupération des événements");
            const data = await res.json();
            setEvents(data.events || []);
        } catch (err: any) {
            setError(err.message);
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

        const payload = {
            title,
            description: description || undefined,
            type,
            startDate: new Date(startDate).toISOString(),
            endDate: endDate ? new Date(endDate).toISOString() : undefined,
            location: location || undefined,
            maxParticipants: maxParticipants ? parseInt(maxParticipants) : undefined,
            fee: fee ? parseFloat(fee) : undefined,
            requiresPermission,
            isPublished
        };

        try {
            const res = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erreur de création");
            }

            setSuccessMsg("Événement créé avec succès");
            setIsAdding(false);
            fetchEvents();
            setTimeout(() => setSuccessMsg(null), 3000);

            // Reset
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
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const getTypeColor = (type: EventType) => {
        const colors: Record<EventType, string> = {
            GENERAL: "bg-blue-500/10 text-blue-600 border-blue-500/20",
            SPORTS: "bg-orange-500/10 text-orange-600 border-orange-500/20",
            CULTURAL: "bg-purple-500/10 text-purple-600 border-purple-500/20",
            ACADEMIC: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
            FIELD_TRIP: "bg-green-500/10 text-green-600 border-green-500/20",
            ASSEMBLY: "bg-slate-500/10 text-slate-600 border-slate-500/20",
            PARENT_MEETING: "bg-teal-500/10 text-teal-600 border-teal-500/20",
            GRADUATION: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
            COMPETITION: "bg-red-500/10 text-red-600 border-red-500/20",
            WORKSHOP: "bg-pink-500/10 text-pink-600 border-pink-500/20",
        };
        return colors[type] || colors.GENERAL;
    };

    const getTypeLabel = (type: EventType) => {
        const labels: Record<EventType, string> = {
            GENERAL: "Général", SPORTS: "Sport", CULTURAL: "Culturel", ACADEMIC: "Académique",
            FIELD_TRIP: "Sortie Scolaire", ASSEMBLY: "Assemblée", PARENT_MEETING: "Réunion Parents",
            GRADUATION: "Remise Diplôme", COMPETITION: "Compétition", WORKSHOP: "Atelier"
        };
        return labels[type] || type;
    };

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-6 max-w-6xl mx-auto pb-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Agenda & Événements"
                        description="Calendrier des manifestations et sorties scolaires."
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Événements" },
                        ]}
                    />
                    {isDirectorOrAdmin && !isAdding && (
                        <Button onClick={() => setIsAdding(true)} className="gap-2 shadow-sm shrink-0">
                            <Plus className="h-4 w-4" />
                            Créer un Événement
                        </Button>
                    )}
                </div>

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}
                {successMsg && (
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{successMsg}</p>
                    </div>
                )}

                {/* Create Form */}
                {isAdding && isDirectorOrAdmin && (
                    <Card className="border-primary/20 bg-primary/5 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CalendarDays className="w-5 h-5 text-primary" />
                                Nouvel Événement
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateEvent} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <Label>Titre <span className="text-destructive">*</span></Label>
                                        <Input value={title} onChange={e => setTitle(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Catégorie</Label>
                                        <select
                                            value={type}
                                            onChange={e => setType(e.target.value as EventType)}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <option value="GENERAL">Général</option>
                                            <option value="SPORTS">Rencontre Sportive</option>
                                            <option value="CULTURAL">Événement Culturel</option>
                                            <option value="PARENT_MEETING">Réunion Parents-Profs</option>
                                            <option value="FIELD_TRIP">Sortie Scolaire</option>
                                            <option value="ACADEMIC">Conférence / Pédagogie</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <Label>Date & Heure de début <span className="text-destructive">*</span></Label>
                                        <Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Date de fin (Optionnel)</Label>
                                        <Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea value={description} onChange={e => setDescription(e.target.value)} className="h-24 resize-none" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div className="space-y-2">
                                        <Label>Lieu</Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input value={location} onChange={e => setLocation(e.target.value)} className="pl-9" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Capacité max (Optionnel)</Label>
                                        <div className="relative">
                                            <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input type="number" min="1" value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} className="pl-9" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Frais de participation (Optionnel)</Label>
                                        <div className="relative">
                                            <Ticket className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input type="number" min="0" step="0.01" value={fee} onChange={e => setFee(e.target.value)} className="pl-9" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-6 pt-4 border-t">
                                    <div className="flex items-center gap-3">
                                        <Switch checked={requiresPermission} onCheckedChange={setRequiresPermission} />
                                        <div>
                                            <Label className="text-sm font-medium cursor-pointer" onClick={() => setRequiresPermission(!requiresPermission)}>Nécessite une autorisation parentale</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">Pour les sorties hors établissement.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                                        <div>
                                            <Label className="text-sm font-medium cursor-pointer" onClick={() => setIsPublished(!isPublished)}>{t("common.publishNow")}</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">Visible par l'audience cible.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>{t("common.cancel")}</Button>
                                    <Button type="submit" disabled={saving || !startDate || !title} className="gap-2">
                                        {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2" /> : <CalendarDays className="w-4 h-4" />}
                                        {t("appActions.saveEvent")}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Events Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {loading ? (
                        <div className="col-span-1 lg:col-span-2 py-12 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                    ) : events.length === 0 ? (
                        <div className="col-span-1 lg:col-span-2 text-center py-16 border border-dashed rounded-xl bg-muted/30">
                            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium">Aucun événement prévu</h3>
                            <p className="text-sm text-muted-foreground mt-1">L'agenda de l'établissement est vide.</p>
                        </div>
                    ) : (
                        events.map(event => (
                            <Card key={event.id} className="overflow-hidden hover:shadow-md transition-all flex flex-col h-full">
                                <CardContent className="p-0 flex flex-col h-full">
                                    <div className={`h-2 w-full ${getTypeColor(event.type).replace(/bg-.*\/10 text-.* border-.*\/20/, m => m.replace(/bg-(.*)\/10.*/, 'bg-$1-500'))}`} />
                                    <div className="p-5 flex flex-col flex-1">
                                        <div className="flex justify-between items-start gap-4 mb-3">
                                            <h3 className="font-bold text-lg text-foreground leading-tight line-clamp-2">{event.title}</h3>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border whitespace-nowrap ${getTypeColor(event.type)}`}>
                                                {getTypeLabel(event.type)}
                                            </span>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                                <Calendar className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                                                <span>
                                                    {new Date(event.startDate).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                                    {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                                                </span>
                                            </div>

                                            {event.location && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <MapPin className="w-4 h-4 shrink-0 text-primary/70" />
                                                    <span className="truncate">{event.location}</span>
                                                </div>
                                            )}
                                        </div>

                                        {event.description && (
                                            <p className="text-sm text-foreground/80 line-clamp-3 mb-4 flex-1">
                                                {event.description}
                                            </p>
                                        )}

                                        <div className="mt-auto pt-4 border-t flex flex-wrap gap-3 items-center text-xs">
                                            {event.fee && event.fee > 0 && (
                                                <span className="flex items-center gap-1 font-medium bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                                                    <Ticket className="w-3.5 h-3.5" />
                                                    {event.fee} € / pers.
                                                </span>
                                            )}
                                            {event.requiresPermission && (
                                                <span className="flex items-center gap-1 font-medium bg-amber-500/10 text-amber-700 px-2 py-1 rounded">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    Autorisation requise
                                                </span>
                                            )}
                                            {event.maxParticipants && (
                                                <span className="flex items-center gap-1 text-muted-foreground ml-auto">
                                                    <Users className="w-3.5 h-3.5" />
                                                    {event._count.participations}/{event.maxParticipants} max
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </PageGuard>
    );
}
