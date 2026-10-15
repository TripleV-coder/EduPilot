"use client";

import { useSchoolThresholds } from "@/hooks/use-school-thresholds";
import type { SchoolThresholds } from "@/lib/schools/school-thresholds";
import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { Chip, FilterBar } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";
import { Block, CARD_COLORS, Figures, MODULE, decimal, initials } from "@/components/edu-homes/home-kit";
import homeStyles from "@/components/edu-homes/home.module.css";
import { pick, useUiLang } from "@/lib/i18n/ui-lang";
import type { StudentAveragesSummary } from "@/lib/academic/class-averages";

type FamilyGrade = {
    id: string;
    evaluationId: string;
    studentId: string;
    countsInAverage: boolean;
    value: number | null;
    maxValue: number;
    isAbsent: boolean;
    isExcused: boolean;
    comment: string | null;
    date: string;
    subject: { id: string; name: string };
    evaluationType: { id: string; name: string; code?: string };
    period: { id: string; name: string };
    coefficient: number;
    classSubjectId: string;
    subjectCoefficient: number;
    classAverage: number | null;
};

type Child = { id: string; user?: { firstName?: string; lastName?: string } };

/** Note ramenée sur 20 (sert à colorer une note isolée). */
const on20 = (g: FamilyGrade) => (g.value === null || g.maxValue <= 0 ? null : (g.value / g.maxValue) * 20);

/** Couleur d'une moyenne aux seuils de l'école (très bien, passage). */
const avgColor = (v: number | null, t: SchoolThresholds) =>
    v === null ? "var(--eduflow-text-tertiary)" : v >= t.performance.veryGoodFrom ? MODULE.green : v >= t.passingGrade ? MODULE.blue : MODULE.orange;

/* « Mes notes » de l'élève, ou notes des enfants pour le parent : ses propres
   notes par matière, pas la liste des évaluations de l'enseignant.
   Données : /api/grades (limité côté serveur à l'élève ou à ses enfants). */
