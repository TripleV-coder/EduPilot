"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageGuard } from "@/components/guard/page-guard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertCircle,
    CheckCircle2,
    Save,
    Plus,
    Trash2,
    LayoutGrid,
    GraduationCap,
    Star,
    RefreshCw
} from "lucide-react";
import { t } from "@/lib/i18n";

const DEFAULT_BAC_SUBJECTS: ExamSubject[] = [
    { code: "MATH", name: "Mathématiques", coefficient: 4 },
    { code: "PC", name: "Physique Chimie", coefficient: 4 },
    { code: "SVT", name: "SVT", coefficient: 4 },
    { code: "FR", name: "Français", coefficient: 2 },
    { code: "ANG", name: "Anglais", coefficient: 2 },
    { code: "PHILO", name: "Philosophie", coefficient: 2 },
    { code: "HG", name: "Hist-Géo", coefficient: 2 },
    { code: "EPS", name: "EPS", coefficient: 1 },
];

const DEFAULT_MENTIONS: Mention[] = [
    { code: "TBIEN", label: "Très Bien", minScore: 16, maxScore: 20, color: "#059669" },
    { code: "BIEN", label: "Bien", minScore: 14, maxScore: 15.99, color: "#10b981" },
    { code: "ABIEN", label: "Assez Bien", minScore: 12, maxScore: 13.99, color: "#3b82f6" },
    { code: "PASSABLE", label: "Passable", minScore: 10, maxScore: 11.99, color: "#94a3b8" },
    { code: "ELIM", label: "Éliminé", minScore: 0, maxScore: 9.99, color: "#ef4444" },
];

type ExamSubject = {
    code: string;
    name: string;
    coefficient: number;
};

type Mention = {
    code: string;
    label: string;
    minScore: number;
    maxScore: number;
    color: string;
};

type ConfigOption = {
    id: string;
    category: string;
    code: string;
    label: string;
    metadata: any;
};

