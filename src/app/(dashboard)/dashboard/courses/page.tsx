"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { Permission } from "@/lib/rbac/permissions";
import { trackUxEvent } from "@/lib/ux/telemetry";

import { Badge, Button, Card, Icon, Spinner } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

type CourseProgress = {
    courseId: string;
    courseTitle: string;
    totalLessons: number;
    completedLessons: number;
    progress: number;
};

type LessonItem = { id: string; title: string; order?: number; isCompleted?: boolean };
type ModuleItem = { id: string; title: string; order?: number; lessons?: LessonItem[] };
type CourseItem = {
    id: string;
    title: string;
    isPublished: boolean;
    classSubject?: { subject?: { name: string }; class?: { name: string } };
    _count?: { modules: number };
};

export default function CoursesPage() {
    const { data: session } = useSession();
    const [courses, setCourses] = useState<CourseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
    const [modules, setModules] = useState<Record<string, ModuleItem[]>>({});
    const [modulesLoading, setModulesLoading] = useState<string | null>(null);
    const [completingLesson, setCompletingLesson] = useState<string | null>(null);
    const canCreateCourse = ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"].includes(
        session?.user?.role || ""
    );

    const { data: progressData, mutate: mutateProgress } = useSWR<{ progress: CourseProgress[] }>(
        "/api/courses/progress",
        fetcher
    );
    const progressMap: Record<string, CourseProgress> = {};
    if (progressData?.progress) {
        for (const p of progressData.progress) progressMap[p.courseId] = p;
    }

    const toggleCourse = async (courseId: string) => {
        if (selectedCourseId === courseId) {
            setSelectedCourseId(null);
            return;
        }
        setSelectedCourseId(courseId);
        if (modules[courseId]) return;
        setModulesLoading(courseId);
        try {
            const res = await fetch(`/api/modules?courseId=${courseId}`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            const mods: ModuleItem[] = Array.isArray(data) ? data : data.modules ?? [];
            const modsWithLessons = await Promise.all(
                mods.map(async (m) => {
                    try {
                        const lr = await fetch(`/api/modules/${m.id}/lessons`, {
                            credentials: "include",
                        });
                        if (!lr.ok) return m;
                        const ld = await lr.json();
                        return { ...m, lessons: Array.isArray(ld) ? ld : ld.lessons ?? [] };
                    } catch {
                        return m;
                    }
                })
            );
            setModules((prev) => ({ ...prev, [courseId]: modsWithLessons }));
        } catch {
            setModules((prev) => ({ ...prev, [courseId]: [] }));
        } finally {
            setModulesLoading(null);
        }
    };

    const completeLesson = async (lessonId: string, courseId: string) => {
        setCompletingLesson(lessonId);
        try {
            const res = await fetch(`/api/lessons/${lessonId}/complete`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) throw new Error();
            setModules((prev) => ({
                ...prev,
                [courseId]: (prev[courseId] ?? []).map((m) => ({
                    ...m,
                    lessons: m.lessons?.map((l) =>
                        l.id === lessonId ? { ...l, isCompleted: true } : l
                    ),
                })),
            }));
            mutateProgress();
            trackUxEvent("lesson_completed", { lessonId, courseId });
        } catch {
            // silent
        } finally {
            setCompletingLesson(null);
        }
    };

    useEffect(() => {
        let cancelled = false;
        fetch("/api/courses", { credentials: "include" })
            .then((r) => {
                if (!r.ok) throw new Error("Erreur de chargement des cours");
                return r.json();
            })
            .then((data) => {
                if (!cancelled) setCourses(Array.isArray(data) ? data : data.courses ?? []);
            })
            .catch((e) => {
                if (!cancelled) setError(e.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <PageGuard
            permission={[
                Permission.CLASS_READ,
                Permission.SUBJECT_READ,
                Permission.SCHEDULE_READ,
            ]}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <PageShell>
                <PageHeader
                    title="Mes cours et apprentissages"
                    description={`${courses.length} ${
                        courses.length > 1 ? "cours actifs" : "cours actif"
                    } · suivez la progression module par module`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Cours" },
                    ]}
                    actions={
                        <RoleActionGuard
                            allowedRoles={["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"]}
                        >
                            <Link href="/dashboard/courses/new">
                                <Button icon="plus">Créer un cours</Button>
                            </Link>
                        </RoleActionGuard>
                    }
                />

                {loading ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {Array.from({ length: 6 }).map((_, idx) => (
                            <Card key={idx} padding={20}>
                                <div className="flex flex-col gap-3">
                                    <div
                                        style={{
                                            height: 16,
                                            width: "65%",
                                            background: "var(--eduflow-surface-sunken)",
                                            borderRadius: 4,
                                        }}
                                    />
                                    <div
                                        style={{
                                            height: 10,
                                            width: "40%",
                                            background: "var(--eduflow-surface-sunken)",
                                            borderRadius: 4,
                                        }}
                                    />
                                    <div
                                        style={{
                                            height: 4,
                                            width: "100%",
                                            background: "var(--eduflow-surface-sunken)",
                                            borderRadius: 2,
                                            marginTop: 8,
                                        }}
                                    />
                                </div>
                            </Card>
                        ))}
                    </div>
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

                {!loading && !error && courses.length === 0 ? (
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
                                <Icon name="book" size={26} color="var(--brand-700)" />
                            </div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Aucun cours créé
                            </h3>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--eduflow-text-secondary)",
                                    margin: 0,
                                    maxWidth: 480,
                                }}
                            >
                                Crée ton premier cours pour structurer l&apos;apprentissage en
                                modules et leçons.
                            </p>
                            {canCreateCourse ? (
                                <Link href="/dashboard/courses/new">
                                    <Button icon="plus">Créer un cours</Button>
                                </Link>
                            ) : null}
                        </div>
                    </Card>
                ) : null}

                {!loading && !error && courses.length > 0 ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {courses.map((course) => {
                            const progress = progressMap[course.id];
                            const expanded = selectedCourseId === course.id;
                            return (
                                <Card
                                    key={course.id}
                                    padding={0}
                                    style={{
                                        gridColumn: expanded ? "1 / -1" : undefined,
                                        cursor: "pointer",
                                        border: expanded
                                            ? "2px solid var(--brand-500)"
                                            : undefined,
                                        transition:
                                            "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                    }}
                                    onClick={() => toggleCourse(course.id)}
                                    className="hover:shadow-eduflow-card-brand"
                                >
                                    <div className="px-5 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <h3
                                                    className="eduflow-display"
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 16,
                                                        fontWeight: 700,
                                                        color: "var(--eduflow-text-primary)",
                                                        lineHeight: 1.25,
                                                    }}
                                                >
                                                    {course.title}
                                                </h3>
                                                <p
                                                    style={{
                                                        margin: "4px 0 0",
                                                        fontSize: 11,
                                                        color: "var(--eduflow-text-tertiary)",
                                                    }}
                                                >
                                                    {course.classSubject?.subject?.name ?? "—"} ·{" "}
                                                    {course.classSubject?.class?.name ?? "—"}
                                                </p>
                                            </div>
                                            <Icon
                                                name="chevronDown"
                                                size={16}
                                                color="var(--eduflow-text-tertiary)"
                                                style={{
                                                    transform: expanded
                                                        ? "rotate(180deg)"
                                                        : "rotate(0deg)",
                                                    transition:
                                                        "transform var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                                }}
                                            />
                                        </div>

                                        <div className="mt-3 flex items-center justify-between">
                                            <span
                                                className="flex items-center gap-1.5"
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                <Icon name="cards" size={12} />
                                                {course._count?.modules ?? 0} modules
                                            </span>
                                            {course.isPublished ? (
                                                <Badge variant="success" size="sm" dot>
                                                    Publié
                                                </Badge>
                                            ) : (
                                                <Badge variant="neutral" size="sm">
                                                    Brouillon
                                                </Badge>
                                            )}
                                        </div>

                                        {progress ? (
                                            <div className="mt-3">
                                                <div
                                                    className="flex items-center justify-between"
                                                    style={{
                                                        fontSize: 10,
                                                        color: "var(--eduflow-text-tertiary)",
                                                    }}
                                                >
                                                    <span className="eduflow-tabular">
                                                        {progress.completedLessons}/
                                                        {progress.totalLessons} leçons
                                                    </span>
                                                    <span
                                                        className="eduflow-tabular"
                                                        style={{
                                                            fontWeight: 700,
                                                            color: "var(--eduflow-text-primary)",
                                                        }}
                                                    >
                                                        {progress.progress}%
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        height: 6,
                                                        background:
                                                            "var(--eduflow-neutral-200)",
                                                        borderRadius: 3,
                                                        overflow: "hidden",
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            height: "100%",
                                                            width: `${progress.progress}%`,
                                                            background:
                                                                progress.progress === 100
                                                                    ? "var(--eduflow-success-500)"
                                                                    : progress.progress > 50
                                                                    ? "var(--brand-600)"
                                                                    : "var(--eduflow-warning-500)",
                                                            transition:
                                                                "width var(--eduflow-motion-base) var(--eduflow-ease-out)",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    {expanded ? (
                                        <div
                                            className="border-t px-5 py-4"
                                            style={{
                                                borderColor: "var(--eduflow-border-subtle)",
                                                background: "var(--eduflow-surface-sunken)",
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {modulesLoading === course.id ? (
                                                <div className="flex items-center gap-2 py-2">
                                                    <Spinner size={14} color="var(--brand-600)" />
                                                    <span
                                                        style={{
                                                            fontSize: 12,
                                                            color: "var(--eduflow-text-secondary)",
                                                        }}
                                                    >
                                                        Chargement des modules…
                                                    </span>
                                                </div>
                                            ) : modules[course.id]?.length === 0 ? (
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 12,
                                                        color: "var(--eduflow-text-tertiary)",
                                                    }}
                                                >
                                                    Aucun module pour ce cours.
                                                </p>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    {modules[course.id]?.map((mod) => (
                                                        <div
                                                            key={mod.id}
                                                            style={{
                                                                padding: 10,
                                                                background:
                                                                    "var(--eduflow-surface-card)",
                                                                borderRadius:
                                                                    "var(--eduflow-radius-md)",
                                                                border:
                                                                    "1px solid var(--eduflow-border-subtle)",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    fontSize: 12,
                                                                    fontWeight: 700,
                                                                    color:
                                                                        "var(--eduflow-text-primary)",
                                                                }}
                                                            >
                                                                {mod.title}
                                                            </div>
                                                            <div className="mt-1 flex flex-col gap-0.5">
                                                                {mod.lessons &&
                                                                mod.lessons.length > 0 ? (
                                                                    mod.lessons.map((lesson) => (
                                                                        <div
                                                                            key={lesson.id}
                                                                            className="flex items-center justify-between py-1.5"
                                                                        >
                                                                            <span
                                                                                style={{
                                                                                    fontSize: 12,
                                                                                    color:
                                                                                        "var(--eduflow-text-secondary)",
                                                                                }}
                                                                            >
                                                                                {lesson.title}
                                                                            </span>
                                                                            {lesson.isCompleted ? (
                                                                                <Badge
                                                                                    variant="success"
                                                                                    size="sm"
                                                                                    icon="check"
                                                                                >
                                                                                    Terminé
                                                                                </Badge>
                                                                            ) : (
                                                                                <Button
                                                                                    variant="secondary"
                                                                                    size="sm"
                                                                                    loading={
                                                                                        completingLesson ===
                                                                                        lesson.id
                                                                                    }
                                                                                    disabled={
                                                                                        completingLesson ===
                                                                                        lesson.id
                                                                                    }
                                                                                    onClick={() =>
                                                                                        completeLesson(
                                                                                            lesson.id,
                                                                                            course.id
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    Compléter
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <p
                                                                        style={{
                                                                            margin: "4px 0 0",
                                                                            fontSize: 11,
                                                                            color:
                                                                                "var(--eduflow-text-tertiary)",
                                                                        }}
                                                                    >
                                                                        Aucune leçon
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </Card>
                            );
                        })}
                    </div>
                ) : null}
            </PageShell>
        </PageGuard>
    );
}
