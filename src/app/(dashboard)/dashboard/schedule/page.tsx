"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { useSchool } from "@/components/providers/school-provider";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { useRBAC } from "@/lib/hooks/use-rbac";
import { WeeklyTimetableGrid } from "@/components/schedule/weekly-timetable-grid";

import { Button, Card, Icon, type IconName } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";

interface ScheduleItem {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string;
    classId: string;
    classSubjectId: string;
    class: { id: string; name: string };
    classSubject?: {
        teacherId?: string;
        teacher?: { id: string; user?: { firstName: string; lastName: string } } | null;
    };
}

export default function SchedulePage() {
    useSchool();
    const [viewType, setViewType] = useState<"weekly" | "daily">("weekly");
    const [filterType, setFilterType] = useState<"class" | "teacher">("class");
    const [selectedId, setSelectedId] = useState<string>("ALL");

    const {
        data: schedules,
        isLoading: loadingSchedules,
        error: schedulesError,
        mutate: reloadSchedules,
    } = useSWR<ScheduleItem[]>("/api/schedules", fetcher);
    const { canAccess } = useRBAC();
    const canCreate = canAccess({ permission: Permission.SCHEDULE_CREATE, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] });

    // Filtres tirés des créneaux visibles : chaque rôle ne voit que ses classes
    // et ses enseignants, sans appeler /api/classes ni /api/teachers (403 pour
    // les élèves et les parents).
    const { classes, teachers } = useMemo(() => {
        const classMap = new Map<string, string>();
        const teacherMap = new Map<string, string>();
        for (const item of schedules ?? []) {
            if (item.class) classMap.set(item.class.id, item.class.name);
            const teacher = item.classSubject?.teacher;
            if (teacher?.user) teacherMap.set(teacher.id, `${teacher.user.firstName} ${teacher.user.lastName}`);
        }
        const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "fr");
        return {
            classes: [...classMap].map(([id, name]) => ({ id, name })).sort(byName),
            teachers: [...teacherMap].map(([id, name]) => ({ id, name })).sort(byName),
        };
    }, [schedules]);

    const filteredSchedules = useMemo(() => {
        if (!schedules) return [];
        if (selectedId === "ALL") return schedules;
        if (filterType === "class") return schedules.filter((s) => s.classId === selectedId);
        return schedules.filter((s) => s.classSubject?.teacherId === selectedId);
    }, [schedules, selectedId, filterType]);

    return (
        <PageGuard
            permission={Permission.SCHEDULE_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <PageShell className="max-w-[1400px] pb-12">
                <PageHeader
                    title="Emploi du temps"
                    description="Planifiez et visualisez l'occupation des salles et des enseignants."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Emploi du temps" },
                    ]}
                    actions={
                        canCreate ? (
                            <Link href="/dashboard/schedule/new">
                                <Button icon="plus">Nouvel horaire</Button>
                            </Link>
                        ) : undefined
                    }
                />

                <Card padding={14}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <SegmentedToggle
                            value={filterType}
                            onChange={(v) => {
                                setFilterType(v);
                                setSelectedId("ALL");
                            }}
                            options={[
                                { value: "class", label: "Par classe", icon: "school" },
                                { value: "teacher", label: "Par enseignant", icon: "users" },
                            ]}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                            <label
                                className="flex h-9 items-center gap-2 px-3"
                                style={{
                                    borderRadius: "var(--eduflow-radius-input)",
                                    border: "1px solid var(--eduflow-border-default)",
                                    background: "var(--eduflow-surface-card)",
                                    minWidth: 220,
                                }}
                            >
                                <Icon name="filter" size={14} color="var(--eduflow-text-tertiary)" />
                                <select
                                    aria-label={filterType === "class" ? "Filtrer par classe" : "Filtrer par enseignant"}
                                    value={selectedId}
                                    onChange={(e) => setSelectedId(e.target.value)}
                                    className="flex-1 bg-transparent outline-none"
                                    style={{
                                        border: 0,
                                        fontFamily: "inherit",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "var(--eduflow-text-primary)",
                                        cursor: "pointer",
                                    }}
                                >
                                    <option value="ALL">
                                        {filterType === "class"
                                            ? "Toutes les classes"
                                            : "Tous les enseignants"}
                                    </option>
                                    {filterType === "class"
                                        ? classes.map((c) => (
                                              <option key={c.id} value={c.id}>
                                                  Classe {c.name}
                                              </option>
                                          ))
                                        : teachers.map((tch) => (
                                              <option key={tch.id} value={tch.id}>
                                                  {tch.name}
                                              </option>
                                          ))}
                                </select>
                            </label>
                            <SegmentedToggle
                                value={viewType}
                                onChange={setViewType}
                                options={[
                                    { value: "weekly", label: "Semaine", icon: "grid" },
                                    { value: "daily", label: "Jour", icon: "calendar" },
                                ]}
                            />
                        </div>
                    </div>
                </Card>

                {loadingSchedules ? (
                    <PageLoading label="Chargement de l'emploi du temps…" />
                ) : schedulesError ? (
                    // Sans ce cas, une panne réseau affichait une grille vide,
                    // impossible à distinguer d'une semaine sans cours.
                    <PageError
                        message="Impossible de charger l'emploi du temps."
                        onRetry={() => void reloadSchedules()}
                    />
                ) : (
                    <Card padding={0} style={{ overflow: "hidden" }}>
                        <WeeklyTimetableGrid
                            schedules={
                                filteredSchedules as unknown as React.ComponentProps<
                                    typeof WeeklyTimetableGrid
                                >["schedules"]
                            }
                        />
                    </Card>
                )}
            </PageShell>
        </PageGuard>
    );
}

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
