"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useReactToPrint } from "react-to-print";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import { Badge, Button, Card, Icon, Spinner } from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

type BulletinSubject = {
    subjectId: string;
    subjectName: string;
    coefficient: number;
    average: number;
    appreciation: string;
    evaluationsCount: number;
};

type BulletinData = {
    student: { id: string; matricule: string; firstName: string; lastName: string };
    class: { id: string; name: string; level: string };
    academicYear: string;
    period: string;
    subjects: BulletinSubject[];
    generalAverage: number | null;
    rank: string | null;
    classSize: number;
    appreciation: string;
};

type ClassOption = { id: string; name: string };
type PeriodOption = { id: string; name: string };
type StudentOption = { id: string; user?: { firstName: string; lastName: string } };

function getScoreColorClass(score: number | null): string {
    if (score === null) return "text-gray-400";
    if (score >= 16) return "text-green-700 font-bold";
    if (score >= 14) return "text-blue-700 font-semibold";
    if (score >= 10) return "text-amber-700 font-medium";
    return "text-red-700 font-bold";
}

export default function BulletinsPage() {
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [periods, setPeriods] = useState<PeriodOption[]>([]);
    const [students, setStudents] = useState<StudentOption[]>([]);

    const [selectedClass, setSelectedClass] = useState("");
    const [selectedPeriod, setSelectedPeriod] = useState("");
    const [selectedStudent, setSelectedStudent] = useState("");

    const [bulletin, setBulletin] = useState<BulletinData | null>(null);
    const [loading, setLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfMessage, setPdfMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const [clsRes, perRes] = await Promise.all([
                    fetch("/api/classes"),
                    fetch("/api/periods"),
                ]);
                if (clsRes.ok) {
                    const d = await clsRes.json();
                    setClasses(Array.isArray(d) ? d : d.data || d.classes || []);
                }
                if (perRes.ok) {
                    const d = await perRes.json();
                    setPeriods(Array.isArray(d) ? d : d.data || []);
                }
            } catch {
                setError("Erreur lors du chargement des classes et périodes.");
            }
        };
        fetchInitial();
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setStudents([]);
            setSelectedStudent("");
            return;
        }
        const fetchStudents = async () => {
            try {
                const stuRes = await fetch(`/api/students?classId=${selectedClass}&limit=100`);
                if (stuRes.ok) {
                    const d = await stuRes.json();
                    setStudents(Array.isArray(d) ? d : d.data || d.students || []);
                }
            } catch {
                setError("Erreur lors du chargement des élèves.");
            }
        };
        fetchStudents();
    }, [selectedClass]);

    const handleGenerate = async () => {
        if (!selectedStudent || !selectedPeriod) return;
        setLoading(true);
        setError(null);
        setPdfMessage(null);
        setBulletin(null);
        try {
            const res = await fetch(
                `/api/bulletins?studentId=${selectedStudent}&periodId=${selectedPeriod}`
            );
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.error || "Erreur lors de la génération du bulletin");
            setBulletin(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: bulletin
            ? `Bulletin_${bulletin.student.lastName}_${bulletin.period}`
            : "Bulletin",
    });

    const handleDownloadPdf = async () => {
        if (!selectedStudent || !selectedPeriod) return;
        setPdfLoading(true);
        setPdfMessage(null);
        setError(null);
        try {
            const res = await fetch("/api/grades/report-cards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: selectedStudent,
                    periodId: selectedPeriod,
                    format: "pdf",
                }),
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.error || "Erreur lors de la génération du PDF");
            if (data.downloadUrl) {
                window.open(data.downloadUrl, "_blank");
            } else {
                setPdfMessage("Le PDF a été généré avec succès.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setPdfLoading(false);
        }
    };

    return (
        <PageGuard
            permission={Permission.EVALUATION_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center gap-3 print:hidden">
                    <Link href="/dashboard/grades">
                        <Button variant="secondary" size="sm">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Icon
                                    name="chevron"
                                    size={14}
                                    style={{ transform: "scaleX(-1)" }}
                                />
                                Retour
                            </span>
                        </Button>
                    </Link>
                    <PageHeader
                        greeting="Bulletins de notes"
                        sub="Génération et impression des bulletins périodiques officiels."
                    />
                </div>

                {/* Selector Card */}
                <Card padding={0} style={{ display: "block" }} className="print:hidden">
                    <div
                        className="flex items-center gap-2 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <Icon name="cards" size={18} color="var(--brand-700)" />
                        <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                            Configurer le bulletin
                        </h3>
                    </div>
                    <div className="px-5 py-5">
                        <div
                            className="grid items-end gap-3"
                            style={{
                                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr)) auto",
                            }}
                        >
                            <FieldSelect
                                label="Classe"
                                value={selectedClass}
                                onChange={setSelectedClass}
                                placeholder="Choisir une classe…"
                                options={classes.map((c) => ({ value: c.id, label: c.name }))}
                            />
                            <FieldSelect
                                label="Élève"
                                value={selectedStudent}
                                onChange={setSelectedStudent}
                                disabled={!selectedClass}
                                placeholder={
                                    selectedClass
                                        ? "Choisir un élève…"
                                        : "Choisir une classe d'abord"
                                }
                                options={students.map((s) => ({
                                    value: s.id,
                                    label: s.user
                                        ? `${s.user.firstName} ${s.user.lastName}`
                                        : s.id,
                                }))}
                            />
                            <FieldSelect
                                label="Période"
                                value={selectedPeriod}
                                onChange={setSelectedPeriod}
                                placeholder="Choisir la période…"
                                options={periods.map((p) => ({ value: p.id, label: p.name }))}
                            />
                            <Button
                                icon={loading ? undefined : "cards"}
                                loading={loading}
                                onClick={handleGenerate}
                                disabled={!selectedStudent || !selectedPeriod || loading}
                            >
                                Générer
                            </Button>
                        </div>
                    </div>
                </Card>

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                        className="print:hidden"
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-danger-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {error}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {pdfMessage ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--brand-500)",
                            background: "var(--brand-50)",
                        }}
                        className="print:hidden"
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="success" size={18} color="var(--brand-700)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--brand-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {pdfMessage}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {!bulletin && !loading ? (
                    <Card padding={36} className="print:hidden">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div
                                className="grid place-items-center"
                                style={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: 16,
                                    background: "var(--brand-50)",
                                }}
                            >
                                <Icon name="cards" size={26} color="var(--brand-700)" />
                            </div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Aucun bulletin généré
                            </h3>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--eduflow-text-secondary)",
                                    maxWidth: 480,
                                    lineHeight: 1.55,
                                    margin: 0,
                                }}
                            >
                                Sélectionne une classe, un élève et une période ci-dessus, puis clique
                                sur « Générer » pour afficher le bulletin officiel.
                            </p>
                        </div>
                    </Card>
                ) : null}

                {/* BULLETIN PREVIEW */}
                {bulletin ? (
                    <div className="flex flex-col gap-4">
                        {/* Action bar (above the printable area) */}
                        <Card padding={14} className="print:hidden">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <Icon name="cards" size={18} color="var(--brand-700)" />
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                color: "var(--eduflow-text-primary)",
                                            }}
                                        >
                                            {bulletin.student.firstName} {bulletin.student.lastName}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                                marginTop: 2,
                                            }}
                                        >
                                            {bulletin.class.name} · {bulletin.period} ·{" "}
                                            {bulletin.academicYear}
                                        </div>
                                    </div>
                                    {bulletin.generalAverage !== null ? (
                                        <Badge
                                            variant={pickAverageVariant(bulletin.generalAverage)}
                                            size="sm"
                                        >
                                            Moyenne{" "}
                                            {bulletin.generalAverage.toFixed(2).replace(".", ",")}/20
                                        </Badge>
                                    ) : null}
                                    {bulletin.rank ? (
                                        <Badge variant="neutral" size="sm" icon="trophy">
                                            Rang {bulletin.rank}
                                        </Badge>
                                    ) : null}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        icon="cards"
                                        onClick={handlePrint}
                                    >
                                        Imprimer
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        icon={pdfLoading ? undefined : "download"}
                                        loading={pdfLoading}
                                        onClick={handleDownloadPdf}
                                    >
                                        Télécharger PDF
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Printable Area — intentionally formal black/white for paper output. */}
                        <div className="w-full overflow-x-auto">
                            <div
                                ref={printRef}
                                className="mx-auto min-w-[800px] w-full max-w-[900px] bg-white p-10 text-black shadow-lg print:p-0 print:shadow-none"
                                style={{
                                    border: "1px solid var(--eduflow-border-subtle)",
                                    borderRadius: "var(--eduflow-radius-card)",
                                    fontFamily: "Inter, system-ui, sans-serif",
                                }}
                            >
                                {/* Header */}
                                <div className="mb-8 border-b-2 border-black pb-4 text-center">
                                    <h1 className="mb-1 text-3xl font-black uppercase tracking-wider">
                                        EduPilot Academy
                                    </h1>
                                    <h2 className="text-xl font-bold uppercase text-gray-700">
                                        Bulletin de notes — {bulletin.period}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        Année scolaire : {bulletin.academicYear}
                                    </p>
                                </div>

                                {/* Student Info */}
                                <div className="mb-8 flex justify-between rounded-lg border border-gray-300 bg-gray-50 p-5 text-sm font-medium">
                                    <div className="space-y-2">
                                        <p>
                                            <span className="text-gray-500">Nom :</span>{" "}
                                            <span className="text-lg font-bold uppercase">
                                                {bulletin.student.lastName}
                                            </span>
                                        </p>
                                        <p>
                                            <span className="text-gray-500">Prénoms :</span>{" "}
                                            <span className="text-lg font-semibold">
                                                {bulletin.student.firstName}
                                            </span>
                                        </p>
                                        <p>
                                            <span className="text-gray-500">Matricule :</span>{" "}
                                            <span className="font-mono">
                                                {bulletin.student.matricule}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="space-y-2 text-right">
                                        <p>
                                            <span className="text-gray-500">Classe :</span>{" "}
                                            <span className="font-bold">{bulletin.class.name}</span>
                                        </p>
                                        <p>
                                            <span className="text-gray-500">Niveau :</span>{" "}
                                            {bulletin.class.level}
                                        </p>
                                        <p>
                                            <span className="text-gray-500">Effectif :</span>{" "}
                                            {bulletin.classSize} élèves
                                        </p>
                                    </div>
                                </div>

                                {/* Grades Table */}
                                <table className="mb-8 w-full border-collapse border border-gray-400 text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="w-1/3 border border-gray-400 p-3 text-left">
                                                Matière
                                            </th>
                                            <th className="w-16 border border-gray-400 p-3 text-center">
                                                Coef
                                            </th>
                                            <th className="w-24 border border-gray-400 p-3 text-center">
                                                Moyenne (/20)
                                            </th>
                                            <th className="border border-gray-400 p-3 text-left">
                                                Appréciation
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulletin.subjects.map((sub, idx) => (
                                            <tr key={idx} className="border-b border-gray-300">
                                                <td className="border border-gray-400 p-3 font-semibold text-gray-800">
                                                    {sub.subjectName}
                                                </td>
                                                <td className="border border-gray-400 p-3 text-center text-gray-600">
                                                    {sub.coefficient}
                                                </td>
                                                <td
                                                    className={`border border-gray-400 p-3 text-center text-base ${getScoreColorClass(
                                                        sub.average
                                                    )}`}
                                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                                >
                                                    {sub.average !== null
                                                        ? sub.average.toFixed(2).replace(".", ",")
                                                        : "—"}
                                                </td>
                                                <td className="border border-gray-400 p-3 text-sm italic text-gray-700">
                                                    {sub.appreciation || "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Summary */}
                                <div className="mb-12 grid grid-cols-2 gap-8">
                                    <div className="rounded-lg border border-gray-400 p-5">
                                        <h3 className="mb-3 border-b border-gray-300 pb-2 font-bold uppercase text-gray-700">
                                            Synthèse pédagogique
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-lg">
                                                <span className="text-gray-600">
                                                    Moyenne générale :
                                                </span>
                                                <span
                                                    className={`text-2xl font-black ${getScoreColorClass(
                                                        bulletin.generalAverage
                                                    )}`}
                                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                                >
                                                    {bulletin.generalAverage !== null
                                                        ? bulletin.generalAverage
                                                              .toFixed(2)
                                                              .replace(".", ",")
                                                        : "Indisponible"}
                                                    <span className="text-sm font-normal text-gray-500">
                                                        {" "}
                                                        / 20
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-base">
                                                <span className="text-gray-600">Rang :</span>
                                                <span className="font-bold">
                                                    {bulletin.rank || "—"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-gray-400 p-5">
                                        <h3 className="mb-3 border-b border-gray-300 pb-2 font-bold uppercase text-gray-700">
                                            Décision du conseil
                                        </h3>
                                        <p className="text-lg font-medium italic text-gray-800">
                                            {bulletin.appreciation || "____________________________"}
                                        </p>
                                    </div>
                                </div>

                                {/* Signatures */}
                                <div className="mt-16 flex justify-between pt-8 text-sm font-semibold text-gray-600">
                                    <div className="w-48 text-center">
                                        <p>Le Professeur Principal</p>
                                        <div className="mt-8 border-t border-dotted border-gray-400 pt-2">
                                            Date et signature
                                        </div>
                                    </div>
                                    <div className="w-48 text-center">
                                        <p>Le Directeur / La Directrice</p>
                                        <div className="mt-8 border-t border-dotted border-gray-400 pt-2">
                                            Date, cachet et signature
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {loading ? (
                    <div className="flex flex-col items-center gap-3 py-12 print:hidden">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Génération du bulletin…
                        </span>
                    </div>
                ) : null}
            </div>
        </PageGuard>
    );
}

function pickAverageVariant(
    avg: number
): "success" | "brand" | "warning" | "danger" {
    if (avg >= 16) return "success";
    if (avg >= 14) return "brand";
    if (avg >= 10) return "warning";
    return "danger";
}

function FieldSelect({
    label,
    value,
    onChange,
    options,
    placeholder,
    disabled,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    disabled?: boolean;
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: value ? 600 : 500,
                    color: value
                        ? "var(--eduflow-text-primary)"
                        : "var(--eduflow-text-tertiary)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.55 : 1,
                    outline: "none",
                }}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
