"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/layout/page-header";
import { PageGuard } from "@/components/guard/page-guard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Upload, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Database,
    UserPlus, GraduationCap, BookOpen, FileText, ChevronRight, FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/fetcher";
import {
    applyMapping, suggestMapping,
    STUDENT_FIELDS, TEACHER_FIELDS, CLASS_FIELDS, PARENT_FIELDS,
    type FieldDefinition,
} from "@/lib/import/mapping-utils";
import { runValidations, readyCount, type ValidationCheck } from "@/lib/import/validators";
import {
    IMPORT_TYPE_LABELS,
    type SupportedImportType,
} from "@/lib/import/types";

type ImportStep = "SELECT_UPLOAD" | "REVIEW" | "SUCCESS";

const IMPORT_TYPES: Array<{
    id: SupportedImportType;
    previewType: "students" | "teachers" | "classes" | "parents";
    endpoint: string;
    label: string;
    description: string;
    icon: typeof UserPlus;
}> = [
    {
        id: "STUDENTS",
        previewType: "students",
        endpoint: "/api/import/students",
        label: "Élèves",
        description: "Importez votre base d'élèves, matricules et contacts parents.",
        icon: UserPlus,
    },
    {
        id: "TEACHERS",
        previewType: "teachers",
        endpoint: "/api/import/teachers",
        label: "Enseignants",
        description: "Annuaires des professeurs et spécialités.",
        icon: GraduationCap,
    },
    {
        id: "CLASSES",
        previewType: "classes",
        endpoint: "/api/import/classes",
        label: "Classes",
        description: "Créez vos classes avec niveau, capacité et professeur principal.",
        icon: BookOpen,
    },
    {
        id: "PARENTS",
        previewType: "parents",
        endpoint: "/api/import/parents",
        label: "Parents",
        description: "Importez les contacts tuteurs et liez-les aux élèves existants.",
        icon: FileText,
    },
];

const FIELDS_BY_TYPE: Record<SupportedImportType, FieldDefinition[]> = {
    STUDENTS: STUDENT_FIELDS,
    TEACHERS: TEACHER_FIELDS,
    CLASSES: CLASS_FIELDS,
    PARENTS: PARENT_FIELDS,
};

const SEVERITY_COLORS = {
    success: "var(--eduflow-success-700)",
    warning: "var(--eduflow-warning-700)",
    danger: "var(--eduflow-danger-700)",
    neutral: "var(--eduflow-neutral-700)",
} as const;

function fmtInt(n: number): string {
    return new Intl.NumberFormat("fr-FR").format(n);
}

export default function ImportPage() {
    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"]}>
            <ImportWizardPage />
        </PageGuard>
    );
}

