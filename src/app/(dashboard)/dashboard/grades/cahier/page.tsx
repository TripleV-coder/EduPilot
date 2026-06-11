"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Spinner,
    type IconName,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";
import {
    type Student,
    type GradeEntry,
    type EvalStats,
    type EvaluationData,
    type SubjectInfo,
    type ClassOption,
    type PeriodOption,
    type EvalTypeOption,
    type ScoreVariant,
    pickScoreVariant,
    variantToken,
} from "@/components/grades/cahier/types";
import {
    ExpandedEvalGrades,
    SegmentedToggle,
    FieldSelect,
    FieldSearch,
    EmptyHero,
    Th,
    Td,
} from "@/components/grades/cahier/components";

// Extrait de dashboard/grades/cahier/page.tsx (1349 lignes) lors de la
// découpe (P3.1, 2026-06-11). Logique inchangée.

export default function CahierDeNotesPage() {
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [periods, setPeriods] = useState<PeriodOption[]>([]);
    const [evalTypes, setEvalTypes] = useState<EvalTypeOption[]>([]);

    const [selectedClass, setSelectedClass] = useState("");
    const [selectedPeriod, setSelectedPeriod] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedType, setSelectedType] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const [students, setStudents] = useState<Student[]>([]);
    const [evaluations, setEvaluations] = useState<EvaluationData[]>([]);
    const [subjects, setSubjects] = useState<SubjectInfo[]>([]);

    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(true);
    const [expandedEval, setExpandedEval] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"evaluations" | "students">("evaluations");

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
                setError("Erreur lors du chargement des données initiales.");
            } finally {
                setLoading(false);
            }
        };
        fetchInitial();
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setStudents([]);
            setEvaluations([]);
            setSubjects([]);
            return;
        }
        const fetchCahierData = async () => {
            setDataLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({ classId: selectedClass });
                if (selectedPeriod) params.set("periodId", selectedPeriod);
                if (selectedSubject) params.set("classSubjectId", selectedSubject);
                if (selectedType) params.set("typeId", selectedType);

                const res = await fetch(`/api/grades/cahier?${params.toString()}`);
                if (!res.ok) throw new Error("Erreur lors du chargement des données");

                const data = await res.json();
                setStudents(data.students || []);
                setEvaluations(data.evaluations || []);
                setSubjects(data.subjects || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            } finally {
                setDataLoading(false);
            }
        };
        fetchCahierData();
    }, [selectedClass, selectedPeriod, selectedSubject, selectedType]);

    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(
            (s) =>
                s.firstName.toLowerCase().includes(q) ||
                s.lastName.toLowerCase().includes(q) ||
                s.matricule.toLowerCase().includes(q)
        );
    }, [students, searchQuery]);

    const evaluationsBySubject = useMemo(() => {
        const grouped = new Map<string, EvaluationData[]>();
        evaluations.forEach((ev) => {
            const key = ev.subject;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(ev);
        });
        return grouped;
    }, [evaluations]);

    const studentSummary = useMemo(() => {
        return filteredStudents
            .map((student) => {
                let totalWeightedSum = 0;
                let totalCoefficient = 0;
                let gradeCount = 0;
                let absentCount = 0;
                evaluations.forEach((ev) => {
                    const grade = ev.grades[student.id];
                    if (grade) {
                        if (grade.isAbsent) absentCount++;
                        else if (grade.value !== null) {
                            const normalized = (grade.value / ev.maxGrade) * 20;
                            totalWeightedSum += normalized * ev.coefficient;
                            totalCoefficient += ev.coefficient;
                            gradeCount++;
                        }
                    }
                });
                const average =
                    totalCoefficient > 0 ? totalWeightedSum / totalCoefficient : null;
                return {
                    ...student,
                    average,
                    gradeCount,
                    absentCount,
                    totalEvals: evaluations.length,
                };
            })
            .sort((a, b) => {
                if (a.average === null && b.average === null) return 0;
                if (a.average === null) return 1;
                if (b.average === null) return -1;
                return b.average - a.average;
            });
    }, [filteredStudents, evaluations]);

    const resetFilters = () => {
        setSelectedPeriod("");
        setSelectedSubject("");
        setSelectedType("");
        setSearchQuery("");
    };

    const hasActiveFilters = !!(
        selectedPeriod ||
        selectedSubject ||
        selectedType ||
        searchQuery
    );

    if (loading) {
        return (
            <div className="eduflow-scope flex min-h-[60vh] items-center justify-center">
                <Spinner size={32} color="var(--brand-600)" />
            </div>
        );
    }

    return (
        <PageGuard
            permission={Permission.EVALUATION_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-[1400px] flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <PageHeader
                            greeting="Cahier de notes"
                            sub="Relevé détaillé des évaluations, devoirs et compositions par classe et période."
                            breadcrumb={[
                                <Link key="dash" href="/dashboard">Tableau de bord</Link>,
                                <Link key="grades" href="/dashboard/grades">Notes & évaluations</Link>,
                                "Cahier de notes",
                            ]}
                        />
                    </div>
                    <SegmentedToggle
                        value={viewMode}
                        onChange={setViewMode}
                        options={[
                            { value: "evaluations", label: "Par évaluation", icon: "cards" },
                            { value: "students", label: "Par élève", icon: "users" },
                        ]}
                    />
                </div>

                {/* Filters */}
                <Card padding={0}>
                    <button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex w-full items-center justify-between px-5 py-4"
                        style={{
                            background: "transparent",
                            border: 0,
                            cursor: "pointer",
                            fontFamily: "inherit",
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <Icon name="filter" size={16} color="var(--brand-700)" />
                            <span
                                className="eduflow-display"
                                style={{ fontSize: 16, fontWeight: 600 }}
                            >
                                Filtres & configuration
                            </span>
                            {hasActiveFilters ? (
                                <Badge variant="brand" size="sm">
                                    Actifs
                                </Badge>
                            ) : null}
                        </div>
                        <Icon
                            name="chevronDown"
                            size={16}
                            color="var(--eduflow-text-tertiary)"
                            style={{
                                transform: showFilters ? "rotate(180deg)" : "rotate(0deg)",
                                transition:
                                    "transform var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                            }}
                        />
                    </button>
                    {showFilters ? (
                        <div className="border-t px-5 py-5" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                    gap: 12,
                                }}
                            >
                                <FieldSelect
                                    label="Classe"
                                    required
                                    value={selectedClass}
                                    onChange={(v) => {
                                        setSelectedClass(v);
                                        setSelectedSubject("");
                                    }}
                                    placeholder="Choisir une classe…"
                                    options={classes.map((c) => ({ value: c.id, label: c.name }))}
                                />
                                <FieldSelect
                                    label="Période"
                                    value={selectedPeriod}
                                    onChange={setSelectedPeriod}
                                    placeholder="Toutes les périodes"
                                    options={periods.map((p) => ({ value: p.id, label: p.name }))}
                                />
                                <FieldSelect
                                    label="Matière"
                                    disabled={!selectedClass}
                                    value={selectedSubject}
                                    onChange={setSelectedSubject}
                                    placeholder={
                                        selectedClass
                                            ? "Toutes les matières"
                                            : "Choisir une classe d'abord"
                                    }
                                    options={subjects.map((s) => ({
                                        value: s.id,
                                        label: `${s.name} (${s.evaluationCount})`,
                                    }))}
                                />
                                <FieldSelect
                                    label="Type d'éval."
                                    value={selectedType}
                                    onChange={setSelectedType}
                                    placeholder="Tous les types"
                                    options={evalTypes.map((t) => ({ value: t.id, label: t.name }))}
                                />
                                <FieldSearch
                                    label="Rechercher un élève"
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    placeholder="Nom, prénom ou matricule…"
                                />
                            </div>
                            {hasActiveFilters ? (
                                <div className="mt-3 flex justify-end">
                                    <Button variant="ghost" size="sm" icon="x" onClick={resetFilters}>
                                        Réinitialiser les filtres
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </Card>

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
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

                {dataLoading ? (
                    <div className="flex flex-col items-center gap-3 py-16">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Chargement du cahier de notes…
                        </span>
                    </div>
                ) : null}

                {!dataLoading && !selectedClass ? (
                    <EmptyHero
                        icon="cards"
                        title="Sélectionne une classe"
                        body="Choisis une classe ci-dessus pour afficher le relevé complet des notes, devoirs et compositions."
                    />
                ) : null}

                {!dataLoading && selectedClass && evaluations.length === 0 ? (
                    <EmptyHero
                        icon="cards"
                        title="Aucune évaluation trouvée"
                        body="Aucun devoir, interrogation ou composition ne correspond aux filtres actuels."
                    />
                ) : null}

                {!dataLoading && selectedClass && evaluations.length > 0 ? (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="neutral" icon="cards">
                                {evaluations.length} évaluation{evaluations.length > 1 ? "s" : ""}
                            </Badge>
                            <Badge variant="neutral" icon="users">
                                {students.length} élève{students.length > 1 ? "s" : ""}
                            </Badge>
                            {evaluationsBySubject.size > 0 ? (
                                <Badge variant="neutral" icon="book">
                                    {evaluationsBySubject.size} matière
                                    {evaluationsBySubject.size > 1 ? "s" : ""}
                                </Badge>
                            ) : null}
                            {searchQuery && filteredStudents.length !== students.length ? (
                                <Badge variant="brand" size="sm">
                                    {filteredStudents.length} / {students.length} après filtre
                                </Badge>
                            ) : null}
                        </div>

                        {viewMode === "evaluations" ? (
                            <div className="flex flex-col gap-4">
                                {Array.from(evaluationsBySubject.entries()).map(
                                    ([subjectName, subjectEvals]) => (
                                        <Card key={subjectName} padding={0}>
                                            <div
                                                className="flex items-center justify-between border-b px-5 py-4"
                                                style={{
                                                    background: "var(--eduflow-surface-sunken)",
                                                    borderColor: "var(--eduflow-border-subtle)",
                                                }}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <Icon
                                                        name="book"
                                                        size={18}
                                                        color="var(--brand-700)"
                                                    />
                                                    <h3
                                                        className="eduflow-display"
                                                        style={{ fontSize: 16, margin: 0 }}
                                                    >
                                                        {subjectName}
                                                    </h3>
                                                </div>
                                                <Badge variant="neutral" size="sm">
                                                    {subjectEvals.length} éval
                                                    {subjectEvals.length > 1 ? "s" : ""}
                                                </Badge>
                                            </div>
                                            <div>
                                                {subjectEvals.map((ev, evIdx) => {
                                                    const expanded = expandedEval === ev.id;
                                                    const avgVariant = pickScoreVariant(
                                                        ev.stats.average,
                                                        ev.maxGrade
                                                    );
                                                    return (
                                                        <div
                                                            key={ev.id}
                                                            style={{
                                                                borderTop:
                                                                    evIdx > 0
                                                                        ? "1px solid var(--eduflow-border-subtle)"
                                                                        : "none",
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setExpandedEval(
                                                                        expanded ? null : ev.id
                                                                    )
                                                                }
                                                                className="flex w-full items-center justify-between gap-4 px-5 py-3"
                                                                style={{
                                                                    background: "transparent",
                                                                    border: 0,
                                                                    cursor: "pointer",
                                                                    fontFamily: "inherit",
                                                                    textAlign: "left",
                                                                    transition:
                                                                        "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                                                }}
                                                            >
                                                                <div className="flex min-w-0 items-center gap-3">
                                                                    <Icon
                                                                        name="chevronDown"
                                                                        size={16}
                                                                        color="var(--eduflow-text-tertiary)"
                                                                        style={{
                                                                            transform: expanded
                                                                                ? "rotate(180deg)"
                                                                                : "rotate(0deg)",
                                                                            transition:
                                                                                "transform var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                                                            flexShrink: 0,
                                                                        }}
                                                                    />
                                                                    <div className="min-w-0">
                                                                        <p
                                                                            className="truncate"
                                                                            style={{
                                                                                fontSize: 13,
                                                                                fontWeight: 600,
                                                                                margin: 0,
                                                                            }}
                                                                        >
                                                                            {ev.title || ev.type}
                                                                        </p>
                                                                        <div
                                                                            className="mt-1 flex flex-wrap items-center gap-2"
                                                                            style={{
                                                                                fontSize: 11,
                                                                                color:
                                                                                    "var(--eduflow-text-tertiary)",
                                                                            }}
                                                                        >
                                                                            <Badge variant="neutral" size="sm">
                                                                                {ev.type}
                                                                            </Badge>
                                                                            <span>{ev.period}</span>
                                                                            <span>·</span>
                                                                            <span>
                                                                                {new Date(ev.date).toLocaleDateString(
                                                                                    "fr-FR",
                                                                                    {
                                                                                        day: "numeric",
                                                                                        month: "short",
                                                                                        year: "numeric",
                                                                                    }
                                                                                )}
                                                                            </span>
                                                                            <span>·</span>
                                                                            <span className="eduflow-mono">
                                                                                /{ev.maxGrade}
                                                                            </span>
                                                                            <span>·</span>
                                                                            <span>Coef {ev.coefficient}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-5">
                                                                    <div className="text-right">
                                                                        <p
                                                                            className="eduflow-display eduflow-tabular"
                                                                            style={{
                                                                                fontSize: 18,
                                                                                fontWeight: 700,
                                                                                lineHeight: 1,
                                                                                color: variantToken(
                                                                                    avgVariant,
                                                                                    700
                                                                                ),
                                                                                margin: 0,
                                                                            }}
                                                                        >
                                                                            {ev.stats.average !== null
                                                                                ? ev.stats.average
                                                                                      .toFixed(2)
                                                                                      .replace(".", ",")
                                                                                : "—"}
                                                                        </p>
                                                                        <p
                                                                            style={{
                                                                                fontSize: 10,
                                                                                color:
                                                                                    "var(--eduflow-text-tertiary)",
                                                                                margin: "2px 0 0",
                                                                            }}
                                                                        >
                                                                            Moy. classe
                                                                        </p>
                                                                    </div>
                                                                    <div
                                                                        className="hidden text-right sm:block"
                                                                        style={{
                                                                            fontSize: 13,
                                                                            color:
                                                                                "var(--eduflow-text-secondary)",
                                                                        }}
                                                                    >
                                                                        <span className="eduflow-tabular">
                                                                            {ev.stats.graded}/{ev.stats.total}
                                                                        </span>
                                                                        <p
                                                                            style={{
                                                                                fontSize: 10,
                                                                                color:
                                                                                    "var(--eduflow-text-tertiary)",
                                                                                margin: "2px 0 0",
                                                                            }}
                                                                        >
                                                                            Notés
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </button>

                                                            {expanded ? (
                                                                <ExpandedEvalGrades
                                                                    ev={ev}
                                                                    students={filteredStudents}
                                                                />
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    )
                                )}
                            </div>
                        ) : null}

                        {viewMode === "students" ? (
                            <Card padding={0}>
                                <div
                                    className="border-b px-5 py-4"
                                    style={{
                                        background: "var(--eduflow-surface-sunken)",
                                        borderColor: "var(--eduflow-border-subtle)",
                                    }}
                                >
                                    <h3 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                                        Récapitulatif par élève
                                    </h3>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            margin: "2px 0 0",
                                        }}
                                    >
                                        Moyenne pondérée par coefficients, normalisée sur 20.
                                    </p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                        <thead>
                                            <tr
                                                style={{
                                                    background: "var(--eduflow-surface-sunken)",
                                                    textAlign: "left",
                                                }}
                                            >
                                                <Th sticky width={50}>
                                                    #
                                                </Th>
                                                <Th sticky width={220} stickyLeft={50}>
                                                    Élève
                                                </Th>
                                                <Th width={90} center accent>
                                                    Moy.
                                                </Th>
                                                <Th width={70} center>
                                                    Évals
                                                </Th>
                                                <Th width={60} center>
                                                    ABS
                                                </Th>
                                                {evaluations.map((ev) => (
                                                    <th
                                                        key={ev.id}
                                                        style={{
                                                            padding: "8px 10px",
                                                            minWidth: 80,
                                                            maxWidth: 120,
                                                            textAlign: "center",
                                                        }}
                                                    >
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span
                                                                style={{
                                                                    fontSize: 10,
                                                                    color: "var(--brand-700)",
                                                                    fontWeight: 700,
                                                                    letterSpacing: "0.04em",
                                                                    maxWidth: "100%",
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                }}
                                                            >
                                                                {ev.subject.slice(0, 8)}
                                                            </span>
                                                            <span
                                                                className="truncate"
                                                                style={{
                                                                    fontSize: 9,
                                                                    color: "var(--eduflow-text-secondary)",
                                                                    maxWidth: "100%",
                                                                }}
                                                            >
                                                                {ev.title || ev.type}
                                                            </span>
                                                            <span
                                                                className="eduflow-mono"
                                                                style={{
                                                                    fontSize: 9,
                                                                    color: "var(--eduflow-text-tertiary)",
                                                                }}
                                                            >
                                                                /{ev.maxGrade}
                                                            </span>
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {studentSummary.map((student, idx) => {
                                                const avgVariant = pickScoreVariant(student.average);
                                                return (
                                                    <tr
                                                        key={student.id}
                                                        style={{
                                                            borderTop:
                                                                "1px solid var(--eduflow-border-subtle)",
                                                        }}
                                                    >
                                                        <Td
                                                            sticky
                                                            style={{
                                                                color: "var(--eduflow-text-tertiary)",
                                                            }}
                                                        >
                                                            {idx + 1}
                                                        </Td>
                                                        <Td sticky stickyLeft={50}>
                                                            <p
                                                                style={{
                                                                    fontSize: 13,
                                                                    fontWeight: 600,
                                                                    margin: 0,
                                                                }}
                                                            >
                                                                {student.lastName} {student.firstName}
                                                            </p>
                                                            <p
                                                                className="eduflow-mono"
                                                                style={{
                                                                    fontSize: 10,
                                                                    color: "var(--eduflow-text-tertiary)",
                                                                    margin: 0,
                                                                }}
                                                            >
                                                                {student.matricule}
                                                            </p>
                                                        </Td>
                                                        <Td
                                                            center
                                                            style={{
                                                                fontWeight: 700,
                                                                background: variantToken(avgVariant, 50),
                                                                color: variantToken(avgVariant, 700),
                                                                fontSize: 14,
                                                            }}
                                                            className="eduflow-tabular"
                                                        >
                                                            {student.average !== null
                                                                ? student.average.toFixed(2).replace(".", ",")
                                                                : "—"}
                                                        </Td>
                                                        <Td
                                                            center
                                                            className="eduflow-tabular"
                                                            style={{ fontSize: 12 }}
                                                        >
                                                            {student.gradeCount}/{student.totalEvals}
                                                        </Td>
                                                        <Td center>
                                                            {student.absentCount > 0 ? (
                                                                <Badge variant="danger" size="sm">
                                                                    {student.absentCount}
                                                                </Badge>
                                                            ) : (
                                                                <span
                                                                    style={{
                                                                        color:
                                                                            "var(--eduflow-text-tertiary)",
                                                                        fontSize: 12,
                                                                    }}
                                                                >
                                                                    0
                                                                </span>
                                                            )}
                                                        </Td>
                                                        {evaluations.map((ev) => {
                                                            const grade = ev.grades[student.id];
                                                            const cellVariant = pickScoreVariant(
                                                                grade?.value ?? null,
                                                                ev.maxGrade
                                                            );
                                                            return (
                                                                <Td
                                                                    key={ev.id}
                                                                    center
                                                                    style={{ padding: "8px 6px" }}
                                                                >
                                                                    {grade ? (
                                                                        grade.isAbsent ? (
                                                                            <span
                                                                                style={{
                                                                                    fontSize: 10,
                                                                                    fontWeight: 700,
                                                                                    color:
                                                                                        "var(--eduflow-danger-700)",
                                                                                }}
                                                                            >
                                                                                ABS
                                                                            </span>
                                                                        ) : (
                                                                            <span
                                                                                className="eduflow-tabular"
                                                                                style={{
                                                                                    fontSize: 13,
                                                                                    fontWeight: 700,
                                                                                    color: variantToken(
                                                                                        cellVariant,
                                                                                        700
                                                                                    ),
                                                                                }}
                                                                            >
                                                                                {grade.value !== null
                                                                                    ? grade.value
                                                                                          .toString()
                                                                                          .replace(".", ",")
                                                                                    : "—"}
                                                                            </span>
                                                                        )
                                                                    ) : (
                                                                        <span
                                                                            style={{
                                                                                color:
                                                                                    "var(--eduflow-text-tertiary)",
                                                                                fontSize: 12,
                                                                            }}
                                                                        >
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </Td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        ) : null}
                    </>
                ) : null}
            </div>
        </PageGuard>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────
