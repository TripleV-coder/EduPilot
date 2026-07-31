"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { useSchool } from "@/components/providers/school-provider";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { t } from "@/lib/i18n";
import { WeeklyTimetableGrid } from "@/components/schedule/weekly-timetable-grid";

import { Button, Card, Icon, type IconName } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading } from "@/components/layout/page-states";

interface ScheduleItem {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string;
    classId: string;
    classSubjectId: string;
    class: { id: string; name: string };
    classSubject?: { teacherId?: string };
}

interface ClassOption {
    id: string;
    name: string;
}
interface TeacherOption {
    id: string;
    user?: { firstName: string; lastName: string };
}

export default function SchedulePage() {
    useSchool();
    const [viewType, setViewType] = useState<"weekly" | "daily">("weekly");
    const [filterType, setFilterType] = useState<"class" | "teacher">("class");
    const [selectedId, setSelectedId] = useState<string>("ALL");

    const { data: schedules, isLoading: loadingSchedules } = useSWR<ScheduleItem[]>(
        "/api/schedules",
        fetcher
    );
    const { data: classesData } = useSWR<ClassOption[] | { data?: ClassOption[] }>(
        "/api/classes",
        fetcher
    );
    const { data: teachersData } = useSWR<TeacherOption[] | { data?: TeacherOption[] }>(
        "/api/teachers",
        fetcher
    );

    const classes: ClassOption[] = Array.isArray(classesData)
        ? classesData
        : classesData?.data ?? [];
    const teachers: TeacherOption[] = Array.isArray(teachersData)
        ? teachersData
        : teachersData?.data ?? [];

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
                        <>
                            <Button variant="ghost" icon="download">
                                {t("common.export")}
                            </Button>
                            <Button icon="plus">Nouvel horaire</Button>
                        </>
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
                                                  {tch.user?.firstName} {tch.user?.lastName}
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
