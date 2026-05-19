"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useReactToPrint } from "react-to-print";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import { Badge, Button, Card, Icon, Logo, Spinner } from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

type BulletinSubject = {
    subjectId: string;
    subjectName: string;
    coefficient: number;
    average: number | null;
    previousAverage: number | null;
    classAverage: number | null;
    classMin: number | null;
    classMax: number | null;
    appreciation: string;
    evaluationsCount: number;
};

type BulletinData = {
    school: {
        name: string;
        address: string | null;
        phone: string | null;
        email: string | null;
        mempCode: string | null;
        motto: string | null;
        logo: string | null;
    } | null;
    student: {
        id: string;
        matricule: string;
        firstName: string;
        lastName: string;
        dateOfBirth: string | null;
    };
    class: { id: string; name: string; level: string };
    academicYear: string;
    period: string;
    periodSequence: number | null;
    previousPeriod: { id: string; name: string } | null;
    subjects: BulletinSubject[];
    generalAverage: number | null;
    previousGeneralAverage: number | null;
    classGeneralAverage: number | null;
    rank: string | null;
    classSize: number;
    appreciation: string;
    vieScolaire: {
        absences: number;
        lates: number;
        excused: number;
        incidents: number;
    };
    referenceNumber: string;
    generatedAt: string;
};

type ClassOption = { id: string; name: string };
type PeriodOption = { id: string; name: string };
type StudentOption = { id: string; user?: { firstName: string; lastName: string } };

const FR_NUM = (v: number, digits = 2) =>
    v.toFixed(digits).replace(".", ",");

const FR_DATE_SHORT = (iso: string) => {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
        return iso;
    }
};

