"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    BookOpen, 
    Layers, 
    PlayCircle, 
    FileText, 
    CheckCircle, 
    Clock, 
    ChevronRight,
    Loader2,
    AlertCircle
} from "lucide-react";
import { Permission } from "@/lib/rbac/permissions";
import { Progress } from "@/components/ui/progress";

type CourseDetail = {
    id: string;
    title: string;
    description?: string;
    thumbnail?: string;
    classSubject: {
        subject: { name: string };
        teacher: { user: { firstName: string; lastName: string } };
    };
    modules: {
        id: string;
        title: string;
        description?: string;
        order: number;
        lessons: {
            id: string;
            title: string;
            type: string;
            duration?: number;
            isCompleted?: boolean;
        }[];
    }[];
    progress?: number;
};

export default function CourseDetailPage() {
    const params = useParams();
    const id = params.id as string;

    const { data: course, error, isLoading } = useSWR<CourseDetail>(
        `/api/courses/${id}`,
        fetcher
    );

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !course) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
                <h3 className="text-xl font-bold">Cours non trouvé</h3>
                <Link href="/dashboard/courses" className="mt-4">
                    <Button variant="outline">Retour à la liste</Button>
                </Link>
            </div>
        );
    }

    const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
    const completedLessons = course.modules.reduce((acc, m) => acc + m.lessons.filter(l => l.isCompleted).length, 0);
    const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return (
        <PageGuard permission={[Permission.CLASS_READ, Permission.SCHEDULE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-8 max-w-5xl mx-auto pb-20">
                <PageHeader
                    title={course.title}
                    description={`${course.classSubject.subject.name} • Par ${course.classSubject.teacher.user.firstName} ${course.classSubject.teacher.user.lastName}`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Cours", href: "/dashboard/courses" },
                        { label: course.title },
                    ]}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content: Syllabus */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>À propos de ce cours</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground leading-relaxed">
                                    {course.description || "Aucune description disponible pour ce cours."}
                                </p>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Layers className="w-5 h-5 text-primary" />
                                Programme du cours
                            </h3>
                            
                            {course.modules.sort((a, b) => a.order - b.order).map((module) => (
                                <Card key={module.id} className="border-border shadow-sm overflow-hidden">
                                    <CardHeader className="bg-muted/30 py-4">
                                        <CardTitle className="text-base">{module.title}</CardTitle>
                                        {module.description && <CardDescription>{module.description}</CardDescription>}
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="divide-y divide-border">
                                            {module.lessons.map((lesson) => (
                                                <Link 
                                                    key={lesson.id} 
                                                    href={`/dashboard/courses/${course.id}/lessons/${lesson.id}`}
                                                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                                                            {lesson.type === "VIDEO" ? <PlayCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                                        </div>
                                                        <span className="text-sm font-medium">{lesson.title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        {lesson.duration && (
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {lesson.duration} min
                                                            </span>
                                                        )}
                                                        {lesson.isCompleted ? (
                                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                                                        )}
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar: Progress & Info */}
                    <div className="space-y-6">
                        <Card className="border-primary/20 bg-primary/5 shadow-md sticky top-6">
                            <CardHeader>
                                <CardTitle className="text-lg">Votre progression</CardTitle>
                                <CardDescription>{completedLessons} sur {totalLessons} leçons terminées</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-bold">
                                        <span>Avancement</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="h-3 shadow-inner" />
                                </div>

                                <Link href={`/dashboard/courses/${course.id}/lessons/${course.modules[0]?.lessons[0]?.id || ""}`}>
                                    <Button className="w-full h-12 text-base font-bold shadow-lg" disabled={totalLessons === 0}>
                                        {progress === 0 ? "Commencer le cours" : progress === 100 ? "Revoir le cours" : "Continuer l'apprentissage"}
                                    </Button>
                                </Link>

                                <div className="pt-4 border-t border-primary/10 space-y-3">
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="p-2 rounded-lg bg-background shadow-sm">
                                            <BookOpen className="w-4 h-4 text-primary" />
                                        </div>
                                        <span className="font-medium">{course.classSubject.subject.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="p-2 rounded-lg bg-background shadow-sm">
                                            <Layers className="w-4 h-4 text-primary" />
                                        </div>
                                        <span className="font-medium">{course.modules.length} Modules</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
