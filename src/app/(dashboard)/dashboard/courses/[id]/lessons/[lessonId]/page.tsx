"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle,
    PlayCircle,
    FileText,
    Download,
    ChevronLeft,
    Loader2,
    AlertCircle
} from "lucide-react";
import { Permission } from "@/lib/rbac/permissions";
import { cn } from "@/lib/utils";

type LessonDetail = {
    id: string;
    title: string;
    content: string;
    type: "TEXT" | "VIDEO" | "PDF" | "QUIZ" | "ASSIGNMENT";
    videoUrl?: string;
    fileUrl?: string;
    duration?: number;
    order: number;
    isCompleted: boolean;
    module: {
        id: string;
        title: string;
        course: {
            id: string;
            title: string;
            classSubject: {
                subject: { name: string };
            };
            modules: {
                id: string;
                title: string;
                lessons: { id: string; title: string; type: string; order: number }[];
            }[];
        };
    };
};

export default function LessonViewerPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const lessonId = params.lessonId as string;

    const { data: lesson, error, isLoading, mutate } = useSWR<LessonDetail>(
        `/api/lessons/${lessonId}`,
        fetcher
    );

    const [completing, setCompleting] = useState(false);

    // Find next and previous lessons
    const allLessons = lesson?.module.course.modules
        .flatMap(m => m.lessons.map(l => ({ ...l, moduleId: m.id })))
        .sort((a, b) => a.order - b.order) || [];

    const currentIndex = allLessons.findIndex(l => l.id === lessonId);
    const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

    const handleComplete = async () => {
        setCompleting(true);
        try {
            const res = await fetch(`/api/lessons/${lessonId}/complete`, {
                method: "POST",
                credentials: "include"
            });
            if (res.ok) {
                mutate();
                if (nextLesson) {
                    router.push(`/dashboard/courses/${id}/lessons/${nextLesson.id}`);
                }
            }
        } catch (err) {
            console.error("Failed to complete lesson", err);
        } finally {
            setCompleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Chargement de votre leçon...</p>
            </div>
        );
    }

    if (error || !lesson) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center px-4">
                <AlertCircle className="h-12 w-12 text-destructive/50" />
                <h3 className="text-xl font-bold">Oups ! Leçon introuvable</h3>
                <p className="text-muted-foreground max-w-md">Nous n&apos;avons pas pu charger le contenu de cette leçon. Il se peut qu&apos;elle n&apos;existe plus ou que vous n&apos;ayez pas les accès nécessaires.</p>
                <Link href={`/dashboard/courses/${id}`}>
                    <Button variant="outline" className="mt-4">Retour au cours</Button>
                </Link>
            </div>
        );
    }

    return (
        <PageGuard permission={[Permission.CLASS_READ, Permission.SCHEDULE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="max-w-5xl mx-auto space-y-6 pb-20">
                {/* Header Navigation */}
                <div className="flex items-center justify-between">
                    <Link href={`/dashboard/courses/${id}`} className="flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Retour au cours
                    </Link>
                    <div className="text-xs font-medium bg-muted px-2 py-1 rounded">
                        {lesson.module.course.classSubject.subject.name}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="space-y-2">
                            <h1 className="text-3xl font-display font-bold tracking-tight">{lesson.title}</h1>
                            <p className="text-muted-foreground font-medium">{lesson.module.title}</p>
                        </div>

                        {/* Video Player */}
                        {lesson.type === "VIDEO" && lesson.videoUrl && (
                            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg border border-border">
                                <iframe
                                    src={lesson.videoUrl.includes("youtube.com") 
                                        ? lesson.videoUrl.replace("watch?v=", "embed/") 
                                        : lesson.videoUrl}
                                    className="w-full h-full"
                                    allowFullScreen
                                    title={lesson.title}
                                />
                            </div>
                        )}

                        {/* Content Body */}
                        <Card className="border-border shadow-sm overflow-hidden">
                            <CardContent className="pt-8 prose prose-slate dark:prose-invert max-w-none">
                                <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
                            </CardContent>
                        </Card>

                        {/* File Downloads */}
                        {lesson.fileUrl && (
                            <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">Ressource complémentaire</p>
                                        <p className="text-xs text-muted-foreground">Document PDF ou support de cours</p>
                                    </div>
                                </div>
                                <a href={lesson.fileUrl} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <Download className="h-4 w-4" />
                                        Télécharger
                                    </Button>
                                </a>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border">
                            {prevLesson ? (
                                <Link href={`/dashboard/courses/${id}/lessons/${prevLesson.id}`} className="w-full sm:w-auto">
                                    <Button variant="ghost" className="w-full sm:w-auto gap-2 group">
                                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                                        <div className="text-left">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Précédent</p>
                                            <p className="text-sm truncate max-w-[150px]">{prevLesson.title}</p>
                                        </div>
                                    </Button>
                                </Link>
                            ) : <div />}

                            {!lesson.isCompleted ? (
                                <Button 
                                    className="w-full sm:w-auto gap-2 h-12 px-8 shadow-md" 
                                    onClick={handleComplete}
                                    disabled={completing}
                                >
                                    {completing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                                    Terminer la leçon
                                </Button>
                            ) : nextLesson ? (
                                <Link href={`/dashboard/courses/${id}/lessons/${nextLesson.id}`} className="w-full sm:w-auto">
                                    <Button className="w-full sm:w-auto gap-2 h-12 px-8 shadow-md" variant="secondary">
                                        Leçon suivante
                                        <ArrowRight className="h-5 w-5" />
                                    </Button>
                                </Link>
                            ) : (
                                <div className="bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    Cours terminé !
                                </div>
                            )}

                            {nextLesson ? (
                                <Link href={`/dashboard/courses/${id}/lessons/${nextLesson.id}`} className="w-full sm:w-auto">
                                    <Button variant="ghost" className="w-full sm:w-auto gap-2 group text-right">
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Suivant</p>
                                            <p className="text-sm truncate max-w-[150px]">{nextLesson.title}</p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </Button>
                                </Link>
                            ) : <div />}
                        </div>
                    </div>

                    {/* Sidebar: Course Outline */}
                    <div className="space-y-4">
                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 bg-muted/50 border-b border-border">
                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Contenu du cours</h3>
                            </div>
                            <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {lesson.module.course.modules.map((m) => (
                                    <div key={m.id} className="space-y-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase px-2 py-2 mt-2">{m.title}</p>
                                        {m.lessons.map((l) => {
                                            const isActive = l.id === lessonId;
                                            return (
                                                <Link 
                                                    key={l.id} 
                                                    href={`/dashboard/courses/${id}/lessons/${l.id}`}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group",
                                                        isActive 
                                                            ? "bg-primary text-primary-foreground font-bold shadow-sm" 
                                                            : "hover:bg-muted text-foreground"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "shrink-0",
                                                        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                                                    )}>
                                                        {l.type === "VIDEO" ? <PlayCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                    </div>
                                                    <span className="truncate flex-1">{l.title}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Progress Summary */}
                        <Card className="border-border shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Votre progression</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex justify-between text-sm font-bold">
                                    <span>Global</span>
                                    <span>{Math.round(((currentIndex + 1) / allLessons.length) * 100)}%</span>
                                </div>
                                <Progress value={((currentIndex + 1) / allLessons.length) * 100} className="h-2" />
                                <p className="text-[10px] text-muted-foreground italic">
                                    {lesson.isCompleted ? "Leçon validée ✓" : "Leçon en cours..."}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
