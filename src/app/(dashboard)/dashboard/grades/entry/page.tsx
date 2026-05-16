"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { t } from "@/lib/i18n";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Spinner,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

interface ClassOption {
    id: string;
    name: string;
}
interface PeriodOption {
    id: string;
    name: string;
}
interface EvalTypeOption {
    id: string;
    name: string;
}
interface ClassSubjectOption {
    id: string;
    subject?: { name: string };
}
interface StudentItem {
    id: string;
    matricule?: string;
    user?: { firstName: string; lastName: string };
}
interface GradeCell {
    value: string;
    isAbsent: boolean;
    isExcused: boolean;
    comment: string;
}

export default function GradesEntryPage() {
    const { isFocusMode } = useSidebar();

    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [periods, setPeriods] = useState<PeriodOption[]>([]);
    const [evalTypes, setEvalTypes] = useState<EvalTypeOption[]>([]);

    const [selectedClass, setSelectedClass] = useState<string>("");
    const [classSubjects, setClassSubjects] = useState<ClassSubjectOption[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>("");

    const [title, setTitle] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [typeId, setTypeId] = useState("");
    const [periodId, setPeriodId] = useState("");
    const [maxGrade, setMaxGrade] = useState(20);
    const [coefficient, setCoefficient] = useState(1);

    const [students, setStudents] = useState<StudentItem[]>([]);
    const [grades, setGrades] = useState<Record<string, GradeCell>>({});
    const [initialGrades, setInitialGrades] = useState<Record<string, GradeCell>>({});
    const [editingId, setEditingId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generatingComments, setGeneratingComments] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const [clsRes, perRes, typRes] = await Promise.all([
                    fetch("/api/classes"),
                    fetch("/api/periods"),
                    fetch("/api/evaluation-types"),
                ]);
                if (clsRes.ok) {
                    const d = await clsRes.json();
                    setClasses(Array.isArray(d) ? d : d.data || d.classes || []);
                }
                if (perRes.ok) {
                    const d = await perRes.json();
                    setPeriods(Array.isArray(d) ? d : d.data || []);
                }
                if (typRes.ok) {
                    const d = await typRes.json();
                    setEvalTypes(Array.isArray(d) ? d : d.data || []);
                }
            } catch {
                setError("Erreur de chargement des paramètres de base");
            } finally {
                setLoading(false);
            }
        };
        fetchInitial();
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setClassSubjects([]);
            setStudents([]);
            setSelectedSubject("");
            return;
        }
        const fetchClassData = async () => {
            try {
                const [subjRes, stuRes] = await Promise.all([
                    fetch(`/api/class-subjects?classId=${selectedClass}`),
                    fetch(`/api/students?classId=${selectedClass}&limit=100`),
                ]);
                if (subjRes.ok) {
                    const d = await subjRes.json();
                    setClassSubjects(Array.isArray(d) ? d : d.data || []);
                }
                if (stuRes.ok) {
                    const d = await stuRes.json();
                    const stuList: StudentItem[] = Array.isArray(d)
                        ? d
                        : d.data || d.students || [];
                    setStudents(stuList);
                    const init: Record<string, GradeCell> = {};
                    stuList.forEach((s) => {
                        init[s.id] = {
                            value: "",
                            isAbsent: false,
                            isExcused: false,
                            comment: "",
                        };
                    });
                    setGrades(init);
                    setInitialGrades(init);
                }
            } catch {
                setError("Erreur lors du chargement des données de la classe.");
            }
        };
        fetchClassData();
    }, [selectedClass]);

    const handleGradeChange = (
        studentId: string,
        field: keyof GradeCell,
        val: GradeCell[keyof GradeCell]
    ) => {
        setGrades((prev) => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: val,
            },
        }));
    };

    const handleGenerateComments = async () => {
        if (!students.length) return;
        setGeneratingComments(true);
        toast.loading("Génération des appréciations IA en cours…", {
            id: "ai-comments",
        });
        try {
            const studentsWithGrades = students.filter(
                (s) => grades[s.id]?.value && !grades[s.id].isAbsent
            );
            let generatedCount = 0;
            for (const student of studentsWithGrades) {
                const res = await fetch("/api/ai/v2", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        endpoint: "governance",
                        action: "draft-report-comment",
                        studentId: student.id,
                        data: { currentGrade: grades[student.id].value, maxGrade },
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.data?.comment) {
                        handleGradeChange(student.id, "comment", data.data.comment);
                        generatedCount++;
                    }
                }
            }
            toast.success(`${generatedCount} appréciations générées par l'IA`, {
                id: "ai-comments",
            });
        } catch {
            toast.error("Erreur lors de la génération des appréciations", {
                id: "ai-comments",
            });
        } finally {
            setGeneratingComments(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubject || !periodId || !typeId) {
            setError(
                "Veuillez sélectionner la matière, la période et le type d'évaluation."
            );
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const evalRes = await fetch("/api/evaluations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classSubjectId: selectedSubject,
                    periodId,
                    typeId,
                    title: title || undefined,
                    date: new Date(date).toISOString(),
                    maxGrade,
                    coefficient,
                }),
            });
            if (!evalRes.ok) {
                const data = await evalRes.json();
                throw new Error(data.error || "Erreur lors de la création de l'évaluation");
            }
            const evaluation = await evalRes.json();
            const gradeList = Object.keys(grades)
                .map((stuId) => {
                    const g = grades[stuId];
                    return {
                        studentId: stuId,
                        value: g.value === "" ? null : parseFloat(g.value),
                        isAbsent: g.isAbsent,
                        isExcused: g.isExcused,
                        comment: g.comment || undefined,
                    };
                })
                .filter((g) => g.value !== null || g.isAbsent);
            if (gradeList.length > 0) {
                const batchRes = await fetch("/api/grades/batch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        evaluationId: evaluation.id,
                        grades: gradeList,
                    }),
                });
                if (!batchRes.ok) {
                    const data = await batchRes.json();
                    throw new Error(
                        data.error || "Erreur lors de l'enregistrement des notes"
                    );
                }
            }
            setSuccess(true);
            window.scrollTo(0, 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setSaving(false);
        }
    };

    const completedCount = useMemo(
        () =>
            Object.values(grades).filter(
                (g) => g.isAbsent || (typeof g.value === "string" && g.value.trim() !== "")
            ).length,
        [grades]
    );

    const dirtyCount = useMemo(
        () =>
            Object.keys(grades).filter((id) => {
                const current = grades[id];
                const initial = initialGrades[id];
                if (!current || !initial) return false;
                return (
                    current.value !== initial.value ||
                    current.isAbsent !== initial.isAbsent ||
                    current.comment !== initial.comment
                );
            }).length,
        [grades, initialGrades]
    );

    if (loading) {
        return (
            <div className="eduflow-scope flex min-h-[60vh] items-center justify-center">
                <Spinner size={32} color="var(--brand-600)" />
            </div>
        );
    }

    if (success) {
        return (
            <div className="eduflow-scope mx-auto max-w-3xl py-12">
                <Card padding={36}>
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div
                            className="grid place-items-center"
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 16,
                                background: "var(--eduflow-success-100)",
                            }}
                        >
                            <Icon
                                name="success"
                                size={32}
                                color="var(--eduflow-success-700)"
                            />
                        </div>
                        <h2
                            className="eduflow-display"
                            style={{
                                fontSize: 24,
                                margin: 0,
                                color: "var(--eduflow-success-800)",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Grille enregistrée avec succès !
                        </h2>
                        <p
                            style={{
                                fontSize: 14,
                                color: "var(--eduflow-text-secondary)",
                                margin: 0,
                                maxWidth: 480,
                                lineHeight: 1.55,
                            }}
                        >
                            Les notes ont été publiées et les moyennes de la classe ont été
                            mises à jour en temps réel.
                        </p>
                        <div className="mt-2 flex gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setSuccess(false);
                                    setGrades({});
                                }}
                            >
                                Saisir une autre évaluation
                            </Button>
                            <Link href="/dashboard/grades">
                                <Button iconRight="arrowRight">Retour aux statistiques</Button>
                            </Link>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    const subjectName =
        classSubjects.find((cs) => cs.id === selectedSubject)?.subject?.name ?? "";
    const className = classes.find((c) => c.id === selectedClass)?.name ?? "";

    return (
        <PageGuard
            permission={Permission.EVALUATION_CREATE}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
        >
            <div
                className={`eduflow-scope mx-auto flex flex-col gap-4 pb-32 ${
                    isFocusMode ? "max-w-7xl" : "max-w-6xl"
                }`}
            >
                <div className="flex items-center gap-3">
                    {!isFocusMode ? (
                        <Link href="/dashboard/grades">
                            <Button variant="secondary" size="sm" icon="chevron" style={{ transform: "rotate(180deg)" }}>
                                <span style={{ transform: "rotate(180deg)" }}>Retour</span>
                            </Button>
                        </Link>
                    ) : null}
                    <PageHeader
                        greeting={isFocusMode ? "Saisie rapide" : "Nouvelle saisie de notes"}
                        sub={
                            isFocusMode
                                ? "Mode focus actif — entre tes notes sans distraction."
                                : "Crée une évaluation et saisis les notes de la classe."
                        }
                    />
                </div>

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon
                                name="warning"
                                size={18}
                                color="var(--eduflow-danger-600)"
                            />
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

                <form onSubmit={handleSave} className="flex flex-col gap-4">
                    {/* Étape 1 — Paramètres */}
                    <Card padding={0}>
                        <div
                            className="flex items-center gap-2 border-b px-5 py-4"
                            style={{ borderColor: "var(--eduflow-border-subtle)" }}
                        >
                            <Icon name="cards" size={18} color="var(--brand-700)" />
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Paramètres de l&apos;évaluation
                            </h3>
                        </div>
                        <div className="px-5 py-5">
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fit, minmax(180px, 1fr))",
                                    gap: 14,
                                }}
                            >
                                <FieldSelect
                                    label="Classe"
                                    required
                                    value={selectedClass}
                                    onChange={setSelectedClass}
                                    placeholder="Sélectionner…"
                                    options={classes.map((c) => ({
                                        value: c.id,
                                        label: c.name,
                                    }))}
                                />
                                <FieldSelect
                                    label="Matière"
                                    required
                                    disabled={!selectedClass}
                                    value={selectedSubject}
                                    onChange={setSelectedSubject}
                                    placeholder={
                                        selectedClass ? "Sélectionner…" : "Choisir une classe"
                                    }
                                    options={classSubjects.map((cs) => ({
                                        value: cs.id,
                                        label: cs.subject?.name ?? "—",
                                    }))}
                                />
                                <FieldSelect
                                    label="Période"
                                    required
                                    value={periodId}
                                    onChange={setPeriodId}
                                    placeholder="Sélectionner…"
                                    options={periods.map((p) => ({
                                        value: p.id,
                                        label: p.name,
                                    }))}
                                />
                                <FieldSelect
                                    label="Type"
                                    required
                                    value={typeId}
                                    onChange={setTypeId}
                                    placeholder="Sélectionner…"
                                    options={evalTypes.map((et) => ({
                                        value: et.id,
                                        label: et.name,
                                    }))}
                                />
                            </div>

                            <div
                                className="mt-4"
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: isFocusMode
                                        ? "repeat(auto-fit, minmax(160px, 1fr))"
                                        : "repeat(auto-fit, minmax(180px, 1fr))",
                                    gap: 14,
                                }}
                            >
                                {!isFocusMode ? (
                                    <FieldText
                                        label="Titre (optionnel)"
                                        placeholder="Ex : DST chapitre 2"
                                        value={title}
                                        onChange={setTitle}
                                        full
                                    />
                                ) : null}
                                <FieldText
                                    label="Date"
                                    type="date"
                                    value={date}
                                    onChange={setDate}
                                    required
                                />
                                <FieldText
                                    label="Note max"
                                    type="number"
                                    value={String(maxGrade)}
                                    onChange={(v) => setMaxGrade(parseInt(v) || 20)}
                                    required
                                    min={1}
                                />
                                {!isFocusMode ? (
                                    <FieldText
                                        label="Coefficient"
                                        type="number"
                                        step="0.5"
                                        value={String(coefficient)}
                                        onChange={(v) => setCoefficient(parseFloat(v) || 1)}
                                        required
                                        min={0.5}
                                    />
                                ) : null}
                            </div>
                        </div>
                    </Card>

                    {/* Étape 2 — Grille de saisie */}
                    {selectedClass ? (
                        <Card padding={0}>
                            <div
                                className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
                                style={{ borderColor: "var(--eduflow-border-subtle)" }}
                            >
                                <div>
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 18, margin: 0 }}
                                    >
                                        Saisie rapide{subjectName ? ` · ${subjectName}` : ""}
                                        {className ? ` · ${className}` : ""}
                                    </h3>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            margin: "2px 0 0",
                                        }}
                                    >
                                        Coefficient {coefficient} · {completedCount} / {students.length}{" "}
                                        saisie{completedCount > 1 ? "s" : ""}
                                    </p>
                                </div>
                                {!isFocusMode && students.length > 0 ? (
                                    <Button
                                        type="button"
                                        variant="soft"
                                        size="sm"
                                        icon="sparkle"
                                        loading={generatingComments}
                                        disabled={generatingComments || completedCount === 0}
                                        onClick={handleGenerateComments}
                                    >
                                        Suggérer des appréciations IA
                                    </Button>
                                ) : null}
                            </div>

                            {dirtyCount > 0 ? (
                                <div
                                    className="flex items-center gap-2 border-b px-5 py-2"
                                    style={{
                                        background: "var(--brand-50)",
                                        borderColor: "var(--brand-100)",
                                        color: "var(--brand-800)",
                                        fontSize: 11,
                                        fontWeight: 600,
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 4,
                                            background: "var(--brand-600)",
                                            animation: "eduflowPulse 1.4s ease-in-out infinite",
                                        }}
                                    />
                                    {dirtyCount} ligne{dirtyCount > 1 ? "s" : ""} modifiée
                                    {dirtyCount > 1 ? "s" : ""} non publiée
                                    {dirtyCount > 1 ? "s" : ""}
                                </div>
                            ) : null}

                            {students.length === 0 ? (
                                <EmptyState
                                    title="Aucun élève inscrit dans cette classe"
                                    body="Vérifie que des élèves sont bien inscrits avec le statut « Actif » dans cette classe."
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            fontSize: 13,
                                        }}
                                    >
                                        <thead>
                                            <tr
                                                style={{
                                                    background: "var(--eduflow-surface-sunken)",
                                                    textAlign: "left",
                                                }}
                                            >
                                                <Th>Élève</Th>
                                                <Th width={140}>Note (/{maxGrade})</Th>
                                                <Th width={90}>Évolution</Th>
                                                <Th width={120}>État</Th>
                                                <Th width={80}>Absent</Th>
                                                {!isFocusMode ? <Th>Appréciation</Th> : null}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((stu) => {
                                                const g =
                                                    grades[stu.id] || {
                                                        value: "",
                                                        isAbsent: false,
                                                        isExcused: false,
                                                        comment: "",
                                                    };
                                                const initial =
                                                    initialGrades[stu.id] ?? {
                                                        value: "",
                                                        isAbsent: false,
                                                        isExcused: false,
                                                        comment: "",
                                                    };
                                                const isDirty =
                                                    g.value !== initial.value ||
                                                    g.isAbsent !== initial.isAbsent ||
                                                    g.comment !== initial.comment;
                                                const isEditing = editingId === stu.id;
                                                const numericValue =
                                                    g.value && !Number.isNaN(parseFloat(g.value))
                                                        ? parseFloat(g.value)
                                                        : null;
                                                const cellState = computeCellState({
                                                    isAbsent: g.isAbsent,
                                                    hasValue: g.value.trim() !== "",
                                                    isDirty,
                                                });
                                                const fullName = stu.user
                                                    ? `${stu.user.firstName} ${stu.user.lastName}`
                                                    : stu.id;
                                                return (
                                                    <tr
                                                        key={stu.id}
                                                        style={{
                                                            borderTop:
                                                                "1px solid var(--eduflow-border-subtle)",
                                                        }}
                                                    >
                                                        <td style={{ padding: "10px 16px" }}>
                                                            <div className="flex items-center gap-2.5">
                                                                <Avatar name={fullName} size="xs" />
                                                                <div className="min-w-0">
                                                                    <div
                                                                        style={{
                                                                            fontSize: 13,
                                                                            fontWeight: 600,
                                                                            color: "var(--eduflow-text-primary)",
                                                                        }}
                                                                    >
                                                                        {fullName}
                                                                    </div>
                                                                    {stu.matricule ? (
                                                                        <div
                                                                            className="eduflow-mono"
                                                                            style={{
                                                                                fontSize: 10,
                                                                                color: "var(--eduflow-text-tertiary)",
                                                                            }}
                                                                        >
                                                                            {stu.matricule}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            <NoteCell
                                                                value={g.value}
                                                                disabled={g.isAbsent}
                                                                editing={isEditing}
                                                                dirty={isDirty}
                                                                maxGrade={maxGrade}
                                                                onFocus={() => setEditingId(stu.id)}
                                                                onBlur={() =>
                                                                    setEditingId((prev) =>
                                                                        prev === stu.id ? null : prev
                                                                    )
                                                                }
                                                                onChange={(v) =>
                                                                    handleGradeChange(stu.id, "value", v)
                                                                }
                                                            />
                                                        </td>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            <TrendCell
                                                                value={numericValue}
                                                                maxGrade={maxGrade}
                                                            />
                                                        </td>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            <StateBadge state={cellState} />
                                                        </td>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            <ToggleAbsent
                                                                checked={g.isAbsent}
                                                                onChange={(c) => {
                                                                    handleGradeChange(stu.id, "isAbsent", c);
                                                                    if (c)
                                                                        handleGradeChange(stu.id, "value", "");
                                                                }}
                                                            />
                                                        </td>
                                                        {!isFocusMode ? (
                                                            <td style={{ padding: "10px 16px" }}>
                                                                <input
                                                                    value={g.comment}
                                                                    onChange={(e) =>
                                                                        handleGradeChange(
                                                                            stu.id,
                                                                            "comment",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    placeholder="Appréciation…"
                                                                    aria-label={`Appréciation de ${fullName}`}
                                                                    style={{
                                                                        width: "100%",
                                                                        height: 30,
                                                                        padding: "0 10px",
                                                                        border:
                                                                            "1px solid var(--eduflow-border-default)",
                                                                        borderRadius: 8,
                                                                        background:
                                                                            "var(--eduflow-surface-card)",
                                                                        fontFamily: "inherit",
                                                                        fontSize: 12,
                                                                        color: "var(--eduflow-text-primary)",
                                                                        outline: "none",
                                                                        transition:
                                                                            "border-color var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                                                    }}
                                                                />
                                                            </td>
                                                        ) : null}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    ) : null}
                </form>

                {/* Sticky bottom bar */}
                {selectedClass && students.length > 0 ? (
                    <div
                        className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                        style={{
                            background: "var(--eduflow-surface-card)",
                            border: "1px solid var(--eduflow-border-subtle)",
                            borderRadius: "var(--eduflow-radius-card)",
                            boxShadow: "var(--eduflow-shadow-cta)",
                            backdropFilter: "blur(8px)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon
                                name={dirtyCount > 0 ? "info" : "check"}
                                size={16}
                                color={
                                    dirtyCount > 0
                                        ? "var(--brand-700)"
                                        : "var(--eduflow-success-700)"
                                }
                            />
                            <span
                                style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "var(--eduflow-text-secondary)",
                                }}
                            >
                                {dirtyCount > 0
                                    ? `${dirtyCount} ligne${dirtyCount > 1 ? "s" : ""} en attente de publication`
                                    : "Toutes les notes sont à jour"}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Link href="/dashboard/grades">
                                <Button variant="secondary" disabled={saving}>
                                    {t("common.cancel")}
                                </Button>
                            </Link>
                            <Button
                                onClick={handleSave}
                                disabled={saving || dirtyCount === 0}
                                loading={saving}
                                icon={!saving ? "check" : undefined}
                                style={{ minWidth: 200 }}
                            >
                                {saving
                                    ? t("gradesEntry.actions.saving")
                                    : dirtyCount > 0
                                    ? t("gradesEntry.actions.publishWithCount", {
                                          count: dirtyCount,
                                      })
                                    : t("common.noChanges")}
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        </PageGuard>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

type CellState = "empty" | "dirty" | "absent";

function computeCellState({
    isAbsent,
    hasValue,
    isDirty,
}: {
    isAbsent: boolean;
    hasValue: boolean;
    isDirty: boolean;
}): CellState {
    if (isAbsent) return "absent";
    if (isDirty && hasValue) return "dirty";
    return "empty";
}

function StateBadge({ state }: { state: CellState }) {
    if (state === "absent") {
        return (
            <Badge variant="warning" size="sm">
                Absent
            </Badge>
        );
    }
    if (state === "dirty") {
        return (
            <Badge variant="brand" size="sm" dot>
                À publier
            </Badge>
        );
    }
    return (
        <Badge variant="neutral" size="sm">
            À saisir
        </Badge>
    );
}

function NoteCell({
    value,
    disabled,
    editing,
    dirty,
    maxGrade,
    onFocus,
    onBlur,
    onChange,
}: {
    value: string;
    disabled: boolean;
    editing: boolean;
    dirty: boolean;
    maxGrade: number;
    onFocus: () => void;
    onBlur: () => void;
    onChange: (v: string) => void;
}) {
    const active = editing && !disabled;
    const filled = !disabled && value.trim() !== "";
    return (
        <div
            className="flex h-9 items-center"
            style={{
                width: 110,
                padding: "0 12px",
                borderRadius: 10,
                border: active
                    ? "1.5px solid var(--brand-600)"
                    : filled
                    ? "1px solid var(--brand-200)"
                    : "1px solid var(--eduflow-border-default)",
                background: active
                    ? "var(--brand-50)"
                    : disabled
                    ? "var(--eduflow-neutral-100)"
                    : "var(--eduflow-surface-card)",
                transition:
                    "border-color var(--eduflow-motion-fast) var(--eduflow-ease-out), background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                boxShadow: active ? "0 0 0 3px rgba(37,99,235,0.18)" : "none",
            }}
        >
            <input
                type="number"
                step="0.25"
                min={0}
                max={maxGrade}
                value={value}
                disabled={disabled}
                onFocus={onFocus}
                onBlur={onBlur}
                onChange={(e) => onChange(e.target.value)}
                placeholder="—"
                aria-label="Note"
                className="eduflow-tabular"
                style={{
                    flex: 1,
                    border: 0,
                    outline: 0,
                    background: "transparent",
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: filled || active ? 700 : 500,
                    textAlign: "right",
                    color: disabled
                        ? "var(--eduflow-text-tertiary)"
                        : active
                        ? "var(--brand-800)"
                        : filled
                        ? "var(--eduflow-text-primary)"
                        : "var(--eduflow-text-tertiary)",
                }}
            />
            {dirty && !disabled ? (
                <span
                    aria-hidden
                    style={{
                        width: 4,
                        height: 14,
                        marginLeft: 4,
                        background: "var(--brand-600)",
                        borderRadius: 1,
                        animation: "eduflowPulse 1s ease-in-out infinite",
                    }}
                />
            ) : null}
        </div>
    );
}

function TrendCell({
    value,
    maxGrade,
}: {
    value: number | null;
    maxGrade: number;
}) {
    if (value == null) {
        return (
            <span style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                —
            </span>
        );
    }
    const passing = maxGrade > 0 ? value >= maxGrade / 2 : true;
    const variantColor = passing
        ? "var(--eduflow-success-700)"
        : "var(--eduflow-danger-700)";
    return (
        <span
            className="eduflow-tabular inline-flex items-center gap-1"
            style={{ fontSize: 11, fontWeight: 600, color: variantColor }}
        >
            <Icon name={passing ? "arrowUp" : "arrowDown"} size={11} />
            {value.toFixed(1).replace(".", ",")}
        </span>
    );
}

function ToggleAbsent({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (c: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="grid place-items-center"
            style={{
                width: 30,
                height: 18,
                padding: 2,
                borderRadius: 9,
                border: 0,
                background: checked
                    ? "var(--eduflow-warning-500)"
                    : "var(--eduflow-neutral-300)",
                cursor: "pointer",
                transition:
                    "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
            }}
        >
            <span
                aria-hidden
                style={{
                    display: "block",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#fff",
                    transform: checked ? "translateX(6px)" : "translateX(-6px)",
                    transition:
                        "transform var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                }}
            />
        </button>
    );
}

function FieldSelect({
    label,
    required,
    value,
    onChange,
    options,
    placeholder,
    disabled,
}: {
    label: string;
    required?: boolean;
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
                {label} {required ? <span style={{ color: "var(--eduflow-danger-600)" }}>*</span> : null}
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
                    color: value ? "var(--eduflow-text-primary)" : "var(--eduflow-text-tertiary)",
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

function FieldText({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    required,
    min,
    step,
    full,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
    min?: number;
    step?: string | number;
    full?: boolean;
}) {
    return (
        <label className="block" style={{ gridColumn: full ? "span 2" : undefined }}>
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
                {label} {required ? <span style={{ color: "var(--eduflow-danger-600)" }}>*</span> : null}
            </span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                min={min}
                step={step}
                style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    color: "var(--eduflow-text-primary)",
                    outline: "none",
                }}
            />
        </label>
    );
}

function Th({ children, width }: { children: React.ReactNode; width?: number }) {
    return (
        <th
            style={{
                padding: "10px 16px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--eduflow-text-tertiary)",
                width,
            }}
        >
            {children}
        </th>
    );
}

function EmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <Icon name="warning" size={28} color="var(--eduflow-warning-600)" />
            <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
                <div
                    style={{
                        fontSize: 13,
                        color: "var(--eduflow-text-secondary)",
                        marginTop: 4,
                    }}
                >
                    {body}
                </div>
            </div>
        </div>
    );
}
