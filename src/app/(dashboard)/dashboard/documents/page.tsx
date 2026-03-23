"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Permission } from "@/lib/rbac/permissions";
import {
    FileText, Download, Printer, Loader2, CheckCircle2,
    Users, BookOpen, GraduationCap, ArrowRight
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PageCallout } from "@/components/layout/page-callout";
import { t } from "@/lib/i18n";

type Student = {
    id: string;
    user: { firstName: string; lastName: string; };
    matricule: string;
    enrollments: { class: { name: string; } }[];
};

export default function DocumentGeneratorPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState("");
    const [selectedDoc, setSelectedDoc] = useState("CERTIFICATE_ENROLLMENT");

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const res = await fetch("/api/students");
                if (res.ok) {
                    const data = await res.json();
                    setStudents(data.students || []);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchStudents();
    }, []);

    const handleGenerate = async () => {
        if (!selectedStudent) {
            alert("Veuillez sélectionner un élève");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/documents/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: selectedStudent,
                    documentType: selectedDoc
                })
            });

            if (!res.ok) throw new Error("Échec de la génération");

            const data = await res.json();

            // Initiate download
            const link = document.createElement("a");
            link.href = data.url;
            link.download = data.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert("Document généré avec succès !");
        } catch (error) {
            alert("Erreur lors de la génération du document.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                <PageHeader
                    title="Générateur de Documents (Édition PDF)"
                    description="Exportez facilement les certificats de scolarité, attestations et bulletins en format PDF sécurisé."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Administration" },
                        { label: "Documents" },
                    ]}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="shadow-sm border-border">
                        <CardHeader className="bg-muted/10 pb-4 border-b">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <FileText className="w-5 h-5 text-primary" />
                                Paramètres Généraux
                            </CardTitle>
                            <CardDescription>Sélectionnez les critères d'impression du document officiel.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {students.length === 0 && (
                                <PageCallout
                                    icon={Users}
                                    title="Aucun élève disponible"
                                    description="Pour générer un document officiel, vous devez d’abord avoir des élèves inscrits. Ajoutez des élèves via l’inscription ou l’import."
                                    actions={[
                                        { label: "Inscrire un élève", href: "/dashboard/students/new" },
                                        { label: t("common.import"), href: "/dashboard/import", variant: "outline" },
                                    ]}
                                />
                            )}

                            <div className="space-y-3">
                                <label className="text-sm font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Type de Document
                                </label>
                                <Select value={selectedDoc} onValueChange={setSelectedDoc}>
                                    <SelectTrigger className="w-full text-left font-medium">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CERTIFICATE_ENROLLMENT">Certificat de Scolarité</SelectItem>
                                        <SelectItem value="BEHAVIOR_REPORT">Attestation de Bonne Conduite</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Sélectionner un Élève
                                </label>
                                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                                    <SelectTrigger className="w-full text-left">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {students.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.user.firstName} {s.user.lastName} ({s.matricule})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 border-t flex flex-col gap-3 sm:flex-row">
                                <Button
                                    className="flex-1 gap-2 font-semibold"
                                    onClick={handleGenerate}
                                    disabled={loading || students.length === 0}
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    Générer & Télécharger le PDF
                                </Button>
                                <Button variant="outline" className="gap-2 shrink-0 border-border" disabled={loading}>
                                    <Printer className="w-4 h-4" /> Aperçu avant impression
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-border overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
                        <CardContent className="p-8 h-full flex flex-col justify-center items-center text-center">
                            <div className="w-20 h-20 bg-background rounded-2xl shadow-sm flex items-center justify-center text-primary mb-6 border border-primary/20 relative">
                                <FileText className="w-10 h-10" />
                                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1 rounded-full border-2 border-background">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                            </div>

                            <h3 className="text-2xl font-bold mb-3 tracking-tight">Format Conforme & Authentifié</h3>
                            <p className="text-muted-foreground text-sm max-w-sm mb-8 leading-relaxed">
                                Tous les documents PDF générés depuis cette console incluent automatiquement le filigrane de l'école, l'en-tête officiel, et une signature électronique validée par la direction.
                            </p>

                            <div className="w-full space-y-3 mt-auto">
                                <Button variant="secondary" className="w-full justify-start text-left bg-background hover:bg-muted/50 border shadow-sm group">
                                    <div className="w-8 h-8 rounded shrink-0 bg-primary/10 flex items-center justify-center text-primary mr-3">
                                        <BookOpen className="w-4 h-4" />
                                    </div>
                                    <span className="flex-1 font-medium text-foreground">Générer les Bulletins de Notes</span>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 transform" />
                                </Button>
                                <Button variant="secondary" className="w-full justify-start text-left bg-background hover:bg-muted/50 border shadow-sm group">
                                    <div className="w-8 h-8 rounded shrink-0 bg-emerald-500/10 flex items-center justify-center text-emerald-600 mr-3">
                                        <GraduationCap className="w-4 h-4" />
                                    </div>
                                    <span className="flex-1 font-medium text-foreground">Consulter les dossiers d'orientation</span>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 transform" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </PageGuard>
    );
}
