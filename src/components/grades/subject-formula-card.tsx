"use client";

/**
 * « Formule de ma matière » : l'enseignant voit comment la moyenne de sa
 * matière est calculée et peut écrire sa propre formule (si l'école le
 * permet), avec un exemple chiffré calculé exactement comme le bulletin.
 */
import { useEffect, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { Button, Card, Icon } from "@/components/edu";
import { FormulaEditor } from "@/components/grades/formula-editor";
import { subjectAverage, toDisplay, type AverageGrade } from "@/lib/academic/average-engine";
import { validateFormula } from "@/lib/academic/formula";

interface FormulaInfo {
    subject: string;
    className: string;
    schoolFormula: string;
    subjectFormula: string | null;
    effectiveFormula: string;
    teacherFormulasAllowed: boolean;
    canEdit: boolean;
}

const SAMPLE: AverageGrade[] = [
    { value: 12, maxGrade: 20, isAbsent: false, isExcused: false, kind: "INTERROGATION" },
    { value: 15, maxGrade: 20, isAbsent: false, isExcused: false, kind: "INTERROGATION" },
    { value: 14, maxGrade: 20, isAbsent: false, isExcused: false, kind: "DEVOIR" },
    { value: 10, maxGrade: 20, isAbsent: false, isExcused: false, kind: "DEVOIR" },
    { value: 9, maxGrade: 20, isAbsent: false, isExcused: false, kind: "COMPOSITION" },
];

function example(formula: string): string {
    if (!validateFormula(formula, "SUBJECT").ok) return "—";
    const v = toDisplay(subjectAverage(SAMPLE, 0, undefined, formula));
    return v === null ? "NC" : String(v).replace(".", ",");
}

export function SubjectFormulaCard({ classSubjectId }: { classSubjectId: string }) {
    const key = `/api/class-subjects/${classSubjectId}/formula`;
    const { data, error, mutate } = useSWR<FormulaInfo>(key, fetcher);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        if (data?.effectiveFormula) setDraft(data.effectiveFormula);
    }, [data?.effectiveFormula]);

    if (error || !data?.effectiveFormula) return null;

    const save = async (formula: string | null) => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(key, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ formula }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Enregistrement impossible");
            await mutate();
            setOpen(false);
            setMessage({
                ok: true,
                text:
                    body?.subjectFormula === null
                        ? "La formule de l'école s'applique de nouveau à cette matière."
                        : "Formule enregistrée : les moyennes de la période en cours sont recalculées.",
            });
        } catch (err) {
            setMessage({ ok: false, text: err instanceof Error ? err.message : "Enregistrement impossible" });
        } finally {
            setSaving(false);
        }
    };

    const own = data.subjectFormula !== null;
    const draftValid = validateFormula(draft, "SUBJECT").ok;

    return (
        <Card padding={0}>
            <div
                className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4"
                style={{ borderColor: "var(--eduflow-border-subtle)" }}
            >
                <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                    <Icon name="chart" size={18} color="var(--brand-700)" />
                    <div style={{ minWidth: 0 }}>
                        <h3 className="eduflow-display" style={{ fontSize: 15, margin: 0 }}>
                            Calcul de la moyenne · {data.subject}
                        </h3>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                            {own ? "Votre formule pour cette matière" : "Formule de l'établissement"} :{" "}
                            <code>{data.effectiveFormula}</code>
                        </p>
                    </div>
                </div>
                {data.canEdit && !open ? (
                    <Button variant="secondary" size="sm" icon="pencil" onClick={() => setOpen(true)}>
                        Choisir ma formule
                    </Button>
                ) : null}
            </div>
            <div className="grid gap-3 px-5 py-4">
                {!data.teacherFormulasAllowed ? (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--eduflow-text-secondary)" }}>
                        L&apos;établissement applique la même formule à toutes les matières.
                    </p>
                ) : null}
                {open ? (
                    <>
                        <FormulaEditor
                            id={`formula-${classSubjectId}`}
                            scope="SUBJECT"
                            label="Formule de ma matière"
                            value={draft}
                            onChange={setDraft}
                            disabled={saving}
                        />
                        <p
                            className="rounded-lg px-3 py-2"
                            style={{ margin: 0, fontSize: 12, background: "var(--eduflow-surface-sunken)" }}
                        >
                            Exemple : interrogations 12 et 15, devoirs 14 et 10, composition 9 → formule de l&apos;école :{" "}
                            <strong>{example(data.schoolFormula)}</strong> ; votre formule : <strong>{example(draft)}</strong>
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                            Le changement s&apos;applique aux périodes dont le conseil n&apos;est pas encore validé. Il est enregistré
                            dans l&apos;historique.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" icon="check" loading={saving} disabled={!draftValid} onClick={() => save(draft)}>
                                Enregistrer ma formule
                            </Button>
                            {own ? (
                                <Button size="sm" variant="secondary" disabled={saving} onClick={() => save(null)}>
                                    Revenir à la formule de l&apos;école
                                </Button>
                            ) : null}
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={saving}
                                onClick={() => {
                                    setDraft(data.effectiveFormula);
                                    setOpen(false);
                                }}
                            >
                                Annuler
                            </Button>
                        </div>
                    </>
                ) : (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--eduflow-text-secondary)" }}>
                        Exemple : interrogations 12 et 15, devoirs 14 et 10, composition 9 → moyenne{" "}
                        <strong>{example(data.effectiveFormula)}</strong>.
                    </p>
                )}
                {message ? (
                    <p
                        role="status"
                        style={{ margin: 0, fontSize: 12, color: message.ok ? "var(--eduflow-text-secondary)" : "var(--eduflow-danger-600)" }}
                    >
                        {message.text}
                    </p>
                ) : null}
            </div>
        </Card>
    );
}
