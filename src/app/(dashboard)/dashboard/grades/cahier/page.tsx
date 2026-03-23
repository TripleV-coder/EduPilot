"use client";

import { useState, useEffect, useMemo } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Permission } from "@/lib/rbac/permissions";
import {
    ArrowLeft, BookOpenCheck, Filter, Search, ChevronDown, ChevronUp, Users,
    TrendingUp, TrendingDown, Minus, AlertCircle, Loader2, X
} from "lucide-react";
import Link from "next/link";

type Student = { id: string; matricule: string; firstName: string; lastName: string };
type GradeEntry = { value: number | null; isAbsent: boolean; isExcused: boolean; comment: string | null };
type EvalStats = { average: number | null; min: number | null; max: number | null; graded: number; total: number };
type EvaluationData = {
    id: string; title: string | null; date: string; maxGrade: number; coefficient: number;
    subject: string; classSubjectId: string; type: string; typeId: string;
    period: string; periodId: string;
    stats: EvalStats;
    grades: Record<string, GradeEntry>;
};
type SubjectInfo = { id: string; name: string; teacher: string | null; evaluationCount: number };

function getScoreColor(score: number | null, max: number = 20): string {
    if (score === null) return "text-muted-foreground";
    const normalized = (score / max) * 20;
    if (normalized >= 16) return "text-emerald-600";
    if (normalized >= 14) return "text-blue-600";
    if (normalized >= 10) return "text-amber-600";
    return "text-red-600";
}

function getScoreBg(score: number | null, max: number = 20): string {
    if (score === null) return "bg-muted/50";
    const normalized = (score / max) * 20;
    if (normalized >= 16) return "bg-emerald-50 dark:bg-emerald-500/10";
    if (normalized >= 14) return "bg-blue-50 dark:bg-blue-500/10";
    if (normalized >= 10) return "bg-amber-50 dark:bg-amber-500/10";
    return "bg-red-50 dark:bg-red-500/10";
}

