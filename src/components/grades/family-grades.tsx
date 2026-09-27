"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { Chip, FilterBar } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";
import { Block, CARD_COLORS, Figures, MODULE, decimal, initials } from "@/components/edu-homes/home-kit";
import homeStyles from "@/components/edu-homes/home.module.css";

type FamilyGrade = {
    id: string;
    value: number | null;
    maxValue: number;
    isAbsent: boolean;
    isExcused: boolean;
    comment: string | null;
    date: string;
    subject: { id: string; name: string };
    evaluationType: { id: string; name: string };
    period: { id: string; name: string };
    coefficient: number;
    classAverage: number | null;
};

type Child = { id: string; user?: { firstName?: string; lastName?: string } };

/** Note ramenée sur 20 (les évaluations peuvent être notées sur 10, 40…). */
const on20 = (g: FamilyGrade) => (g.value === null || g.maxValue <= 0 ? null : (g.value / g.maxValue) * 20);

/** Moyenne pondérée par les coefficients, sur les notes comptées (ni absence ni dispense). */
function weightedAverage(grades: FamilyGrade[]): number | null {
    let sum = 0;
    let weight = 0;
    for (const g of grades) {
        const v = on20(g);
        if (v === null || g.isAbsent || g.isExcused) continue;
        sum += v * g.coefficient;
        weight += g.coefficient;
    }
    return weight > 0 ? sum / weight : null;
}

const avgColor = (v: number | null) =>
    v === null ? "var(--eduflow-text-tertiary)" : v >= 14 ? MODULE.green : v >= 10 ? MODULE.blue : MODULE.orange;

/* « Mes notes » de l'élève, ou notes des enfants pour le parent : ses propres
   notes par matière, pas la liste des évaluations de l'enseignant.
   Données : /api/grades (limité côté serveur à l'élève ou à ses enfants). */
export function FamilyGrades({ role }: { role: "STUDENT" | "PARENT" }) {
    const isParent = role === "PARENT";
    const { data: childrenData } = useSWR<unknown>(isParent ? "/api/students?limit=50" : null, fetcher);
    const children: Child[] = Array.isArray(childrenData)
        ? (childrenData as Child[])
        : ((childrenData as { data?: Child[] } | undefined)?.data ?? []);

    const [childId, setChildId] = useState<string | null>(null);
    const activeChild = isParent ? (childId ?? children[0]?.id ?? null) : null;
    const gradesKey = isParent ? (activeChild ? `/api/grades?studentId=${activeChild}&limit=500` : null) : "/api/grades?limit=500";
    const { data, error, isLoading, mutate } = useSWR<{ data: FamilyGrade[] }>(gradesKey, fetcher);

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

    const bySubject = useMemo(() => {
        const map = new Map<string, { name: string; grades: FamilyGrade[] }>();
        for (const g of grades) {
            const entry = map.get(g.subject.id) ?? { name: g.subject.name, grades: [] };
            entry.grades.push(g);
            map.set(g.subject.id, entry);
        }
        return Array.from(map.values())
            .map((s) => ({ ...s, average: weightedAverage(s.grades) }))
            .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    }, [grades]);

    const overall = weightedAverage(grades);
    const best = bySubject.filter((s) => s.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0];
    const recent = [...grades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const childName = (c: Child) => `${c.user?.firstName ?? ""} ${c.user?.lastName ?? ""}`.trim() || "Enfant";
    const loading = isLoading || (isParent && !childrenData);
    const noChild = isParent && !loading && children.length === 0;

    return (
        <PageShell>
            <PageHeader
                title={isParent ? "Notes de mes enfants" : "Mes notes"}
                description={isParent ? "Les notes et moyennes par matière, période par période." : "Tes notes et tes moyennes par matière."}
                breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: isParent ? "Notes" : "Mes notes" }]}
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
                <PageEmpty icon="users" title="Aucun enfant rattaché" description="Rattachez votre enfant avec le code remis par l'établissement." />
            ) : null}
            {!loading && !error && !noChild && grades.length === 0 ? (
                <PageEmpty icon="pencil" title="Aucune note pour l'instant" description="Les notes apparaissent ici dès que les enseignants les saisissent." />
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
                                    color: avgColor(overall),
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
                                    <span className="eduflow-tabular text-[15px] font-semibold" style={{ color: avgColor(s.average) }}>
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
                                        <span className="eduflow-tabular text-[15px] font-semibold" style={{ color: avgColor(on20(g)) }}>
                                            {value}
                                        </span>
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
