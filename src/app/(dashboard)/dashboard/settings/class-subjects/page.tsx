"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookMarked, Save, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export default function ClassSubjectsPage() {
    const { data: classes, isLoading: classesLoading } = useSWR("/api/classes", fetcher);
    const { isLoading: subjectsLoading } = useSWR("/api/subjects", fetcher);
    const { data: teachers, isLoading: teachersLoading } = useSWR("/api/teachers", fetcher);
    const { data: classSubjects, mutate: mutateClassSubjects } = useSWR("/api/class-subjects", fetcher);

    const [selectedClassId, setSelectedClassId] = useState<string>("");
    type EditableAssignment = {
        id: string;
        classId: string;
        subjectId: string;
        subjectName: string;
        teacherId: string | null;
        coefficient: string;
        weeklyHours: string;
    };
    const [editableAssignments, setEditableAssignments] = useState<EditableAssignment[]>([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Set default class on load
    useEffect(() => {
        if (classes && classes.length > 0 && !selectedClassId) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes, selectedClassId]);

    // Load assignments for selected class
    useEffect(() => {
        if (selectedClassId && classSubjects) {
            const classAssignments = classSubjects.filter((cs: any) => cs.classId === selectedClassId);
            const toEditable = (cs: any): EditableAssignment => ({
                id: cs.id,
                classId: cs.classId,
                subjectId: cs.subjectId,
                subjectName: cs.subject?.name ?? "—",
                teacherId: cs.teacherId ?? cs.teacher?.id ?? null,
                coefficient: String(cs.coefficient ?? 1),
                weeklyHours: cs.weeklyHours != null ? String(cs.weeklyHours) : "",
            });

            setEditableAssignments(classAssignments.map(toEditable));
        }
    }, [selectedClassId, classSubjects]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payloadAssignments = editableAssignments.map((a) => ({
                classId: a.classId,
                subjectId: a.subjectId,
                teacherId: a.teacherId,
                coefficient: Number.isFinite(Number(a.coefficient)) ? Number(a.coefficient) : 1,
                weeklyHours: a.weeklyHours.trim() ? Number(a.weeklyHours) : undefined,
            }));

            await fetch("/api/class-subjects/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignments: payloadAssignments }),
            });
            mutateClassSubjects();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error("Failed to save assignments:", error);
        } finally {
            setSaving(false);
        }
    };

    const selectedClass = classes?.find((c: any) => c.id === selectedClassId);
    const isLoading = classesLoading || subjectsLoading || teachersLoading;

    const updateAssignment = (id: string, patch: Partial<EditableAssignment>) => {
        setEditableAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    };

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6 max-w-5xl mx-auto">
                <PageHeader
                    title="Matières par Classe"
                    description="Affectation des matières, coefficients et enseignants aux classes"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres" },
                        { label: "Matières" },
                    ]}
                />

                {isLoading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="ml-3 text-muted-foreground">Chargement des données...</span>
                    </div>
                )}

                {!isLoading && (!classes || classes.length === 0) && (
                    <div className="flex items-center justify-center py-20">
                        <AlertCircle className="w-8 h-8 text-destructive" />
                        <span className="ml-3 text-destructive">Aucune classe disponible</span>
                    </div>
                )}

                {!isLoading && classes && classes.length > 0 && (
                <>
                {saved && (
                    <div className="p-3 rounded-lg bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success))] flex items-center gap-2 text-sm">
                        ✓ Affectations enregistrées avec succès.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardContent className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Sélectionner une classe</label>
                                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                        <SelectTrigger className="bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {classes.map((c: any) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="pt-4 border-t border-border">
                                    <Button className="w-full gap-2" variant="outline">
                                        <BookMarked className="w-4 h-4" />
                                        Catalogue global
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="md:col-span-3">
                        <Card className="border-border shadow-sm">
                            <CardHeader className="bg-muted/30 border-b border-border flex flex-row items-center justify-between py-4">
                                <div>
                                    <CardTitle className="text-lg">Programme de {selectedClass?.name}</CardTitle>
                                    <CardDescription>Configurez les matières enseignées pour cette classe spécifique.</CardDescription>
                                </div>
                                <Button size="sm" className="gap-2">
                                    <Plus className="w-4 h-4" /> Ajouter
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/10">
                                        <TableRow>
                                            <TableHead>Matière</TableHead>
                                            <TableHead>Enseignant</TableHead>
                                            <TableHead className="w-[100px]">Coeff.</TableHead>
                                            <TableHead className="w-[100px]">Crédits</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {editableAssignments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5}>
                                                    <div className="py-12 text-center">
                                                        <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-4" />
                                                        <p className="font-medium">Aucune matière assignée pour cette classe.</p>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            Utilisez les données de l&apos;établissement (matières + enseignants) pour configurer les affectations.
                                                        </p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            editableAssignments.map((a) => (
                                                <TableRow key={a.id}>
                                                    <TableCell className="font-medium">{a.subjectName}</TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={a.teacherId ?? "unassigned"}
                                                            onValueChange={(v) =>
                                                                updateAssignment(a.id, { teacherId: v === "unassigned" ? null : v })
                                                            }
                                                        >
                                                            <SelectTrigger className="h-8 bg-transparent border-0 ring-0 focus:ring-0">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="unassigned" className="text-muted-foreground italic">
                                                                    Non assigné
                                                                </SelectItem>
                                                                {(teachers ?? []).map((t: any) => (
                                                                    <SelectItem key={t.id} value={t.id}>
                                                                        {t.user?.firstName} {t.user?.lastName}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            step={0.5}
                                                            className="h-8 w-16 px-2"
                                                            value={a.coefficient}
                                                            onChange={(e) => updateAssignment(a.id, { coefficient: e.target.value })}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            step={0.5}
                                                            className="h-8 w-16 px-2"
                                                            value={a.weeklyHours}
                                                            onChange={(e) => updateAssignment(a.id, { weeklyHours: e.target.value })}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => setEditableAssignments((prev) => prev.filter((x) => x.id !== a.id))}
                                                            title="Retirer l&apos;affectation (suppression à la sauvegarde)"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>

                                <div className="p-4 bg-muted/10 border-t border-border flex justify-end">
                                    <Button className="gap-2" onClick={handleSave} disabled={saving}>
                                        <Save className="w-4 h-4" /> 
                                        {saving ? "Enregistrement..." : "Enregistrer les modifications"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
                </>
                )}
            </div>
        </PageGuard>
    );
}
