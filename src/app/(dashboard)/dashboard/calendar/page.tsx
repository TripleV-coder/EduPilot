"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { addMonths } from "date-fns/addMonths";
import { addDays } from "date-fns/addDays";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { eachDayOfInterval } from "date-fns/eachDayOfInterval";
import { endOfMonth } from "date-fns/endOfMonth";
import { endOfWeek } from "date-fns/endOfWeek";
import { format } from "date-fns/format";
import { isSameDay } from "date-fns/isSameDay";
import { isSameMonth } from "date-fns/isSameMonth";
import { isWithinInterval } from "date-fns/isWithinInterval";
import { parseISO } from "date-fns/parseISO";
import { startOfDay } from "date-fns/startOfDay";
import { startOfMonth } from "date-fns/startOfMonth";
import { startOfWeek } from "date-fns/startOfWeek";
import { fr } from "date-fns/locale/fr";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { formatDateShort } from "@/lib/utils/formatters";

import {
    Badge,
    Button,
    Card,
    Icon,
    Spinner,
    type IconName,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

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

type DotKind = "event" | "holiday" | "public";

interface DotEntry {
    kind: DotKind;
    label: string;
    type?: string;
}

// ── Mappings ─────────────────────────────────────────────────────────────────

const EVENT_TYPE_VARIANT: Record<string, "brand" | "info" | "success" | "warning" | "neutral"> =
    {
        GENERAL: "brand",
        SPORTS: "info",
        CULTURAL: "warning",
        ACADEMIC: "brand",
        HOLIDAY: "warning",
    };

const EVENT_TYPE_LABEL: Record<string, string> = {
    GENERAL: "Général",
    SPORTS: "Sport",
    CULTURAL: "Culturel",
    ACADEMIC: "Académique",
    HOLIDAY: "Fête",
};

const HOLIDAY_LABEL: Record<string, string> = {
    CHRISTMAS: "Noël",
    NEW_YEAR: "Nouvel An",
    EASTER: "Pâques",
    SUMMER: "Été",
    FEBRUARY: "Février",
    SPRING: "Printemps",
    TOUSSAINT: "Toussaint",
    OTHER: "Autre",
};

const PUBLIC_HOLIDAY_LABEL: Record<string, string> = {
    NATIONAL: "National",
    RELIGIOUS: "Religieux",
    INTERNATIONAL: "International",
    LOCAL: "Local",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
    const today = useMemo(() => startOfDay(new Date()), []);
    const [cursor, setCursor] = useState<Date>(startOfMonth(today));
    const [view, setView] = useState<"month" | "events" | "holidays" | "public">(
        "month"
    );

    const {
        data: eventsRaw,
        error: eventsError,
        isLoading: eventsLoading,
    } = useSWR<CalendarEvent[] | { events: CalendarEvent[] }>(
        "/api/calendar/events",
        fetcher
    );
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
    const publicHolidays: PublicHoliday[] = Array.isArray(publicHolidaysRaw)
        ? publicHolidaysRaw
        : [];

    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = useMemo(
        () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
        [gridStart, gridEnd]
    );

    const dotsByDay = useMemo(() => {
        const map = new Map<string, DotEntry[]>();
        const addDot = (day: Date, dot: DotEntry) => {
            const key = format(day, "yyyy-MM-dd");
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(dot);
        };

        // Events
        for (const ev of events) {
            const start = parseISO(ev.startDate);
            const end = ev.endDate ? parseISO(ev.endDate) : start;
            if (Number.isNaN(start.getTime())) continue;
            const span = eachDayOfInterval({ start, end });
            for (const d of span) {
                if (isWithinInterval(d, { start: gridStart, end: gridEnd })) {
                    addDot(d, { kind: "event", label: ev.title, type: ev.type });
                }
            }
        }
        // School holidays
        for (const h of holidays) {
            const start = parseISO(h.startDate);
            const end = parseISO(h.endDate);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
            const span = eachDayOfInterval({ start, end });
            for (const d of span) {
                if (isWithinInterval(d, { start: gridStart, end: gridEnd })) {
                    addDot(d, { kind: "holiday", label: h.name, type: h.type });
                }
            }
        }
        // Public holidays
        for (const ph of publicHolidays) {
            const date = parseISO(ph.date);
            if (Number.isNaN(date.getTime())) continue;
            if (isWithinInterval(date, { start: gridStart, end: gridEnd })) {
                addDot(date, { kind: "public", label: ph.name, type: ph.type });
            }
        }
        return map;
    }, [events, holidays, publicHolidays, gridStart, gridEnd]);

    const upcomingEvents = useMemo(() => {
        return events
            .filter((e) => {
                const d = parseISO(e.startDate);
                return !Number.isNaN(d.getTime()) && d >= today;
            })
            .sort(
                (a, b) =>
                    parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
            )
            .slice(0, 5);
    }, [events, today]);

    const eventCount = events.length;
    const holidayCount = holidays.length;
    const publicHolidayCount = publicHolidays.length;
    const isLoadingAny = eventsLoading || holidaysLoading || publicHolidaysLoading;

    const goPrev = () => setCursor((c) => addMonths(c, -1));
    const goNext = () => setCursor((c) => addMonths(c, 1));
    const goToday = () => setCursor(startOfMonth(today));

    return (
        <PageGuard
            permission={[Permission.CALENDAR_EVENT_READ, Permission.HOLIDAY_READ]}
            roles={[
                "SUPER_ADMIN",
                "SCHOOL_ADMIN",
                "DIRECTOR",
                "TEACHER",
                "STUDENT",
                "PARENT",
            ]}
        >
            <div className="eduflow-scope flex flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        greeting="Calendrier"
                        sub={`${eventCount} évènements · ${holidayCount} vacances scolaires · ${publicHolidayCount} jours fériés`}
                        breadcrumb={["Tableau de bord", "Calendrier"]}
                    />
                    <SegmentedToggle
                        value={view}
                        onChange={setView}
                        options={[
                            { value: "month", label: "Mois", icon: "grid" },
                            { value: "events", label: "Évènements", icon: "calendar" },
                            { value: "holidays", label: "Vacances", icon: "sun" },
                            { value: "public", label: "Fériés", icon: "tag" },
                        ]}
                    />
                </div>

                {view === "month" ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 2.4fr) minmax(0, 1fr)",
                            gap: 16,
                        }}
                        className="dashboard-grid-collapse"
                    >
                        <Card padding={0} style={{ overflow: "hidden" }}>
                            <CalendarHeader
                                cursor={cursor}
                                onPrev={goPrev}
                                onNext={goNext}
                                onToday={goToday}
                            />
                            <WeekdayHeader />
                            <MonthGrid
                                days={days}
                                cursor={cursor}
                                today={today}
                                dotsByDay={dotsByDay}
                            />
                            <CalendarLegend />
                        </Card>

                        <div className="flex flex-col gap-4">
                            <Card padding={20}>
                                <div className="flex items-center gap-2">
                                    <Icon name="sparkle" size={16} color="var(--brand-700)" />
                                    <SubLabel>Aujourd&apos;hui</SubLabel>
                                </div>
                                <div
                                    className="eduflow-display"
                                    style={{
                                        fontSize: 24,
                                        fontWeight: 700,
                                        letterSpacing: "-0.02em",
                                        color: "var(--eduflow-text-primary)",
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {format(today, "EEEE d MMMM", { locale: fr })}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginTop: 4,
                                    }}
                                >
                                    {format(today, "yyyy", { locale: fr })}
                                </div>

                                <div
                                    className="mt-4 border-t pt-3"
                                    style={{ borderColor: "var(--eduflow-border-subtle)" }}
                                >
                                    <SubLabel>Prochains évènements</SubLabel>
                                    {upcomingEvents.length === 0 ? (
                                        <p
                                            style={{
                                                fontSize: 12,
                                                color: "var(--eduflow-text-secondary)",
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            Aucun évènement à venir prochainement.
                                        </p>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {upcomingEvents.map((ev) => (
                                                <UpcomingEventRow
                                                    key={ev.id}
                                                    event={ev}
                                                    today={today}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>

                            {isLoadingAny ? (
                                <Card padding={16}>
                                    <div className="flex items-center gap-3">
                                        <Spinner size={18} color="var(--brand-600)" />
                                        <span
                                            style={{
                                                fontSize: 12,
                                                color: "var(--eduflow-text-secondary)",
                                            }}
                                        >
                                            Chargement du calendrier…
                                        </span>
                                    </div>
                                </Card>
                            ) : null}

                            {eventsError || holidaysError || publicHolidaysError ? (
                                <Card
                                    padding={14}
                                    style={{
                                        borderLeft: "3px solid var(--eduflow-danger-500)",
                                        background: "var(--eduflow-danger-50)",
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon
                                            name="warning"
                                            size={18}
                                            color="var(--eduflow-danger-600)"
                                        />
                                        <p
                                            style={{
                                                margin: 0,
                                                fontSize: 13,
                                                color: "var(--eduflow-danger-800)",
                                            }}
                                        >
                                            Une partie du calendrier n&apos;a pas pu être chargée.
                                        </p>
                                    </div>
                                </Card>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {view === "events" ? (
                    <ListView
                        title="Évènements de l'établissement"
                        loading={eventsLoading}
                        error={eventsError ? "Erreur de chargement des évènements" : null}
                        emptyTitle="Aucun évènement programmé"
                        emptyBody="Les évènements (sportifs, culturels, conseils de classe…) apparaîtront ici une fois créés."
                        emptyIcon="calendar"
                    >
                        {events.length > 0
                            ? events.map((ev) => (
                                  <EventListCard key={ev.id} event={ev} />
                              ))
                            : null}
                    </ListView>
                ) : null}

                {view === "holidays" ? (
                    <ListView
                        title="Vacances scolaires"
                        loading={holidaysLoading}
                        error={holidaysError ? "Erreur de chargement des vacances" : null}
                        emptyTitle="Aucune vacance scolaire"
                        emptyBody="Les périodes de vacances scolaires apparaîtront ici une fois configurées dans les paramètres académiques."
                        emptyIcon="sun"
                    >
                        {holidays.length > 0
                            ? holidays.map((h) => <HolidayListCard key={h.id} holiday={h} />)
                            : null}
                    </ListView>
                ) : null}

                {view === "public" ? (
                    <ListView
                        title="Jours fériés"
                        loading={publicHolidaysLoading}
                        error={publicHolidaysError ? "Erreur de chargement des jours fériés" : null}
                        emptyTitle="Aucun jour férié configuré"
                        emptyBody="Les jours fériés (nationaux, religieux, internationaux) apparaîtront ici."
                        emptyIcon="tag"
                    >
                        {publicHolidays.length > 0
                            ? publicHolidays.map((ph) => (
                                  <PublicHolidayListCard key={ph.id} ph={ph} />
                              ))
                            : null}
                    </ListView>
                ) : null}
            </div>
        </PageGuard>
    );
}

// ── Calendar grid ────────────────────────────────────────────────────────────

function CalendarHeader({
    cursor,
    onPrev,
    onNext,
    onToday,
}: {
    cursor: Date;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
}) {
    return (
        <div
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid var(--eduflow-border-subtle)" }}
        >
            <div className="flex items-center gap-3">
                <h3
                    className="eduflow-display"
                    style={{
                        fontSize: 22,
                        margin: 0,
                        letterSpacing: "-0.02em",
                        textTransform: "capitalize",
                    }}
                >
                    {format(cursor, "MMMM yyyy", { locale: fr })}
                </h3>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onToday}>
                    Aujourd&apos;hui
                </Button>
                <button
                    type="button"
                    onClick={onPrev}
                    aria-label="Mois précédent"
                    className="grid place-items-center"
                    style={{
                        width: 32,
                        height: 32,
                        border: "1px solid var(--eduflow-border-default)",
                        background: "var(--eduflow-surface-card)",
                        borderRadius: "var(--eduflow-radius-md)",
                        cursor: "pointer",
                        color: "var(--eduflow-text-secondary)",
                    }}
                >
                    <Icon
                        name="chevron"
                        size={14}
                        style={{ transform: "rotate(180deg)" }}
                    />
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    aria-label="Mois suivant"
                    className="grid place-items-center"
                    style={{
                        width: 32,
                        height: 32,
                        border: "1px solid var(--eduflow-border-default)",
                        background: "var(--eduflow-surface-card)",
                        borderRadius: "var(--eduflow-radius-md)",
                        cursor: "pointer",
                        color: "var(--eduflow-text-secondary)",
                    }}
                >
                    <Icon name="chevron" size={14} />
                </button>
            </div>
        </div>
    );
}

function WeekdayHeader() {
    const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    return (
        <div
            className="grid"
            style={{
                gridTemplateColumns: "repeat(7, 1fr)",
                background: "var(--eduflow-surface-sunken)",
                borderBottom: "1px solid var(--eduflow-border-subtle)",
            }}
        >
            {days.map((d, i) => (
                <div
                    key={d}
                    className="px-2 py-2 text-center"
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: i >= 5 ? "var(--brand-700)" : "var(--eduflow-text-tertiary)",
                    }}
                >
                    {d}
                </div>
            ))}
        </div>
    );
}

function MonthGrid({
    days,
    cursor,
    today,
    dotsByDay,
}: {
    days: Date[];
    cursor: Date;
    today: Date;
    dotsByDay: Map<string, DotEntry[]>;
}) {
    return (
        <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
        >
            {days.map((day, i) => {
                const inMonth = isSameMonth(day, cursor);
                const isToday = isSameDay(day, today);
                const dots = dotsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const colIndex = i % 7;
                const rowIndex = Math.floor(i / 7);
                return (
                    <div
                        key={day.toISOString()}
                        className="flex flex-col gap-1 p-1.5"
                        style={{
                            minHeight: 96,
                            borderRight:
                                colIndex < 6
                                    ? "1px solid var(--eduflow-border-subtle)"
                                    : "none",
                            borderBottom:
                                rowIndex < 5
                                    ? "1px solid var(--eduflow-border-subtle)"
                                    : "none",
                            background: isToday
                                ? "var(--brand-50)"
                                : !inMonth
                                ? "var(--eduflow-surface-sunken)"
                                : isWeekend
                                ? "var(--eduflow-surface-sunken)"
                                : "var(--eduflow-surface-card)",
                            opacity: !inMonth ? 0.55 : 1,
                            transition:
                                "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                        }}
                    >
                        <div className="flex items-start justify-between">
                            <span
                                className="eduflow-tabular"
                                style={{
                                    display: "inline-grid",
                                    placeItems: "center",
                                    minWidth: 22,
                                    height: 22,
                                    padding: "0 6px",
                                    borderRadius: 11,
                                    fontSize: 12,
                                    fontWeight: isToday ? 700 : 600,
                                    background: isToday
                                        ? "var(--brand-700)"
                                        : "transparent",
                                    color: isToday
                                        ? "var(--eduflow-text-on-brand)"
                                        : !inMonth
                                        ? "var(--eduflow-text-tertiary)"
                                        : "var(--eduflow-text-primary)",
                                }}
                            >
                                {format(day, "d")}
                            </span>
                            {dots.length > 3 ? (
                                <span
                                    className="eduflow-tabular"
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    +{dots.length - 3}
                                </span>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-1">
                            {dots.slice(0, 3).map((dot, idx) => (
                                <DayDot key={`${dot.kind}-${idx}`} dot={dot} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DayDot({ dot }: { dot: DotEntry }) {
    const variant = pickDotVariant(dot);
    return (
        <span
            className="block truncate"
            title={dot.label}
            style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 6,
                background: variant.bg,
                color: variant.fg,
                lineHeight: 1.3,
                borderLeft: `2px solid ${variant.border}`,
            }}
        >
            {dot.label}
        </span>
    );
}

function pickDotVariant(dot: DotEntry): {
    bg: string;
    fg: string;
    border: string;
} {
    if (dot.kind === "public") {
        return {
            bg: "var(--eduflow-success-50)",
            fg: "var(--eduflow-success-800)",
            border: "var(--eduflow-success-600)",
        };
    }
    if (dot.kind === "holiday") {
        return {
            bg: "var(--eduflow-warning-50)",
            fg: "var(--eduflow-warning-800)",
            border: "var(--eduflow-warning-600)",
        };
    }
    // Event — color by type if known
    const type = dot.type ? EVENT_TYPE_VARIANT[dot.type] ?? "brand" : "brand";
    if (type === "info") {
        return {
            bg: "var(--eduflow-info-50)",
            fg: "var(--eduflow-info-800)",
            border: "var(--eduflow-info-600)",
        };
    }
    if (type === "success") {
        return {
            bg: "var(--eduflow-success-50)",
            fg: "var(--eduflow-success-800)",
            border: "var(--eduflow-success-600)",
        };
    }
    if (type === "warning") {
        return {
            bg: "var(--eduflow-warning-50)",
            fg: "var(--eduflow-warning-800)",
            border: "var(--eduflow-warning-600)",
        };
    }
    return {
        bg: "var(--brand-50)",
        fg: "var(--brand-800)",
        border: "var(--brand-600)",
    };
}

function CalendarLegend() {
    const items = [
        { label: "Évènement", color: "var(--brand-600)" },
        { label: "Vacances", color: "var(--eduflow-warning-600)" },
        { label: "Férié", color: "var(--eduflow-success-600)" },
        { label: "Aujourd'hui", color: "var(--brand-700)" },
    ];
    return (
        <div
            className="flex flex-wrap items-center gap-4 px-5 py-3"
            style={{ borderTop: "1px solid var(--eduflow-border-subtle)" }}
        >
            {items.map((it) => (
                <span
                    key={it.label}
                    className="flex items-center gap-1.5"
                    style={{ fontSize: 11, color: "var(--eduflow-text-secondary)" }}
                >
                    <span
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: it.color,
                        }}
                    />
                    {it.label}
                </span>
            ))}
        </div>
    );
}

// ── Right column upcoming events ────────────────────────────────────────────

function UpcomingEventRow({
    event,
    today,
}: {
    event: CalendarEvent;
    today: Date;
}) {
    const start = parseISO(event.startDate);
    const inDays = differenceInCalendarDays(start, today);
    const variant: "brand" | "info" | "success" | "warning" | "neutral" =
        event.type ? EVENT_TYPE_VARIANT[event.type] ?? "brand" : "brand";
    const labelInDays =
        inDays === 0
            ? "Aujourd'hui"
            : inDays === 1
            ? "Demain"
            : inDays < 7
            ? `Dans ${inDays} j.`
            : format(start, "EEE d MMM", { locale: fr });

    return (
        <div className="flex items-start gap-3">
            <div
                className="grid place-items-center"
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: variant === "brand" ? "var(--brand-50)" : `var(--eduflow-${variant}-50)`,
                    color: variant === "brand" ? "var(--brand-700)" : `var(--eduflow-${variant}-700)`,
                    flexShrink: 0,
                }}
            >
                <span
                    className="eduflow-display eduflow-tabular"
                    style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}
                >
                    {format(start, "d", { locale: fr })}
                </span>
            </div>
            <div className="min-w-0 flex-1">
                <div
                    className="truncate"
                    style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--eduflow-text-primary)",
                    }}
                >
                    {event.title}
                </div>
                <div
                    className="mt-0.5 flex flex-wrap items-center gap-2"
                    style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}
                >
                    <span style={{ textTransform: "capitalize" }}>{labelInDays}</span>
                    {event.location ? (
                        <span className="flex items-center gap-1">
                            <Icon name="school" size={11} /> {event.location}
                        </span>
                    ) : null}
                </div>
            </div>
            {event.type ? (
                <Badge variant={variant} size="sm">
                    {EVENT_TYPE_LABEL[event.type] ?? event.type}
                </Badge>
            ) : null}
        </div>
    );
}

// ── List view shells ────────────────────────────────────────────────────────

function ListView({
    title,
    loading,
    error,
    emptyTitle,
    emptyBody,
    emptyIcon,
    children,
}: {
    title: string;
    loading: boolean;
    error: string | null;
    emptyTitle: string;
    emptyBody: string;
    emptyIcon: IconName;
    children?: React.ReactNode;
}) {
    const isEmpty = !loading && !error && (!children || (Array.isArray(children) && !children.length));
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <Icon name={emptyIcon} size={18} color="var(--brand-700)" />
                <h2
                    className="eduflow-display"
                    style={{ fontSize: 20, margin: 0, letterSpacing: "-0.02em" }}
                >
                    {title}
                </h2>
            </div>

            {loading ? (
                <Card padding={20}>
                    <div className="flex items-center gap-3">
                        <Spinner size={20} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Chargement…
                        </span>
                    </div>
                </Card>
            ) : null}

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
                            {error}
                        </p>
                    </div>
                </Card>
            ) : null}

            {isEmpty ? (
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
                            <Icon name={emptyIcon} size={26} color="var(--brand-700)" />
                        </div>
                        <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                            {emptyTitle}
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
                            {emptyBody}
                        </p>
                    </div>
                </Card>
            ) : null}

            {!loading && !error ? (
                <div className="flex flex-col gap-2">{children}</div>
            ) : null}
        </div>
    );
}

function EventListCard({ event }: { event: CalendarEvent }) {
    const variant: "brand" | "info" | "success" | "warning" | "neutral" =
        event.type ? EVENT_TYPE_VARIANT[event.type] ?? "brand" : "brand";
    return (
        <Card padding={16}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--eduflow-text-primary)",
                            lineHeight: 1.25,
                        }}
                    >
                        {event.title}
                    </div>
                    <div
                        className="mt-1 flex flex-wrap items-center gap-3"
                        style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}
                    >
                        <span className="flex items-center gap-1.5">
                            <Icon name="calendar" size={12} />
                            {formatDateShort(event.startDate)}
                            {event.endDate ? ` → ${formatDateShort(event.endDate)}` : ""}
                        </span>
                        {event.location ? (
                            <span className="flex items-center gap-1.5">
                                <Icon name="school" size={12} />
                                {event.location}
                            </span>
                        ) : null}
                    </div>
                </div>
                {event.type ? (
                    <Badge variant={variant} size="sm">
                        {EVENT_TYPE_LABEL[event.type] ?? event.type}
                    </Badge>
                ) : null}
            </div>
        </Card>
    );
}

function HolidayListCard({ holiday }: { holiday: SchoolHoliday }) {
    const start = parseISO(holiday.startDate);
    const end = parseISO(holiday.endDate);
    const days = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
        ? differenceInCalendarDays(addDays(end, 1), start)
        : null;
    return (
        <Card padding={16}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--eduflow-text-primary)",
                            lineHeight: 1.25,
                        }}
                    >
                        {holiday.name}
                    </div>
                    <div
                        className="mt-1 flex flex-wrap items-center gap-3"
                        style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}
                    >
                        <span className="flex items-center gap-1.5">
                            <Icon name="calendar" size={12} />
                            {formatDateShort(holiday.startDate)} →{" "}
                            {formatDateShort(holiday.endDate)}
                        </span>
                        {days ? (
                            <span
                                className="eduflow-tabular"
                                style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}
                            >
                                {days} j.
                            </span>
                        ) : null}
                    </div>
                    {holiday.description ? (
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-tertiary)",
                                marginTop: 6,
                                lineHeight: 1.5,
                            }}
                        >
                            {holiday.description}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Badge variant="warning" size="sm" icon="sun">
                        {HOLIDAY_LABEL[holiday.type] ?? holiday.type}
                    </Badge>
                    {holiday.academicYear?.name ? (
                        <span style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}>
                            {holiday.academicYear.name}
                        </span>
                    ) : null}
                </div>
            </div>
        </Card>
    );
}

