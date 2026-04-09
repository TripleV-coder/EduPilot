"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Trash2, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { toast } from "sonner";
import { useSchool } from "@/components/providers/school-provider";

interface ClassSubjectEntry {
    classId: string;
    subjectId: string;
    coefficient: number;
    classSubjectId?: string;
    subject: { id: string; name: string; code: string; category?: string };
}

interface ClassOption {
    id: string;
    name: string;
    classLevel?: { name: string };
}

interface SubjectOption {
    id: string;
    name: string;
    code: string;
    category?: string;
}

export default function CurriculumConfigPage() {
    const { schoolId } = useSchool();
    const [selectedClassId, setSelectedClassId] = useState<string>("");
    const [saving, setSaving] = useState(false);

    // Fetch classes
    const { data: classesData } = useSWR<{ data?: ClassOption[]; classes?: ClassOption[] }>(
        schoolId ? "/api/classes?limit=200" : null,
        fetcher,
        { revalidateOnFocus: false }
    );
    const classes: ClassOption[] = classesData?.data || classesData?.classes || (Array.isArray(classesData) ? classesData : []);

    // Fetch all subjects for assignment
    const { data: subjectsData } = useSWR<{ data?: SubjectOption[]; subjects?: SubjectOption[] }>(
        schoolId ? "/api/subjects?limit=200" : null,
        fetcher,
        { revalidateOnFocus: false }
    );
    const allSubjects: SubjectOption[] = subjectsData?.data || subjectsData?.subjects || (Array.isArray(subjectsData) ? subjectsData : []);

    // Fetch curriculum for selected class
    const { data: curriculumData, mutate: mutateCurriculum } = useSWR<{
        subjects: ClassSubjectEntry[];
        totalCoefficients: number;
        count: number;
    }>(
        selectedClassId ? `/api/admin/curriculum-config?classId=${selectedClassId}` : null,
        fetcher,
        { revalidateOnFocus: false }
    );

    const entries = curriculumData?.subjects || [];

    // ── Assign a new subject to the class ──
    const [assignSubjectId, setAssignSubjectId] = useState("");
    const [assignCoeff, setAssignCoeff] = useState("1");

    const handleAssign = async () => {
        if (!assignSubjectId || !selectedClassId) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/curriculum-config?action=assign-subject", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classId: selectedClassId,
                    subjectId: assignSubjectId,
                    coefficient: parseFloat(assignCoeff) || 1,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Erreur");
            }
            await mutateCurriculum();
            setAssignSubjectId("");
            setAssignCoeff("1");
            toast.success("Matière ajoutée au curriculum");
        } catch (e: any) {
            toast.error(e.message || "Erreur lors de l'ajout");
        } finally {
            setSaving(false);
        }
    };

    // ── Update coefficient ──
    const handleUpdateCoeff = useCallback(async (classSubjectId: string, newCoeff: number) => {
        try {
            const res = await fetch("/api/admin/curriculum-config", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ classSubjectId, coefficient: newCoeff }),
            });
            if (!res.ok) throw new Error("Erreur");
            await mutateCurriculum();
            toast.success("Coefficient mis à jour");
        } catch {
            toast.error("Erreur lors de la mise à jour");
        }
    }, [mutateCurriculum]);

    // ── Remove subject from class ──
    const handleRemove = useCallback(async (classSubjectId: string) => {
        if (!confirm("Retirer cette matière du curriculum ?")) return;
        try {
            const res = await fetch(`/api/admin/curriculum-config?classSubjectId=${classSubjectId}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Erreur");
            }
            await mutateCurriculum();
            toast.success("Matière retirée du curriculum");
        } catch (e: any) {
            toast.error(e.message || "Erreur — des notes existent peut-être pour cette matière");
        }
    }, [mutateCurriculum]);

    // Subjects not yet assigned to selected class
    const assignedSubjectIds = new Set(entries.map(e => e.subjectId));
    const availableSubjects = allSubjects.filter(s => !assignedSubjectIds.has(s.id));

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Configuration du Curriculum"
                    description="Assignez les matières et coefficients par classe."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Configuration", href: "/dashboard/settings" },
                        { label: "Curriculum" },
                    ]}
                />

                {/* Class selector */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <BookOpen className="w-5 h-5 text-primary" />
                            Sélectionnez une classe
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                            <SelectTrigger className="w-full max-w-md">
                                <SelectValue placeholder="Choisir une classe..." />
                            </SelectTrigger>
                            <SelectContent>
                                {classes.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.classLevel?.name ? `${c.classLevel.name} — ${c.name}` : c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {/* Curriculum table */}
                {selectedClassId && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">
                                Matières assignées
                                {curriculumData && (
                                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                                        ({curriculumData.count} matières, total coefficients : {curriculumData.totalCoefficients})
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {entries.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    Aucune matière assignée à cette classe.
                                </p>
                            ) : (
                                <div className="border rounded-md overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="text-left px-4 py-2 font-medium">Matière</th>
                                                <th className="text-left px-4 py-2 font-medium">Code</th>
                                                <th className="text-left px-4 py-2 font-medium">Catégorie</th>
                                                <th className="text-center px-4 py-2 font-medium w-32">Coefficient</th>
                                                <th className="w-12" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entries.map(entry => (
                                                <tr key={entry.classSubjectId || entry.subjectId} className="border-t">
                                                    <td className="px-4 py-2 font-medium">{entry.subject.name}</td>
                                                    <td className="px-4 py-2 text-muted-foreground">{entry.subject.code}</td>
                                                    <td className="px-4 py-2 text-muted-foreground">{entry.subject.category || "—"}</td>
                                                    <td className="px-4 py-2">
                                                        <Input
                                                            type="number"
                                                            min={0.5}
                                                            max={10}
                                                            step={0.5}
                                                            defaultValue={entry.coefficient}
                                                            className="w-20 mx-auto text-center"
                                                            onBlur={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                if (val !== entry.coefficient && entry.classSubjectId) {
                                                                    handleUpdateCoeff(entry.classSubjectId, val);
                                                                }
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {entry.classSubjectId && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-destructive hover:text-destructive"
                                                                onClick={() => handleRemove(entry.classSubjectId!)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Add subject form */}
                            <div className="flex items-end gap-3 pt-4 border-t">
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Ajouter une matière</Label>
                                    <Select value={assignSubjectId} onValueChange={setAssignSubjectId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sélectionner une matière..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableSubjects.map(s => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.name} ({s.code})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-24">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Coeff.</Label>
                                    <Input
                                        type="number"
                                        min={0.5}
                                        max={10}
                                        step={0.5}
                                        value={assignCoeff}
                                        onChange={e => setAssignCoeff(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleAssign} disabled={saving || !assignSubjectId} className="gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Ajouter
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </PageGuard>
    );
}
