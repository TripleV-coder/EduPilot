"use client";

type Subject = { id: string; name: string; code: string };
type UserProfile = { firstName: string; lastName: string };
type Teacher = { id: string; user: UserProfile };
type ClassSubject = { id: string; subject: Subject; teacher: Teacher };
type ClassLevel = { id: string; name: string };
type SchoolClass = {
    id: string;
    name: string;
    classLevel: ClassLevel;
    classSubjects: ClassSubject[];
};

type Schedule = {
    id: string;
    dayOfWeek: number; // 1=Monday, 2=Tuesday, etc.
    startTime: string; // "08:00"
    endTime: string; // "09:00"
    room: string;
    classId: string;
    classSubjectId: string;
    class: SchoolClass;
};

interface WeeklyTimetableGridProps {
    schedules: Schedule[];
}

const DAYS = [
    { label: "Lundi", value: 1 },
    { label: "Mardi", value: 2 },
    { label: "Mercredi", value: 3 },
    { label: "Jeudi", value: 4 },
    { label: "Vendredi", value: 5 },
    { label: "Samedi", value: 6 },
];

const HOURS = Array.from({ length: 11 }, (_, i) => i + 7); // 7 to 17

// Fonds opaques : des teintes translucides s'additionnaient quand des créneaux
// se chevauchent, et le texte passait sous 4,5:1 (axe color-contrast).
const SUBJECT_COLORS = [
    "bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100",
    "bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-100",
    "bg-purple-100 border-purple-300 text-purple-900 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-100",
    "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100",
    "bg-rose-100 border-rose-300 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-100",
    "bg-cyan-100 border-cyan-300 text-cyan-900 dark:bg-cyan-950 dark:border-cyan-800 dark:text-cyan-100",
    "bg-indigo-100 border-indigo-300 text-indigo-900 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-100",
    "bg-pink-100 border-pink-300 text-pink-900 dark:bg-pink-950 dark:border-pink-800 dark:text-pink-100",
];

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

function getColorForSubject(subjectName: string): string {
    return SUBJECT_COLORS[hashString(subjectName) % SUBJECT_COLORS.length];
}

const getSubjectInfo = (schedule: Schedule) => {
    const cs = schedule.class?.classSubjects?.find(
        (c) => c.id === schedule.classSubjectId
    );
    if (!cs)
        return { subjectName: "Matière inconnue", teacherName: "Non assigné" };
    return {
        subjectName: cs.subject.name,
        teacherName: `${cs.teacher.user.lastName} ${cs.teacher.user.firstName}`,
    };
};

function parseHour(time: string): number {
    return parseInt(time.split(":")[0], 10);
}

export function WeeklyTimetableGrid({ schedules }: WeeklyTimetableGridProps) {
    // Build a lookup: key = "day-hour" => schedule(s)
    const cellMap = new Map<string, Schedule[]>();
    schedules.forEach((s) => {
        const startHour = parseHour(s.startTime);
        const endHour = parseHour(s.endTime);
        // Fill each hour slot the schedule spans
        for (let h = startHour; h < endHour; h++) {
            const key = `${s.dayOfWeek}-${h}`;
            const existing = cellMap.get(key) || [];
            existing.push(s);
            cellMap.set(key, existing);
        }
    });

    return (
        // Zone défilante horizontale : atteignable au clavier pour faire défiler la semaine.
        <div className="overflow-x-auto rounded-xl border border-border bg-card" tabIndex={0} role="region" aria-label="Grille hebdomadaire de l'emploi du temps">
            <div
                className="grid min-w-[800px]"
                style={{
                    gridTemplateColumns: "80px repeat(6, 1fr)",
                    gridTemplateRows: `48px repeat(${HOURS.length}, 72px)`,
                }}
            >
                {/* Top-left empty corner */}
                <div className="bg-muted/50 border-b border-r border-border" />

                {/* Day headers */}
                {DAYS.map((day) => (
                    <div
                        key={day.value}
                        className="flex items-center justify-center bg-muted/50 border-b border-r border-border text-sm font-semibold text-foreground last:border-r-0"
                    >
                        {day.label}
                    </div>
                ))}

                {/* Rows: one per hour */}
                {HOURS.map((hour) => (
                    <>
                        {/* Time label */}
                        <div
                            key={`label-${hour}`}
                            className="flex items-center justify-center border-b border-r border-border text-xs font-medium text-muted-foreground bg-muted/30"
                        >
                            {String(hour).padStart(2, "0")}:00
                        </div>

                        {/* Day cells for this hour */}
                        {DAYS.map((day) => {
                            const key = `${day.value}-${hour}`;
                            const entries = cellMap.get(key) || [];

                            return (
                                <div
                                    key={key}
                                    className="border-b border-r border-border last:border-r-0 p-0.5"
                                >
                                    {entries.length === 0 ? (
                                        <div className="h-full w-full" />
                                    ) : (
                                        <div className="flex flex-col gap-0.5 h-full">
                                            {entries.map((schedule) => {
                                                const info =
                                                    getSubjectInfo(schedule);
                                                const colorClass =
                                                    getColorForSubject(
                                                        info.subjectName
                                                    );

                                                return (
                                                    <div
                                                        key={schedule.id}
                                                        className={`rounded-md border px-2 py-1 h-full flex flex-col justify-center ${colorClass}`}
                                                    >
                                                        <span className="text-xs font-bold leading-tight truncate">
                                                            {info.subjectName}
                                                        </span>
                                                        <span className="text-[10px] leading-tight truncate opacity-80">
                                                            {schedule.room ||
                                                                "—"}
                                                        </span>
                                                        <span className="text-[10px] leading-tight truncate opacity-70">
                                                            {info.teacherName}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </>
                ))}
            </div>
        </div>
    );
}