export function FamilyGrades({ role }: { role: "STUDENT" | "PARENT" }) {
    const thresholds = useSchoolThresholds();
    const lang = useUiLang();
    const isParent = role === "PARENT";
    // Liste des enfants : parent uniquement (l'élève n'y a pas accès, 403)
    const { data: childrenData } = useSWR<unknown>(isParent ? "/api/students?limit=50" : null, fetcher);
    const children: Child[] = Array.isArray(childrenData)
        ? (childrenData as Child[])
        : ((childrenData as { data?: Child[] } | undefined)?.data ?? []);

    const [childId, setChildId] = useState<string | null>(null);
    const activeChild = isParent ? (childId ?? children[0]?.id ?? null) : null;
    const gradesKey = isParent ? (activeChild ? `/api/grades?studentId=${activeChild}&limit=500` : null) : "/api/grades?limit=500";
    // Moyennes calculées par le serveur, exactement comme au bulletin
    const { data, error, isLoading, mutate } = useSWR<{ data: FamilyGrade[]; summary: StudentAveragesSummary | null }>(
        gradesKey,
        fetcher
    );

    const [periodId, setPeriodId] = useState<string>("ALL");
    const allGrades = useMemo(() => data?.data ?? [], [data]);
    const periods = useMemo(() => {
        const seen = new Map<string, string>();
        for (const g of allGrades) seen.set(g.period.id, g.period.name);
        return Array.from(seen, ([id, name]) => ({ id, name }));
    }, [allGrades]);
    const grades = useMemo(
        () => (periodId === "ALL" ? allGrades : allGrades.filter((g) => g.period.id === periodId)),
        [allGrades, periodId]
    );

    const summary = data?.summary ?? null;
    const view =
        periodId === "ALL"
            ? summary
                ? { general: summary.annual.general ?? summary.annual.provisional, subjects: summary.annual.subjects }
                : null
            : (summary?.periods[periodId] ?? null);
    const bySubject = useMemo(() => {
        const map = new Map<string, { name: string; grades: FamilyGrade[] }>();
        for (const g of grades) {
            const entry = map.get(g.classSubjectId) ?? { name: g.subject.name, grades: [] };
            entry.grades.push(g);
            map.set(g.classSubjectId, entry);
        }
        return Array.from(map, ([classSubjectId, s]) => ({
            ...s,
            average: view?.subjects[classSubjectId] ?? null,
        })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    }, [grades, view]);

    const overall = view?.general ?? null;
    const best = bySubject.filter((s) => s.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0];
    const recent = [...grades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const childName = (c: Child) => `${c.user?.firstName ?? ""} ${c.user?.lastName ?? ""}`.trim() || "Enfant";
    const selfList: Child[] = Array.isArray(childrenData)
        ? (childrenData as Child[])
        : ((childrenData as { data?: Child[] } | undefined)?.data ?? []);
    const bulletinStudentId = isParent ? activeChild : (selfList[0]?.id ?? null);
    const bulletinPeriodId = periodId !== "ALL" ? periodId : (grades[0]?.period.id ?? null);
    const loading = isLoading || (isParent && !childrenData);
    const noChild = isParent && !loading && children.length === 0;

    return (
        <PageShell>
            <PageHeader
                title={isParent ? "Notes de mes enfants" : pick(lang, "Mes notes", "My grades")}
                description={isParent ? "Les notes et moyennes par matière, période par période." : "Tes notes et tes moyennes par matière."}
                breadcrumbs={[{ label: pick(lang, "Tableau de bord", "Dashboard"), href: "/dashboard" }, { label: isParent ? "Notes" : pick(lang, "Mes notes", "My grades") }]}
                actions={
                    bulletinStudentId && bulletinPeriodId && grades.length > 0 ? (
                        <Link
                            href={`/dashboard/grades/bulletins?studentId=${bulletinStudentId}&periodId=${bulletinPeriodId}`}
                            className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold"
                            style={{ background: "var(--brand-700)", color: "var(--eduflow-text-on-brand)" }}
                        >
                            Bulletin
                        </Link>
                    ) : null
                }
            />

            {isParent && children.length > 1 ? (
                <FilterBar hideIcon>
                    {children.map((c) => (
                        <Chip key={c.id} active={activeChild === c.id} onClick={() => setChildId(c.id)}>
                            {childName(c)}
                        </Chip>
                    ))}
                </FilterBar>
            ) : null}

            {periods.length > 1 ? (
                <FilterBar>
                    <Chip active={periodId === "ALL"} onClick={() => setPeriodId("ALL")}>
                        Toute l&apos;année
                    </Chip>
                    {periods.map((p) => (
                        <Chip key={p.id} active={periodId === p.id} onClick={() => setPeriodId(p.id)}>
                            {p.name}
                        </Chip>
                    ))}
                </FilterBar>
            ) : null}

            {loading && !noChild ? <PageLoading label="Chargement des notes…" /> : null}
            {error ? <PageError message="Impossible de charger les notes." onRetry={() => void mutate()} /> : null}
            {noChild ? (
                <PageEmpty icon="users" title={pick(lang, "Aucun enfant rattaché", "No linked child")} description="Rattachez votre enfant avec le code remis par l'établissement." />
            ) : null}
            {!loading && !error && !noChild && grades.length === 0 ? (
                <PageEmpty icon="pencil" title={pick(lang, "Aucune note pour l'instant", "No grades yet")} description="Les notes apparaissent ici dès que les enseignants les saisissent." />
            ) : null}

            {!loading && !error && grades.length > 0 ? (
                <>
                    <Block id="grades-overview" title="Vue d'ensemble">
                        <Figures
                            items={[
                                {
                                    label: "Moyenne générale",
                                    value: overall === null ? "—" : `${decimal(overall, 2)}/20`,
                                    note: "pondérée par les coefficients",
                                    color: avgColor(overall, thresholds),
                                },
                                {
                                    label: "Notes",
                                    value: String(grades.length),
                                    note: `${bySubject.length} matière${bySubject.length > 1 ? "s" : ""}`,
                                    color: MODULE.purple,
                                },
                                {
                                    label: "Meilleure matière",
                                    value: best ? best.name : "—",
                                    note: best?.average != null ? `${decimal(best.average, 2)}/20` : "pas encore de moyenne",
                                    color: MODULE.green,
                                },
                            ]}
                        />
                    </Block>

                    <Block id="grades-subjects" title="Par matière">
                        <ul className={homeStyles.watch}>
                            {bySubject.map((s, i) => (
                                <li key={s.name} className={homeStyles.watchItem}>
                                    <span className={homeStyles.avatar} style={{ background: CARD_COLORS[i % CARD_COLORS.length] }} aria-hidden="true">
                                        {initials(s.name)}
                                    </span>
                                    <div className="min-w-0">
                                        <div className={homeStyles.name}>{s.name}</div>
                                        <div className={homeStyles.detail}>
                                            {s.grades.length} note{s.grades.length > 1 ? "s" : ""}
                                        </div>
                                    </div>
                                    <span className="eduflow-tabular text-[15px] font-semibold" style={{ color: avgColor(s.average, thresholds) }}>
                                        {s.average === null ? "—" : `${decimal(s.average, 2)}/20`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Block>

                    <Block id="grades-recent" title="Dernières notes">
                        <ul className={homeStyles.watch}>
                            {recent.map((g, i) => {
                                const value = g.isAbsent
                                    ? "Absent"
                                    : g.isExcused
                                      ? "Dispensé"
                                      : g.value === null
                                        ? "—"
                                        : `${decimal(g.value, 2)}/${g.maxValue}`;
                                const detail = [
                                    g.evaluationType.name,
                                    new Date(g.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }),
                                    g.classAverage !== null ? `moyenne de la classe ${decimal(g.classAverage, 2)}` : null,
                                ]
                                    .filter(Boolean)
                                    .join(" · ");
                                return (
                                    <li key={g.id} className={homeStyles.watchItem}>
                                        <span className={homeStyles.avatar} style={{ background: CARD_COLORS[i % CARD_COLORS.length] }} aria-hidden="true">
                                            {initials(g.subject.name)}
                                        </span>
                                        <div className="min-w-0">
                                            <div className={homeStyles.name}>{g.subject.name}</div>
                                            <div className={homeStyles.detail}>{detail}</div>
                                        </div>
                                        <span className="eduflow-tabular text-[15px] font-semibold" style={{ color: avgColor(on20(g), thresholds) }}>
                                            {value}
                                        </span>
                                        {g.countsInAverage ? <ClaimButton grade={g} /> : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </Block>
                </>
            ) : null}
        </PageShell>
    );
}

/**
 * Réclamation : un seul bouton qui prend rendez-vous avec l'enseignant de la
 * matière. La copie est revue en personne ; la correction éventuelle est
 * ensuite enregistrée par l'enseignant et validée par le directeur des études.
 */
function ClaimButton({ grade }: { grade: FamilyGrade }) {
    const [open, setOpen] = useState(false);
    const [when, setWhen] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const submit = async () => {
        if (!when) {
            setMessage({ ok: false, text: "Choisissez une date et une heure." });
            return;
        }
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch("/api/grades/corrections/appointment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    evaluationId: grade.evaluationId,
                    studentId: grade.studentId,
                    scheduledAt: new Date(when).toISOString(),
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Rendez-vous impossible");
            setMessage({ ok: true, text: "Rendez-vous demandé. Apportez la copie." });
            setOpen(false);
        } catch (err) {
            setMessage({ ok: false, text: err instanceof Error ? err.message : "Rendez-vous impossible" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="basis-full text-xs" style={{ color: "var(--eduflow-text-secondary)" }}>
            {open ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1">
                        Rendez-vous le
                        <input
                            type="datetime-local"
                            value={when}
                            onChange={(e) => setWhen(e.target.value)}
                            className="rounded border px-2 py-1"
                            aria-label={`Date du rendez-vous pour la réclamation en ${grade.subject.name}`}
                        />
                    </label>
                    <button type="button" className="rounded-full border px-3 py-1 font-semibold" disabled={busy} onClick={submit}>
                        {busy ? "Envoi…" : "Demander"}
                    </button>
                    <button type="button" className="underline" onClick={() => setOpen(false)}>
                        Annuler
                    </button>
                </div>
            ) : (
                <button type="button" className="mt-1 underline" onClick={() => setOpen(true)}>
                    Réclamation · prendre rendez-vous
                </button>
            )}
            {message ? (
                <p role="status" className="mt-1" style={{ color: message.ok ? undefined : "var(--eduflow-danger-600)" }}>
                    {message.text}
                </p>
            ) : null}
        </div>
    );
}
