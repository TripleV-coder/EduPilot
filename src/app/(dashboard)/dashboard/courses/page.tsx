"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { BookOpen, AlertCircle, Layers, ChevronDown, ChevronUp, CheckCircle, Loader2, Plus } from "lucide-react";
import Link from "next/link";

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
    const [courses, setCourses] = useState<CourseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
    const [modules, setModules] = useState<Record<string, ModuleItem[]>>({});
    const [modulesLoading, setModulesLoading] = useState<string | null>(null);
    const [completingLesson, setCompletingLesson] = useState<string | null>(null);

    // Fetch course progress
    const { data: progressData, mutate: mutateProgress } = useSWR<{ progress: CourseProgress[] }>(
        "/api/courses/progress", fetcher
    );
    const progressMap: Record<string, CourseProgress> = {};
    if (progressData?.progress) {
        for (const p of progressData.progress) progressMap[p.courseId] = p;
    }

    const toggleCourse = async (courseId: string) => {
        if (selectedCourseId === courseId) { setSelectedCourseId(null); return; }
        setSelectedCourseId(courseId);
        if (modules[courseId]) return;
        setModulesLoading(courseId);
        try {
            const res = await fetch(`/api/modules?courseId=${courseId}`, { credentials: "include" });
            if (!res.ok) throw new Error();
            const data = await res.json();
            const mods: ModuleItem[] = Array.isArray(data) ? data : data.modules ?? [];
            // Fetch lessons for each module
            const modsWithLessons = await Promise.all(mods.map(async (m) => {
                try {
                    const lr = await fetch(`/api/modules/${m.id}/lessons`, { credentials: "include" });
                    if (!lr.ok) return m;
                    const ld = await lr.json();
                    return { ...m, lessons: Array.isArray(ld) ? ld : ld.lessons ?? [] };
                } catch { return m; }
            }));
            setModules(prev => ({ ...prev, [courseId]: modsWithLessons }));
        } catch { setModules(prev => ({ ...prev, [courseId]: [] })); }
        finally { setModulesLoading(null); }
    };

    const completeLesson = async (lessonId: string, courseId: string) => {
        setCompletingLesson(lessonId);
        try {
            const res = await fetch(`/api/lessons/${lessonId}/complete`, { method: "POST", credentials: "include" });
            if (!res.ok) throw new Error();
            setModules(prev => ({
                ...prev,
                [courseId]: (prev[courseId] ?? []).map(m => ({
                    ...m,
                    lessons: m.lessons?.map(l => l.id === lessonId ? { ...l, isCompleted: true } : l),
                })),
            }));
            mutateProgress(); // refresh progress
        } catch { /* silent */ }
        finally { setCompletingLesson(null); }
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
            .catch((e) => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    return (
        <PageGuard permission={[Permission.CLASS_READ, Permission.SUBJECT_READ, Permission.SCHEDULE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-6">
                <PageHeader
                    title="Mes Cours & Apprentissages"
                    description="Accédez à vos leçons et suivez votre progression"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Cours" },
                    ]}
                    actions={
                        <RoleActionGuard allowedRoles={["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"]}>
                            <Link href="/dashboard/courses/new">
                                <Button className="gap-2">
                                    <Plus className="w-4 h-4" /> Créer un cours
                                </Button>
                            </Link>
                        </RoleActionGuard>
                    }
                />

                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                )}

                {error && (
                    <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && courses.length === 0 && (
                    <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/30">
                        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium text-foreground">Aucun cours créé</h3>
                        <p className="text-sm text-muted-foreground mt-2">Créez votre premier cours pour commencer.</p>
                    </div>
                )}

                {!loading && !error && courses.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {courses.map((course) => (
                            <Card key={course.id} className={`border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer ${selectedCourseId === course.id ? "border-primary ring-1 ring-primary/20 sm:col-span-2 lg:col-span-3" : ""}`} onClick={() => toggleCourse(course.id)}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-semibold text-foreground">{course.title}</CardTitle>
                                        {selectedCourseId === course.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {course.classSubject?.subject?.name ?? "—"} • {course.classSubject?.class?.name ?? "—"}
                                    </p>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                            <Layers className="h-3 w-3" /> {course._count?.modules ?? 0} modules
                                        </span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${course.isPublished ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                                            {course.isPublished ? "Publié" : "Brouillon"}
                                        </span>
                                    </div>
                                    {/* Progress Bar */}
                                    {progressMap[course.id] && (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                <span>{progressMap[course.id].completedLessons}/{progressMap[course.id].totalLessons} leçons</span>
                                                <span className="font-semibold text-foreground">{progressMap[course.id].progress}%</span>
                                            </div>
                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${progressMap[course.id].progress === 100 ? 'bg-emerald-500' :
                                                            progressMap[course.id].progress > 50 ? 'bg-primary' : 'bg-amber-500'
                                                        }`}
                                                    style={{ width: `${progressMap[course.id].progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {selectedCourseId === course.id && (
                                        <div className="border-t border-border pt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                                            {modulesLoading === course.id && (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3 w-3 animate-spin" /> Chargement des modules...</div>
                                            )}
                                            {modules[course.id]?.length === 0 && !modulesLoading && (
                                                <p className="text-xs text-muted-foreground py-2">Aucun module pour ce cours.</p>
                                            )}
                                            {modules[course.id]?.map((mod) => (
                                                <div key={mod.id} className="rounded-md border border-border bg-muted/20 p-2 space-y-1">
                                                    <p className="text-xs font-medium text-foreground">{mod.title}</p>
                                                    {mod.lessons && mod.lessons.length > 0 ? mod.lessons.map((lesson) => (
                                                        <div key={lesson.id} className="flex items-center justify-between pl-3 py-1">
                                                            <span className="text-xs text-muted-foreground">{lesson.title}</span>
                                                            {lesson.isCompleted ? (
                                                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle className="h-3 w-3" /> Terminé</span>
                                                            ) : (
                                                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={completingLesson === lesson.id} onClick={() => completeLesson(lesson.id, course.id)}>
                                                                    {completingLesson === lesson.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Compléter"}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )) : (
                                                        <p className="text-[10px] text-muted-foreground pl-3">Aucune leçon</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </PageGuard>
    );
}
