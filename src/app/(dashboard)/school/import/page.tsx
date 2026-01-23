"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileUp, Check, Loader2, ArrowRight, RefreshCw, AlertTriangle, Save, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColumnMapper } from "@/components/import/ColumnMapper";
import { ImportPreview } from "@/components/import/ImportPreview";
import { parseCsv, parseExcel, validateImportData } from "@/lib/import/parsers";
import { importTeacherSchema, importStudentSchema, importClassSchema } from "@/lib/import/schemas";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Configuration for each Entity Type
const IMPORT_CONFIG = {
    teacher: {
        label: "Enseignants",
        schema: importTeacherSchema,
        api: "/api/import/teachers",
        redirect: "/school/teachers",
        typeId: "TEACHER",
        requiredFields: [
            { key: "firstName", label: "Prénom", required: true },
            { key: "lastName", label: "Nom", required: true },
            { key: "email", label: "Email", required: true },
            { key: "phone", label: "Téléphone", required: false },
            { key: "subjects", label: "Matières", required: false },
        ]
    },
    student: {
        label: "Élèves",
        schema: importStudentSchema,
        api: "/api/import/students",
        redirect: "/school/students",
        typeId: "STUDENT",
        requiredFields: [
            { key: "firstName", label: "Prénom", required: true },
            { key: "lastName", label: "Nom", required: true },
            { key: "matricule", label: "Matricule", required: false }, // Optional, generated if missing
            { key: "className", label: "Classe", required: false }, // Should be mapped to class name
            { key: "dateOfBirth", label: "Date Naissance", required: false },
        ]
    },
    class: {
        label: "Classes",
        schema: importClassSchema,
        api: "/api/import/classes",
        redirect: "/school/classes",
        typeId: "CLASS",
        requiredFields: [
            { key: "name", label: "Nom Classe", required: true }, // e.g. 6ème A
            { key: "level", label: "Niveau", required: true }, // e.g. 6EME
            { key: "capacity", label: "Capacité", required: false },
            { key: "mainTeacherEmail", label: "Email PP", required: false },
        ]
    }
};

type EntityType = keyof typeof IMPORT_CONFIG;

