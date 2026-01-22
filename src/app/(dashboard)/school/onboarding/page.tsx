"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileUp, Check, Loader2, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColumnMapper } from "@/components/import/ColumnMapper";
import { ImportPreview } from "@/components/import/ImportPreview";
import { parseCsv, parseExcel, validateImportData } from "@/lib/import/parsers";
import { importTeacherSchema } from "@/lib/import/schemas";
// Toast imports removed - using sonner from layout
// Actually package.json has "sonner": "^2.0.7", so I should add Toaster in layout or here.

// Required fields for Teachers
const TEACHER_REQUIRED_FIELDS = [
    { key: "firstName", label: "Prénom", required: true },
    { key: "lastName", label: "Nom", required: true },
    { key: "email", label: "Email", required: true },
    { key: "phone", label: "Téléphone", required: false },
    { key: "subjects", label: "Matières", required: false }, // String separated by commas
];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [rawData, setRawData] = useState<any[]>([]);
    const [mappedData, setMappedData] = useState<any[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});
    const [isProcessing, setIsProcessing] = useState(false);

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
                    // toast.success(`${data.length} lignes chargées`);
                } else {
                    // toast.error("Le fichier semble vide");
                    setFile(null);
                }
            } catch (error) {
                console.error("Error parsing file:", error);
                // toast.error("Erreur lors de la lecture du fichier");
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
                // Handle subjects splitting if needed, simplistic for now
                if (newRow.subjects && typeof newRow.subjects === 'string') {
                    newRow.subjects = newRow.subjects.split(',').map((s: string) => s.trim());
                }
                return newRow;
            });

            setMappedData(newMappedData);

            // Validate
            const { invalid } = validateImportData(newMappedData, importTeacherSchema);
            const errors: Record<number, string[]> = {};
            invalid.forEach(inv => {
                // Map 0-based index to error list
                errors[inv.row - 1] = inv.errors.map((e: any) => e.message || "Erreur invalide");
            });
            setValidationErrors(errors);

            setStep(3);
            setIsProcessing(false);
        }, 500);
    };

    const handleFinalImport = async () => {
        setIsProcessing(true);
        try {
            const validRows = mappedData.filter((_, i) => !validationErrors[i]);

            if (validRows.length === 0) {
                alert("Aucune donnée valide à importer."); // Fallback if toast not ready
                return;
            }

            const response = await fetch("/api/import/teachers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: validRows }),
            });

            if (!response.ok) throw new Error("Erreur import");

            await response.json();
            // toast.success(`Import réussi: ${result.created} créés`);

            setTimeout(() => {
                router.push("/school/teachers");
            }, 1500);

        } catch (error) {
            console.error(error);
            // toast.error("Erreur lors de l'import API");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Import des Enseignants</h1>
                <p className="text-muted-foreground">Suivez les étapes pour importer vos enseignants via CSV ou Excel.</p>
            </div>

            {/* Stepper */}
            <div className="relative flex items-center justify-between w-full max-w-2xl mx-auto mb-8">
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

                        {step === 1 && "Charger un fichier"}
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
                                        <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(2)} KB • {rawData.length} lignes détectées</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="font-semibold text-lg">Cliquez pour parcourir</p>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                            Supporte CSV et Excel. Glissez-déposez bientôt disponible.
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
                            <ColumnMapper
                                headers={rawData.length > 0 ? Object.keys(rawData[0]) : []}
                                requiredFields={TEACHER_REQUIRED_FIELDS}
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
                            <Button onClick={handleFinalImport} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white">
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
