"use client";

import { useState, useEffect, useRef } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Permission } from "@/lib/rbac/permissions";
import { Printer, AlertCircle, FileText, ArrowLeft, Loader2, Download } from "lucide-react";
import Link from "next/link";
import { useReactToPrint } from "react-to-print";

type BulletinData = {
    student: { id: string; matricule: string; firstName: string; lastName: string };
    class: { id: string; name: string; level: string };
    academicYear: string;
    period: string;
    subjects: {
        subjectId: string;
        subjectName: string;
        coefficient: number;
        average: number;
        appreciation: string;
        evaluationsCount: number;
    }[];
    generalAverage: number | null;
    rank: string | null;
    classSize: number;
    appreciation: string;
};

export default function BulletinsPage() {
    const [classes, setClasses] = useState<any[]>([]);
    const [periods, setPeriods] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);

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
                    fetch("/api/periods")
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
        setBulletin(null);

        try {
            const res = await fetch(`/api/bulletins?studentId=${selectedStudent}&periodId=${selectedPeriod}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Erreur lors de la génération du bulletin");

            setBulletin(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: bulletin ? `Bulletin_${bulletin.student.lastName}_${bulletin.period}` : "Bulletin",
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

            if (!res.ok) throw new Error(data.error || "Erreur lors de la génération du PDF");

            if (data.downloadUrl) {
                window.open(data.downloadUrl, "_blank");
            } else {
                setPdfMessage("Le PDF a été généré avec succès.");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setPdfLoading(false);
        }
    };

    const getScoreColorClass = (score: number | null) => {
        if (score === null) return "text-muted-foreground";
        if (score >= 16) return "text-emerald-600 font-bold";
        if (score >= 14) return "text-blue-600 font-semibold";
        if (score >= 10) return "text-amber-600 font-medium";
        return "text-red-600 font-bold";
    };

    return (
        <PageGuard permission={Permission.EVALUATION_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-6 max-w-6xl mx-auto pb-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/grades">
                            <Button variant="outline" size="icon" className="shrink-0">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <PageHeader
                            title="Bulletins de Notes"
                            description="Génération et impression des bulletins périodiques officiels."
                        />
                    </div>
                </div>

                <Card className="border-border shadow-sm p-4 print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Classe</Label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <option value="">Choisir une classe...</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Élève</Label>
                            <select
                                value={selectedStudent}
                                onChange={(e) => setSelectedStudent(e.target.value)}
                                disabled={!selectedClass}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                            >
                                <option value="">Choisir un élève...</option>
                                {students.map(s => <option key={s.id} value={s.id}>{s.user?.firstName} {s.user?.lastName}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Période</Label>
                            <select
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <option value="">Choisir la période...</option>
                                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                className="flex-1 gap-2"
                                onClick={handleGenerate}
                                disabled={!selectedStudent || !selectedPeriod || loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                Générer
                            </Button>
                        </div>
                    </div>
                </Card>

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3 print:hidden">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {pdfMessage && (
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-3 print:hidden">
                        <FileText className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{pdfMessage}</p>
                    </div>
                )}

                {/* BULLETIN PREVIEW */}
                {bulletin && (
                    <div className="space-y-4">
                        <div className="flex justify-end gap-2 print:hidden">
                            <Button onClick={handlePrint} className="gap-2" variant="secondary">
                                <Printer className="w-4 h-4" />
                                Imprimer ce bulletin
                            </Button>
                            <Button onClick={handleDownloadPdf} className="gap-2" variant="secondary" disabled={pdfLoading}>
                                {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Télécharger PDF
                            </Button>
                        </div>

                        {/* Printable Area */}
                        <div className="w-full overflow-x-auto">
                            <div className="min-w-[800px] w-full max-w-[900px] mx-auto bg-white text-black p-10 print:p-0 shadow-lg print:shadow-none border print:border-none" ref={printRef}>
                                {/* Header */}
                                <div className="text-center mb-8 border-b-2 border-black pb-4">
                                    <h1 className="text-3xl font-black uppercase tracking-wider mb-1">EDUPILOT ACADEMY</h1>
                                    <h2 className="text-xl font-bold uppercase text-gray-700">Bulletin de Notes - {bulletin.period}</h2>
                                    <p className="text-sm text-gray-500">Année Scolaire : {bulletin.academicYear}</p>
                                </div>

                                {/* Student Info */}
                                <div className="flex justify-between mb-8 text-sm font-medium border border-gray-300 rounded-lg p-5 bg-gray-50">
                                    <div className="space-y-2">
                                        <p><span className="text-gray-500">Nom :</span> <span className="font-bold text-lg uppercase">{bulletin.student.lastName}</span></p>
                                        <p><span className="text-gray-500">Prénoms :</span> <span className="font-semibold text-lg">{bulletin.student.firstName}</span></p>
                                        <p><span className="text-gray-500">Matricule :</span> {bulletin.student.matricule}</p>
                                    </div>
                                    <div className="space-y-2 text-right">
                                        <p><span className="text-gray-500">Classe :</span> <span className="font-bold">{bulletin.class.name}</span></p>
                                        <p><span className="text-gray-500">Niveau :</span> {bulletin.class.level}</p>
                                        <p><span className="text-gray-500">Effectif :</span> {bulletin.classSize} élèves</p>
                                    </div>
                                </div>

                                {/* Grades Table */}
                                <table className="w-full text-sm border-collapse border border-gray-400 mb-8">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="border border-gray-400 p-3 text-left w-1/3">Matière</th>
                                            <th className="border border-gray-400 p-3 text-center w-16">Coef</th>
                                            <th className="border border-gray-400 p-3 text-center w-24">Moyenne (/20)</th>
                                            <th className="border border-gray-400 p-3 text-left">Appréciation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulletin.subjects.map((sub, idx) => (
                                            <tr key={idx} className="border-b border-gray-300">
                                                <td className="border border-gray-400 p-3 font-semibold text-gray-800">{sub.subjectName}</td>
                                                <td className="border border-gray-400 p-3 text-center text-gray-600">{sub.coefficient}</td>
                                                <td className={`border border-gray-400 p-3 text-center text-base ${getScoreColorClass(sub.average)}`}>
                                                    {sub.average !== null ? sub.average.toFixed(2) : "-"}
                                                </td>
                                                <td className="border border-gray-400 p-3 text-gray-700 italic text-sm">{sub.appreciation || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Summary */}
                                <div className="grid grid-cols-2 gap-8 mb-12">
                                    <div className="border border-gray-400 rounded-lg p-5">
                                        <h3 className="font-bold text-gray-700 uppercase border-b border-gray-300 pb-2 mb-3">Synthèse Pédagogique</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-lg">
                                                <span className="text-gray-600">Moyenne Générale :</span>
                                                <span className={`font-black text-2xl ${getScoreColorClass(bulletin.generalAverage)}`}>
                                                    {bulletin.generalAverage !== null ? bulletin.generalAverage.toFixed(2) : "N/A"}
                                                    <span className="text-sm font-normal text-gray-500"> / 20</span>
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-base">
                                                <span className="text-gray-600">Rang :</span>
                                                <span className="font-bold">{bulletin.rank || "-"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border border-gray-400 rounded-lg p-5">
                                        <h3 className="font-bold text-gray-700 uppercase border-b border-gray-300 pb-2 mb-3">Décision du Conseil</h3>
                                        <p className="text-lg font-medium text-gray-800 italic">
                                            {bulletin.appreciation || "____________________________"}
                                        </p>
                                    </div>
                                </div>

                                {/* Signatures */}
                                <div className="flex justify-between mt-16 pt-8 text-sm font-semibold text-gray-600">
                                    <div className="text-center w-48">
                                        <p>Le Professeur Principal</p>
                                        <div className="mt-8 border-t border-gray-400 border-dotted pt-2">Date et Signature</div>
                                    </div>
                                    <div className="text-center w-48">
                                        <p>Le Directeur / La Directrice</p>
                                        <div className="mt-8 border-t border-gray-400 border-dotted pt-2">Date, Cachet et Signature</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageGuard>
    );
}
