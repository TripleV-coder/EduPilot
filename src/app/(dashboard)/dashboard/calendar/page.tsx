"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import {
    Calendar,
    AlertCircle,
    MapPin,
    Sun,
    Flag,
    CalendarDays,
    Repeat,
} from "lucide-react";
import { Permission } from "@/lib/rbac/permissions";

// ── Types ────────────────────────────────────────────────────────────────────

type CalendarEvent = {
    id: string;
    title: string;
    startDate: string;
    endDate?: string;
    type?: string;
    location?: string;
};

type SchoolHoliday = {
    id: string;
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    description?: string;
    academicYear?: { name: string };
};

type PublicHoliday = {
    id: string;
    name: string;
    type: string;
    date: string;
    isRecurring: boolean;
    description?: string;
    school?: { name: string };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (d: string) =>
    new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(d));

const eventTypeColors: Record<string, string> = {
    GENERAL: "bg-primary/10 text-primary",
    SPORTS: "bg-secondary/10 text-secondary",
    CULTURAL: "bg-accent/10 text-accent",
    ACADEMIC: "bg-info/10 text-info",
    HOLIDAY: "bg-warning/10 text-warning",
};

const holidayTypeLabels: Record<string, string> = {
    CHRISTMAS: "Noël",
    NEW_YEAR: "Nouvel An",
    EASTER: "Pâques",
    SUMMER: "Été",
    FEBRUARY: "Février",
    SPRING: "Printemps",
    TOUSSAINT: "Toussaint",
    OTHER: "Autre",
};

const publicHolidayTypeLabels: Record<string, string> = {
    NATIONAL: "National",
    RELIGIOUS: "Religieux",
    INTERNATIONAL: "International",
    LOCAL: "Local",
};

const holidayTypeVariant: Record<string, "default" | "secondary" | "warning" | "info" | "outline"> = {
    CHRISTMAS: "default",
    NEW_YEAR: "default",
    EASTER: "info",
    SUMMER: "warning",
    FEBRUARY: "secondary",
    SPRING: "secondary",
    TOUSSAINT: "info",
    OTHER: "outline",
};

const publicHolidayTypeVariant: Record<string, "default" | "secondary" | "warning" | "info" | "outline"> = {
    NATIONAL: "default",
    RELIGIOUS: "info",
    INTERNATIONAL: "secondary",
    LOCAL: "warning",
};

// ── Shared UI fragments ─────────────────────────────────────────────────────

function LoadingSpinner() {
    return (
        <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
    );
}

