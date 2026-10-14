"use client";

/**
 * « Adapter le calcul » pour UN élève, dans une matière et une période.
 *
 * 1. Ne pas compter une note précise (motif obligatoire) : la formule de la
 *    matière s'applique sans cette note — par exemple ÷ 2 au lieu de ÷ 3.
 * 2. Ou écrire une formule particulière pour cet élève, en nommant ses notes
 *    (I1, D1, C1…), par exemple (MI + D1) / 2.
 * L'aperçu est calculé exactement comme le bulletin. Tout est tracé et figé au
 * conseil de classe.
 */
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { Button, Card, Icon } from "@/components/edu";
import { FormulaEditor } from "@/components/grades/formula-editor";
import {
    evaluationKind,
    gradeLabels,
    subjectAverage,
    toDisplay,
    type AverageGrade,
} from "@/lib/academic/average-engine";
import { validateFormula } from "@/lib/academic/formula";
import type { EvaluationData } from "@/components/grades/cahier/types";

interface Props {
    classId: string;
    classSubjectId: string;
    periodId: string;
    studentId: string;
    studentName: string;
    onClose: () => void;
}

type Row = AverageGrade & {
    evaluation: EvaluationData;
    gradeId: string | null;
    excludedReason: string | null;
};

const fmt = (v: number | null) => (v === null ? "NC" : String(v).replace(".", ","));

async function readError(res: Response, fallback: string): Promise<string> {
    const body = await res.json().catch(() => null);
    return (body && typeof body.error === "string" && body.error) || fallback;
}