function PublicHolidayListCard({ ph }: { ph: PublicHoliday }) {
    return (
        <Card padding={16}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--eduflow-text-primary)",
                            lineHeight: 1.25,
                        }}
                    >
                        {ph.name}
                    </div>
                    <div
                        className="mt-1 flex flex-wrap items-center gap-3"
                        style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}
                    >
                        <span className="flex items-center gap-1.5">
                            <Icon name="calendar" size={12} />
                            {formatDateShort(ph.date)}
                        </span>
                        {ph.school?.name ? (
                            <span className="flex items-center gap-1.5">
                                <Icon name="school" size={12} />
                                {ph.school.name}
                            </span>
                        ) : null}
                    </div>
                    {ph.description ? (
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-tertiary)",
                                marginTop: 6,
                                lineHeight: 1.5,
                            }}
                        >
                            {ph.description}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Badge variant="success" size="sm" icon="tag">
                        {PUBLIC_HOLIDAY_LABEL[ph.type] ?? ph.type}
                    </Badge>
                    {ph.isRecurring ? (
                        <Badge variant="neutral" size="sm">
                            Récurrent
                        </Badge>
                    ) : null}
                </div>
            </div>
        </Card>
    );
}

// ── Shared ──────────────────────────────────────────────────────────────────

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
