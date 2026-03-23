"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Upload, CheckCircle2, AlertTriangle, 
  ArrowRight, Loader2, ListChecks, Database, 
  UserPlus, GraduationCap, BookOpen, FileText, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { t } from "@/lib/i18n";
import {
  applyMapping,
  suggestMapping,
  STUDENT_FIELDS,
  TEACHER_FIELDS,
  CLASS_FIELDS,
  PARENT_FIELDS,
  type FieldDefinition,
} from "@/lib/import/mapping-utils";

type ImportStep = "SELECT_TYPE" | "UPLOAD" | "MAPPING" | "VALIDATE" | "PROCESS";

type SupportedImportType = "STUDENTS" | "TEACHERS" | "CLASSES" | "PARENTS";

const IMPORT_TYPES: Array<{
  id: SupportedImportType;
  previewType: "students" | "teachers" | "classes" | "parents";
  endpoint: string;
  label: string;
  description: string;
  icon: typeof UserPlus;
  color: string;
  bg: string;
}> = [
  {
    id: "STUDENTS",
    previewType: "students",
    endpoint: "/api/import/students",
    label: "Élèves",
    description: "Importez votre base d'élèves, matricules et contacts parents.",
    icon: UserPlus,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    id: "TEACHERS",
    previewType: "teachers",
    endpoint: "/api/import/teachers",
    label: "Enseignants",
    description: "Annuaires des professeurs et spécialités.",
    icon: GraduationCap,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    id: "CLASSES",
    previewType: "classes",
    endpoint: "/api/import/classes",
    label: "Classes",
    description: "Créez vos classes avec niveau, capacité et professeur principal.",
    icon: BookOpen,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    id: "PARENTS",
    previewType: "parents",
    endpoint: "/api/import/parents",
    label: "Parents",
    description: "Importez les contacts tuteurs et liez-les aux élèves existants.",
    icon: FileText,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
];

export default function ImportWizardPage() {
  const [step, setStep] = useState<ImportStep>("SELECT_TYPE");
  const [selectedType, setSelectedType] = useState<SupportedImportType | null>(null);
  const [fileData, setFileData] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewSummary, setPreviewSummary] = useState<{ total: number; valid: number; invalid: number; percentage: number } | null>(null);
  const [previewErrors, setPreviewErrors] = useState<Array<{ row: number; errors?: Array<{ message: string }>; message?: string }>>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importErrors, setImportErrors] = useState<Array<{ row?: number; error?: string; details?: string }>>([]);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsSubmitting] = useState(false);

  const selectedConfig = selectedType ? IMPORT_TYPES.find((it) => it.id === selectedType) ?? null : null;

  const getTargetFields = (type: SupportedImportType | null): FieldDefinition[] => {
    if (type === "STUDENTS") return STUDENT_FIELDS;
    if (type === "TEACHERS") return TEACHER_FIELDS;
    if (type === "CLASSES") return CLASS_FIELDS;
    if (type === "PARENTS") return PARENT_FIELDS;
    return [];
  };

  const resetFlow = () => {
    setStep("SELECT_TYPE");
    setSelectedType(null);
    setFileData([]);
    setHeaders([]);
    setMapping({});
    setPreviewSummary(null);
    setPreviewErrors([]);
    setImportedCount(0);
    setImportErrors([]);
    setProgress(0);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      if (data.length > 0) {
        const parsedHeaders = (data[0] as string[]).map((h) => String(h || "").trim()).filter(Boolean);
        const rows = (data.slice(1) as unknown[][])
          .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== ""))
          .map((row) => {
            const obj: Record<string, unknown> = {};
            parsedHeaders.forEach((header, i) => {
              obj[header] = row[i];
            });
            return obj;
          });

        setHeaders(parsedHeaders);
        setFileData(rows);
        setPreviewSummary(null);
        setPreviewErrors([]);

        const targetFields = getTargetFields(selectedType);
        setMapping(suggestMapping(parsedHeaders, targetFields));
        setStep("MAPPING");
      }
    };
    reader.readAsBinaryString(file);
  };

  const runPreview = async () => {
    if (!selectedConfig) return;
    setIsValidating(true);
    try {
      const mappedData = applyMapping(fileData, mapping);
      const res = await fetch("/api/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedConfig.previewType,
          data: mappedData,
          limit: 20,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || payload?.message || "Échec de la prévalidation");
      }
      setPreviewSummary(payload.summary);
      setPreviewErrors(payload.errors || []);
      setStep("VALIDATE");
    } catch (err: any) {
      toast({ title: "Prévalidation échouée", description: err.message, variant: "destructive" });
    } finally {
      setIsValidating(false);
    }
  };

  const startImport = async () => {
    if (!selectedConfig) return;
    setIsSubmitting(true);
    setProgress(10);
    
    try {
      const mappedData = applyMapping(fileData, mapping);
      setProgress(35);
      const res = await fetch(selectedConfig.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: mappedData }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result?.error || "Erreur lors de l'injection");
      }

      const count = Number(result?.created ?? result?.count ?? 0);
      const errors = Array.isArray(result?.errors) ? result.errors : [];
      setImportedCount(count);
      setImportErrors(errors);
      setProgress(100);
      setStep("PROCESS");
      if (errors.length > 0) {
        toast({
          title: "Importation partielle",
          description: `${count} enregistrements importés, ${errors.length} lignes en erreur.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Importation Réussie",
          description: `${count} enregistrements ont été ajoutés à la base.`,
        });
      }
    } catch (err: any) {
      toast({ title: "Erreur d'importation", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetFields = getTargetFields(selectedType);
  const targetFieldsByKey = new Map(targetFields.map((f) => [f.key, f]));
  const mappedCount = headers.filter((header) => Boolean(mapping[header])).length;
  const hasBlockingErrors = (previewSummary?.invalid || 0) > 0;
  const successRedirect =
    selectedType === "TEACHERS"
      ? "/dashboard/teachers"
      : selectedType === "CLASSES"
        ? "/dashboard/classes"
        : selectedType === "PARENTS"
          ? "/dashboard/parents"
          : "/dashboard/students";

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto animate-in fade-in duration-500 pb-20">
      <PageHeader 
        title="Assistant d'Importation" 
        description="Migrez vos données historiques Excel ou CSV vers la plateforme EduPilot en quelques minutes."
      />

      {/* Stepper Visual */}
      <div className="flex items-center justify-between max-w-2xl mx-auto mb-12">
        {["Type", "Fichier", "Mapping", "Validation"].map((s, i) => {
          const stepIndex = ["SELECT_TYPE", "UPLOAD", "MAPPING", "VALIDATE", "PROCESS"].indexOf(step);
          const isActive = i <= stepIndex;
          return (
            <div key={s} className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all",
                isActive ? "bg-primary text-white scale-110 shadow-lg" : "bg-muted text-muted-foreground"
              )}>{i + 1}</div>
              <span className={cn("text-xs font-bold uppercase tracking-tighter hidden sm:inline", isActive ? "text-foreground" : "text-muted-foreground")}>{s}</span>
              {i < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground/30" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Select Type */}
      {step === "SELECT_TYPE" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {IMPORT_TYPES.map((type) => (
            <Card 
              key={type.id} 
              className={cn(
                "cursor-pointer hover:border-primary/50 transition-all group relative overflow-hidden",
                selectedType === type.id ? "border-primary ring-1 ring-primary/20 shadow-xl" : "border-border/50"
              )}
              onClick={() => setSelectedType(type.id)}
            >
              <CardContent className="p-6 flex gap-5">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", type.bg)}>
                  <type.icon className={cn("w-7 h-7", type.color)} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">{type.label}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{type.description}</p>
                </div>
                <div className={cn(
                  "absolute bottom-0 right-0 p-2 transition-transform duration-300",
                  selectedType === type.id ? "translate-x-0" : "translate-x-full"
                )}>
                  <div className="bg-primary text-white rounded-tl-xl p-1.5 shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="md:col-span-2 flex justify-end mt-4">
            <Button 
              disabled={!selectedType} 
              onClick={() => setStep("UPLOAD")}
              className="h-12 px-8 rounded-xl font-bold uppercase tracking-widest shadow-xl hover:shadow-primary/20 transition-all gap-3"
            >
              Étape Suivante
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Upload */}
      {step === "UPLOAD" && (
        <Card className="border-none shadow-none bg-muted/20">
          <CardContent className="p-12">
            <div className="max-w-xl mx-auto text-center space-y-8">
              <div className="w-24 h-24 bg-background rounded-3xl flex items-center justify-center mx-auto shadow-sm border border-border/50">
                <Upload className="w-10 h-10 text-primary animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black">Téléversez votre fichier Excel</h3>
                <p className="text-sm text-muted-foreground">Format supportés : .xlsx, .xls, .csv. Taille max : 10 Mo.</p>
              </div>
              
              <div className="relative group">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="p-10 border-2 border-dashed border-border group-hover:border-primary/50 rounded-2xl bg-background/50 transition-colors">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Cliquez ou glissez-déposez ici</p>
                </div>
              </div>

              <Button variant="ghost" className="text-xs font-bold uppercase" onClick={() => setStep("SELECT_TYPE")}>
                Changer le type de données
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Mapping */}
      {step === "MAPPING" && (
        <div className="space-y-6">
          <Card className="border-none shadow-none bg-muted/20">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                Mapping des Colonnes
              </CardTitle>
              <CardDescription className="text-xs">Faites correspondre les colonnes de votre fichier aux champs EduPilot.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/50 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 text-left">Champ EduPilot</th>
                    <th className="px-6 py-4 text-left">Colonne dans votre fichier</th>
                    <th className="px-6 py-4 text-left">Aperçu donnée</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {headers.map((header, i) => (
                    <tr key={i} className="hover:bg-background/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-primary">
                        {mapping[header]
                          ? targetFieldsByKey.get(mapping[header])?.label || mapping[header]
                          : "Non mappé"}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={mapping[header] || ""}
                          onChange={(event) =>
                            setMapping((current) => ({
                              ...current,
                              [header]: event.target.value,
                            }))
                          }
                          className="bg-background border border-border/50 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary w-full max-w-[260px]"
                        >
                          <option value="">Ignorer cette colonne</option>
                          {targetFields.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.label} {field.required ? "(requis)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                        {String(fileData[0]?.[header] ?? "—")}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {mapping[header] ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => setStep("UPLOAD")} className="font-bold uppercase text-[11px] h-10 px-6 rounded-xl">Retour</Button>
            <Button
              onClick={runPreview}
              disabled={isValidating || mappedCount === 0}
              className="font-bold uppercase text-[11px] h-10 px-8 rounded-xl shadow-lg"
            >
              {isValidating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Lancer la Validation
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Validate */}
      {step === "VALIDATE" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-none bg-emerald-500/5 border border-emerald-500/20 p-6 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <h4 className="text-xl font-black text-emerald-600">{previewSummary?.valid ?? 0}</h4>
              <p className="text-xs font-bold text-emerald-600/70 uppercase">Lignes Prêtes</p>
            </Card>
            <Card className="border-none shadow-none bg-amber-500/5 border border-amber-500/20 p-6 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <h4 className="text-xl font-black text-amber-600">{previewSummary ? previewSummary.total - previewSummary.valid : 0}</h4>
              <p className="text-xs font-bold text-amber-600/70 uppercase">Avertissements</p>
            </Card>
            <Card className="border-none shadow-none bg-destructive/5 border border-destructive/20 p-6 text-center space-y-2">
              <Database className="w-8 h-8 text-destructive mx-auto" />
              <h4 className="text-xl font-black text-destructive">{previewSummary?.invalid ?? 0}</h4>
              <p className="text-xs font-bold text-destructive/70 uppercase">Erreurs Bloquantes</p>
            </Card>
          </div>

          <Card className="border-none shadow-none bg-muted/20 p-12 text-center space-y-6">
            <div className="max-w-md mx-auto space-y-4">
              <h3 className="text-xl font-black">Prêt pour l&apos;injection ?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Les données ont été analysées. L&apos;importation va traiter {previewSummary?.total ?? fileData.length} lignes. Corrige les erreurs bloquantes avant de confirmer.
              </p>
              {previewErrors.length > 0 ? (
                <div className="max-h-36 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-left text-xs text-destructive space-y-1">
                  {previewErrors.slice(0, 6).map((err, index) => (
                    <p key={`${err.row}-${index}`}>
                      Ligne {err.row}: {err.errors?.[0]?.message || err.message || "Erreur de validation"}
                    </p>
                  ))}
                </div>
              ) : null}
              {isProcessing && (
                <div className="space-y-3 pt-4">
                  <Progress value={progress} className="h-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse">Injection des données en cours... {progress}%</p>
                </div>
              )}
              <Button 
                disabled={isProcessing || hasBlockingErrors} 
                onClick={startImport}
                className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.1em] text-lg shadow-2xl hover:shadow-primary/30 transition-all mt-4"
              >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Database className="w-6 h-6 mr-3" />}
                Confirmer l&apos;Importation
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Final Step: Success */}
      {step === "PROCESS" && (
        <Card className="border-none shadow-2xl bg-primary text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <CheckCircle2 className="w-64 h-64" />
          </div>
          <CardContent className="p-12 text-center space-y-8 relative z-10">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto scale-125">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <div className="space-y-3">
              <h2 className="text-4xl font-black tracking-tighter">Félicitations !</h2>
              <p className="text-lg font-medium opacity-90 max-w-lg mx-auto">
                Votre base de données a été mise à jour avec succès. {importedCount} enregistrements ont été importés.
              </p>
              {importErrors.length > 0 ? (
                <div className="max-w-2xl mx-auto rounded-lg border border-white/30 bg-white/10 p-3 text-left text-xs space-y-1">
                  <p className="font-bold">Lignes en erreur: {importErrors.length}</p>
                  {importErrors.slice(0, 6).map((err, idx) => (
                    <p key={`${err.row ?? idx}-${idx}`}>
                      {err.row ? `Ligne ${err.row}` : "Ligne"}: {err.error || err.details || "Erreur"}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button variant="secondary" className="h-12 px-8 rounded-xl font-bold uppercase" onClick={() => window.location.href = successRedirect}>
                {selectedType === "TEACHERS"
                  ? "Voir les enseignants"
                  : selectedType === "CLASSES"
                    ? "Voir les classes"
                    : selectedType === "PARENTS"
                      ? "Voir les parents"
                      : t("appActions.viewStudents")}
              </Button>
              <Button variant="outline" className="h-12 px-8 rounded-xl font-bold uppercase bg-transparent text-white border-white/30 hover:bg-white/10" onClick={resetFlow}>
                Nouvel import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