export default function CahierDeNotesPage() {
    // Data states
    const [classes, setClasses] = useState<any[]>([]);
    const [periods, setPeriods] = useState<any[]>([]);
    const [evalTypes, setEvalTypes] = useState<any[]>([]);

    // Filter states
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedPeriod, setSelectedPeriod] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedType, setSelectedType] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // Cahier data
    const [students, setStudents] = useState<Student[]>([]);
    const [evaluations, setEvaluations] = useState<EvaluationData[]>([]);
    const [subjects, setSubjects] = useState<SubjectInfo[]>([]);

    // UI states
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(true);
    const [expandedEval, setExpandedEval] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"evaluations" | "students">("evaluations");

    // Initial Fetch: Classes, Periods, EvalTypes
    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const [clsRes, perRes, typRes] = await Promise.all([
                    fetch("/api/classes"),
                    fetch("/api/periods"),
                    fetch("/api/evaluation-types")
                ]);

                if (clsRes.ok) {
                    const d = await clsRes.json();
                    setClasses(Array.isArray(d) ? d : d.data || d.classes || []);
                }
                if (perRes.ok) {
                    const d = await perRes.json();
                    setPeriods(Array.isArray(d) ? d : d.data || []);
                }
                if (typRes.ok) {
                    const d = await typRes.json();
                    setEvalTypes(Array.isArray(d) ? d : d.data || []);
                }
            } catch {
                setError("Erreur lors du chargement des données initiales.");
            } finally {
                setLoading(false);
            }
        };
        fetchInitial();
    }, []);

    // Fetch Cahier Data when class changes (with optional filters)
    const fetchCahierData = async () => {
        if (!selectedClass) return;

        setDataLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({ classId: selectedClass });
            if (selectedPeriod) params.set("periodId", selectedPeriod);
            if (selectedSubject) params.set("classSubjectId", selectedSubject);
            if (selectedType) params.set("typeId", selectedType);

            const res = await fetch(`/api/grades/cahier?${params.toString()}`);
            if (!res.ok) throw new Error("Erreur lors du chargement des données");

            const data = await res.json();
            setStudents(data.students || []);
            setEvaluations(data.evaluations || []);
            setSubjects(data.subjects || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDataLoading(false);
        }
    };

    // Auto-fetch when class is selected
    useEffect(() => {
        if (selectedClass) {
            fetchCahierData();
        } else {
            setStudents([]);
            setEvaluations([]);
            setSubjects([]);
        }
    }, [selectedClass]);

    // Re-fetch when filters change (but only if class is selected)
    useEffect(() => {
        if (selectedClass) {
            fetchCahierData();
        }
    }, [selectedPeriod, selectedSubject, selectedType]);

    // Filtered students by search query
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(s =>
            s.firstName.toLowerCase().includes(q) ||
            s.lastName.toLowerCase().includes(q) ||
            s.matricule.toLowerCase().includes(q)
        );
    }, [students, searchQuery]);

    // Group evaluations by subject
    const evaluationsBySubject = useMemo(() => {
        const grouped = new Map<string, EvaluationData[]>();
        evaluations.forEach(ev => {
            const key = ev.subject;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(ev);
        });
        return grouped;
    }, [evaluations]);

    // Compute student-level summary (all subjects, all evaluations)
    const studentSummary = useMemo(() => {
        return filteredStudents.map(student => {
            let totalWeightedSum = 0;
            let totalCoefficient = 0;
            let gradeCount = 0;
            let absentCount = 0;

            evaluations.forEach(ev => {
                const grade = ev.grades[student.id];
                if (grade) {
                    if (grade.isAbsent) {
                        absentCount++;
                    } else if (grade.value !== null) {
                        // Normalize to /20
                        const normalized = (grade.value / ev.maxGrade) * 20;
                        totalWeightedSum += normalized * ev.coefficient;
                        totalCoefficient += ev.coefficient;
                        gradeCount++;
                    }
                }
            });

            const average = totalCoefficient > 0 ? totalWeightedSum / totalCoefficient : null;

            return {
                ...student,
                average,
                gradeCount,
                absentCount,
                totalEvals: evaluations.length
            };
        }).sort((a, b) => {
            if (a.average === null && b.average === null) return 0;
            if (a.average === null) return 1;
            if (b.average === null) return -1;
            return b.average - a.average;
        });
    }, [filteredStudents, evaluations]);

    // Reset all filters
    const resetFilters = () => {
        setSelectedPeriod("");
        setSelectedSubject("");
        setSelectedType("");
        setSearchQuery("");
    };

    const hasActiveFilters = selectedPeriod || selectedSubject || selectedType || searchQuery;

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <PageGuard permission={Permission.EVALUATION_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/grades">
                            <Button variant="outline" size="icon" className="shrink-0">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <PageHeader
                            title="Cahier de Notes"
                            description="Relevé détaillé des évaluations, devoirs et interrogations par classe et période."
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={viewMode === "evaluations" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setViewMode("evaluations")}
                            className="gap-1.5"
                        >
                            <BookOpenCheck className="w-4 h-4" />
                            Par Évaluation
                        </Button>
                        <Button
                            variant={viewMode === "students" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setViewMode("students")}
                            className="gap-1.5"
                        >
                            <Users className="w-4 h-4" />
                            Par Élève
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <Card className="border-border shadow-sm">
                    <CardHeader
                        className="pb-3 cursor-pointer flex flex-row items-center justify-between"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-primary" />
                            <CardTitle className="text-base">Filtres & Configuration</CardTitle>
                            {hasActiveFilters && (
                                <Badge variant="secondary" className="text-xs ml-2">
                                    Filtres actifs
                                </Badge>
                            )}
                        </div>
                        {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </CardHeader>
                    {showFilters && (
                        <CardContent className="pt-0 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                {/* Class (always visible and required) */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Classe <span className="text-destructive">*</span>
                                    </Label>
                                    <select
                                        value={selectedClass}
                                        onChange={(e) => {
                                            setSelectedClass(e.target.value);
                                            setSelectedSubject(""); // Reset subject when class changes
                                        }}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        <option value="">Choisir une classe...</option>
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                {/* Period */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Période (Trim./Sem.)
                                    </Label>
                                    <select
                                        value={selectedPeriod}
                                        onChange={(e) => setSelectedPeriod(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        <option value="">Toutes les périodes</option>
                                        {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>

                                {/* Subject */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Matière
                                    </Label>
                                    <select
                                        value={selectedSubject}
                                        onChange={(e) => setSelectedSubject(e.target.value)}
                                        disabled={!selectedClass}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                                    >
                                        <option value="">Toutes les matières</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.evaluationCount})</option>)}
                                    </select>
                                </div>

                                {/* Type */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Type d&apos;Éval.
                                    </Label>
                                    <select
                                        value={selectedType}
                                        onChange={(e) => setSelectedType(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        <option value="">Tous les types</option>
                                        {evalTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>

                                {/* Search */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Rechercher un élève
                                    </Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            
                                            className="pl-9"
                                        />
                                    </div>
                                </div>
                            </div>

                            {hasActiveFilters && (
                                <div className="flex items-center justify-end">
                                    <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-muted-foreground hover:text-destructive">
                                        <X className="w-3.5 h-3.5" /> Réinitialiser les filtres
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>

                {/* Error */}
                {error && (
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Loading */}
                {dataLoading && (
                    <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm">Chargement du cahier de notes...</span>
                    </div>
                )}

                {/* Empty state */}
                {!dataLoading && !selectedClass && (
                    <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/20">
                        <BookOpenCheck className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold">Sélectionnez une classe</h3>
                        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                            Choisissez une classe ci-dessus pour afficher le relevé complet des notes, devoirs et compositions.
                        </p>
                    </div>
                )}

                {/* No evaluations */}
                {!dataLoading && selectedClass && evaluations.length === 0 && (
                    <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/20">
                        <BookOpenCheck className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold">Aucune évaluation trouvée</h3>
                        <p className="text-sm text-muted-foreground mt-2">
                            Aucun devoir, interrogation ou composition ne correspond aux filtres actuels.
                        </p>
                    </div>
                )}

                {/* =============================
                    VIEW MODE: BY EVALUATION
                   ============================= */}
                {!dataLoading && selectedClass && evaluations.length > 0 && viewMode === "evaluations" && (
                    <div className="space-y-4">
                        {/* Summary strip */}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <Badge variant="outline" className="gap-1">
                                <BookOpenCheck className="w-3 h-3" />
                                {evaluations.length} évaluation(s)
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                                <Users className="w-3 h-3" />
                                {students.length} élève(s)
                            </Badge>
                            {evaluationsBySubject.size > 0 && (
                                <Badge variant="outline">
                                    {evaluationsBySubject.size} matière(s)
                                </Badge>
                            )}
                        </div>

                        {/* Evaluations grouped by subject */}
                        {Array.from(evaluationsBySubject.entries()).map(([subjectName, subjectEvals]) => (
                            <Card key={subjectName} className="border-border shadow-sm overflow-hidden">
                                <CardHeader className="bg-muted/30 py-3 border-b">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-semibold">{subjectName}</CardTitle>
                                        <Badge variant="secondary" className="text-xs">{subjectEvals.length} éval(s)</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {subjectEvals.map((ev) => {
                                        const isExpanded = expandedEval === ev.id;
                                        return (
                                            <div key={ev.id} className="border-b last:border-0">
                                                {/* Eval Header (clickable) */}
                                                <div
                                                    className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                                                    onClick={() => setExpandedEval(isExpanded ? null : ev.id)}
                                                >
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="shrink-0">
                                                            {isExpanded ? (
                                                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                                            ) : (
                                                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-sm truncate">
                                                                {ev.title || ev.type}
                                                            </p>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ev.type}</Badge>
                                                                <span>{ev.period}</span>
                                                                <span>•</span>
                                                                <span>{new Date(ev.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
                                                                <span>•</span>
                                                                <span>/{ev.maxGrade}</span>
                                                                <span>•</span>
                                                                <span>Coef {ev.coefficient}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6 shrink-0">
                                                        <div className="text-right">
                                                            <p className={`text-lg font-bold ${getScoreColor(ev.stats.average, ev.maxGrade)}`}>
                                                                {ev.stats.average !== null ? ev.stats.average.toFixed(2) : "—"}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground">Moy. classe</p>
                                                        </div>
                                                        <div className="text-right hidden sm:block">
                                                            <p className="text-sm font-medium">{ev.stats.graded}/{ev.stats.total}</p>
                                                            <p className="text-[10px] text-muted-foreground">Noté(s)</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expanded: Full grade table */}
                                                {isExpanded && (
                                                    <div className="bg-muted/10 border-t">
                                                        {/* Stats bar */}
                                                        <div className="px-5 py-2 flex items-center gap-6 text-xs border-b bg-muted/20 flex-wrap">
                                                            <span className="flex items-center gap-1">
                                                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                                                                Max: <b>{ev.stats.max !== null ? ev.stats.max : "—"}</b>
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Minus className="w-3 h-3 text-amber-500" />
                                                                Moy: <b className={getScoreColor(ev.stats.average, ev.maxGrade)}>{ev.stats.average !== null ? ev.stats.average.toFixed(2) : "—"}</b>
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <TrendingDown className="w-3 h-3 text-red-500" />
                                                                Min: <b>{ev.stats.min !== null ? ev.stats.min : "—"}</b>
                                                            </span>
                                                        </div>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm">
                                                                <thead className="text-xs text-muted-foreground bg-muted/30">
                                                                    <tr>
                                                                        <th className="text-left px-5 py-2 font-medium w-8">#</th>
                                                                        <th className="text-left px-3 py-2 font-medium">Élève</th>
                                                                        <th className="text-left px-3 py-2 font-medium w-24">Matricule</th>
                                                                        <th className="text-center px-3 py-2 font-medium w-28">Note /{ev.maxGrade}</th>
                                                                        <th className="text-center px-3 py-2 font-medium w-20">Statut</th>
                                                                        <th className="text-left px-3 py-2 font-medium">Commentaire</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {filteredStudents.map((student, idx) => {
                                                                        const grade = ev.grades[student.id];
                                                                        return (
                                                                            <tr key={student.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                                                                <td className="px-5 py-2 text-muted-foreground">{idx + 1}</td>
                                                                                <td className="px-3 py-2 font-medium">
                                                                                    {student.lastName} {student.firstName}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                                                                                    {student.matricule}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-center">
                                                                                    {grade ? (
                                                                                        grade.isAbsent ? (
                                                                                            <span className="text-muted-foreground italic">ABS</span>
                                                                                        ) : (
                                                                                            <span className={`font-bold text-base ${getScoreColor(grade.value, ev.maxGrade)} ${getScoreBg(grade.value, ev.maxGrade)} px-3 py-0.5 rounded-md inline-block min-w-[3rem]`}>
                                                                                                {grade.value !== null ? grade.value : "—"}
                                                                                            </span>
                                                                                        )
                                                                                    ) : (
                                                                                        <span className="text-muted-foreground/50">—</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-center">
                                                                                    {grade?.isAbsent ? (
                                                                                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                                                                            {grade.isExcused ? "ABS-J" : "ABS-NJ"}
                                                                                        </Badge>
                                                                                    ) : grade?.value !== null ? (
                                                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600">
                                                                                            Noté
                                                                                        </Badge>
                                                                                    ) : (
                                                                                        <span className="text-muted-foreground/40 text-xs">—</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-xs text-muted-foreground italic truncate max-w-[200px]">
                                                                                    {grade?.comment || ""}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* =============================
                    VIEW MODE: BY STUDENT
                   ============================= */}
                {!dataLoading && selectedClass && evaluations.length > 0 && viewMode === "students" && (
                    <div className="space-y-4">
                        {/* Summary strip */}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <Badge variant="outline" className="gap-1">
                                <Users className="w-3 h-3" />
                                {filteredStudents.length} élève(s)
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                                <BookOpenCheck className="w-3 h-3" />
                                {evaluations.length} évaluation(s)
                            </Badge>
                        </div>

                        {/* Full student table with all evaluations as columns */}
                        <Card className="border-border shadow-sm overflow-hidden">
                            <CardHeader className="bg-muted/30 py-3 border-b">
                                <CardTitle className="text-base font-semibold">Récapitulatif par Élève</CardTitle>
                                <CardDescription className="text-xs">
                                    Moyenne pondérée par coefficients, normalisée sur 20.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-muted-foreground bg-muted/30 sticky top-0">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-medium sticky left-0 bg-muted/30 z-10 min-w-[50px]">#</th>
                                                <th className="text-left px-3 py-3 font-medium sticky left-[50px] bg-muted/30 z-10 min-w-[200px]">Élève</th>
                                                <th className="text-center px-3 py-3 font-semibold min-w-[80px] bg-primary/5">Moy.</th>
                                                <th className="text-center px-3 py-3 font-medium min-w-[50px]">Évals</th>
                                                <th className="text-center px-3 py-3 font-medium min-w-[50px]">ABS</th>
                                                {/* Dynamic columns for each evaluation */}
                                                {evaluations.map(ev => (
                                                    <th key={ev.id} className="text-center px-2 py-1 font-medium min-w-[70px] max-w-[100px]">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className="text-[10px] text-primary truncate max-w-full">{ev.subject.slice(0, 8)}</span>
                                                            <span className="truncate text-[9px] max-w-full">{ev.title || ev.type}</span>
                                                            <span className="text-[9px] text-muted-foreground/60">/{ev.maxGrade}</span>
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {studentSummary.map((student, idx) => (
                                                <tr key={student.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                                    <td className="px-4 py-2 text-muted-foreground sticky left-0 bg-background z-10">{idx + 1}</td>
                                                    <td className="px-3 py-2 sticky left-[50px] bg-background z-10">
                                                        <p className="font-medium text-sm truncate">{student.lastName} {student.firstName}</p>
                                                        <p className="text-[10px] text-muted-foreground font-mono">{student.matricule}</p>
                                                    </td>
                                                    <td className={`px-3 py-2 text-center font-bold text-base ${getScoreColor(student.average)} ${getScoreBg(student.average)} bg-primary/5`}>
                                                        {student.average !== null ? student.average.toFixed(2) : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-sm">{student.gradeCount}/{student.totalEvals}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        {student.absentCount > 0 ? (
                                                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{student.absentCount}</Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground/40">0</span>
                                                        )}
                                                    </td>
                                                    {evaluations.map(ev => {
                                                        const grade = ev.grades[student.id];
                                                        return (
                                                            <td key={ev.id} className="px-2 py-2 text-center">
                                                                {grade ? (
                                                                    grade.isAbsent ? (
                                                                        <span className="text-[10px] text-destructive font-medium">ABS</span>
                                                                    ) : (
                                                                        <span className={`font-semibold text-sm ${getScoreColor(grade.value, ev.maxGrade)}`}>
                                                                            {grade.value !== null ? grade.value : "—"}
                                                                        </span>
                                                                    )
                                                                ) : (
                                                                    <span className="text-muted-foreground/30">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </PageGuard>
    );
}