const FR_DATE_LONG = (iso: string) => {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    } catch {
        return iso;
    }
};

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
                                            Moyenne {FR_NUM(bulletin.generalAverage)}/20
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

                        {/* Printable A4 — pixel-perfect per student-suite.jsx Bulletin */}
                        <div className="w-full overflow-x-auto">
                            <div
                                ref={printRef}
                                className="bulletin-a4 mx-auto"
                                style={{
                                    width: 794,
                                    minHeight: 1123,
                                    padding: 48,
                                    background: "#fff",
                                    color: "#0F172A",
                                    fontFamily: "Inter, system-ui, sans-serif",
                                    position: "relative",
                                    boxShadow: "var(--shadow-lg)",
                                }}
                            >
                                <BulletinDocument bulletin={bulletin} />
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

            <style jsx global>{`
                @media print {
                    .bulletin-a4 {
                        box-shadow: none !important;
                        margin: 0 !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}

function BulletinDocument({ bulletin }: { bulletin: BulletinData }) {
    const schoolName = bulletin.school?.name || "EduPilot Academy";
    const schoolAddr = bulletin.school?.address || "—";
    const schoolMemp = bulletin.school?.mempCode
        ? `Code MEMP ${bulletin.school.mempCode}`
        : "";
    const schoolPhone = bulletin.school?.phone || "";
    const schoolEmail = bulletin.school?.email || "";
    const periodLabel = bulletin.period;
    const periodSubtitle = bulletin.periodSequence
        ? `Bulletin du ${ordinalFr(bulletin.periodSequence)} trimestre`
        : `Bulletin · ${periodLabel}`;
    const generatedLabel = `Année ${bulletin.academicYear} · édité le ${FR_DATE_LONG(bulletin.generatedAt)}`;
    const honorsLabel = computeHonorsLabel(bulletin.generalAverage);
    const sanctionsCount = bulletin.vieScolaire.incidents;

    return (
        <>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    paddingBottom: 18,
                    borderBottom: "2px solid var(--brand-700)",
                    marginBottom: 24,
                }}
            >
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <Logo size={56} />
                    <div>
                        <div
                            className="eduflow-display"
                            style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}
                        >
                            {schoolName}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                            {[schoolAddr, schoolMemp].filter(Boolean).join(" · ")}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                            {[schoolPhone && `Tél ${schoolPhone}`, schoolEmail]
                                .filter(Boolean)
                                .join(" · ") || " "}
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div
                        className="eduflow-display"
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                        }}
                    >
                        {periodSubtitle}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                        {generatedLabel}
                    </div>
                    <div
                        className="eduflow-mono"
                        style={{
                            fontSize: 9,
                            color: "var(--eduflow-text-tertiary)",
                            marginTop: 4,
                            fontFamily: "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        Réf. {bulletin.referenceNumber}
                    </div>
                </div>
            </div>

            {/* Student card */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    padding: 14,
                    background: "var(--brand-50)",
                    borderRadius: 10,
                    marginBottom: 20,
                    gap: 16,
                }}
            >
                <CardCell label="Élève">
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
                        {bulletin.student.lastName.toUpperCase()} {bulletin.student.firstName}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--eduflow-text-secondary)" }}>
                        {bulletin.student.dateOfBirth
                            ? `née/né le ${FR_DATE_SHORT(bulletin.student.dateOfBirth)}`
                            : " "}
                    </div>
                </CardCell>
                <CardCell label="Classe">
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
                        {bulletin.class.name} · {bulletin.classSize} élèves
                    </div>
                    <div style={{ fontSize: 10, color: "var(--eduflow-text-secondary)" }}>
                        {bulletin.class.level}
                    </div>
                </CardCell>
                <CardCell label="Matricule">
                    <div
                        className="eduflow-mono"
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            marginTop: 4,
                            fontFamily: "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {bulletin.student.matricule}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--eduflow-text-secondary)" }}>
                        Année {bulletin.academicYear}
                    </div>
                </CardCell>
            </div>

            {/* Grades table */}
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 11,
                    marginBottom: 20,
                }}
            >
                <thead>
                    <tr style={{ background: "var(--neutral-900, #0F172A)", color: "#fff" }}>
                        {[
                            "Matière",
                            "Coef.",
                            bulletin.previousPeriod ? `Moy. ${bulletin.previousPeriod.name}` : "Moy. préc.",
                            `Moy. ${bulletin.period}`,
                            "Moy. classe",
                            "Min · Max",
                            "Appréciation",
                        ].map((h) => (
                            <th
                                key={h}
                                style={{
                                    padding: "8px 10px",
                                    textAlign: "left",
                                    fontSize: 9,
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                }}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {bulletin.subjects.map((s) => {
                        const cur = s.average;
                        const cellColor =
                            cur === null
                                ? "var(--eduflow-text-tertiary)"
                                : cur >= 14
                                ? "var(--eduflow-success-700, #047857)"
                                : cur < 10
                                ? "var(--eduflow-danger-700, #B91C1C)"
                                : "var(--eduflow-text-primary)";
                        return (
                            <tr
                                key={s.subjectId}
                                style={{
                                    borderBottom:
                                        "1px solid var(--eduflow-border-subtle, #E2E8F0)",
                                }}
                            >
                                <td style={{ padding: "9px 10px", fontWeight: 600 }}>
                                    {s.subjectName}
                                </td>
                                <td
                                    style={{ padding: "9px 10px" }}
                                    className="tabular"
                                >
                                    {s.coefficient}
                                </td>
                                <td
                                    style={{
                                        padding: "9px 10px",
                                        color: "var(--eduflow-text-secondary)",
                                    }}
                                    className="tabular"
                                >
                                    {s.previousAverage !== null
                                        ? FR_NUM(s.previousAverage)
                                        : "—"}
                                </td>
                                <td
                                    style={{
                                        padding: "9px 10px",
                                        fontWeight: 700,
                                        color: cellColor,
                                    }}
                                    className="tabular"
                                >
                                    {cur !== null ? FR_NUM(cur) : "—"}
                                </td>
                                <td
                                    style={{
                                        padding: "9px 10px",
                                        color: "var(--eduflow-text-secondary)",
                                    }}
                                    className="tabular"
                                >
                                    {s.classAverage !== null
                                        ? FR_NUM(s.classAverage)
                                        : "—"}
                                </td>
                                <td
                                    style={{
                                        padding: "9px 10px",
                                        color: "var(--eduflow-text-tertiary)",
                                        fontSize: 10,
                                    }}
                                    className="tabular"
                                >
                                    {s.classMin !== null && s.classMax !== null
                                        ? `${FR_NUM(s.classMin, 0)}—${FR_NUM(s.classMax, 0)}`
                                        : "—"}
                                </td>
                                <td
                                    style={{
                                        padding: "9px 10px",
                                        fontSize: 10,
                                        color: "var(--eduflow-text-secondary)",
                                        fontStyle: "italic",
                                    }}
                                >
                                    {s.appreciation || "—"}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr style={{ background: "var(--brand-50)" }}>
                        <td style={{ padding: "12px 10px", fontWeight: 800 }}>
                            MOYENNE GÉNÉRALE
                        </td>
                        <td style={{ padding: "12px 10px" }} className="tabular">
                            <strong>
                                {bulletin.subjects.reduce((sum, s) => sum + s.coefficient, 0)}
                            </strong>
                        </td>
                        <td style={{ padding: "12px 10px" }} className="tabular">
                            <strong>
                                {bulletin.previousGeneralAverage !== null
                                    ? FR_NUM(bulletin.previousGeneralAverage)
                                    : "—"}
                            </strong>
                        </td>
                        <td
                            style={{
                                padding: "12px 10px",
                                fontSize: 16,
                                color: "var(--brand-800)",
                            }}
                            className="tabular"
                        >
                            <strong>
                                {bulletin.generalAverage !== null
                                    ? FR_NUM(bulletin.generalAverage)
                                    : "—"}
                            </strong>
                        </td>
                        <td style={{ padding: "12px 10px" }} className="tabular">
                            <strong>
                                {bulletin.classGeneralAverage !== null
                                    ? FR_NUM(bulletin.classGeneralAverage)
                                    : "—"}
                            </strong>
                        </td>
                        <td
                            colSpan={2}
                            style={{ padding: "12px 10px", textAlign: "right" }}
                        >
                            Rang :{" "}
                            <strong style={{ fontSize: 14 }}>
                                {bulletin.rank ? `${bulletin.rank} / ${bulletin.classSize}` : "—"}
                            </strong>
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* Discipline + appreciation */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 2fr",
                    gap: 14,
                    marginBottom: 20,
                }}
            >
                <div
                    style={{
                        padding: 14,
                        border: "1px solid var(--eduflow-border-subtle, #E2E8F0)",
                        borderRadius: 10,
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--eduflow-text-tertiary)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                        }}
                    >
                        Vie scolaire
                    </div>
                    <div
                        style={{
                            marginTop: 8,
                            fontSize: 11,
                            color: "var(--eduflow-text-secondary)",
                            lineHeight: 1.7,
                        }}
                    >
                        Absences :{" "}
                        <strong>
                            {bulletin.vieScolaire.absences + bulletin.vieScolaire.excused} demi-journées
                        </strong>{" "}
                        ({bulletin.vieScolaire.excused} justifiées)
                        <br />
                        Retards : <strong>{bulletin.vieScolaire.lates}</strong>
                        <br />
                        Sanctions :{" "}
                        <strong>{sanctionsCount === 0 ? "aucune" : sanctionsCount}</strong>
                        <br />
                        Encouragements :{" "}
                        <strong
                            style={{
                                color: honorsLabel
                                    ? "var(--eduflow-success-700, #047857)"
                                    : undefined,
                            }}
                        >
                            {honorsLabel || "—"}
                        </strong>
                    </div>
                </div>
                <div
                    style={{
                        padding: 14,
                        border: "1px solid var(--eduflow-border-subtle, #E2E8F0)",
                        borderRadius: 10,
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--eduflow-text-tertiary)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                        }}
                    >
                        Appréciation du conseil de classe
                    </div>
                    <div
                        style={{
                            marginTop: 8,
                            fontSize: 12,
                            color: "var(--eduflow-text-primary)",
                            lineHeight: 1.65,
                            fontStyle: "italic",
                        }}
                    >
                        {bulletin.appreciation ||
                            "Le conseil de classe se réunira pour statuer sur les résultats."}
                    </div>
                </div>
            </div>

            {/* Signatures */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                    marginTop: 32,
                }}
            >
                {[
                    { l: "Le professeur principal", n: " " },
                    { l: "La Direction", n: " " },
                    { l: "Le parent / tuteur", n: " " },
                ].map((s) => (
                    <div
                        key={s.l}
                        style={{
                            paddingTop: 24,
                            borderTop: "1px solid var(--eduflow-border-strong, #CBD5E1)",
                        }}
                    >
                        <div style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}>
                            {s.l}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                            {s.n}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: 48,
                    right: 48,
                    paddingTop: 12,
                    borderTop: "1px solid var(--eduflow-border-subtle, #E2E8F0)",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 9,
                    color: "var(--eduflow-text-tertiary)",
                }}
            >
                <span>
                    EduPilot · document authentique · vérifiable sur
                    {" "}edupilot.bj/v/{bulletin.referenceNumber}
                </span>
                <span
                    className="eduflow-mono"
                    style={{
                        fontFamily: "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    #{bulletin.referenceNumber.split("-").slice(-2).join("-")}
                </span>
            </div>
        </>
    );
}

function CardCell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div
                style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--eduflow-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                }}
            >
                {label}
            </div>
            {children}
        </div>
    );
}

function ordinalFr(n: number): string {
    if (n === 1) return "1er";
    return `${n}ᵉ`;
}

function computeHonorsLabel(avg: number | null): string | null {
    if (avg === null) return null;
    if (avg >= 16) return "Tableau d'honneur";
    if (avg >= 14) return "Encouragements";
    if (avg >= 12) return "Satisfaisant";
    return null;
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