function ErrorAlert({ message }: { message: string }) {
    return (
        <div
            role="alert"
            className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2"
        >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{message}</p>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
    const {
        data: eventsRaw,
        error: eventsError,
        isLoading: eventsLoading,
    } = useSWR<CalendarEvent[] | { events: CalendarEvent[] }>("/api/calendar/events", fetcher);

    const {
        data: holidaysRaw,
        error: holidaysError,
        isLoading: holidaysLoading,
    } = useSWR<SchoolHoliday[]>("/api/calendar/holidays", fetcher);

    const {
        data: publicHolidaysRaw,
        error: publicHolidaysError,
        isLoading: publicHolidaysLoading,
    } = useSWR<PublicHoliday[]>("/api/calendar/public-holidays", fetcher);

    const events: CalendarEvent[] = Array.isArray(eventsRaw)
        ? eventsRaw
        : (eventsRaw as { events: CalendarEvent[] } | undefined)?.events ?? [];

    const holidays: SchoolHoliday[] = Array.isArray(holidaysRaw) ? holidaysRaw : [];
    const publicHolidays: PublicHoliday[] = Array.isArray(publicHolidaysRaw) ? publicHolidaysRaw : [];

    return (
        <PageGuard permission={[Permission.CALENDAR_EVENT_READ, Permission.HOLIDAY_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-6">
                <PageHeader
                    title="Calendrier"
                    description="Événements, vacances scolaires et jours fériés de l'établissement"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Calendrier" },
                    ]}
                />

                <Tabs defaultValue="events" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="events" className="gap-1.5">
                            <CalendarDays className="h-4 w-4" />
                            Événements
                        </TabsTrigger>
                        <TabsTrigger value="holidays" className="gap-1.5">
                            <Sun className="h-4 w-4" />
                            Vacances scolaires
                        </TabsTrigger>
                        <TabsTrigger value="public-holidays" className="gap-1.5">
                            <Flag className="h-4 w-4" />
                            Jours fériés
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Événements ──────────────────────────────────────── */}
                    <TabsContent value="events">
                        {eventsLoading && <LoadingSpinner />}
                        {eventsError && <ErrorAlert message={eventsError.message} />}

                        {!eventsLoading && !eventsError && events.length === 0 && (
                            <EmptyState
                                icon={Calendar}
                                title="Aucun événement programmé"
                                description="Les événements apparaîtront ici une fois créés."
                            />
                        )}

                        {!eventsLoading && !eventsError && events.length > 0 && (
                            <div className="space-y-3">
                                {events.map((event) => (
                                    <Card
                                        key={event.id}
                                        className="border-border bg-card hover:border-primary/40 transition-all duration-200"
                                    >
                                        <CardHeader className="flex flex-row items-center justify-between pb-1">
                                            <CardTitle className="text-sm font-semibold">
                                                {event.title}
                                            </CardTitle>
                                            {event.type && (
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${eventTypeColors[event.type] ?? "bg-muted text-muted-foreground"}`}
                                                >
                                                    {event.type}
                                                </span>
                                            )}
                                        </CardHeader>
                                        <CardContent className="pt-0 flex items-center justify-between text-xs text-muted-foreground">
                                            <span>
                                                {formatDate(event.startDate)}
                                                {event.endDate ? ` \u2192 ${formatDate(event.endDate)}` : ""}
                                            </span>
                                            {event.location && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" /> {event.location}
                                                </span>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Vacances scolaires ──────────────────────────────── */}
                    <TabsContent value="holidays">
                        {holidaysLoading && <LoadingSpinner />}
                        {holidaysError && <ErrorAlert message={holidaysError.message} />}

                        {!holidaysLoading && !holidaysError && holidays.length === 0 && (
                            <EmptyState
                                icon={Sun}
                                title="Aucune vacance scolaire enregistrée"
                                description="Les vacances scolaires apparaîtront ici une fois configurées."
                            />
                        )}

                        {!holidaysLoading && !holidaysError && holidays.length > 0 && (
                            <div className="space-y-3">
                                {holidays.map((holiday) => (
                                    <Card
                                        key={holiday.id}
                                        className="border-border bg-card hover:border-primary/40 transition-all duration-200"
                                    >
                                        <CardHeader className="flex flex-row items-center justify-between pb-1">
                                            <CardTitle className="text-sm font-semibold">
                                                {holiday.name}
                                            </CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={holidayTypeVariant[holiday.type] ?? "outline"}>
                                                    {holidayTypeLabels[holiday.type] ?? holiday.type}
                                                </Badge>
                                                {holiday.academicYear?.name && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {holiday.academicYear.name}
                                                    </span>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0 space-y-1">
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(holiday.startDate)} {"\u2192"} {formatDate(holiday.endDate)}
                                            </p>
                                            {holiday.description && (
                                                <p className="text-xs text-muted-foreground/80">
                                                    {holiday.description}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Jours fériés ────────────────────────────────────── */}
                    <TabsContent value="public-holidays">
                        {publicHolidaysLoading && <LoadingSpinner />}
                        {publicHolidaysError && <ErrorAlert message={publicHolidaysError.message} />}

                        {!publicHolidaysLoading && !publicHolidaysError && publicHolidays.length === 0 && (
                            <EmptyState
                                icon={Flag}
                                title="Aucun jour férié enregistré"
                                description="Les jours fériés apparaîtront ici une fois configurés."
                            />
                        )}

                        {!publicHolidaysLoading && !publicHolidaysError && publicHolidays.length > 0 && (
                            <div className="space-y-3">
                                {publicHolidays.map((ph) => (
                                    <Card
                                        key={ph.id}
                                        className="border-border bg-card hover:border-primary/40 transition-all duration-200"
                                    >
                                        <CardHeader className="flex flex-row items-center justify-between pb-1">
                                            <CardTitle className="text-sm font-semibold">
                                                {ph.name}
                                            </CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={publicHolidayTypeVariant[ph.type] ?? "outline"}>
                                                    {publicHolidayTypeLabels[ph.type] ?? ph.type}
                                                </Badge>
                                                {ph.isRecurring && (
                                                    <Badge variant="secondary" className="gap-1">
                                                        <Repeat className="h-3 w-3" />
                                                        Récurrent
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0 space-y-1">
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(ph.date)}
                                            </p>
                                            {ph.description && (
                                                <p className="text-xs text-muted-foreground/80">
                                                    {ph.description}
                                                </p>
                                            )}
                                            {ph.school?.name && (
                                                <p className="text-[10px] text-muted-foreground/60">
                                                    {ph.school.name}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </PageGuard>
    );
}