export default function ReformsPage() {
    const [configs, setConfigs] = useState<ConfigOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Temp state for editing
    const [cepSubjects, setCepSubjects] = useState<ExamSubject[]>([]);
    const [bepcSubjects, setBepcSubjects] = useState<ExamSubject[]>([]);
    const [bacSubjects, setBacSubjects] = useState<ExamSubject[]>([]);
    const [mentions, setMentions] = useState<Mention[]>([]);

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/config/reforms");
            if (!res.ok) throw new Error("Erreur de chargement");
            const data: ConfigOption[] = await res.json();
            setConfigs(data);

            // Extract values
            const cep = data.find(c => c.code === "CEP")?.metadata?.subjects || [];
            const bepc = data.find(c => c.code === "BEPC")?.metadata?.subjects || [];
            const bac = data.find(c => c.code === "BAC")?.metadata?.subjects || [];
            const m = data.find(c => c.code === "MENTIONS")?.metadata?.mentions || [];
 
            setCepSubjects(cep);
            setBepcSubjects(bepc);
            setBacSubjects(bac.length > 0 ? bac : DEFAULT_BAC_SUBJECTS);
            setMentions(m.length > 0 ? m : DEFAULT_MENTIONS);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (code: string, metadata: any) => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/config/reforms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category: ["CEP", "BEPC", "BAC"].includes(code) ? "NATIONAL_EXAMS" : "GRADE_SETTINGS",
                    code,
                    metadata
                }),
            });
            if (!res.ok) throw new Error("Erreur lors de la sauvegarde");
            setSuccess(`Configuration ${code} mise à jour`);
            setTimeout(() => setSuccess(null), 3000);
            loadConfigs();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const addSubject = (type: "CEP" | "BEPC" | "BAC") => {
        let set;
        if (type === "CEP") set = setCepSubjects;
        else if (type === "BEPC") set = setBepcSubjects;
        else set = setBacSubjects;
        set(prev => [...prev, { code: "NEW", name: "Nouvelle Matière", coefficient: 1 }]);
    };
 
    const removeSubject = (type: "CEP" | "BEPC" | "BAC", index: number) => {
        let set;
        if (type === "CEP") set = setCepSubjects;
        else if (type === "BEPC") set = setBepcSubjects;
        else set = setBacSubjects;
        set(prev => prev.filter((_, i) => i !== index));
    };
 
    const updateSubject = (type: "CEP" | "BEPC" | "BAC", index: number, field: keyof ExamSubject, value: any) => {
        let set;
        if (type === "CEP") set = setCepSubjects;
        else if (type === "BEPC") set = setBepcSubjects;
        else set = setBacSubjects;
        set(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    };

    const addMention = () => {
        setMentions(prev => [...prev, { code: `M${prev.length + 1}`, label: "Nouvelle Mention", minScore: 10, maxScore: 12, color: "#94a3b8" }]);
    };

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 max-w-6xl mx-auto">
                <PageHeader
                    title="Gestion des Réformes Nationales"
                    description="Configurez les matières d'examen et les mentions de notes au niveau national."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Root Control", href: "/dashboard/root-control" },
                        { label: "Réformes" },
                    ]}
                />

                {(error || success) && (
                    <div className={`p-4 rounded-lg flex items-center gap-3 border ${error ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                        }`}>
                        {error ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                        <p className="text-sm font-medium">{error || success}</p>
                    </div>
                )}

                <Tabs defaultValue="cep" className="space-y-6">
                    <TabsList className="bg-muted/50 border border-border">
                        <TabsTrigger value="cep" className="gap-2"><GraduationCap className="h-4 w-4" /> Examens CEP</TabsTrigger>
                        <TabsTrigger value="bepc" className="gap-2"><GraduationCap className="h-4 w-4" /> Examens BEPC</TabsTrigger>
                        <TabsTrigger value="bac" className="gap-2"><GraduationCap className="h-4 w-4" /> Examens BAC</TabsTrigger>
                        <TabsTrigger value="mentions" className="gap-2"><Star className="h-4 w-4" /> Mentions Globales</TabsTrigger>
                    </TabsList>

                    {/* CEP CONFIG */}
                    <TabsContent value="cep">
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Matières & Coefficients CEP</CardTitle>
                                    <CardDescription>Définissez la pondération officielle pour le Certificat d'Études Primaires.</CardDescription>
                                </div>
                                <Button onClick={() => addSubject("CEP")} variant="outline" size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" /> Ajouter
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-12 gap-4 font-semibold text-sm text-muted-foreground pb-2 border-b">
                                    <div className="col-span-3">Code</div>
                                    <div className="col-span-6">Nom</div>
                                    <div className="col-span-2 text-center">Coef</div>
                                    <div className="col-span-1"></div>
                                </div>
                                {cepSubjects.map((s, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-4 items-center">
                                        <div className="col-span-3"><Input value={s.code} onChange={e => updateSubject("CEP", i, "code", e.target.value)} /></div>
                                        <div className="col-span-6"><Input value={s.name} onChange={e => updateSubject("CEP", i, "name", e.target.value)} /></div>
                                        <div className="col-span-2 text-center"><Input type="number" step="0.5" value={s.coefficient} onChange={e => updateSubject("CEP", i, "coefficient", parseFloat(e.target.value))} /></div>
                                        <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeSubject("CEP", i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></div>
                                    </div>
                                ))}
                                <div className="flex justify-end pt-4">
                                    <Button onClick={() => handleSave("CEP", { subjects: cepSubjects })} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                                        <Save className="h-4 w-4" /> {saving ? "Sauvegarde..." : "Enregistrer les modifications"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* BEPC CONFIG */}
                    <TabsContent value="bepc">
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Matières & Coefficients BEPC</CardTitle>
                                    <CardDescription>Définissez la pondération officielle pour le Brevet d'Études du Premier Cycle.</CardDescription>
                                </div>
                                <Button onClick={() => addSubject("BEPC")} variant="outline" size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" /> Ajouter
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-12 gap-4 font-semibold text-sm text-muted-foreground pb-2 border-b">
                                    <div className="col-span-3">Code</div>
                                    <div className="col-span-6">Nom</div>
                                    <div className="col-span-2 text-center">Coef</div>
                                    <div className="col-span-1"></div>
                                </div>
                                {bepcSubjects.map((s, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-4 items-center">
                                        <div className="col-span-3"><Input value={s.code} onChange={e => updateSubject("BEPC", i, "code", e.target.value)} /></div>
                                        <div className="col-span-6"><Input value={s.name} onChange={e => updateSubject("BEPC", i, "name", e.target.value)} /></div>
                                        <div className="col-span-2 text-center"><Input type="number" step="0.5" value={s.coefficient} onChange={e => updateSubject("BEPC", i, "coefficient", parseFloat(e.target.value))} /></div>
                                        <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeSubject("BEPC", i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></div>
                                    </div>
                                ))}
                                <div className="flex justify-end pt-4">
                                    <Button onClick={() => handleSave("BEPC", { subjects: bepcSubjects })} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                                        <Save className="h-4 w-4" /> {saving ? "Sauvegarde..." : "Enregistrer les modifications"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* BAC CONFIG */}
                    <TabsContent value="bac">
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Matières & Coefficients BAC</CardTitle>
                                    <CardDescription>Définissez la pondération officielle pour le Baccalauréat.</CardDescription>
                                </div>
                                <Button onClick={() => addSubject("BAC")} variant="outline" size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" /> Ajouter
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-12 gap-4 font-semibold text-sm text-muted-foreground pb-2 border-b">
                                    <div className="col-span-3">Code</div>
                                    <div className="col-span-6">Nom</div>
                                    <div className="col-span-2 text-center">Coef</div>
                                    <div className="col-span-1"></div>
                                </div>
                                {bacSubjects.map((s, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-4 items-center">
                                        <div className="col-span-3"><Input value={s.code} onChange={e => updateSubject("BAC", i, "code", e.target.value)} /></div>
                                        <div className="col-span-6"><Input value={s.name} onChange={e => updateSubject("BAC", i, "name", e.target.value)} /></div>
                                        <div className="col-span-2 text-center"><Input type="number" step="0.5" value={s.coefficient} onChange={e => updateSubject("BAC", i, "coefficient", parseFloat(e.target.value))} /></div>
                                        <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeSubject("BAC", i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></div>
                                    </div>
                                ))}
                                <div className="flex justify-end pt-4">
                                    <Button onClick={() => handleSave("BAC", { subjects: bacSubjects })} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                                        <Save className="h-4 w-4" /> {saving ? "Sauvegarde..." : "Enregistrer les modifications"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* MENTIONS CONFIG */}
                    <TabsContent value="mentions">
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Système de Mentions</CardTitle>
                                    <CardDescription>Seuils de réussite et libellés pour les moyennes générales.</CardDescription>
                                </div>
                                <Button onClick={addMention} variant="outline" size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" /> Ajouter une Mention
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-xs text-muted-foreground italic">Note: Cette configuration est mondiale pour toute la plateforme EduPilot.</p>
                                <div className="space-y-4 pb-4">
                                    {mentions.map((m, i) => (
                                        <div key={i} className="flex flex-wrap gap-4 items-end p-4 rounded-xl border border-border/40 bg-muted/20 relative group">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => setMentions(prev => prev.filter((_, idx) => idx !== i))} 
                                                className="absolute top-2 right-2 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase">Libellé</Label>
                                                <Input value={m.label} onChange={e => setMentions(prev => prev.map((item, idx) => idx === i ? { ...item, label: e.target.value } : item))} className="w-40" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase">Seuil Min</Label>
                                                <Input type="number" step="0.5" value={m.minScore} onChange={e => setMentions(prev => prev.map((item, idx) => idx === i ? { ...item, minScore: parseFloat(e.target.value) } : item))} className="w-24" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase">Seuil Max</Label>
                                                <Input type="number" step="0.5" value={m.maxScore} onChange={e => setMentions(prev => prev.map((item, idx) => idx === i ? { ...item, maxScore: parseFloat(e.target.value) } : item))} className="w-24" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase">Couleur (Hex)</Label>
                                                <div className="flex gap-2 items-center">
                                                    <div className="h-8 w-8 rounded-full border border-border shrink-0" style={{ backgroundColor: m.color }}></div>
                                                    <Input value={m.color} onChange={e => setMentions(prev => prev.map((item, idx) => idx === i ? { ...item, color: e.target.value } : item))} className="w-32" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button onClick={() => handleSave("MENTIONS", { mentions })} disabled={saving} className="gap-2 bg-purple-600 hover:bg-purple-700">
                                        <Save className="h-4 w-4" /> {saving ? "Sauvegarde..." : "Enregistrer les Mentions"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </PageGuard>
    );
}
