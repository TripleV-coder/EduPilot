"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Permission } from "@/lib/rbac/permissions";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    GraduationCap, Search, Loader2, Plus, LineChart,
    CheckCircle2, FileText, ArrowRight, BookOpen, AlertCircle, Sparkles,
    Zap, Brain, History, UserCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";

type Orientation = {
    id: string;
    status: string;
    student: {
        user: { firstName: string; lastName: string; };
    };
    classLevel: { name: string; };
    academicYear: { name: string; };
    recommendations: {
        id: string;
        recommendedSeries: string;
        rank: number;
        justification: string;
        isValidated: boolean;
    }[];
};

type StudentRecord = {
    id: string;
    user: { firstName: string; lastName: string; };
    enrollments: { academicYearId: string; classLevelId: string; }[];
};

const POST_BEPC_SERIES = [
    { value: "SERIE_A1", label: "Seconde Littéraire: Lettres - Langues (A1)" },
    { value: "SERIE_A2", label: "Seconde Littéraire: Sciences Humaines (A2)" },
    { value: "SERIE_B", label: "Seconde Économique: Sciences Sociales (B)" },
    { value: "SERIE_C", label: "Seconde Scientifique: Sciences et Techniques (C)" },
    { value: "SERIE_D", label: "Seconde Scientifique: Biologie - Géologie (D)" },
    { value: "SERIE_E", label: "Seconde Mathématiques et Techniques (E)" },
    { value: "SERIE_F1", label: "Seconde Industrielle: Construction Mécanique (F1)" },
    { value: "SERIE_F2", label: "Seconde Industrielle: Électronique (F2)" },
    { value: "SERIE_F3", label: "Seconde Industrielle: Électrotechnique (F3)" },
    { value: "SERIE_F4", label: "Seconde Industrielle: Génie Civil (F4)" },
    { value: "SERIE_G1", label: "Seconde Tertiaire: Secrétariat (G1)" },
    { value: "SERIE_G2", label: "Seconde Tertiaire: Comptabilité (G2)" },
    { value: "SERIE_G3", label: "Seconde Tertiaire: Marketing (G3)" },
];

const POST_BAC_OPTIONS = [
    { value: "UNIV_SCIENCES", label: "FAST: Sciences et Techniques" },
    { value: "UNIV_MEDECINE", label: "CUMM: Sciences de la Santé" },
    { value: "UNIV_LETTRES", label: "FLLAC: Lettres et Arts" },
    { value: "UNIV_FLASH", label: "FLASH: Sciences Humaines" },
    { value: "UNIV_DROIT", label: "FADESP: Droit et Sciences Politiques" },
    { value: "UNIV_ECONOMIE", label: "FASEG: Économie et Gestion" },
    { value: "UNIV_AGRO", label: "FSA: Sciences Agronomiques" },
    { value: "EPAC", label: "EPAC: École Polytechnique" },
    { value: "ENS", label: "ENS: École Normale Supérieure" },
    { value: "ENAM", label: "ENAM: Administration et Magistrature" },
    { value: "ENEAM", label: "ENEAM: Économie Appliquée et Management" },
];

