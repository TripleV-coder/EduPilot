"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    BookOpen, Plus, Trash2, Edit2, Save, X, Download,
    Loader2, CheckCircle, AlertCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Subject {
    id: string;
    name: string;
    code: string;
    category: string | null;
    coefficient: number;
    isActive: boolean;
}

async function fetchSubjects(): Promise<Subject[]> {
    const res = await fetch("/api/admin/subjects");
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
}

export default function SubjectsAdminPage() {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: "", coefficient: 1 });
    const [newSubject, setNewSubject] = useState({ name: "", code: "", category: "", coefficient: 1 });
    const [showAddForm, setShowAddForm] = useState(false);
    const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);

    const { data: subjects, isLoading } = useQuery({
        queryKey: ["admin-subjects"],
        queryFn: fetchSubjects,
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (data: typeof newSubject) => {
            const res = await fetch("/api/admin/subjects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to create");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-subjects"] });
            setNewSubject({ name: "", code: "", category: "", coefficient: 1 });
            setShowAddForm(false);
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, ...data }: { id: string; name: string; coefficient: number }) => {
            const res = await fetch(`/api/admin/subjects/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-subjects"] });
            setEditingId(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/admin/subjects/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-subjects"] });
        },
    });

    const importMutation = useMutation({
        mutationFn: async (type: "primary" | "college") => {
            const res = await fetch("/api/admin/subjects", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type }),
            });
            if (!res.ok) throw new Error("Failed to import");
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["admin-subjects"] });
            setImportResult(data);
            setTimeout(() => setImportResult(null), 5000);
        },
    });

    const startEditing = (subject: Subject) => {
        setEditingId(subject.id);
        setEditForm({ name: subject.name, coefficient: subject.coefficient });
    };

    const saveEdit = () => {
        if (editingId) {
            updateMutation.mutate({ id: editingId, ...editForm });
        }
    };

    const groupedSubjects = subjects?.reduce((acc, s) => {
        const cat = s.category || "Autres";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(s);
        return acc;
    }, {} as Record<string, Subject[]>) || {};

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Gestion des Matières</h1>
                    <p className="text-muted-foreground">Configurez les matières et coefficients de votre école</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => importMutation.mutate("primary")}
                        disabled={importMutation.isPending}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Primaire
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => importMutation.mutate("college")}
                        disabled={importMutation.isPending}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Collège
                    </Button>
                    <Button onClick={() => setShowAddForm(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter
                    </Button>
                </div>
            </div>

            {/* Import Result Toast */}
            <AnimatePresence>
                {importResult && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-3"
                    >
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span>
                            {importResult.created} matière(s) importée(s), {importResult.skipped} ignorée(s) (déjà existantes)
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Form */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Nouvelle Matière</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-4 gap-4">
                                    <Input
                                        placeholder="Nom"
                                        value={newSubject.name}
                                        onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                                    />
                                    <Input
                                        placeholder="Code (ex: MAT)"
                                        value={newSubject.code}
                                        onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value.toUpperCase() })}
                                        maxLength={5}
                                    />
                                    <Input
                                        placeholder="Catégorie"
                                        value={newSubject.category}
                                        onChange={(e) => setNewSubject({ ...newSubject, category: e.target.value })}
                                    />
                                    <Input
                                        type="number"
                                        min={1}
                                        max={10}
                                        placeholder="Coef"
                                        value={newSubject.coefficient}
                                        onChange={(e) => setNewSubject({ ...newSubject, coefficient: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="ghost" onClick={() => setShowAddForm(false)}>Annuler</Button>
                                    <Button
                                        onClick={() => createMutation.mutate(newSubject)}
                                        disabled={!newSubject.name || !newSubject.code || createMutation.isPending}
                                    >
                                        {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Créer
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {/* Subjects List */}
            {!isLoading && Object.entries(groupedSubjects).map(([category, categorySubjects]) => (
                <Card key={category}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-primary" />
                            {category}
                            <span className="text-sm font-normal text-muted-foreground">
                                ({categorySubjects.length})
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {categorySubjects.map((subject) => (
                                <motion.div
                                    key={subject.id}
                                    layout
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border",
                                        !subject.isActive && "opacity-50 bg-muted"
                                    )}
                                >
                                    {editingId === subject.id ? (
                                        <>
                                            <div className="flex gap-2 flex-1">
                                                <Input
                                                    value={editForm.name}
                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                    className="w-48"
                                                />
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={10}
                                                    value={editForm.coefficient}
                                                    onChange={(e) => setEditForm({ ...editForm, coefficient: parseInt(e.target.value) || 1 })}
                                                    className="w-20"
                                                />
                                            </div>
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" onClick={saveEdit}>
                                                    <Save className="w-4 h-4" />
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                                                    {subject.code}
                                                </span>
                                                <span className="font-medium">{subject.name}</span>
                                                {!subject.isActive && (
                                                    <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded">
                                                        Désactivée
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded font-bold">
                                                    Coef {subject.coefficient}
                                                </span>
                                                <Button size="sm" variant="ghost" onClick={() => startEditing(subject)}>
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive"
                                                    onClick={() => deleteMutation.mutate(subject.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Empty State */}
            {!isLoading && (!subjects || subjects.length === 0) && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-bold text-lg mb-2">Aucune matière configurée</h3>
                        <p className="text-muted-foreground mb-4">
                            Importez les matières standards ou créez-en manuellement.
                        </p>
                        <div className="flex gap-2 justify-center">
                            <Button onClick={() => importMutation.mutate("primary")}>
                                Importer Primaire
                            </Button>
                            <Button onClick={() => importMutation.mutate("college")}>
                                Importer Collège
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