export function StudentAdjustPanel({ classId, classSubjectId, periodId, studentId, studentName, onClose }: Props) {
    const cahierKey = `/api/grades/cahier?classId=${classId}&classSubjectId=${classSubjectId}&periodId=${periodId}`;
    const formulasKey = `/api/student-formulas?classSubjectId=${classSubjectId}&periodId=${periodId}`;
    const { data: cahier, mutate: reloadCahier } = useSWR<{ evaluations: EvaluationData[] }>(cahierKey, fetcher);
    const { data: adapted, mutate: reloadAdapted } = useSWR<{
        data: Array<{ studentId: string; formula: string; reason: string }>;
        canEdit: boolean;
        studentAdjustments: boolean;
    }>(formulasKey, fetcher);
    const { data: subjectInfo } = useSWR<{ effectiveFormula: string; subject: string }>(
        `/api/class-subjects/${classSubjectId}/formula`,
        fetcher,
    );

    const current = adapted?.data?.find((r) => r.studentId === studentId) ?? null;
    const [formula, setFormula] = useState("");
    const [reason, setReason] = useState("");
    const [excludeFor, setExcludeFor] = useState<string | null>(null);
    const [excludeReason, setExcludeReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        setFormula(current?.formula ?? "");
        setReason(current?.reason ?? "");
    }, [current?.formula, current?.reason]);

    // Notes de l'élève dans la matière et la période, nommées comme dans les formules
    const rows: Array<{ row: Row; label: string }> = useMemo(() => {
        const list: Row[] = (cahier?.evaluations ?? [])
            .filter((ev) => ev.periodId === periodId && ev.typeCategory !== "COMPETENCE")
            .map((ev) => {
                const g = ev.grades[studentId];
                return {
                    value: g?.value ?? null,
                    maxGrade: ev.maxGrade,
                    isAbsent: g?.isAbsent ?? false,
                    isExcused: g?.isExcused ?? false,
                    excluded: Boolean(g?.excludedReason),
                    kind: evaluationKind({ code: ev.typeCode, name: ev.type, category: ev.typeCategory }),
                    order: `${new Date(ev.date).toISOString()}|${ev.id}`,
                    evaluation: ev,
                    gradeId: g?.id ?? null,
                    excludedReason: g?.excludedReason ?? null,
                };
            });
        return gradeLabels(list).map(({ grade, label }) => ({ row: grade, label }));
    }, [cahier, periodId, studentId]);

    const grades = rows.map((r) => r.row);
    const subjectFormula = subjectInfo?.effectiveFormula ?? "moyenne(MI ; DEVOIRS ; COMPOS)";
    const normal = toDisplay(subjectAverage(grades, 0, undefined, subjectFormula));
    const formulaValid = formula.trim() === "" || validateFormula(formula, "SUBJECT").ok;
    const withFormula = formula.trim() && formulaValid ? toDisplay(subjectAverage(grades, 0, undefined, formula)) : null;
    const canEdit = adapted?.canEdit ?? false;

    const toggleExclusion = async (row: Row, excluded: boolean, why?: string) => {
        if (!row.gradeId) return;
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/grades/${row.gradeId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(excluded ? { excluded: true, excludedReason: why } : { excluded: false }),
            });
            if (!res.ok) throw new Error(await readError(res, "Modification impossible"));
            await reloadCahier();
            setExcludeFor(null);
            setExcludeReason("");
            setMessage({ ok: true, text: excluded ? "La note ne compte plus pour cet élève." : "La note compte de nouveau." });
        } catch (err) {
            setMessage({ ok: false, text: err instanceof Error ? err.message : "Modification impossible" });
        } finally {
            setBusy(false);
        }
    };

    const saveFormula = async (next: string | null) => {
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch("/api/student-formulas", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ classSubjectId, periodId, studentId, formula: next, reason: reason.trim() || undefined }),
            });
            if (!res.ok) throw new Error(await readError(res, "Enregistrement impossible"));
            await reloadAdapted();
            setMessage({ ok: true, text: next ? "Formule particulière enregistrée pour cet élève." : "Le calcul normal s'applique de nouveau." });
        } catch (err) {
            setMessage({ ok: false, text: err instanceof Error ? err.message : "Enregistrement impossible" });
        } finally {
            setBusy(false);
        }
    };

    const cell: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid var(--eduflow-border-subtle)" };
    const input: React.CSSProperties = {
        height: 34,
        padding: "0 10px",
        borderRadius: 8,
        border: "1px solid var(--eduflow-border-default)",
        fontSize: 13,
        minWidth: 0,
    };

    return (
        <Card padding={0}>
            <div
                className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4"
                style={{ borderColor: "var(--eduflow-border-subtle)" }}
            >
                <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                    <Icon name="settings" size={18} color="var(--brand-700)" />
                    <h3 className="eduflow-display" style={{ fontSize: 15, margin: 0 }}>
                        Adapter le calcul · {studentName}
                        {subjectInfo?.subject ? ` · ${subjectInfo.subject}` : ""}
                    </h3>
                </div>
                <Button variant="ghost" size="sm" icon="x" onClick={onClose}>
                    Fermer
                </Button>
            </div>

            <div className="grid gap-4 px-5 py-4">
                {adapted && !adapted.studentAdjustments ? (
                    <p style={{ margin: 0, fontSize: 12 }}>L&apos;établissement ne permet pas d&apos;adapter le calcul pour un élève.</p>
                ) : null}

                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ textAlign: "left", fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                                <th style={cell}>Nom</th>
                                <th style={cell}>Évaluation</th>
                                <th style={cell}>Note</th>
                                <th style={cell}>Compte</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td style={cell} colSpan={4}>
                                        Aucune évaluation dans cette période.
                                    </td>
                                </tr>
                            ) : null}
                            {rows.map(({ row, label }) => {
                                const ev = row.evaluation;
                                const value = row.isAbsent
                                    ? row.isExcused
                                        ? "absence justifiée"
                                        : "absence non justifiée"
                                    : row.value === null
                                      ? "pas de note"
                                      : `${fmt(Number(row.value))} / ${ev.maxGrade}`;
                                return (
                                    <tr key={ev.id}>
                                        <td style={{ ...cell, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>{label}</td>
                                        <td style={cell}>
                                            {ev.title || ev.type} · {new Date(ev.date).toLocaleDateString("fr-FR")}
                                        </td>
                                        <td style={cell}>{value}</td>
                                        <td style={cell}>
                                            {row.excludedReason ? (
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span>Non comptée ({row.excludedReason})</span>
                                                    {canEdit ? (
                                                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => toggleExclusion(row, false)}>
                                                            Compter de nouveau
                                                        </Button>
                                                    ) : null}
                                                </span>
                                            ) : excludeFor === ev.id ? (
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <input
                                                        style={input}
                                                        value={excludeReason}
                                                        maxLength={300}
                                                        placeholder="Motif (obligatoire)"
                                                        aria-label={`Motif pour ne pas compter ${label}`}
                                                        onChange={(e) => setExcludeReason(e.target.value)}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        disabled={busy || !excludeReason.trim()}
                                                        onClick={() => toggleExclusion(row, true, excludeReason.trim())}
                                                    >
                                                        Ne pas compter
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setExcludeFor(null)}>
                                                        Annuler
                                                    </Button>
                                                </span>
                                            ) : (
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span>Oui</span>
                                                    {canEdit && row.gradeId ? (
                                                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setExcludeFor(ev.id)}>
                                                            Ne pas compter…
                                                        </Button>
                                                    ) : null}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <p className="rounded-lg px-3 py-2" style={{ margin: 0, fontSize: 12, background: "var(--eduflow-surface-sunken)" }}>
                    Calcul normal de la matière (<code>{subjectFormula}</code>), notes non comptées retirées :{" "}
                    <strong>{fmt(normal)}</strong>
                    {current ? (
                        <>
                            {" "}
                            · formule particulière en vigueur (<code>{current.formula}</code>) :{" "}
                            <strong>{fmt(toDisplay(subjectAverage(grades, 0, undefined, current.formula)))}</strong>
                        </>
                    ) : null}
                </p>

                {canEdit ? (
                    <div className="grid gap-2">
                        <FormulaEditor
                            id={`student-formula-${studentId}`}
                            scope="SUBJECT"
                            label="Formule particulière pour cet élève (facultatif) — utilisez les noms ci-dessus, par exemple (MI + D1) / 2"
                            value={formula}
                            onChange={setFormula}
                            disabled={busy}
                        />
                        <label className="grid gap-1" style={{ fontSize: 11, fontWeight: 600, color: "var(--eduflow-text-tertiary)" }}>
                            Motif (obligatoire)
                            <input style={input} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                        </label>
                        {formula.trim() && formulaValid ? (
                            <p style={{ margin: 0, fontSize: 12 }}>
                                Aperçu avec cette formule : <strong>{fmt(withFormula)}</strong>
                            </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                icon="check"
                                loading={busy}
                                disabled={!formula.trim() || !formulaValid || !reason.trim()}
                                onClick={() => saveFormula(formula.trim())}
                            >
                                Enregistrer pour cet élève
                            </Button>
                            {current ? (
                                <Button size="sm" variant="secondary" disabled={busy} onClick={() => saveFormula(null)}>
                                    Revenir au calcul normal
                                </Button>
                            ) : null}
                        </div>
                    </div>
                ) : current ? (
                    <p style={{ margin: 0, fontSize: 12 }}>Motif : {current.reason}</p>
                ) : null}

                {message ? (
                    <p
                        role="status"
                        style={{ margin: 0, fontSize: 12, color: message.ok ? "var(--eduflow-text-secondary)" : "var(--eduflow-danger-600)" }}
                    >
                        {message.text}
                    </p>
                ) : null}
                <p style={{ margin: 0, fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                    Possible jusqu&apos;à la validation du conseil de classe. Chaque changement est enregistré dans l&apos;historique et
                    signalé sur le bulletin.
                </p>
            </div>
        </Card>
    );
}
