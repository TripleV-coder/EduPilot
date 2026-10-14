"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { t } from "@/lib/i18n";
import { useAutoSave } from "@/hooks/use-autosave";

import {
    Avatar,
    Button,
    Card,
    Icon,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading } from "@/components/layout/page-states";
import {
    type ClassOption,
    type PeriodOption,
    type EvalTypeOption,
    type ClassSubjectOption,
    type StudentItem,
    type GradeCell,
} from "@/components/grades/entry/types";
import { AppreciationButton } from "@/components/ai/appreciation-button";
import { SubjectFormulaCard } from "@/components/grades/subject-formula-card";
import { StudentAdjustPanel } from "@/components/grades/student-adjust-panel";
import {
    computeCellState,
    StateBadge,
    NoteCell,
    TrendCell,
    ToggleAbsent,
    FieldSelect,
    FieldText,
    Th,
    EmptyState,
} from "@/components/grades/entry/components";

// Extrait de dashboard/grades/entry/page.tsx (1218 lignes) lors de la
// découpe (P3.1, 2026-06-11). Logique inchangée.

// Brouillon local : la saisie est un flux créationnel (POST évaluation +
// POST notes). On NE sauvegarde PAS automatiquement vers le serveur (créerait
// des doublons) ; on persiste le travail en cours dans localStorage pour ne
// jamais le perdre. La publication reste explicite.
interface GradeDraft {
    grades: Record<string, GradeCell>;
    title: string;
    date: string;
    typeId: string;
    periodId: string;
    maxGrade: number;
    coefficient: number;
    savedAt: string;
}

const DRAFT_PREFIX = "edupilot.grade-draft";
/** Dernier type d'évaluation utilisé sur cet appareil (proposé par défaut). */
const LAST_TYPE_KEY = "edupilot.grade-entry.last-type";

function readUrlParam(name: string): string | null {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(name);
}

