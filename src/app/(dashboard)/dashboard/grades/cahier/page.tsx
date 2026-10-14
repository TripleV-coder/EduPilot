"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Badge,
    Button,
    Card,
    Icon,
    Spinner,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading } from "@/components/layout/page-states";
import {
    type Student,
    type EvaluationData,
    type SubjectInfo,
    type ClassOption,
    type PeriodOption,
    type EvalTypeOption,
    pickScoreVariant,
    variantToken,
} from "@/components/grades/cahier/types";
import { computeAnnualAverages, gradedEvaluations, toDisplay, type GradeRecord } from "@/lib/academic/average-engine";
import type { CalculationRules } from "@/lib/academic/grading-rules";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
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
    // Règles de calcul de l'établissement (même calcul que le bulletin)
    const { data: rulesData } = useSWR<{ settings?: { calculation?: CalculationRules } }>("/api/config/grading", fetcher);
    const calcRules = rulesData?.settings?.calculation;

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
    // Calculs adaptés par l'enseignant pour des élèves précis
    const [studentFormulas, setStudentFormulas] = useState<
        Array<{ classSubjectId: string; periodId: string; studentId: string; formula: string }>
    >([]);

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
                setStudentFormulas(data.studentFormulas || []);
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
        // Formule de l'enseignant pour sa matière (sinon celle de l'école)
        const subjectFormula = new Map(subjects.map((s) => [s.id, s.formula ?? null]));
        const classSubjects = Array.from(
            new Map(evaluations.map((ev) => [ev.classSubjectId, ev.subjectCoefficient])),
            ([id, coefficient]) => ({ id, coefficient, formula: subjectFormula.get(id) ?? null })
        );
        // Périodes affichées (dans l'ordre) : (S1 + S2) / 2 ou (T1 + T2 + T3) / 3 si toutes sont chargées
        const periods = Array.from(new Set(evaluations.map((ev) => ev.periodId)), (id) => ({ id }));
        const recordsOf = (studentId: string): GradeRecord[] =>
            evaluations.flatMap((ev) => {
                const grade = ev.grades[studentId];
                return grade
                    ? [{
                          evaluationId: ev.id,
                          date: ev.date,
                          classSubjectId: ev.classSubjectId,
                          periodId: ev.periodId,
                          value: grade.value,
                          isAbsent: grade.isAbsent,
                          isExcused: grade.isExcused,
                          excludedReason: grade.excludedReason ?? null,
                          maxGrade: ev.maxGrade,
                          type: { code: ev.typeCode, name: ev.type, category: ev.typeCategory },
                      }]
                    : [];
            });
        // Notes attendues : évaluations déjà notées chez au moins un élève de la classe
        const expected = gradedEvaluations(students.flatMap((s) => recordsOf(s.id)));
        return filteredStudents
            .map((student) => {
                const records = recordsOf(student.id);
                const gradeCount = records.filter((r) => !r.isAbsent && r.value !== null).length;
                const absentCount = records.filter((r) => r.isAbsent).length;
                // Moteur unique : formule officielle, calcul exact, arrondi au centième
                // Calculs adaptés pour cet élève, période par période
                const studentFormulasByPeriod = new Map<string, Map<string, string>>();
                for (const f of studentFormulas) {
                    if (f.studentId !== student.id) continue;
                    const bySubject = studentFormulasByPeriod.get(f.periodId) ?? new Map<string, string>();
                    bySubject.set(f.classSubjectId, f.formula);
                    studentFormulasByPeriod.set(f.periodId, bySubject);
                }
                const annual = computeAnnualAverages(records, classSubjects, periods, expected, {
                    rules: calcRules,
                    studentFormulasByPeriod,
                });
                const average = toDisplay(annual.general ?? annual.provisional, calcRules?.rounding);
                return {
                    ...student,
                    average,
                    missingCount: annual.missing.length,
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
    }, [filteredStudents, evaluations, students, calcRules, subjects, studentFormulas]);

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
            <PageShell>
                <PageHeader
                    title="Cahier de notes"
                    description="Chargement des données…"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Notes & évaluations", href: "/dashboard/grades" },
                        { label: "Cahier de notes" },
                    ]}
                />
                <PageLoading label="Chargement du cahier de notes…" />
            </PageShell>
        );
    }

    return (
        <PageGuard
            permission={Permission.EVALUATION_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <PageShell>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        title="Cahier de notes"
                        description="Relevé détaillé des évaluations, devoirs et compositions par classe et période."
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Notes & évaluations", href: "/dashboard/grades" },
                            { label: "Cahier de notes" },
                        ]}
                    />
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
                            border: "1px solid var(--eduflow-danger-200)",
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
                                                    <h2
                                                        className="eduflow-display"
                                                        style={{ fontSize: 16, margin: 0 }}
                                                    >
                                                        {subjectName}
                                                    </h2>
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
                                                                                fontSize: 11,
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
                                                                                fontSize: 11,
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
                                                                <>
                                                                    <div className="px-5 pb-2" style={{ fontSize: 12 }}>
                                                                        <Link
                                                                            href={`/dashboard/grades/entry?classId=${selectedClass}&classSubjectId=${ev.classSubjectId}&evaluationId=${ev.id}`}
                                                                            style={{ color: "var(--brand-700)", fontWeight: 600 }}
                                                                        >
                                                                            Modifier les notes (correction, recomposition, absence justifiée)
                                                                        </Link>
                                                                    </div>
                                                                    <ExpandedEvalGrades
                                                                        ev={ev}
                                                                        students={filteredStudents}
                                                                    />
                                                                </>
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
                                    <h2 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                                        Récapitulatif par élève
                                    </h2>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            margin: "2px 0 0",
                                        }}
                                    >
                                        Par matière : (moyenne des interrogations + devoirs) / (1 + nombre de devoirs), notes ramenées sur 20 ; moyenne pondérée par les coefficients de matière.
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
                                                                    fontSize: 11,
                                                                    color: "var(--brand-700)",
                                                                    fontWeight: 700,
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
                                                                    fontSize: 11,
                                                                    color: "var(--eduflow-text-secondary)",
                                                                    maxWidth: "100%",
                                                                }}
                                                            >
                                                                {ev.title || ev.type}
                                                            </span>
                                                            <span
                                                                className="eduflow-mono"
                                                                style={{
                                                                    fontSize: 11,
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
                                                                    fontSize: 11,
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
                                                            {student.missingCount > 0 ? (
                                                                <div
                                                                    title="Note absente alors que les camarades sont notés : saisir la note ou indiquer l'absence (justifiée ou non)"
                                                                    style={{ fontSize: 10, fontWeight: 600, color: "var(--eduflow-warning-700)" }}
                                                                >
                                                                    {student.missingCount} à justifier
                                                                </div>
                                                            ) : null}
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
                                                                                    fontSize: 11,
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
            </PageShell>
        </PageGuard>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────
