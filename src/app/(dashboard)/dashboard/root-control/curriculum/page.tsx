"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError, PageEmpty } from "@/components/layout/page-states";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Building2, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState";

export default function RootCurriculumPage() {
    const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
    const [selectedClassId, setSelectedClassId] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Schools
    const { data: schoolsData } = useSWR("/api/root/schools?limit=100", fetcher);
    const schools = Array.isArray(schoolsData) ? schoolsData : schoolsData?.data || [];

    // Fetch Classes for selected school
    const { data: classesData } = useSWR(
        selectedSchoolId ? `/api/classes?schoolId=${selectedSchoolId}&limit=100` : null, 
        fetcher
    );
    const classes = Array.isArray(classesData) ? classesData : classesData?.data || classesData?.classes || [];

    // Fetch All Subjects for the school
    const { data: allSubjectsData, mutate: mutateAllSubjects } = useSWR(
        selectedSchoolId ? `/api/subjects?schoolId=${selectedSchoolId}&limit=500` : null,
        fetcher
    );
    const allSubjects = Array.isArray(allSubjectsData) ? allSubjectsData : allSubjectsData?.data || [];

    // Fetch Subjects for selected class
    const { data: curriculumData, mutate: mutateCurriculum } = useSWR(
        selectedClassId ? `/api/admin/curriculum-config?classId=${selectedClassId}` : null,
        fetcher
    );

    // Form states
    const [newSubject, setNewSubject] = useState({ name: "", code: "", category: "GENERAL" });
    const [assignSubject, setAssignSubject] = useState({ subjectId: "", coefficient: 1 });

    const handleCreateSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSchoolId) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/admin/curriculum-config?action=create-subject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...newSubject, schoolId: selectedSchoolId }),
            });
            if (res.ok) {
                toast.success("Matière créée");
                setNewSubject({ name: "", code: "", category: "GENERAL" });
                mutateAllSubjects();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors de la création");
            }
        } catch {
            toast.error("Erreur réseau");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAssignSubject = async () => {
        if (!selectedClassId || !assignSubject.subjectId) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/admin/curriculum-config?action=assign-subject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...assignSubject, classId: selectedClassId }),
            });
            if (res.ok) {
                toast.success("Matière assignée");
                mutateCurriculum();
                setAssignSubject({ subjectId: "", coefficient: 1 });
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur d'assignation");
            }
        } catch {
            toast.error("Erreur réseau");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveSubject = async (classSubjectId: string) => {
        if (!confirm("Supprimer cette matière de la classe ?")) return;
        try {
            const res = await fetch(`/api/admin/curriculum-config?classSubjectId=${classSubjectId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Matière retirée");
                mutateCurriculum();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors de la suppression");
            }
        } catch {
            toast.error("Erreur réseau");
        }
    };

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 pb-24">
                <PageHeader
                    title="Curriculum & Réformes"
                    description="Console globale de gestion des matières et coefficients par établissement."
                    breadcrumbs={[
                        { label: "Console Racine", href: "/dashboard/root-control" },
                        { label: "Curriculum" },
                    ]}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Context Selection */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary" /> Sélection du Contexte
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Établissement</Label>
                                <Select value={selectedSchoolId} onValueChange={(v) => { setSelectedSchoolId(v); setSelectedClassId(""); }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choisir une école" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {schools.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Classe</Label>
                                <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={!selectedSchoolId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choisir une classe" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Create Subject */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                                <Plus className="w-4 h-4 text-primary" /> Créer une Matière
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateSubject} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Nom</Label>
                                        <Input value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Code</Label>
                                        <Input value={newSubject.code} onChange={e => setNewSubject({...newSubject, code: e.target.value})} required />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full" disabled={isSaving || !selectedSchoolId}>
                                    {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : "Enregistrer la matière"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Curriculum Table */}
                {selectedClassId && (
                    <Card className="border-border overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-bold uppercase tracking-widest">Contenu du Programme</CardTitle>
                                <CardDescription className="text-[10px]">Liste des matières et coefficients pour cette classe.</CardDescription>
                            </div>
                            <Badge variant="secondary" className="font-black">Consolidé</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/10 text-muted-foreground uppercase font-bold text-[10px] border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left">Matière</th>
                                        <th className="px-6 py-3 text-center">Code</th>
                                        <th className="px-6 py-3 text-center">Coefficient</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {(curriculumData?.subjects || []).map((cs: any) => (
                                        <tr key={cs.id} className="hover:bg-muted/5 group">
                                            <td className="px-6 py-4 font-bold">{cs.subject.name}</td>
                                            <td className="px-6 py-4 text-center font-mono text-xs">{cs.subject.code}</td>
                                            <td className="px-6 py-4 text-center font-black">{cs.coefficient}</td>
                                            <td className="px-6 py-4 text-right">
                                                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSubject(cs.id)} className="h-11 w-11 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Retirer ${cs.subject.name}`}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Assign New Row */}
                                    <tr className="bg-primary/5">
                                        <td colSpan={2} className="px-6 py-4">
                                            <Select value={assignSubject.subjectId} onValueChange={v => setAssignSubject({...assignSubject, subjectId: v})}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Ajouter une matière..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {allSubjects.map((s: any) => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Input 
                                                type="number" 
                                                step="0.1" 
                                                aria-label="Coefficient de la matière"
                                                min={0}
                                                className="h-10 w-24 mx-auto text-center" 
                                                value={assignSubject.coefficient} 
                                                onChange={e => {
                                                    const nextValue = Number.parseFloat(e.target.value);
                                                    setAssignSubject({
                                                        ...assignSubject,
                                                        coefficient: Number.isFinite(nextValue) ? nextValue : 0,
                                                    });
                                                }}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button type="button" size="sm" className="h-10 px-3" onClick={handleAssignSubject} disabled={isSaving || !assignSubject.subjectId}>
                                                {isSaving ? <Loader2 className="animate-spin w-3 h-3" /> : <><Plus className="w-3.5 h-3.5 mr-1" /> Ajouter</>}
                                            </Button>
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-muted/20 font-black">
                                    <tr>
                                        <td colSpan={2} className="px-6 py-3 text-right text-[10px] uppercase">Somme des Coefficients</td>
                                        <td className="px-6 py-3 text-center">{curriculumData?.totalCoefficients || 0}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </CardContent>
                    </Card>
                )}

                {!selectedClassId ? (
                    <AnalyticsEmptyState
                        title="Sélectionnez une classe pour configurer son programme"
                        description="Choisissez d'abord un établissement puis une classe pour afficher et ajuster les matières et coefficients."
                        primaryLabel="Aller aux classes"
                        primaryHref="/dashboard/classes"
                        secondaryLabel="Retour console racine"
                        secondaryHref="/dashboard/root-control"
                        icon={BookOpen}
                    />
                ) : null}
            </div>
        </PageGuard>
    );
}