export default function ImportPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<EntityType>("teacher");

    // Import State
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [rawData, setRawData] = useState<any[]>([]);
    const [mappedData, setMappedData] = useState<any[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});
    const [isProcessing, setIsProcessing] = useState(false);

    // Template State
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
    const [newTemplateName, setNewTemplateName] = useState("");
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

    const currentConfig = IMPORT_CONFIG[activeTab];

    // Fetch Templates on Tab Change
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await fetch(`/api/import/templates?type=${currentConfig.typeId}`);
                if (res.ok) {
                    const data = await res.json();
                    setTemplates(data);
                }
            } catch (error) {
                console.error("Failed to fetch templates", error);
            }
        };
        fetchTemplates();
    }, [activeTab, currentConfig.typeId]);

    const resetState = () => {
        setStep(1);
        setFile(null);
        setRawData([]);
        setMappedData([]);
        setMapping({});
        setValidationErrors({});
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value as EntityType);
        resetState();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setIsProcessing(true);

            try {
                let data: any[] = [];
                if (selectedFile.name.endsWith(".csv")) {
                    data = await parseCsv(selectedFile);
                } else if (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls")) {
                    data = await parseExcel(selectedFile);
                }

                if (data.length > 0) {
                    setRawData(data);
                    toast.success(`${data.length} lignes chargées`);
                } else {
                    toast.error("Le fichier semble vide");
                    setFile(null);
                }
            } catch (error) {
                console.error("Error parsing file:", error);
                toast.error("Erreur lors de la lecture du fichier");
                setFile(null);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleMappingComplete = (newMapping: Record<string, string>) => {
        setMapping(newMapping);
    };

    const applyMapping = () => {
        setIsProcessing(true);
        setTimeout(() => {
            const newMappedData = rawData.map(row => {
                const newRow: any = {};
                Object.entries(mapping).forEach(([fieldKey, header]) => {
                    if (header) {
                        newRow[fieldKey] = row[header];
                    }
                });

                if (activeTab === 'teacher' && newRow.subjects && typeof newRow.subjects === 'string') {
                    newRow.subjects = newRow.subjects.split(',').map((s: string) => s.trim());
                }
                if (activeTab === 'class' && newRow.capacity) {
                    newRow.capacity = Number(newRow.capacity) || 30;
                }

                return newRow;
            });

            setMappedData(newMappedData);

            const { invalid } = validateImportData(newMappedData, currentConfig.schema as any);
            const errors: Record<number, string[]> = {};
            invalid.forEach(inv => {
                errors[inv.row - 1] = inv.errors.map((e: any) => e.message || "Erreur invalide");
            });
            setValidationErrors(errors);

            setStep(3);
            setIsProcessing(false);
        }, 500);
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName) return;
        try {
            const res = await fetch("/api/import/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newTemplateName,
                    type: currentConfig.typeId,
                    mappings: mapping
                })
            });

            if (res.ok) {
                toast.success("Modèle enregistré avec succès");
                setIsSaveDialogOpen(false);
                setNewTemplateName("");
                // Refresh templates
                const updated = await fetch(`/api/import/templates?type=${currentConfig.typeId}`).then(r => r.json());
                setTemplates(updated);
            } else {
                throw new Error("Erreur sauvegarde");
            }
        } catch (_error) {
            toast.error("Impossible de sauvegarder le modèle");
        }
    };

    const handleLoadTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (template) {
            setMapping(template.mappings);
            setSelectedTemplateId(templateId);
            toast.success("Modèle appliqué");
        }
    };

    const handleFinalImport = async () => {
        setIsProcessing(true);
        try {
            const validRows = mappedData.filter((_, i) => !validationErrors[i]);

            if (validRows.length === 0) {
                toast.error("Aucune donnée valide à importer.");
                return;
            }

            const response = await fetch(currentConfig.api, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: validRows }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Erreur import");
            }

            const result = await response.json();

            if (result.errors && result.errors.length > 0) {
                toast.warning(`Import partiel: ${result.created} créés, ${result.errors.length} erreurs`);
            } else {
                toast.success(`Import réussi: ${result.created} éléments créés`);
            }

            setTimeout(() => {
                router.push(currentConfig.redirect);
            }, 1500);

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Erreur lors de l'import API");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Centre d&apos;Importation</h1>
                <p className="text-muted-foreground">Importez vos données en masse via fichiers CSV ou Excel.</p>
            </div>

            <Tabs defaultValue="teacher" value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
                    <TabsTrigger value="teacher">Enseignants</TabsTrigger>
                    <TabsTrigger value="student">Élèves</TabsTrigger>
                    <TabsTrigger value="class">Classes</TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Stepper Display */}
            <div className="relative flex items-center justify-between w-full max-w-2xl mx-auto mb-8 mt-4">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex flex-col items-center relative z-10">
                        <div
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all duration-300",
                                step >= s
                                    ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                                    : "bg-background border-muted text-muted-foreground"
                            )}
                        >
                            {step > s ? <Check className="w-5 h-5" /> : s}
                        </div>
                        <span className={cn(
                            "mt-2 text-xs font-medium uppercase tracking-wider",
                            step >= s ? "text-primary" : "text-muted-foreground"
                        )}>
                            {s === 1 ? "Upload" : s === 2 ? "Mapping" : "Validation"}
                        </span>
                    </div>
                ))}
                <div className="absolute top-5 left-0 w-full h-0.5 bg-muted -z-0" />
                <motion.div
                    className="absolute top-5 left-0 h-0.5 bg-primary -z-0"
                    initial={{ width: "0%" }}
                    animate={{ width: step === 1 ? "0%" : step === 2 ? "50%" : "100%" }}
                />
            </div>

            <Card variant="glass" className="overflow-hidden min-h-[500px] flex flex-col">
                <CardHeader className="border-b bg-muted/20">
                    <CardTitle className="flex items-center gap-2">
                        {step === 1 && <Upload className="w-5 h-5 text-primary" />}
                        {step === 2 && <RefreshCw className="w-5 h-5 text-primary" />}
                        {step === 3 && <Check className="w-5 h-5 text-primary" />}

                        {step === 1 && `Charger un fichier (${currentConfig.label})`}
                        {step === 2 && "Correspondance des colonnes"}
                        {step === 3 && "Validation des données"}
                    </CardTitle>
                    <CardDescription>
                        {step === 1 && "Formats supportés : .csv, .xlsx. Taille max : 5MB."}
                        {step === 2 && "Associez les colonnes de votre fichier aux champs requis."}
                        {step === 3 && "Vérifiez les erreurs avant de finaliser l'import."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-8 flex-1">
                    {step === 1 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center justify-center h-full space-y-6"
                        >
                            <div
                                className={cn(
                                    "w-full max-w-xl border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-muted/30 hover:border-primary/50",
                                    file ? "border-primary bg-primary/5 shadow-inner" : "border-muted-foreground/20"
                                )}
                                onClick={() => !isProcessing && document.getElementById('file-upload')?.click()}
                            >
                                <Input
                                    id="file-upload"
                                    type="file"
                                    className="hidden"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleFileChange}
                                    disabled={isProcessing}
                                />

                                {isProcessing ? (
                                    <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary shadow-sm">
                                        <FileUp className="w-8 h-8" />
                                    </div>
                                )}

                                {file ? (
                                    <div className="space-y-1">
                                        <p className="font-bold text-xl text-primary">{file.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {(file.size / 1024).toFixed(2)} KB • {rawData.length} lignes détectées
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="font-semibold text-lg">Cliquez pour parcourir</p>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                            Supporte CSV et Excel.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-between items-center bg-muted/20 p-4 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <LayoutTemplate className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-sm font-medium">Modèles :</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={selectedTemplateId} onValueChange={handleLoadTemplate} disabled={templates.length === 0}>
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Charger un modèle..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templates.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Save className="w-4 h-4 mr-2" />
                                                Enregistrer
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Enregistrer comme modèle</DialogTitle>
                                                <DialogDescription>
                                                    Donnez un nom à ce mapping pour le réutiliser plus tard.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="py-4">
                                                <Label htmlFor="t-name">Nom du modèle</Label>
                                                <Input
                                                    id="t-name"
                                                    value={newTemplateName}
                                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                                    placeholder="ex: Import Annuel 2024"
                                                    className="mt-2"
                                                />
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Annuler</Button>
                                                <Button onClick={handleSaveTemplate}>Sauvegarder</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>

                            <ColumnMapper
                                headers={rawData.length > 0 ? Object.keys(rawData[0]) : []}
                                requiredFields={currentConfig.requiredFields}
                                onMappingComplete={handleMappingComplete}
                                initialMapping={mapping}
                            />
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <ImportPreview
                                data={mappedData}
                                validationErrors={validationErrors}
                            />

                            {Object.keys(validationErrors).length > 0 && (
                                <div className="mt-4 p-4 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive flex items-center gap-3">
                                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                    <p className="text-sm">Certaines lignes contiennent des erreurs et ne seront pas importées. Corrigez votre fichier ou ignorez ces lignes.</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </CardContent>

                <div className="border-t bg-muted/30 p-6 flex justify-between items-center">
                    <Button
                        variant="ghost"
                        onClick={() => setStep(prev => prev - 1)}
                        disabled={step === 1 || isProcessing}
                    >
                        Retour
                    </Button>

                    <div className="flex gap-2">
                        {step === 1 && (
                            <Button onClick={() => setStep(2)} disabled={!file || rawData.length === 0 || isProcessing}>
                                Configurer le mapping <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}
                        {step === 2 && (
                            <Button onClick={applyMapping} disabled={isProcessing}>
                                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Valider et Prévisualiser
                            </Button>
                        )}
                        {step === 3 && (
                            <Button onClick={handleFinalImport} disabled={isProcessing}>
                                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Lancer l&apos;importation ({mappedData.length - Object.keys(validationErrors).length})
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