function ImportWizardPage() {
    const [step, setStep] = useState<ImportStep>("SELECT_UPLOAD");
    const [selectedType, setSelectedType] = useState<SupportedImportType | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [fileData, setFileData] = useState<Record<string, unknown>[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [importedCount, setImportedCount] = useState(0);
    const [importErrors, setImportErrors] = useState<Array<{ row?: number; error?: string; details?: string }>>([]);

    const selectedConfig = selectedType ? IMPORT_TYPES.find((it) => it.id === selectedType) ?? null : null;
    const targetFields = selectedType ? FIELDS_BY_TYPE[selectedType] : [];
    const targetFieldsByKey = useMemo(() => new Map(targetFields.map((f) => [f.key, f])), [targetFields]);

    const { data: classesData } = useSWR<{ classes?: Array<{ name: string }> }>(
        selectedType === "STUDENTS" || selectedType === "CLASSES" ? "/api/classes" : null,
        fetcher,
    );
    const knownClassNames = useMemo(
        () => (classesData?.classes ?? []).map((c) => c.name),
        [classesData],
    );

    const mappedRows = useMemo(
        () => (selectedType ? applyMapping(fileData, mapping) : []),
        [selectedType, fileData, mapping],
    );

    const validations: ValidationCheck[] = useMemo(() => {
        if (!selectedType || mappedRows.length === 0) return [];
        return runValidations({
            rows: mappedRows,
            type: selectedType,
            knownClassNames: knownClassNames.length ? knownClassNames : undefined,
        });
    }, [selectedType, mappedRows, knownClassNames]);

    const ready = readyCount(validations, fileData.length);
    const toReview = Math.max(0, fileData.length - ready);
    const mappedColCount = headers.filter((h) => Boolean(mapping[h])).length;
    const warningCount = validations.filter((v) => v.severity === "warning" || v.severity === "danger").length;

    function resetFlow() {
        setStep("SELECT_UPLOAD");
        setSelectedType(null);
        setFileName("");
        setFileData([]);
        setHeaders([]);
        setMapping({});
        setProgress(0);
        setImportedCount(0);
        setImportErrors([]);
    }

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !selectedType) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
            if (raw.length === 0) return;
            const parsedHeaders = (raw[0] as string[]).map((h) => String(h ?? "").trim()).filter(Boolean);
            const rows = raw.slice(1)
                .filter((r) => Array.isArray(r) && r.some((cell) => String(cell ?? "").trim() !== ""))
                .map((r) => {
                    const obj: Record<string, unknown> = {};
                    parsedHeaders.forEach((h, idx) => { obj[h] = r[idx]; });
                    return obj;
                });
            setHeaders(parsedHeaders);
            setFileData(rows);
            setMapping(suggestMapping(parsedHeaders, FIELDS_BY_TYPE[selectedType]));
            setStep("REVIEW");
        };
        reader.readAsBinaryString(file);
    }

    async function startImport() {
        if (!selectedConfig) return;
        setIsProcessing(true);
        setProgress(20);
        try {
            const res = await fetch(selectedConfig.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: mappedRows }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result?.error || "Erreur lors de l'injection");
            setProgress(100);
            setImportedCount(Number(result?.created ?? result?.count ?? 0));
            setImportErrors(Array.isArray(result?.errors) ? result.errors : []);
            setStep("SUCCESS");
            toast({ title: "Importation réussie", description: `${result?.created ?? 0} enregistrements ajoutés.` });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Erreur inconnue";
            toast({ title: "Erreur d'importation", description: msg, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    }

    const stepNumber = step === "SELECT_UPLOAD" ? 1 : step === "REVIEW" ? 2 : 3;
    const subtitle = step === "REVIEW"
        ? `Étape 2 / 3 · vérification & mapping des colonnes`
        : step === "SUCCESS"
            ? `Étape 3 / 3 · données injectées`
            : `Étape 1 / 3 · sélection du type de données`;

    const titleByType = selectedType
        ? `Importer des ${IMPORT_TYPE_LABELS[selectedType]} · CSV`
        : "Importer des données · CSV";

    return (
        <div className="space-y-4 max-w-[1280px] mx-auto pb-12">
            <PageHeader
                title={titleByType}
                description={subtitle}
                breadcrumbs={[
                    { label: "Tableau de bord", href: "/dashboard" },
                    { label: "Élèves", href: "/dashboard/students" },
                    { label: "Import" },
                ]}
            />

            {/* Mini stepper */}
            <div className="flex items-center gap-3" style={{ color: "var(--eduflow-text-tertiary)" }}>
                {["Type & fichier", "Mapping & validation", "Injection"].map((label, idx) => {
                    const number = idx + 1;
                    const active = stepNumber >= number;
                    return (
                        <div key={label} className="flex items-center gap-2">
                            <span
                                className="grid place-items-center rounded-full font-bold"
                                style={{
                                    width: 24, height: 24, fontSize: 11,
                                    background: active ? "var(--eduflow-brand-700)" : "var(--eduflow-surface-sunken)",
                                    color: active ? "#fff" : "var(--eduflow-text-tertiary)",
                                }}
                            >
                                {number}
                            </span>
                            <span
                                className="hidden sm:inline"
                                style={{
                                    fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    color: active ? "var(--eduflow-text-primary)" : "var(--eduflow-text-tertiary)",
                                }}
                            >
                                {label}
                            </span>
                            {idx < 2 && <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
                        </div>
                    );
                })}
            </div>

            {step === "SELECT_UPLOAD" && (
                <SelectAndUpload
                    selectedType={selectedType}
                    setSelectedType={setSelectedType}
                    handleFile={handleFile}
                />
            )}

            {step === "REVIEW" && selectedType && (
                <div className="grid gap-3.5" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
                    {/* Mapping table card */}
                    <div
                        className="rounded-xl overflow-hidden"
                        style={{
                            background: "var(--eduflow-surface-card)",
                            border: "1px solid var(--eduflow-border-subtle)",
                        }}
                    >
                        <div
                            className="flex items-center justify-between px-5 py-3.5 gap-3"
                            style={{ borderBottom: "1px solid var(--eduflow-border-subtle)" }}
                        >
                            <div>
                                <h3 className="m-0 flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700 }}>
                                    <FileSpreadsheet className="w-4 h-4" style={{ color: "var(--eduflow-brand-700)" }} />
                                    {fileName || "Fichier importé"}
                                </h3>
                                <p className="m-0" style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)", marginTop: 2 }}>
                                    {fmtInt(fileData.length)} lignes détectées · {headers.length} colonnes
                                </p>
                            </div>
                            <div className="flex gap-1.5">
                                <CountBadge severity="success" icon="check">
                                    {mappedColCount} mappées
                                </CountBadge>
                                {warningCount > 0 && (
                                    <CountBadge severity="warning" icon="warning">
                                        {warningCount} à vérifier
                                    </CountBadge>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse" style={{ fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: "var(--eduflow-surface-sunken)" }}>
                                        {["Colonne Excel", "→", "Champ EduPilot", "Aperçu (3 premières)", "Statut"].map((h) => (
                                            <th
                                                key={h}
                                                className="text-left font-bold uppercase"
                                                style={{
                                                    padding: "10px 14px",
                                                    fontSize: 10,
                                                    color: "var(--eduflow-text-tertiary)",
                                                    letterSpacing: "0.06em",
                                                }}
                                            >
                                                {h === "→" ? "" : h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {headers.map((header) => {
                                        const fieldKey = mapping[header];
                                        const field = fieldKey ? targetFieldsByKey.get(fieldKey) : undefined;
                                        const preview = fileData
                                            .slice(0, 3)
                                            .map((r) => String(r[header] ?? "(vide)"))
                                            .join(" · ");
                                        const fillRate = fileData.length === 0
                                            ? 0
                                            : fileData.filter((r) => String(r[header] ?? "").trim() !== "").length / fileData.length;
                                        const isWarn = !!fieldKey && fillRate < 0.5;
                                        const isSkip = !fieldKey;
                                        return (
                                            <tr key={header} style={{ borderTop: "1px solid var(--eduflow-border-subtle)" }}>
                                                <td className="font-mono" style={{ padding: "11px 14px" }}>{header}</td>
                                                <td style={{ padding: "11px 14px", color: "var(--eduflow-text-tertiary)" }}>→</td>
                                                <td style={{ padding: "11px 14px" }}>
                                                    <select
                                                        value={fieldKey ?? ""}
                                                        onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value }))}
                                                        className="bg-transparent border-0 outline-none"
                                                        style={{
                                                            fontFamily: "inherit",
                                                            fontSize: 12,
                                                            fontWeight: field ? 600 : 400,
                                                            color: field ? "var(--eduflow-text-primary)" : "var(--eduflow-text-tertiary)",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        <option value="">— ignorée —</option>
                                                        {targetFields.map((f) => (
                                                            <option key={f.key} value={f.key}>
                                                                {f.label}{f.required ? " *" : ""} · {selectedType.toLowerCase()}.{f.key}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "11px 14px",
                                                        fontSize: 11,
                                                        color: "var(--eduflow-text-secondary)",
                                                        maxWidth: 280,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {preview}
                                                </td>
                                                <td style={{ padding: "11px 14px" }}>
                                                    {isSkip
                                                        ? <StatusBadge severity="neutral">Ignorée</StatusBadge>
                                                        : isWarn
                                                            ? <StatusBadge severity="warning">{Math.round((1 - fillRate) * 100)}% vides</StatusBadge>
                                                            : <StatusBadge severity="success" icon="check">OK</StatusBadge>
                                                    }
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Side panel */}
                    <div className="flex flex-col gap-3.5">
                        <div
                            className="rounded-xl p-4"
                            style={{
                                background: "var(--eduflow-surface-card)",
                                border: "1px solid var(--eduflow-border-subtle)",
                            }}
                        >
                            <SubLabel>Validations automatiques</SubLabel>
                            <div className="mt-2.5">
                                {validations.length === 0 ? (
                                    <p style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                                        Aucune ligne à valider pour le moment.
                                    </p>
                                ) : validations.map((v, i) => (
                                    <div
                                        key={v.label}
                                        className="flex items-center justify-between"
                                        style={{
                                            padding: "10px 0",
                                            borderBottom: i < validations.length - 1
                                                ? "1px solid var(--eduflow-border-subtle)"
                                                : "none",
                                            fontSize: 12,
                                        }}
                                    >
                                        <span>{v.label}</span>
                                        <span
                                            className="font-mono font-bold"
                                            style={{ color: SEVERITY_COLORS[v.severity] }}
                                        >
                                            {v.passed === v.total
                                                ? `${fmtInt(v.passed)} / ${fmtInt(v.total)}`
                                                : `${fmtInt(v.passed)} / ${fmtInt(v.total)}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div
                            className="rounded-xl p-4"
                            style={{
                                background: "var(--eduflow-brand-50)",
                                border: "1px solid var(--eduflow-brand-200)",
                            }}
                        >
                            <SubLabel style={{ color: "var(--eduflow-brand-800)" }}>Prêt à importer</SubLabel>
                            <div
                                className="font-mono"
                                style={{
                                    fontSize: 32,
                                    fontWeight: 700,
                                    color: "var(--eduflow-brand-800)",
                                    marginTop: 6,
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                {fmtInt(ready)}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--eduflow-brand-800)" }}>
                                {IMPORT_TYPE_LABELS[selectedType]} prêts
                                {toReview > 0 && ` · ${fmtInt(toReview)} nécessitent une vérification manuelle`}
                            </div>
                            <Button
                                onClick={startImport}
                                disabled={isProcessing || ready === 0}
                                className="w-full mt-3.5 h-12 gap-3 font-bold uppercase tracking-tighter shadow-md"
                                style={{ background: "var(--eduflow-gradient-cta)", color: "#fff", border: 0 }}
                            >
                                {isProcessing
                                    ? <Loader2 className="w-5 h-5 animate-spin" />
                                    : <Database className="w-5 h-5" />}
                                Lancer l&apos;import
                                {!isProcessing && <ArrowRight className="w-4 h-4" />}
                            </Button>
                            {isProcessing && (
                                <div className="mt-3">
                                    <Progress value={progress} className="h-1.5" />
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={resetFlow}
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "var(--eduflow-text-tertiary)",
                                background: "transparent",
                                border: 0,
                                cursor: "pointer",
                                padding: "8px 0",
                                textAlign: "left",
                            }}
                        >
                            ← Recharger un autre fichier
                        </button>
                    </div>
                </div>
            )}

            {step === "SUCCESS" && (
                <SuccessCard
                    importedCount={importedCount}
                    importErrors={importErrors}
                    onReset={resetFlow}
                    typeLabel={selectedType ? IMPORT_TYPE_LABELS[selectedType] : "enregistrements"}
                />
            )}
        </div>
    );
}

function SelectAndUpload({
    selectedType,
    setSelectedType,
    handleFile,
}: {
    selectedType: SupportedImportType | null;
    setSelectedType: (t: SupportedImportType) => void;
    handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 320px" }}>
            <div
                className="rounded-xl p-4"
                style={{
                    background: "var(--eduflow-surface-card)",
                    border: "1px solid var(--eduflow-border-subtle)",
                }}
            >
                <SubLabel>Choisir le type de données à importer</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2.5">
                    {IMPORT_TYPES.map((type) => {
                        const active = selectedType === type.id;
                        return (
                            <button
                                key={type.id}
                                type="button"
                                onClick={() => setSelectedType(type.id)}
                                className={cn(
                                    "text-left rounded-xl p-3.5 transition-colors flex items-start gap-3",
                                )}
                                style={{
                                    background: active ? "var(--eduflow-brand-50)" : "var(--eduflow-surface-sunken)",
                                    border: `1px solid ${active ? "var(--eduflow-brand-300)" : "transparent"}`,
                                }}
                            >
                                <div
                                    className="grid place-items-center rounded-lg shrink-0"
                                    style={{
                                        width: 36, height: 36,
                                        background: active ? "var(--eduflow-brand-100)" : "var(--eduflow-surface-card)",
                                        color: active ? "var(--eduflow-brand-700)" : "var(--eduflow-text-secondary)",
                                    }}
                                >
                                    <type.icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="m-0" style={{ fontSize: 14, fontWeight: 700 }}>{type.label}</h4>
                                    <p className="m-0" style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)", marginTop: 2 }}>
                                        {type.description}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div
                className="rounded-xl p-4 flex flex-col gap-3"
                style={{
                    background: "var(--eduflow-surface-card)",
                    border: "1px solid var(--eduflow-border-subtle)",
                }}
            >
                <SubLabel>Déposer un fichier</SubLabel>
                <div
                    className="relative rounded-xl flex-1 grid place-items-center"
                    style={{
                        border: "2px dashed var(--eduflow-border-default)",
                        background: "var(--eduflow-surface-sunken)",
                        minHeight: 160,
                    }}
                >
                    <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFile}
                        disabled={!selectedType}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="text-center px-4">
                        <Upload
                            className="w-7 h-7 mx-auto"
                            style={{ color: selectedType ? "var(--eduflow-brand-700)" : "var(--eduflow-text-tertiary)" }}
                        />
                        <p
                            className="mt-2"
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color: "var(--eduflow-text-secondary)",
                            }}
                        >
                            {selectedType
                                ? "Cliquer ou glisser-déposer"
                                : "Choisis un type d'abord"}
                        </p>
                        <p
                            className="mt-1"
                            style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
                        >
                            .xlsx / .xls / .csv · max 10 Mo
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SuccessCard({
    importedCount,
    importErrors,
    onReset,
    typeLabel,
}: {
    importedCount: number;
    importErrors: Array<{ row?: number; error?: string; details?: string }>;
    onReset: () => void;
    typeLabel: string;
}) {
    return (
        <div
            className="rounded-xl p-8 text-center"
            style={{
                background: "var(--eduflow-gradient-cta)",
                color: "#fff",
            }}
        >
            <div
                className="w-16 h-16 grid place-items-center mx-auto rounded-2xl"
                style={{ background: "rgba(255,255,255,0.18)" }}
            >
                <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="mt-4" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em" }}>
                {fmtInt(importedCount)} {typeLabel} importés
            </h2>
            <p style={{ fontSize: 14, opacity: 0.9 }}>
                La base de données a été mise à jour.
            </p>
            {importErrors.length > 0 && (
                <div
                    className="mt-4 mx-auto max-w-xl rounded-lg p-3 text-left"
                    style={{ background: "rgba(255,255,255,0.15)", fontSize: 11 }}
                >
                    <p className="font-bold">Lignes en erreur · {importErrors.length}</p>
                    {importErrors.slice(0, 6).map((err, idx) => (
                        <p key={idx} className="mt-1">
                            {err.row ? `Ligne ${err.row} · ` : ""}{err.error || err.details || "—"}
                        </p>
                    ))}
                </div>
            )}
            <Button
                variant="secondary"
                onClick={onReset}
                className="mt-6"
                style={{ background: "#fff", color: "var(--eduflow-brand-800)", border: 0 }}
            >
                Nouvel import
            </Button>
        </div>
    );
}

function SubLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div
            style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--eduflow-text-tertiary)",
                ...style,
            }}
        >
            {children}
        </div>
    );
}

function CountBadge({
    severity,
    children,
    icon,
}: {
    severity: "success" | "warning";
    icon: "check" | "warning";
    children: React.ReactNode;
}) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded-md font-bold"
            style={{
                fontSize: 10,
                padding: "3px 8px",
                background: severity === "success" ? "var(--eduflow-success-50)" : "var(--eduflow-warning-50)",
                color: severity === "success" ? "var(--eduflow-success-800)" : "var(--eduflow-warning-800)",
            }}
        >
            {icon === "check"
                ? <CheckCircle2 className="w-3 h-3" />
                : <AlertTriangle className="w-3 h-3" />}
            {children}
        </span>
    );
}

function StatusBadge({
    severity,
    icon,
    children,
}: {
    severity: "success" | "warning" | "neutral";
    icon?: "check";
    children: React.ReactNode;
}) {
    const bg = severity === "success"
        ? "var(--eduflow-success-50)"
        : severity === "warning"
            ? "var(--eduflow-warning-50)"
            : "var(--eduflow-neutral-100)";
    const fg = severity === "success"
        ? "var(--eduflow-success-800)"
        : severity === "warning"
            ? "var(--eduflow-warning-800)"
            : "var(--eduflow-text-tertiary)";
    return (
        <span
            className="inline-flex items-center gap-1 rounded-md font-bold"
            style={{
                fontSize: 10,
                padding: "3px 7px",
                background: bg,
                color: fg,
            }}
        >
            {icon === "check" && <CheckCircle2 className="w-3 h-3" />}
            {children}
        </span>
    );
}