export default function GradesEntryPage() {
    const { isFocusMode } = useSidebar();
    const { data: session } = useSession();
    const isTeacher = session?.user?.role === "TEACHER";

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
    // Règles de saisie de l'établissement : précision des notes, motif d'absence
    const { data: schoolRules } = useSWR<{
        settings: { gradeStep: string; excuseReasonRequired: boolean; calculation?: { unjustifiedAbsence?: "ZERO" | "EXCLUDE" } };
    }>(
        "/api/config/grading",
        fetcher
    );
    const gradeStep = schoolRules?.settings?.gradeStep ?? "0.01";
    const excuseReasonRequired = schoolRules?.settings?.excuseReasonRequired ?? true;
    // Absence non justifiée : 0 dans la moyenne (règle officielle), sauf réglage contraire de l'école
    const unjustifiedCountsZero = (schoolRules?.settings?.calculation?.unjustifiedAbsence ?? "ZERO") === "ZERO";

    const [students, setStudents] = useState<StudentItem[]>([]);
    const [grades, setGrades] = useState<Record<string, GradeCell>>({});
    const [initialGrades, setInitialGrades] = useState<Record<string, GradeCell>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    // Élève dont l'enseignant adapte le calcul (note non comptée, formule particulière)
    const [adjusting, setAdjusting] = useState<{ id: string; name: string } | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generatingComments, setGeneratingComments] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Mode « modifier les notes » d'une évaluation existante (?evaluationId=) :
    // correction d'une note, recomposition d'un élève absent, absence justifiée.
    const [editEvaluationId] = useState<string | null>(() => readUrlParam("evaluationId"));

    const [pendingDraft, setPendingDraft] = useState<GradeDraft | null>(null);
    const [draftDismissed, setDraftDismissed] = useState(false);

    // Pas de brouillon local en modification : les notes viennent du serveur.
    const draftKey =
        !editEvaluationId && selectedClass && selectedSubject
            ? `${DRAFT_PREFIX}:${selectedClass}:${selectedSubject}`
            : null;

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const [clsRes, perRes, typRes, mineRes] = await Promise.all([
                    fetch("/api/classes"),
                    fetch("/api/periods"),
                    fetch("/api/evaluation-types"),
                    isTeacher ? fetch("/api/me/subjects") : Promise.resolve(null),
                ]);
                if (clsRes.ok) {
                    const d = await clsRes.json();
                    let list: ClassOption[] = Array.isArray(d) ? d : d.data || d.classes || [];
                    if (isTeacher && mineRes?.ok) {
                        const mine = await mineRes.json();
                        const classIds = new Set(
                            (Array.isArray(mine) ? mine : []).map((cs: { classId?: string }) => cs.classId).filter(Boolean)
                        );
                        list = list.filter((c) => classIds.has(c.id));
                    }
                    setClasses(list);
                }
                if (perRes.ok) {
                    const d = await perRes.json();
                    const list: PeriodOption[] = Array.isArray(d) ? d : d.data || [];
                    setPeriods(list);
                    // Période en cours d'après la date du jour : rien à choisir d'habitude.
                    const now = Date.now();
                    const current = list.find(
                        (p) => p.startDate && p.endDate && new Date(p.startDate).getTime() <= now && now <= new Date(p.endDate).getTime(),
                    );
                    if (current) setPeriodId((prev) => prev || current.id);
                }
                if (typRes.ok) {
                    const d = await typRes.json();
                    const list: EvalTypeOption[] = Array.isArray(d) ? d : d.data || [];
                    setEvalTypes(list);
                    let remembered: string | null = null;
                    try {
                        remembered = localStorage.getItem(LAST_TYPE_KEY);
                    } catch {
                        /* stockage indisponible : pas de préférence */
                    }
                    const preferred = list.find((t) => t.id === remembered) ?? (list.length === 1 ? list[0] : undefined);
                    if (preferred) setTypeId((prev) => prev || preferred.id);
                }
            } catch {
                setError("Erreur de chargement des paramètres de base");
            } finally {
                setLoading(false);
            }
        };
        fetchInitial();
    }, [isTeacher]);

    // Ouverture en un geste depuis « Ma journée » (?classId=&classSubjectId=), ou
    // la seule classe / la seule matière de l'enseignant.
    useEffect(() => {
        if (selectedClass || classes.length === 0) return;
        const requested = readUrlParam("classId");
        if (requested && classes.some((c) => c.id === requested)) setSelectedClass(requested);
        else if (classes.length === 1) setSelectedClass(classes[0].id);
    }, [classes, selectedClass]);

    useEffect(() => {
        if (selectedSubject || classSubjects.length === 0) return;
        const requested = readUrlParam("classSubjectId");
        if (requested && classSubjects.some((cs) => cs.id === requested)) setSelectedSubject(requested);
        else if (classSubjects.length === 1) setSelectedSubject(classSubjects[0].id);
    }, [classSubjects, selectedSubject]);

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
                    // Effectif complet de la classe (N19) : jusqu'à 1000 avec ?classId=
                    fetch(`/api/students?classId=${selectedClass}&limit=1000`),
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

    // Mode modification : charge l'évaluation et ses notes existantes.
    useEffect(() => {
        if (!editEvaluationId || !selectedClass || !selectedSubject || students.length === 0) return;
        const loadExisting = async () => {
            try {
                const res = await fetch(
                    `/api/grades/cahier?classId=${selectedClass}&classSubjectId=${selectedSubject}`
                );
                if (!res.ok) throw new Error();
                const data = await res.json();
                const ev = (data.evaluations ?? []).find((e: { id: string }) => e.id === editEvaluationId);
                if (!ev) {
                    setError("Évaluation introuvable pour cette classe et cette matière.");
                    return;
                }
                setTitle(ev.title ?? "");
                setDate(String(ev.date).split("T")[0]);
                setTypeId(ev.typeId);
                setPeriodId(ev.periodId);
                setMaxGrade(ev.maxGrade);
                setCoefficient(ev.coefficient);
                const existing: Record<string, GradeCell> = {};
                students.forEach((stu) => {
                    const g = ev.grades?.[stu.id];
                    existing[stu.id] = {
                        value: g && g.value !== null ? String(g.value) : "",
                        isAbsent: g?.isAbsent ?? false,
                        isExcused: g?.isExcused ?? false,
                        excuseReason: g?.excuseReason ?? "",
                        comment: g?.comment ?? "",
                    };
                });
                setGrades(existing);
                setInitialGrades(existing);
            } catch {
                setError("Impossible de charger les notes de l'évaluation.");
            }
        };
        loadExisting();
    }, [editEvaluationId, selectedClass, selectedSubject, students]);

    const handleGradeChange = (
        studentId: string,
        field: keyof GradeCell,
        val: GradeCell[keyof GradeCell]
    ) => {
        if (field === "value" && typeof val === "string" && val !== "") {
            const numeric = Number(val);
            if (!Number.isNaN(numeric) && numeric > maxGrade) {
                toast.error(`La note ne peut pas dépasser ${maxGrade}.`);
                return;
            }
            if (!Number.isNaN(numeric) && numeric < 0) {
                toast.error("La note ne peut pas être négative.");
                return;
            }
        }
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
        const gradeList = Object.keys(grades)
            .map((stuId) => {
                const g = grades[stuId];
                return {
                    studentId: stuId,
                    value: g.value === "" ? null : parseFloat(g.value),
                    isAbsent: g.isAbsent,
                    isExcused: g.isExcused,
                    excuseReason: g.isAbsent && g.isExcused ? (g.excuseReason ?? "").trim() || undefined : undefined,
                    comment: g.comment || undefined,
                };
            })
            // Nouvelle évaluation : seules les cases remplies. Modification : aussi
            // les cases modifiées (une note effacée redevient « à justifier »).
            .filter((g) => {
                if (g.value !== null || g.isAbsent) return true;
                if (!editEvaluationId) return false;
                const initial = initialGrades[g.studentId];
                return Boolean(initial && (initial.value !== "" || initial.isAbsent));
            });
        const overScale = gradeList.find(
            (g) => g.value !== null && !Number.isNaN(g.value) && g.value > maxGrade
        );
        if (overScale) {
            setError(`La note ne peut pas dépasser ${maxGrade}.`);
            return;
        }
        // Précision de saisie de l'établissement (contrôlée aussi par le serveur)
        const stepCents = Math.round(Number(gradeStep) * 100);
        const offStep = gradeList.find(
            (g) => g.value !== null && !Number.isNaN(g.value) && Math.round(g.value * 100) % stepCents !== 0
        );
        if (offStep) {
            setError(`L'établissement saisit les notes par pas de ${gradeStep.replace(".", ",")} : ${String(offStep.value).replace(".", ",")} n'est pas accepté.`);
            return;
        }
        if (excuseReasonRequired && gradeList.some((g) => g.isAbsent && g.isExcused && !g.excuseReason)) {
            setError("Indiquez le motif de chaque absence justifiée (billet visé par le directeur des études).");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            let evaluation: { id: string };
            if (editEvaluationId) {
                evaluation = { id: editEvaluationId };
            } else {
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
                    }),
                });
                if (!evalRes.ok) {
                    const data = await evalRes.json();
                    throw new Error(data.error || "Erreur lors de la création de l'évaluation");
                }
                evaluation = await evalRes.json();
            }
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
            if (draftKey && typeof window !== "undefined") localStorage.removeItem(draftKey);
            if (editEvaluationId) setInitialGrades(grades);
            setSuccess(true);
            try {
                localStorage.setItem(LAST_TYPE_KEY, typeId);
            } catch {
                /* stockage indisponible */
            }
            document.getElementById("main-content")?.scrollTo({ top: 0 });
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
                    current.isExcused !== initial.isExcused ||
                    (current.excuseReason ?? "") !== (initial.excuseReason ?? "") ||
                    current.comment !== initial.comment
                );
            }).length,
        [grades, initialGrades]
    );

    // Auto-save du brouillon en localStorage (jamais vers le serveur).
    const draftSnapshot = { grades, title, date, typeId, periodId, maxGrade, coefficient };
    const { status: draftStatus, lastSavedAt: draftSavedAt } = useAutoSave({
        data: draftSnapshot,
        enabled: !!draftKey && students.length > 0 && !pendingDraft,
        delay: 800,
        onSave: async (snap) => {
            if (!draftKey || typeof window === "undefined") return;
            if (dirtyCount === 0) {
                localStorage.removeItem(draftKey);
                return;
            }
            const payload: GradeDraft = { ...snap, savedAt: new Date().toISOString() };
            localStorage.setItem(draftKey, JSON.stringify(payload));
        },
    });

    // Détection d'un brouillon existant à la sélection classe+matière.
    useEffect(() => {
        if (!draftKey || students.length === 0 || draftDismissed || typeof window === "undefined") {
            return;
        }
        try {
            const raw = localStorage.getItem(draftKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as GradeDraft;
            if (parsed && parsed.grades) setPendingDraft(parsed);
        } catch {
            // brouillon corrompu : on l'ignore
        }
    }, [draftKey, students.length, draftDismissed]);

    const applyDraft = useCallback(() => {
        if (!pendingDraft) return;
        setGrades(pendingDraft.grades);
        setTitle(pendingDraft.title);
        setDate(pendingDraft.date);
        setTypeId(pendingDraft.typeId);
        setPeriodId(pendingDraft.periodId);
        setMaxGrade(pendingDraft.maxGrade);
        setCoefficient(pendingDraft.coefficient);
        setPendingDraft(null);
    }, [pendingDraft]);

    const discardDraft = useCallback(() => {
        if (draftKey && typeof window !== "undefined") localStorage.removeItem(draftKey);
        setPendingDraft(null);
        setDraftDismissed(true);
    }, [draftKey]);

    if (loading) {
        return (
            <PageShell className="pb-32">
                <PageHeader
                    title="Nouvelle saisie de notes"
                    description="Chargement des classes et périodes…"
                    breadcrumbs={[
                        { label: "Pédagogie", href: "/dashboard/grades" },
                        { label: "Saisie de notes" },
                    ]}
                />
                <PageLoading label="Préparation de la grille de saisie…" />
            </PageShell>
        );
    }

    if (success) {
        return (
            <PageShell className="max-w-3xl pb-12">
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
            </PageShell>
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
            <PageShell
                className="pb-32"
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
                        title={
                            editEvaluationId
                                ? "Modifier les notes"
                                : isFocusMode
                                  ? "Saisie rapide"
                                  : "Nouvelle saisie de notes"
                        }
                        description={
                            isFocusMode
                                ? "Mode focus actif — entre tes notes sans distraction."
                                : "Crée une évaluation et saisis les notes de la classe."
                        }
                        breadcrumbs={[
                            { label: "Pédagogie", href: "/dashboard/grades" },
                            { label: "Saisie de notes" },
                        ]}
                    />
                </div>

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            border: "1px solid var(--eduflow-danger-200)",
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

                {pendingDraft ? (
                    <Card
                        padding={14}
                        style={{
                            border: "1px solid var(--eduflow-brand-200)",
                            background: "var(--brand-50)",
                        }}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Icon name="info" size={18} color="var(--brand-700)" />
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 13,
                                        color: "var(--brand-800)",
                                        fontWeight: 500,
                                    }}
                                >
                                    Brouillon retrouvé (
                                    {new Date(pendingDraft.savedAt).toLocaleString("fr-FR", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                    })}
                                    ). Reprendre la saisie&nbsp;?
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" size="sm" onClick={discardDraft}>
                                    Ignorer
                                </Button>
                                <Button size="sm" icon="check" onClick={applyDraft}>
                                    Reprendre
                                </Button>
                            </div>
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
                            <h2 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                                Paramètres de l&apos;évaluation
                            </h2>
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
                                    disabled={Boolean(editEvaluationId)}
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
                                    disabled={!selectedClass || Boolean(editEvaluationId)}
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
                                    disabled={Boolean(editEvaluationId)}
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
                                    disabled={Boolean(editEvaluationId)}
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
                                    disabled={Boolean(editEvaluationId)}
                                        placeholder="Ex : DST chapitre 2"
                                        value={title}
                                        onChange={setTitle}
                                        full
                                    />
                                ) : null}
                                <FieldText
                                    label="Date"
                                    disabled={Boolean(editEvaluationId)}
                                    type="date"
                                    value={date}
                                    onChange={setDate}
                                    required
                                />
                                <FieldText
                                    label="Note max"
                                    disabled={Boolean(editEvaluationId)}
                                    type="number"
                                    value={String(maxGrade)}
                                    onChange={(v) => setMaxGrade(parseInt(v) || 20)}
                                    required
                                    min={1}
                                />

                            </div>
                        </div>
                    </Card>

                    {/* Formule de calcul de la matière (choisie par son enseignant) */}
                    {selectedSubject ? <SubjectFormulaCard classSubjectId={selectedSubject} /> : null}

                    {adjusting && selectedClass && selectedSubject && periodId ? (
                        <StudentAdjustPanel
                            key={`${adjusting.id}-${selectedSubject}-${periodId}`}
                            classId={selectedClass}
                            classSubjectId={selectedSubject}
                            periodId={periodId}
                            studentId={adjusting.id}
                            studentName={adjusting.name}
                            onClose={() => setAdjusting(null)}
                        />
                    ) : null}

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
                                        style={{ fontSize: 16, margin: 0 }}
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
                                        {completedCount} / {students.length}{" "}
                                        saisie{completedCount > 1 ? "s" : ""}
                                    </p>
                                    {draftStatus === "saving" ? (
                                        <p
                                            aria-live="polite"
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                                margin: "2px 0 0",
                                            }}
                                        >
                                            Brouillon en cours d&apos;enregistrement…
                                        </p>
                                    ) : draftSavedAt ? (
                                        <p
                                            aria-live="polite"
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                                margin: "2px 0 0",
                                            }}
                                        >
                                            Brouillon enregistré à{" "}
                                            {draftSavedAt.toLocaleTimeString("fr-FR", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    ) : null}
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
                                        Rédiger les appréciations
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
                                                <Th width={130}>Absence</Th>
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
                                                    g.isExcused !== initial.isExcused ||
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
                                                                                fontSize: 11,
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
                                                                step={gradeStep}
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
                                                            <div className="flex items-center gap-2">
                                                                <ToggleAbsent
                                                                    checked={g.isAbsent}
                                                                    onChange={(c) => {
                                                                        handleGradeChange(stu.id, "isAbsent", c);
                                                                        if (c)
                                                                            handleGradeChange(stu.id, "value", "");
                                                                        else
                                                                            handleGradeChange(stu.id, "isExcused", false);
                                                                    }}
                                                                />
                                                                {g.isAbsent ? (
                                                                    <label
                                                                        className="inline-flex items-center gap-1"
                                                                        style={{ fontSize: 11, color: "var(--eduflow-text-secondary)" }}
                                                                        title="Justifiée : exclue du calcul. Non justifiée : comptée 0 (modifiable si l'élève recompose)."
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={g.isExcused}
                                                                            onChange={(e) => {
                                                                                handleGradeChange(stu.id, "isExcused", e.target.checked);
                                                                                if (!e.target.checked) handleGradeChange(stu.id, "excuseReason", "");
                                                                            }}
                                                                            aria-label={`Absence justifiée de ${fullName}`}
                                                                        />
                                                                        justifiée
                                                                    </label>
                                                                ) : null}
                                                                {g.isAbsent && !g.isExcused && unjustifiedCountsZero ? (
                                                                    <span
                                                                        role="note"
                                                                        style={{ fontSize: 11, fontWeight: 600, color: "var(--eduflow-danger-600)" }}
                                                                    >
                                                                        compte 0 — cochez « justifiée » si l&apos;élève a un justificatif
                                                                    </span>
                                                                ) : null}
                                                                {isTeacher && selectedSubject && periodId ? (
                                                                    <button
                                                                        type="button"
                                                                        className="underline"
                                                                        style={{ fontSize: 11, color: "var(--eduflow-text-secondary)" }}
                                                                        aria-label={`Adapter le calcul pour ${fullName}`}
                                                                        onClick={() => {
                                                                            setAdjusting({ id: stu.id, name: fullName });
                                                                            document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
                                                                        }}
                                                                    >
                                                                        Adapter
                                                                    </button>
                                                                ) : null}
                                                                {g.isAbsent && g.isExcused ? (
                                                                    <input
                                                                        value={g.excuseReason ?? ""}
                                                                        maxLength={300}
                                                                        onChange={(e) => handleGradeChange(stu.id, "excuseReason", e.target.value)}
                                                                        placeholder={excuseReasonRequired ? "Motif (obligatoire)" : "Motif"}
                                                                        aria-label={`Motif de l'absence de ${fullName}`}
                                                                        aria-required={excuseReasonRequired}
                                                                        style={{
                                                                            width: 150,
                                                                            height: 28,
                                                                            padding: "0 8px",
                                                                            borderRadius: 8,
                                                                            border: `1px solid ${excuseReasonRequired && !(g.excuseReason ?? "").trim() ? "var(--eduflow-danger-600)" : "var(--eduflow-border-default)"}`,
                                                                            fontSize: 11,
                                                                        }}
                                                                    />
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        {!isFocusMode ? (
                                                            <td style={{ padding: "10px 16px" }}>
                                                                <div className="flex items-center gap-1">
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
                                                                            flex: 1,
                                                                            minWidth: 0,
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
                                                                    <AppreciationButton
                                                                        studentId={stu.id}
                                                                        currentGrade={g.value}
                                                                        maxGrade={maxGrade}
                                                                        onGenerated={(comment) =>
                                                                            handleGradeChange(
                                                                                stu.id,
                                                                                "comment",
                                                                                comment
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
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
            </PageShell>
        </PageGuard>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────
