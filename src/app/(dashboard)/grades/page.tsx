"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Search, Filter, Save, Loader2,
    ChevronDown, ChevronUp, AlertCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getMention } from "@/lib/benin/config";

interface ClassOption {
    id: string;
    name: string;
}

interface StudentGrade {
    studentId: string;
    studentName: string;
    grades: { subjectId: string; value: number | null }[];
    average: number;
    mention: { label: string; color: string } | null;
}

export default function GradesPage() {
    const queryClient = useQueryClient();
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [selectedPeriod, setSelectedPeriod] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [editedGrades, setEditedGrades] = useState<Record<string, Record<string, number>>>({});
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

    // Fetch classes
    const { data: classes } = useQuery({
        queryKey: ["classes"],
        queryFn: async () => {
            const res = await fetch("/api/classes");
            return res.json() as Promise<ClassOption[]>;
        },
    });

    // Fetch periods
    const { data: periods } = useQuery({
        queryKey: ["periods"],
        queryFn: async () => {
            const res = await fetch("/api/periods");
            return res.json();
        },
    });

    // Fetch grades for selected class/period
    const { data: gradesData, isLoading } = useQuery({
        queryKey: ["grades", selectedClass, selectedPeriod],
        queryFn: async () => {
            if (!selectedClass || !selectedPeriod) return null;
            const res = await fetch(`/api/grades/report-card?classId=${selectedClass}&periodId=${selectedPeriod}`);
            return res.json();
        },
        enabled: !!selectedClass && !!selectedPeriod,
    });

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (data: { studentId: string; grades: { evaluationId: string; value: number }[] }) => {
            const res = await fetch("/api/grades/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to save");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["grades"] });
            setEditedGrades({});
        },
    });

    const handleGradeChange = (studentId: string, subjectId: string, value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0 || numValue > 20) return;

        setEditedGrades(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [subjectId]: numValue,
            },
        }));
    };

    const hasUnsavedChanges = Object.keys(editedGrades).length > 0;

    const filteredStudents = (gradesData || []).filter((s: StudentGrade) =>
        s.studentName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Gestion des Notes</h1>
                    <p className="text-muted-foreground">Saisissez et consultez les notes par classe</p>
                </div>
                {hasUnsavedChanges && (
                    <Button onClick={() => saveMutation.mutate({ studentId: "", grades: [] })} disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Enregistrer
                    </Button>
                )}
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-sm font-medium mb-2 block">Classe</label>
                            <select
                                className="w-full p-2 border rounded-lg"
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                            >
                                <option value="">Sélectionner une classe</option>
                                {classes?.map((c: ClassOption) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-sm font-medium mb-2 block">Période</label>
                            <select
                                className="w-full p-2 border rounded-lg"
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                            >
                                <option value="">Sélectionner une période</option>
                                {periods?.map((p: { id: string; name: string }) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-sm font-medium mb-2 block">Rechercher</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Nom de l'élève..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Loading */}
            {isLoading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {/* No Selection */}
            {!selectedClass || !selectedPeriod ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Filter className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Sélectionnez une classe et une période pour afficher les notes</p>
                    </CardContent>
                </Card>
            ) : null}

            {/* Grades List */}
            {!isLoading && selectedClass && selectedPeriod && (
                <div className="space-y-3">
                    {filteredStudents.map((student: StudentGrade, index: number) => {
                        const mention = getMention(student.average);
                        const isExpanded = expandedStudent === student.studentId;

                        return (
                            <motion.div
                                key={student.studentId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className={cn(
                                    "overflow-hidden transition-all",
                                    isExpanded && "ring-2 ring-primary"
                                )}>
                                    <div
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                                        onClick={() => setExpandedStudent(isExpanded ? null : student.studentId)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="font-medium">{student.studentName}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {student.grades.filter(g => g.value !== null).length} notes saisies
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-2xl font-bold">{student.average.toFixed(2)}</p>
                                                {mention && (
                                                    <span
                                                        className="text-xs px-2 py-0.5 rounded"
                                                        style={{ backgroundColor: `${mention.color}20`, color: mention.color }}
                                                    >
                                                        {mention.label}
                                                    </span>
                                                )}
                                            </div>
                                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: "auto" }}
                                            exit={{ height: 0 }}
                                            className="border-t"
                                        >
                                            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {student.grades.map((grade) => (
                                                    <div key={grade.subjectId} className="space-y-1">
                                                        <label className="text-xs text-muted-foreground">{grade.subjectId}</label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={20}
                                                            step={0.5}
                                                            value={editedGrades[student.studentId]?.[grade.subjectId] ?? grade.value ?? ""}
                                                            onChange={(e) => handleGradeChange(student.studentId, grade.subjectId, e.target.value)}
                                                            className="h-9"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </Card>
                            </motion.div>
                        );
                    })}

                    {filteredStudents.length === 0 && !isLoading && (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">Aucun élève trouvé</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
