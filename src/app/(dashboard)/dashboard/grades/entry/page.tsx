"use client";

import { useState, useEffect, useMemo } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Permission } from "@/lib/rbac/permissions";
import { Save, AlertCircle, ArrowLeft, CheckCircle, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { t } from "@/lib/i18n";

export default function GradesEntryPage() {
    const { isFocusMode } = useSidebar();
    // Selectors state
    const [classes, setClasses] = useState<any[]>([]);
    const [periods, setPeriods] = useState<any[]>([]);
    const [evalTypes, setEvalTypes] = useState<any[]>([]);

    // Selected Context
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [classSubjects, setClassSubjects] = useState<any[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>("");

    // Evaluation Metadata
    const [title, setTitle] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [typeId, setTypeId] = useState("");
    const [periodId, setPeriodId] = useState("");
    const [maxGrade, setMaxGrade] = useState(20);
    const [coefficient, setCoefficient] = useState(1);

    // Students & Grades Grid
    const [students, setStudents] = useState<any[]>([]);
    const [grades, setGrades] = useState<Record<string, { value: string, isAbsent: boolean, isExcused: boolean, comment: string }>>({});
    const [initialGrades, setInitialGrades] = useState<Record<string, { value: string, isAbsent: boolean, isExcused: boolean, comment: string }>>({});

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Initial Fetch (Classes, Periods, EvalTypes)
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
            } catch (err: any) {
                setError("Erreur de chargement des paramètres de base");
            } finally {
                setLoading(false);
            }
        };
        fetchInitial();
    }, []);

    // When Class Changes: Fetch ClassSubjects + Students
    useEffect(() => {
        if (!selectedClass) {
            setClassSubjects([]);
            setStudents([]);
            setSelectedSubject("");
            return;
        }

        const fetchClassData = async () => {
            try {
                const [subjRes, stuRes] = await Promise.all([
                    fetch(`/api/class-subjects?classId=${selectedClass}`),
                    fetch(`/api/students?classId=${selectedClass}&limit=100`)
                ]);

                if (subjRes.ok) {
                    const d = await subjRes.json();
                    setClassSubjects(Array.isArray(d) ? d : d.data || []);
                }

                if (stuRes.ok) {
                    const d = await stuRes.json();
                    const stuList = Array.isArray(d) ? d : d.data || d.students || [];
                    setStudents(stuList);

                    // Init Grade Grid State
                    const initialGrades: any = {};
                    stuList.forEach((s: any) => {
                        initialGrades[s.id] = { value: "", isAbsent: false, isExcused: false, comment: "" };
                    });
                    setGrades(initialGrades);
                    setInitialGrades(initialGrades);
                }
            } catch {
                setError("Erreur lors du chargement des données de la classe.");
            }
        };
        fetchClassData();
    }, [selectedClass]);

    const handleGradeChange = (studentId: string, field: string, val: any) => {
        setGrades(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: val
            }
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedSubject || !periodId || !typeId) {
            setError("Veuillez sélectionner la matière, la période et le type d'évaluation.");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            // 1. Create Evaluation
            const evalPayload = {
                classSubjectId: selectedSubject,
                periodId,
                typeId,
                title: title || undefined,
                date: new Date(date).toISOString(),
                maxGrade,
                coefficient,
            };

            const evalRes = await fetch("/api/evaluations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(evalPayload),
            });

            if (!evalRes.ok) {
                const data = await evalRes.json();
                throw new Error(data.error || "Erreur lors de la création de l'évaluation");
            }

            const evaluation = await evalRes.json();

            // 2. Submit Batch Grades
            const gradeList = Object.keys(grades).map(stuId => {
                const g = grades[stuId];
                return {
                    studentId: stuId,
                    value: g.value === "" ? null : parseFloat(g.value),
                    isAbsent: g.isAbsent,
                    isExcused: g.isExcused,
                    comment: g.comment || undefined
                };
            }).filter(g => g.value !== null || g.isAbsent); // Only save filled ones or absent ones

            if (gradeList.length > 0) {
                const batchRes = await fetch("/api/grades/batch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        evaluationId: evaluation.id,
                        grades: gradeList
                    }),
                });

                if (!batchRes.ok) {
                    const data = await batchRes.json();
                    throw new Error(data.error || "Erreur lors de l'enregistrement des notes");
                }
            }

            setSuccess(true);
            window.scrollTo(0, 0);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const completedCount = useMemo(
        () =>
            Object.values(grades).filter((g) => g.isAbsent || (typeof g.value === "string" && g.value.trim() !== ""))
                .length,
        [grades]
    );

    const dirtyCount = useMemo(
        () =>
            Object.keys(grades).filter((id) => {
                const current = grades[id];
                const initial = initialGrades[id];
                if (!current || !initial) return false;
                return (
                    current.value !== initial.value ||
                    current.isAbsent !== initial.isAbsent ||
                    current.comment !== initial.comment
                );
            }).length,
        [grades, initialGrades]
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (success) {
        return (
            <div className="max-w-3xl mx-auto py-12">
                <div className="p-8 rounded-xl border-2 border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] rounded-full flex items-center justify-center">
                        <CheckCircle className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-[hsl(var(--success))]">Grille enregistrée avec succès !</h3>
                    <p className="text-muted-foreground">Les notes ont été publiées et les moyennes de la classe ont été mises à jour.</p>
                    <div className="pt-4 flex justify-center gap-4">
                        <Button onClick={() => { setSuccess(false); setGrades({}); }} variant="outline">
                            Saisir une autre évaluation
                        </Button>
                        <Link href="/dashboard/grades">
                            <Button>Retour aux statistiques</Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <PageGuard permission={Permission.EVALUATION_CREATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className={isFocusMode ? "space-y-4 max-w-7xl mx-auto" : "space-y-6 max-w-6xl mx-auto"}>
                <div className="flex items-center gap-4">
                    {!isFocusMode && (
                        <Link href="/dashboard/grades">
                            <Button variant="outline" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                    )}
                    <PageHeader
                        title={isFocusMode ? "Saisie rapide des notes" : "Nouvelle Saisie de Notes"}
                        description={isFocusMode ? "Mode focus actif : entrez vos notes sans distractions." : "Créer une évaluation et saisir les notes de la classe sous forme de grille."}
                    />
                </div>

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Étape 1 : Contexte de l'évaluation */}
                    <Card className="border-border shadow-sm">
                        <CardHeader className="border-b bg-muted/30">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5 text-primary" />
                                Paramètres de l'Évaluation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                <div className="space-y-2">
                                    <Label>Classe <span className="text-destructive">*</span></Label>
                                    <Select value={selectedClass} onValueChange={(value) => setSelectedClass(value)}>
                                        <SelectTrigger className="h-10 text-sm">
                                            <SelectValue placeholder="Sélectionner une classe..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {classes.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Matière <span className="text-destructive">*</span></Label>
                                    <Select
                                        value={selectedSubject}
                                        onValueChange={(value) => setSelectedSubject(value)}
                                        disabled={!selectedClass}
                                    >
                                        <SelectTrigger className="h-10 text-sm" aria-disabled={!selectedClass}>
                                            <SelectValue placeholder={selectedClass ? "Sélectionner une matière..." : "Choisir d'abord une classe"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {classSubjects.map((cs) => (
                                                <SelectItem key={cs.id} value={cs.id}>
                                                    {cs.subject?.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Période (Trimestre/Sem.) <span className="text-destructive">*</span></Label>
                                    <Select value={periodId} onValueChange={(value) => setPeriodId(value)}>
                                        <SelectTrigger className="h-10 text-sm">
                                            <SelectValue placeholder="Sélectionner..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {periods.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Type (Devoir, Compo...) <span className="text-destructive">*</span></Label>
                                    <Select value={typeId} onValueChange={(value) => setTypeId(value)}>
                                        <SelectTrigger className="h-10 text-sm">
                                            <SelectValue placeholder="Sélectionner..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {evalTypes.map((t) => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className={isFocusMode ? "grid grid-cols-1 md:grid-cols-3 gap-5" : "grid grid-cols-1 md:grid-cols-4 gap-5"}>
                                {!isFocusMode && (
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Titre (Optionnel)</Label>
                                        <Input value={title} onChange={e => setTitle(e.target.value)} />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Date <span className="text-destructive">*</span></Label>
                                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                                </div>
                                <div className="space-y-2 flex gap-2">
                                    <div className="flex-1">
                                        <Label>Note Max</Label>
                                        <Input type="number" value={maxGrade} onChange={e => setMaxGrade(parseInt(e.target.value))} required min={1} />
                                    </div>
                                    {!isFocusMode && (
                                        <div className="flex-1">
                                            <Label>Coef</Label>
                                            <Input type="number" step="0.5" value={coefficient} onChange={e => setCoefficient(parseFloat(e.target.value))} required min={0.5} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Étape 2 : Grille de Saisie */}
                    {selectedClass && (
                        <Card className="border-border shadow-sm">
                            <CardHeader className="border-b bg-muted/30">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg">Grille de la Classe</CardTitle>
                                    <span className="text-sm text-muted-foreground">
                                        {students.length} Eleve(s) · {completedCount} renseigne(s)
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {dirtyCount > 0 && (
                                    <div className="px-4 py-2 text-[11px] text-primary bg-primary/5 border-b border-primary/10">
                                        {dirtyCount} ligne(s) modifiee(s) non publiee(s)
                                    </div>
                                )}
                                {students.length === 0 ? (
                                    <div className="p-12 text-center text-muted-foreground">
                                        <AlertCircle className="h-8 w-8 mx-auto mb-3 text-amber-500" />
                                        <p className="font-medium text-foreground">Aucun élève inscrit dans cette classe</p>
                                        <p className="text-sm mt-1">Vérifiez que des élèves sont bien inscrits avec le statut &quot;Actif&quot; dans cette classe.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Élève</th>
                                                    <th className="px-4 py-3 font-medium w-40">Note (/{maxGrade})</th>
                                                    <th className="px-4 py-3 font-medium w-24 text-center">Absent</th>
                                                    {!isFocusMode && <th className="px-4 py-3 font-medium">Appréciation (Commentaire)</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((stu) => {
                                                    const g = grades[stu.id] || { value: "", isAbsent: false, comment: "" };
                                                    const name = stu.user ? `${stu.user.firstName} ${stu.user.lastName}` : stu.id;
                                                    return (
                                                        <tr key={stu.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                                            <td className="px-4 py-3 font-medium">
                                                                {name}
                                                                <span className="block text-[10px] text-muted-foreground">{stu.matricule}</span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <Input
                                                                    type="number"
                                                                    step="0.25"
                                                                    min={0}
                                                                    max={maxGrade}
                                                                    value={g.value}
                                                                    onChange={e => handleGradeChange(stu.id, "value", e.target.value)}
                                                                    disabled={g.isAbsent}
                                                                    
                                                                    className="h-8 max-w-[100px] text-right font-mono"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex justify-center">
                                                                    <Switch
                                                                        checked={g.isAbsent}
                                                                        onCheckedChange={c => {
                                                                            handleGradeChange(stu.id, "isAbsent", c);
                                                                            if (c) handleGradeChange(stu.id, "value", ""); // clear value if absent
                                                                        }}
                                                                    />
                                                                </div>
                                                            </td>
                                                            {!isFocusMode && (
                                                                <td className="px-4 py-3">
                                                                    <Input
                                                                        value={g.comment}
                                                                        onChange={e => handleGradeChange(stu.id, "comment", e.target.value)}
                                                                        
                                                                        className="h-8 w-full"
                                                                    />
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {selectedClass && students.length > 0 && (
                        <div className={isFocusMode ? "flex justify-end gap-3 pt-2 sticky bottom-3 bg-background/90 backdrop-blur-sm p-3 border rounded-xl shadow-lg" : "flex justify-end gap-3 pt-4 sticky bottom-6 bg-background/80 backdrop-blur-sm p-4 border-t rounded-xl shadow-lg"}>
                            <Link href="/dashboard/grades">
                                <Button type="button" variant="outline" disabled={saving} className="touch-target">{t("common.cancel")}</Button>
                            </Link>
                            <Button type="submit" disabled={saving || dirtyCount === 0} className="gap-2 min-w-[200px] action-critical touch-target">
                                {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2" /> : <Save className="h-4 w-4" />}
                                {saving ? t("gradesEntry.actions.saving") : dirtyCount > 0 ? t("gradesEntry.actions.publishWithCount", { count: dirtyCount }) : t("common.noChanges")}
                            </Button>
                        </div>
                    )}
                </form>
            </div>
        </PageGuard>
    );
}