export default function OrientationPage() {
    const [orientations, setOrientations] = useState<Orientation[]>([]);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<StudentRecord[]>([]);

    // Form state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState("");
    const [orientationType, setOrientationType] = useState<"BEPC" | "BAC">("BEPC");
    const [selectedSeries, setSelectedSeries] = useState("SERIE_D");
    const [justification, setJustification] = useState("");
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
    const [batchResults, setBatchResults] = useState<any[]>([]);
    const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        fetchOrientations();
        fetchStudents();
    }, []);

    const fetchOrientations = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/orientation");
            if (res.ok) {
                const data = await res.json();
                setOrientations(data);
            }
        } catch (error) {
            console.error("Failed to fetch orientations", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const res = await fetch("/api/students?limit=100");
            if (res.ok) {
                const data = await res.json();
                setStudents(data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch students", error);
        }
    };

    const handleGenerateAI = async () => {
        if (!selectedStudent) {
            toast({ title: "Sélection requise", description: "Veuillez choisir un élève d'abord.", variant: "destructive" });
            return;
        }

        setIsGeneratingAI(true);
        try {
            const student = students.find(s => s.id === selectedStudent);
            if (!student || !student.enrollments?.[0]) {
                throw new Error("Données de l'élève incomplètes.");
            }

            const res = await fetch("/api/orientation/generate-ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: selectedStudent,
                    academicYearId: student.enrollments[0].academicYearId
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Impossible de générer l'avis IA.");
            }

            const data = await res.json();
            if (data.recommendations && data.recommendations.length > 0) {
                const rec = data.recommendations[0];
                setSelectedSeries(rec.series);
                setJustification(rec.justification);
                toast({ title: "IA: Analyse terminée", description: `Recommandation suggérée: ${rec.series}` });
            }
        } catch (error: any) {
            toast({ title: "Échec IA", description: error.message, variant: "destructive" });
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleBatchAnalyze = async () => {
        if (students.length === 0) return;
        
        setIsBatchAnalyzing(true);
        try {
            const firstStudent = students[0];
            const academicYearId = firstStudent.enrollments?.[0]?.academicYearId;
            
            if (!academicYearId) throw new Error("Année académique introuvable");

            const res = await fetch("/api/orientation/batch-analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ academicYearId })
            });

            if (!res.ok) throw new Error("Erreur lors de l'analyse globale");

            const data = await res.json();
            setBatchResults(data.results || []);
            setIsBatchDialogOpen(true);
            
            if (data.results.length === 0) {
                toast({ title: "Analyse terminée", description: "Tous les étudiants ont déjà une orientation." });
            } else {
                toast({ title: "Analyse terminée", description: `${data.results.length} recommandations générées.` });
            }
        } catch (error: any) {
            toast({ title: "Échec", description: error.message, variant: "destructive" });
        } finally {
            setIsBatchAnalyzing(false);
        }
    };

    const handleSaveBatch = async () => {
        setIsSubmitting(true);
        let successCount = 0;
        try {
            for (const res of batchResults.filter(r => r.success)) {
                const student = students.find(s => s.id === res.studentId);
                if (!student || !student.enrollments?.[0]) continue;

                // Create base
                const baseRes = await fetch("/api/orientation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        studentId: res.studentId,
                        academicYearId: student.enrollments[0].academicYearId,
                        classLevelId: student.enrollments[0].classLevelId
                    })
                });

                if (baseRes.ok) {
                    const baseData = await baseRes.json();
                    // Add recommendation
                    await fetch(`/api/orientation/${baseData.id}/recommendations`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            recommendedSeries: res.series,
                            rank: 1,
                            score: 0,
                            justification: res.justification
                        })
                    });
                    successCount++;
                }
            }
            toast({ title: "Enregistrement terminé", description: `${successCount} dossiers créés avec succès.` });
            setIsBatchDialogOpen(false);
            fetchOrientations();
        } catch (error: any) {
            toast({ title: "Erreur partielle", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateOrientation = async () => {
        setIsSubmitting(true);
        try {
            const student = students.find(s => s.id === selectedStudent);
            if (!student || !student.enrollments?.[0]) {
                throw new Error("Étudiant invalide ou sans inscription active.");
            }

            // 1. Create Orientation Base
            const baseRes = await fetch("/api/orientation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: selectedStudent,
                    academicYearId: student.enrollments[0].academicYearId,
                    classLevelId: student.enrollments[0].classLevelId
                })
            });

            if (!baseRes.ok) throw new Error("Erreur lors de la création du dossier d'orientation");
            const baseData = await baseRes.json();

            // 2. Add Recommendation Post-BEPC
            const recRes = await fetch(`/api/orientation/${baseData.id}/recommendations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recommendedSeries: selectedSeries,
                    rank: 1,
                    score: 0,
                    justification: justification || "Avis favorable suite aux résultats annuels."
                })
            });

            if (!recRes.ok) throw new Error("Erreur lors de l'ajout de la recommandation");

            toast({ title: "Orientation enregistrée", description: "Le dossier post-BEPC a été créé avec succès." });
            setIsDialogOpen(false);

            // Reset form
            setSelectedStudent("");
            setSelectedSeries("SERIE_D");
            setJustification("");

            fetchOrientations();
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusDetails = (status: string) => {
        switch (status) {
            case "PENDING": return { color: "bg-slate-500/10 text-slate-600 border-slate-500/20", label: "En attente" };
            case "ANALYZED": return { color: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Analysé" };
            case "RECOMMENDED": return { color: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Recommandation émise" };
            case "VALIDATED": return { color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Validé" };
            case "REJECTED": return { color: "bg-red-500/10 text-red-600 border-red-500/20", label: "Rejeté" };
            case "ACCEPTED": return { color: "bg-purple-500/10 text-purple-600 border-purple-500/20", label: "Accepté par la famille" };
            default: return { color: "bg-slate-500/10 text-slate-600", label: status };
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STUDENT"]}>
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                <PageHeader
                    title="Orientation Scolaire & Universitaire"
                    description="Gérez les vœux d'orientation, visualisez les recommandations du conseil de classe et suivez les parcours des élèves."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Accompagnement" },
                        { label: "Orientation" },
                    ]}
                    actions={
                        <div className="flex gap-3">
                            <Button 
                                variant="outline" 
                                className="gap-2 border-primary/20 hover:bg-primary/5 hidden sm:flex"
                                onClick={handleBatchAnalyze}
                                disabled={isBatchAnalyzing || students.length === 0}
                            >
                                {isBatchAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-500" />}
                                Lanceur d'Analyse Globale (IA)
                            </Button>

                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
                                        <Plus className="w-4 h-4" /> Nouvel Avis d'Orientation
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Émettre une recommandation d'orientation</DialogTitle>
                                        <DialogDescription>
                                            Suggérez un parcours (Série ou Filière) basé sur les performances académiques.
                                            L'IA peut vous aider à générer un avis argumenté en un clic.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Type d'Orientation</Label>
                                            <div className="flex gap-2">
                                                <Button 
                                                    type="button" 
                                                    variant={orientationType === "BEPC" ? "default" : "outline"} 
                                                    className="flex-1"
                                                    onClick={() => { setOrientationType("BEPC"); setSelectedSeries("SERIE_D"); }}
                                                >
                                                    Post-BEPC (2nde)
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    variant={orientationType === "BAC" ? "default" : "outline"} 
                                                    className="flex-1"
                                                    onClick={() => { setOrientationType("BAC"); setSelectedSeries("UNIV_SCIENCES"); }}
                                                >
                                                    Post-BAC (Supérieur)
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Élève Concerné</Label>
                                            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {students.map(s => (
                                                        <SelectItem key={s.id} value={s.id}>
                                                            {s.user.firstName} {s.user.lastName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {selectedStudent && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="mt-2 w-full gap-2 border-primary/30 text-primary hover:bg-primary/5 shadow-sm"
                                                    onClick={handleGenerateAI}
                                                    disabled={isGeneratingAI}
                                                >
                                                    {isGeneratingAI ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Sparkles className="w-4 h-4" />
                                                    )}
                                                    {isGeneratingAI ? "Analyse en cours..." : "Générer une recommandation via IA"}
                                                </Button>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{orientationType === "BEPC" ? "Série Recommandée" : "Filière Universitaire Suggérée"}</Label>
                                            <Select value={selectedSeries} onValueChange={setSelectedSeries}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(orientationType === "BEPC" ? POST_BEPC_SERIES : POST_BAC_OPTIONS).map(series => (
                                                        <SelectItem key={series.value} value={series.value}>
                                                            {series.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Justification Primaire (Conseil de classe)</Label>
                                            <Textarea
                                                
                                                value={justification}
                                                onChange={(e) => setJustification(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
                                        <Button onClick={handleCreateOrientation} disabled={isSubmitting || !selectedStudent || !selectedSeries || !justification}>
                                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            Enregistrer l'Avis
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
                                <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <Brain className="w-5 h-5 text-primary" />
                                            Résultats de l'Analyse Globale IA
                                        </DialogTitle>
                                        <DialogDescription>
                                            L'intelligence artificielle a analysé les performances académiques. 
                                            Veuillez revoir les propositions avant l'enregistrement massif.
                                        </DialogDescription>
                                    </DialogHeader>
                                    
                                    <div className="flex-1 overflow-y-auto my-4 border rounded-md">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2 text-left">Élève</th>
                                                    <th className="px-4 py-2 text-left">Série suggérée</th>
                                                    <th className="px-4 py-2 text-left">Justification</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {batchResults.map((res, i) => (
                                                    <tr key={i} className={res.success ? "" : "bg-red-50"}>
                                                        <td className="px-4 py-3 font-medium">{res.studentName}</td>
                                                        <td className="px-4 py-3">
                                                            {res.success ? (
                                                                <span className="font-bold text-primary">{res.series}</span>
                                                            ) : (
                                                                <span className="text-destructive">Échec</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                                            {res.justification || res.error}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsBatchDialogOpen(false)}>Ignorer</Button>
                                        <Button 
                                            onClick={handleSaveBatch} 
                                            disabled={isSubmitting || batchResults.filter(r => r.success).length === 0}
                                        >
                                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            Confirmer & Enregistrer ({batchResults.filter(r => r.success).length})
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    }
                />

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Colonne de statistiques (1/4) */}
                    <div className="md:col-span-1 space-y-4">
                        <Card className="shadow-sm border-border">
                            <CardContent className="p-6">
                                <div className="p-3 bg-primary/10 w-fit rounded-xl mb-4 text-primary">
                                    <GraduationCap className="w-6 h-6" />
                                </div>
                                <h3 className="text-2xl font-bold">{students.length}</h3>
                                <p className="text-sm text-muted-foreground font-medium">Élèves éligibles (Post-BEPC)</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-border bg-muted/5">
                            <CardContent className="p-6">
                                <div className="p-3 bg-amber-500/10 w-fit rounded-xl mb-4 text-amber-600">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <h3 className="text-2xl font-bold">{orientations.length}</h3>
                                <p className="text-sm text-muted-foreground font-medium">Dossiers d'orientation ouverts</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-border bg-muted/10">
                            <CardContent className="p-6 space-y-3">
                                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    Guide d'Orientation Post-BEPC
                                </h4>
                                <ul className="text-sm space-y-2 text-foreground/80">
                                    <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-emerald-500 shrink-0" /> Séries Scientifiques (C, D, E)</li>
                                    <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-rose-500 shrink-0" /> Séries Littéraires (A, Littérature)</li>
                                    <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-blue-500 shrink-0" /> Séries Techniques (F, G, Pro)</li>
                                    <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-amber-500 shrink-0" /> Apprentissage Direct</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Registre Principal (3/4) */}
                    <Card className="md:col-span-3 shadow-sm border-border overflow-hidden flex flex-col min-h-[500px]">
                        <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-9 bg-background" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground tracking-wide font-semibold border-b bg-muted/40">
                                    <tr>
                                        <th className="px-6 py-4">Élève & Classe</th>
                                        <th className="px-6 py-4">Année Académique</th>
                                        <th className="px-6 py-4">Recommandation Principale</th>
                                        <th className="px-6 py-4">Statut</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                                                <p className="text-muted-foreground">Chargement des dossiers d'orientation...</p>
                                            </td>
                                        </tr>
                                    ) : orientations.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                                                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p className="text-lg font-medium text-foreground">Aucun dossier trouvé</p>
                                                <p className="text-sm max-w-sm mx-auto mt-1">Les avis d'orientation Post-BEPC sont généralement saisis à l'issue du 3e trimestre.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        orientations.map((item) => {
                                            const st = getStatusDetails(item.status);
                                            const topRec = item.recommendations?.[0];
                                            const seriesLabel = topRec ? POST_BEPC_SERIES.find(s => s.value === topRec.recommendedSeries)?.label || topRec.recommendedSeries : "";

                                            return (
                                                <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-foreground">
                                                            {item.student?.user?.firstName} {item.student?.user?.lastName}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground font-medium mt-0.5 uppercase">
                                                            Niveau: {item.classLevel?.name || "N/A"}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-medium">
                                                        {item.academicYear?.name || "N/A"}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {topRec ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="font-bold text-primary flex items-center gap-1.5">
                                                                    Série suggérée: {seriesLabel}
                                                                </span>
                                                                {topRec.isValidated ? (
                                                                    <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full w-fit flex items-center gap-1 font-bold">
                                                                        <CheckCircle2 className="w-3 h-3" /> Validé
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full w-fit flex items-center gap-1 font-bold">
                                                                        <AlertCircle className="w-3 h-3" /> Non-validé
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground italic text-xs">Avis en cours de préparation...</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${st.color}`}>
                                                            {st.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Button variant="outline" size="sm" className="gap-2">
                                                            <FileText className="w-4 h-4" /> Consulter le dossier
                                                        </Button>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
