"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Permission } from "@/lib/rbac/permissions";
import { BookOpen, Users, AlertCircle, CheckCircle, Plus, Trash2, GraduationCap, Clock } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PerformanceBarChart } from "@/components/charts/PerformanceBarChart";
import { SubjectRadarChart } from "@/components/charts/SubjectRadarChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { Calendar, BarChart3, Target, Upload } from "lucide-react";
import { t } from "@/lib/i18n";

type ClassData = {
    id: string;
    name: string;
    classLevel: { name: string, level: string };
    _count: { enrollments: number };
};

type ClassSubject = {
    id: string;
    coefficient: number;
    weeklyHours: number | null;
    subject: { id: string, name: string, code: string };
    teacher?: { id: string, user: { firstName: string, lastName: string } } | null;
};

type Teacher = { id: string, user: { firstName: string, lastName: string } };
type Subject = { id: string, name: string, code: string, coefficient: number };

export default function ClassDetailsPage() {
    const params = useParams();
    const classId = params.id as string;

    const [classData, setClassData] = useState<ClassData | null>(null);
    const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
    const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
    const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [isAssigning, setIsAssigning] = useState(false);
    const [assigningLoading, setAssigningLoading] = useState(false);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

    const { data: schedules } = useSWR(classId ? `/api/schedules?classId=${classId}` : null, fetcher);
    const { data: classStats } = useSWR(classId ? `/api/analytics/class/${classId}` : null, fetcher);
    const { data: subjectStats } = useSWR(
      classId && selectedSubjectId ? `/api/analytics/class/${classId}/subject/${selectedSubjectId}` : null, fetcher
    );

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch class info
                const classRes = await fetch(`/api/classes/${classId}`);
                if (!classRes.ok) throw new Error("Erreur lors du chargement de la classe");
                const classJson = await classRes.json();
                setClassData(classJson);

                // Fetch current assigned subjects
                const subjectsRes = await fetch(`/api/class-subjects?classId=${classId}`);
                const subjectsJson = await subjectsRes.json();
                setClassSubjects(Array.isArray(subjectsJson) ? subjectsJson : []);

                // Fetch globals
                const [teachersRes, allSubjectsRes] = await Promise.all([
                    fetch("/api/teachers?limit=100"),
                    fetch("/api/subjects")
                ]);

                if (teachersRes.ok) {
                    const t = await teachersRes.json();
                    setAvailableTeachers(Array.isArray(t) ? t : t.teachers || []);
                }

                if (allSubjectsRes.ok) {
                    const s = await allSubjectsRes.json();
                    setAvailableSubjects(Array.isArray(s) ? s : s.data || []);
                }

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (classId) fetchData();
    }, [classId]);

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    const handleAssignSubject = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setAssigningLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const subjectId = formData.get("subjectId") as string;

        // Use default coefficient from the selected subject if not provided
        const selectedSubject = availableSubjects.find(s => s.id === subjectId);
        const defaultCoef = selectedSubject?.coefficient || 1;

        const payload = {
            classId,
            subjectId,
            teacherId: formData.get("teacherId") || undefined,
            coefficient: parseFloat(formData.get("coefficient") as string || defaultCoef.toString()),
            weeklyHours: formData.get("weeklyHours") ? parseFloat(formData.get("weeklyHours") as string) : undefined,
        };

        try {
            const res = await fetch("/api/class-subjects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erreur d'assignation");
            }

            const newAssignment = await res.json();
            setClassSubjects(prev => [...prev, newAssignment]);
            setIsAssigning(false);
            showSuccess("Matière assignée avec succès");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setAssigningLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!classData && !loading) {
        return (
            <div className="text-center py-20">
                <h2 className="text-xl font-bold text-destructive">Classe introuvable</h2>
                <Link href="/dashboard/classes" className="text-primary mt-4 inline-block hover:underline">
                    Retour aux classes
                </Link>
            </div>
        );
    }

    return (
        <PageGuard permission={Permission.CLASS_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <div className="space-y-6 max-w-6xl mx-auto">
                <PageHeader
                    title={`Classe : ${classData?.name}`}
                    description={`Niveau : ${classData?.classLevel?.name} | ${classData?._count?.enrollments || 0} Élèves inscrits`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Classes", href: "/dashboard/classes" },
                        { label: classData?.name || "Détails" },
                    ]}
                />

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

                <Tabs defaultValue="subjects" className="space-y-6">
                    <TabsList className="bg-muted/50 p-1 border border-border">
                        <TabsTrigger value="subjects" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            Matières & Professeurs
                        </TabsTrigger>
                        <TabsTrigger value="students" className="gap-2">
                            <Users className="h-4 w-4" />
                            Élèves ({classData?._count?.enrollments || 0})
                        </TabsTrigger>
                        <TabsTrigger value="schedule" className="gap-2">
                            <Calendar className="h-4 w-4" />
                            Emploi du Temps
                        </TabsTrigger>
                        <TabsTrigger value="performance" className="gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Performances
                        </TabsTrigger>
                        <TabsTrigger value="subjects-tracking" className="gap-2">
                            <Target className="h-4 w-4" />
                            Suivi par Matière
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="subjects" className="space-y-6">
                        <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                    <BookOpen className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-lg">Répartition des Matières</h2>
                                    <p className="text-sm text-muted-foreground">Assignez les professeurs et les volumes horaires pour cette classe.</p>
                                </div>
                            </div>
                            {!isAssigning && (
                                <Button onClick={() => setIsAssigning(true)} className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Assigner une matière
                                </Button>
                            )}
                        </div>

                        {isAssigning && (
                            <Card className="border-primary/20 bg-primary/5 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Nouvelle Assignation</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleAssignSubject} className="space-y-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="subjectId">Matière <span className="text-destructive">*</span></Label>
                                                <select id="subjectId" name="subjectId" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                                                    <option value="">Sélectionner une matière...</option>
                                                    {availableSubjects.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="teacherId">Professeur</Label>
                                                <select id="teacherId" name="teacherId" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                                                    <option value="">Aucun (À définir)</option>
                                                    {availableTeachers.map(t => (
                                                        <option key={t.id} value={t.id}>{t.user?.firstName} {t.user?.lastName}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="coefficient">Coefficient (Optionnel)</Label>
                                                <Input id="coefficient" name="coefficient" type="number" step="0.5" min="0.5" max="10" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="weeklyHours">Volume Horaire (Heures/Semaine)</Label>
                                                <Input id="weeklyHours" name="weeklyHours" type="number" step="0.5" min="0.5" max="20" />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-3 pt-2">
                                            <Button type="button" variant="outline" onClick={() => setIsAssigning(false)}>{t("common.cancel")}</Button>
                                            <Button type="submit" disabled={assigningLoading} className="gap-2">
                                                {assigningLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2" /> : <CheckCircle className="h-4 w-4" />}
                                                Assigner
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid gap-4">
                            {classSubjects.length === 0 ? (
                                <div className="text-center py-16 border border-dashed rounded-xl bg-muted/30">
                                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                    <h3 className="text-lg font-medium">Aucune matière assignée</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Commencez par assigner les matières pour cette classe.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {classSubjects.map((cs) => (
                                        <Card key={cs.id} className="border-border bg-card hover:shadow-sm transition-all group">
                                            <CardContent className="p-5 flex flex-col justify-between h-full">
                                                <div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="font-bold text-base line-clamp-1" title={cs.subject?.name}>{cs.subject?.name}</h3>
                                                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">{cs.subject?.code}</span>
                                                    </div>

                                                    <div className="flex items-center gap-2 mb-4">
                                                        <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                                                            <GraduationCap className="h-4 w-4 text-secondary" />
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <p className="text-sm font-medium truncate">
                                                                {cs.teacher ? `${cs.teacher.user?.firstName} ${cs.teacher.user?.lastName}` : <span className="text-destructive/80 italic text-xs">Professeur non assigné</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center pt-3 border-t border-border/50 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-semibold text-foreground">Coef {cs.coefficient}</span>
                                                    </div>
                                                    {cs.weeklyHours && (
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" /> {cs.weeklyHours}h/sem.
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="students">
                        <Card className="border-dashed border-2 shadow-none bg-muted/10">
                            <CardContent className="py-20 text-center">
                                <Users className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                <h3 className="text-lg font-medium">Liste des Élèves</h3>
                                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                                    Les élèves inscrits apparaîtront ici. Pour inscrire un élève, rendez-vous dans le module Inscriptions ou Importation.
                                </p>
                                <div className="mt-6 flex justify-center gap-4">
                                    <Link href="/dashboard/students/new">
                                        <Button variant="outline">Inscrire un élève</Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="schedule" className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Emploi du Temps</h2>
                            <a href="/dashboard/import">
                                <Button variant="outline" className="gap-2">
                                    <Upload className="h-4 w-4" />
                                    {t("common.import")}
                                </Button>
                            </a>
                        </div>

                        {schedules && Array.isArray(schedules) && schedules.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                {[
                                    { day: 1, label: "Lundi" },
                                    { day: 2, label: "Mardi" },
                                    { day: 3, label: "Mercredi" },
                                    { day: 4, label: "Jeudi" },
                                    { day: 5, label: "Vendredi" },
                                    { day: 6, label: "Samedi" },
                                ].map(({ day, label }) => {
                                    const daySchedules = schedules.filter((s: any) => s.dayOfWeek === day)
                                        .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
                                    return (
                                        <Card key={day}>
                                            <CardHeader className="py-3 px-4">
                                                <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="px-4 pb-4 space-y-2">
                                                {daySchedules.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">Aucun cours</p>
                                                ) : (
                                                    daySchedules.map((s: any) => (
                                                        <div key={s.id} className="p-2 rounded-md bg-primary/5 border border-primary/10 text-xs">
                                                            <div className="font-semibold">{s.classSubject?.subject?.name || "—"}</div>
                                                            <div className="text-muted-foreground">{s.startTime} - {s.endTime}</div>
                                                            {s.room && <div className="text-muted-foreground">Salle: {s.room}</div>}
                                                        </div>
                                                    ))
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <Card className="border-dashed border-2">
                                <CardContent className="py-16 text-center">
                                    <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                    <h3 className="text-lg font-medium">Aucun emploi du temps</h3>
                                    <p className="text-sm text-muted-foreground mt-2">Importez l&apos;emploi du temps depuis le module d&apos;import.</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="performance" className="space-y-6">
                        {classStats ? (
                            <>
                                {/* KPIs */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Moyenne de la classe</CardTitle></CardHeader>
                                        <CardContent><div className="text-2xl font-bold">{classStats.averageGrade?.toFixed(1) ?? "—"}/20</div></CardContent></Card>
                                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Nombre d&apos;élèves</CardTitle></CardHeader>
                                        <CardContent><div className="text-2xl font-bold">{classStats.studentCount ?? 0}</div></CardContent></Card>
                                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taux de réussite</CardTitle></CardHeader>
                                        <CardContent><div className="text-2xl font-bold">{classStats.studentRanking ? ((classStats.studentRanking.filter((s: any) => s.average >= 10).length / classStats.studentRanking.length * 100) || 0).toFixed(1) : "—"}%</div></CardContent></Card>
                                </div>
                                {/* Charts */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card><CardHeader><CardTitle>Distribution des performances</CardTitle></CardHeader>
                                        <CardContent>{classStats.performanceDistribution && <PerformanceBarChart data={classStats.performanceDistribution} />}</CardContent></Card>
                                    <Card><CardHeader><CardTitle>Moyennes par matière</CardTitle></CardHeader>
                                        <CardContent>{classStats.subjectSummary && <SubjectRadarChart data={classStats.subjectSummary} />}</CardContent></Card>
                                    <Card className="lg:col-span-2"><CardHeader><CardTitle>Évolution par trimestre</CardTitle></CardHeader>
                                        <CardContent>{classStats.monthlyTrend && <TrendLineChart data={classStats.monthlyTrend} />}</CardContent></Card>
                                </div>
                                {/* Student ranking table */}
                                {classStats.studentRanking && classStats.studentRanking.length > 0 && (
                                    <Card>
                                        <CardHeader><CardTitle>Classement des élèves</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead><tr className="border-b"><th className="text-left py-2 px-3">Rang</th><th className="text-left py-2 px-3">Nom</th><th className="text-right py-2 px-3">Moyenne</th></tr></thead>
                                                    <tbody>
                                                        {classStats.studentRanking.map((s: any, i: number) => (
                                                            <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                                                                <td className="py-2 px-3 font-medium">{s.rank || i + 1}</td>
                                                                <td className="py-2 px-3">{s.name}</td>
                                                                <td className="py-2 px-3 text-right font-semibold">{Number(s.average).toFixed(1)}/20</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                        )}
                    </TabsContent>

                    <TabsContent value="subjects-tracking" className="space-y-6">
                        {/* Subject selector */}
                        <Card>
                            <CardContent className="py-4">
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium">Matière :</label>
                                    <select
                                        className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                        value={selectedSubjectId || ""}
                                        onChange={(e) => setSelectedSubjectId(e.target.value || null)}
                                    >
                                        <option value="">Sélectionner une matière...</option>
                                        {classSubjects.map((cs) => (
                                            <option key={cs.subject.id} value={cs.subject.id}>{cs.subject.name} ({cs.subject.code})</option>
                                        ))}
                                    </select>
                                </div>
                            </CardContent>
                        </Card>

                        {selectedSubjectId && subjectStats ? (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Moyenne</CardTitle></CardHeader>
                                        <CardContent><div className="text-2xl font-bold">{Number(subjectStats.average).toFixed(1)}/20</div></CardContent></Card>
                                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Plus haute</CardTitle></CardHeader>
                                        <CardContent><div className="text-2xl font-bold text-green-500">{Number(subjectStats.highest).toFixed(1)}/20</div></CardContent></Card>
                                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Plus basse</CardTitle></CardHeader>
                                        <CardContent><div className="text-2xl font-bold text-red-500">{Number(subjectStats.lowest).toFixed(1)}/20</div></CardContent></Card>
                                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Médiane</CardTitle></CardHeader>
                                        <CardContent><div className="text-2xl font-bold">{Number(subjectStats.median).toFixed(1)}/20</div></CardContent></Card>
                                </div>
                                {subjectStats.gradeDistribution && (
                                    <Card><CardHeader><CardTitle>Distribution des notes</CardTitle></CardHeader>
                                        <CardContent><PerformanceBarChart data={subjectStats.gradeDistribution} /></CardContent></Card>
                                )}
                                {subjectStats.studentGrades && subjectStats.studentGrades.length > 0 && (
                                    <Card><CardHeader><CardTitle>Notes par élève</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead><tr className="border-b"><th className="text-left py-2 px-3">Rang</th><th className="text-left py-2 px-3">Nom</th><th className="text-right py-2 px-3">Moyenne</th></tr></thead>
                                                    <tbody>
                                                        {subjectStats.studentGrades.map((s: any, i: number) => (
                                                            <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                                                                <td className="py-2 px-3 font-medium">{s.rank || i + 1}</td>
                                                                <td className="py-2 px-3">{s.studentName}</td>
                                                                <td className="py-2 px-3 text-right font-semibold">{Number(s.average).toFixed(1)}/20</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </>
                        ) : selectedSubjectId ? (
                            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                        ) : (
                            <Card className="border-dashed border-2">
                                <CardContent className="py-16 text-center">
                                    <Target className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                    <h3 className="text-lg font-medium">Sélectionnez une matière</h3>
                                    <p className="text-sm text-muted-foreground mt-2">Choisissez une matière pour voir le détail des performances.</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </PageGuard>
    );
}
