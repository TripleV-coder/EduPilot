"use client";

/**
 * Règles de l'établissement : calcul des moyennes, mentions, options de
 * l'année, critères d'orientation. Des choix encadrés (jamais de formule
 * libre), les règles officielles du Bénin par défaut, un exemple chiffré
 * calculé par le moteur réel, chaque changement tracé côté serveur.
 */
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { Button, Card, Icon } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError } from "@/components/layout/page-states";
import { Rational, subjectAverage, toDisplay, type AverageGrade } from "@/lib/academic/average-engine";
import { evaluateFormula, validateFormula } from "@/lib/academic/formula";
import { FormulaEditor } from "@/components/grades/formula-editor";
import { gradingSettingsSchema, mentionFor, type GradingSettings } from "@/lib/academic/grading-rules";
import { DISCIPLINES, DISCIPLINE_LABELS, OFFICIAL_SERIES, type Discipline } from "@/lib/benin/series";
import { formatDecimal } from "@/lib/utils/formatters";

interface RulesResponse {
    settings: GradingSettings;
    defaults: GradingSettings;
    passingGrade: number;
    periodType: string;
    periodsCount: number | null;
    canEdit: boolean;
}

type Calculation = GradingSettings["calculation"];
type IconName = Parameters<typeof Icon>[0]["name"];

const fmt = (v: number | null) => (v === null ? "NC" : formatDecimal(v, 2));

// Exemple fixe, calculé avec le moteur réel selon les règles choisies
const SAMPLE: AverageGrade[] = [
    { value: 12, maxGrade: 20, isAbsent: false, isExcused: false, kind: "INTERROGATION" },
    { value: 15, maxGrade: 20, isAbsent: false, isExcused: false, kind: "INTERROGATION" },
    { value: 14, maxGrade: 20, isAbsent: false, isExcused: false, kind: "DEVOIR" },
    { value: null, maxGrade: 20, isAbsent: true, isExcused: false, kind: "DEVOIR" },
    { value: 9, maxGrade: 20, isAbsent: false, isExcused: false, kind: "COMPOSITION" },
];
const SAMPLE_PERIODS = [11.5, 12.75, 14];

function annualExample(calc: Calculation, count: number): number | null {
    const values = SAMPLE_PERIODS.slice(0, count).map((v) => Rational.from(v));
    const vars: Record<string, Rational | Rational[]> = { PERIODES: values };
    values.forEach((v, i) => (vars[`P${i + 1}`] = v));
    return toDisplay(evaluateFormula(calc.annualFormula, vars), calc.rounding);
}

/** Message lisible pour la première erreur de validation. */
function describeIssue(path: PropertyKey[], message: string): string {
    const section = String(path[0] ?? "");
    if (path[1] === "subjectFormula") return `Formule des matières : ${message}`;
    if (path[1] === "annualFormula") return `Moyenne annuelle : ${message}`;
    if (section === "mentions") {
        return message.startsWith("La ") || message.startsWith("Les ")
            ? `Mentions : ${message}`
            : "Mentions : chaque mention a un nom et une moyenne entre 0 et 20.";
    }
    if (section === "orientation") {
        return `Critères d'orientation (${String(path[1] ?? "").replace("SERIE_", "")}) : au moins une discipline indispensable, des poids de 1 à 10 et une moyenne conseillée de 0 à 20.`;
    }
    if (section === "calculation") return "Moyenne annuelle : chaque poids de période est un nombre entier de 1 à 5.";
    if (section === "cepPassMark" || section === "bepcPassMark") return "Les moyennes visées pour le CEP et le BEPC sont comprises entre 0 et 20.";
    return "Un réglage est invalide : vérifiez les valeurs saisies.";
}

export default function GradingRulesPage() {
    const { data, error, isLoading, mutate } = useSWR<RulesResponse>("/api/config/grading", fetcher);
    const [draft, setDraft] = useState<GradingSettings | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    useEffect(() => {
        if (data && !draft) setDraft(data.settings);
    }, [data, draft]);

    const canEdit = data?.canEdit ?? false;
    const periodsCount = data?.periodsCount ?? null;
    const dirty = useMemo(
        () => Boolean(data && draft && JSON.stringify(data.settings) !== JSON.stringify(draft)),
        [data, draft],
    );

    const update = (patch: Partial<GradingSettings>) => {
        setSavedMessage(null);
        setDraft((d) => (d ? { ...d, ...patch } : d));
    };
    const updateCalc = (patch: Partial<Calculation>) => {
        setSavedMessage(null);
        setDraft((d) => (d ? { ...d, calculation: { ...d.calculation, ...patch } } : d));
    };

    // Même validation que le serveur (schéma partagé)
    const validation = useMemo(() => {
        if (!draft) return null;
        const parsed = gradingSettingsSchema.safeParse(draft);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            return describeIssue(issue.path, issue.message);
        }
        const annual = validateFormula(draft.calculation.annualFormula, "ANNUAL", periodsCount ?? 3);
        if (!annual.ok) return `Moyenne annuelle : ${annual.error}`;
        return null;
    }, [draft, periodsCount]);

    async function save() {
        if (!draft || validation) return;
        setSaving(true);
        setSaveError(null);
        setSavedMessage(null);
        try {
            const res = await fetch("/api/config/grading", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Enregistrement impossible");
            setDraft(body.settings);
            await mutate();
            setSavedMessage(
                body.recalculation === "started"
                    ? "Règles enregistrées. Les moyennes de l'année en cours sont en cours de recalcul ; les périodes au conseil validé gardent leurs règles."
                    : "Règles enregistrées.",
            );
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Enregistrement impossible");
        } finally {
            setSaving(false);
        }
    }

    const calc = draft?.calculation;
    const subjectExample = calc ? toDisplay(subjectAverage(SAMPLE, 0, calc), calc.rounding) : null;
    const annualCount = periodsCount ?? 3;
    const annual = calc ? annualExample(calc, annualCount) : null;
    const periodLetter = periodsCount === 2 ? "S" : "T";

    return (
        <PageGuard roles={["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <PageShell className="max-w-4xl pb-28">
                <PageHeader
                    title="Règles de l'établissement"
                    description="Comment l'école calcule les moyennes, attribue les mentions et oriente les élèves. Les règles officielles du Bénin s'appliquent par défaut."
                    breadcrumbs={[{ label: "Paramètres", href: "/dashboard/settings" }, { label: "Règles de l'établissement" }]}
                />

                {error ? (
                    <PageError message="Impossible de charger les règles de l'établissement." onRetry={() => void mutate()} />
                ) : null}
                {!error && (isLoading || !draft) ? (
                    <Card padding={20}>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--eduflow-text-secondary)" }}>Chargement des règles…</p>
                    </Card>
                ) : null}

                {draft && calc ? (
                    <fieldset disabled={!canEdit || saving} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 16, minWidth: 0 }}>
                        {!canEdit ? <Notice>Lecture seule : seule la direction modifie ces règles.</Notice> : null}
                        <Notice>
                            Quand un conseil de classe est validé, les règles et les coefficients de cette période sont gelés : un
                            changement ici ne modifie jamais un bulletin déjà validé.
                        </Notice>

                        <Section icon="chart" title="Moyenne d'une matière" subtitle="Comment les notes d'une matière deviennent une moyenne sur 20.">
                            <FormulaEditor
                                id="school-subject-formula"
                                scope="SUBJECT"
                                label="Formule de l'école pour la moyenne d'une matière"
                                value={calc.subjectFormula}
                                onChange={(text) => updateCalc({ subjectFormula: text })}
                            />
                            <Choice
                                name="unjustifiedAbsence"
                                legend="Absence NON justifiée à une évaluation"
                                value={calc.unjustifiedAbsence}
                                onChange={(v) => updateCalc({ unjustifiedAbsence: v as Calculation["unjustifiedAbsence"] })}
                                options={[
                                    { value: "ZERO", label: "Compte 0 (règle officielle)", help: "Le professeur peut toujours saisir la note si l'élève recompose." },
                                    { value: "EXCLUDE", label: "Ne compte pas", help: "L'évaluation est retirée du calcul pour cet élève." },
                                ]}
                            />
                            <Choice
                                name="unresolvedNc"
                                legend="Note « NC » que le professeur n'a pas encore tranchée"
                                value={calc.unresolvedNc}
                                onChange={(v) => updateCalc({ unresolvedNc: v as Calculation["unresolvedNc"] })}
                                options={[
                                    { value: "EXCLUDE", label: "Retirée du calcul (par défaut)", help: "Rien n'est bloqué ; la note reste signalée « NC » sur le bulletin." },
                                    { value: "ZERO", label: "Compte 0", help: "Chaque note manquante compte 0 jusqu'à ce que le professeur tranche." },
                                ]}
                            />
                            <Toggle
                                checked={calc.subjectNcWhenNoDevoir}
                                onChange={(v) => updateCalc({ subjectNcWhenNoDevoir: v })}
                                label="Matière « NC » si des devoirs étaient prévus mais qu'aucun ne compte"
                                help="Évite une moyenne de matière faite uniquement d'interrogations."
                            />
                            <Choice
                                name="rounding"
                                legend="Arrondi au centième"
                                value={calc.rounding}
                                onChange={(v) => updateCalc({ rounding: v as Calculation["rounding"] })}
                                options={[
                                    { value: "HALF_UP", label: "Au plus proche (12,345 → 12,35)", help: "Règle par défaut." },
                                    { value: "TRUNCATE", label: "Troncature (12,349 → 12,34)", help: "On coupe sans arrondir." },
                                ]}
                            />
                            <Example>
                                Exemple : interrogations 12 et 15, devoir 14, devoir manqué sans justificatif, composition 9 →{" "}
                                <strong>moyenne de la matière : {fmt(subjectExample)}</strong>
                            </Example>
                        </Section>

                        <Section
                            icon="calendar"
                            title="Moyenne annuelle"
                            subtitle={
                                periodsCount === 2
                                    ? "L'établissement fonctionne en semestres."
                                    : periodsCount === 3
                                      ? "L'établissement fonctionne en trimestres."
                                      : "Découpage de l'année à définir dans les années académiques."
                            }
                        >
                            <FormulaEditor
                                id="school-annual-formula"
                                scope="ANNUAL"
                                periods={periodsCount ?? 3}
                                label={`Formule de la moyenne annuelle (${periodsCount === 2 ? "P1 = S1, P2 = S2" : "P1 = T1, P2 = T2, P3 = T3"})`}
                                value={calc.annualFormula}
                                onChange={(text) => updateCalc({ annualFormula: text })}
                            />
                            <Example>
                                Exemple : {SAMPLE_PERIODS.slice(0, annualCount).map((v, i) => `${periodLetter}${i + 1} = ${formatDecimal(v, 2)}`).join(" ; ")} →{" "}
                                <strong>moyenne annuelle : {fmt(annual)}</strong>
                            </Example>
                        </Section>

                        <Section icon="trophy" title="Mentions" subtitle="Chaque mention commence à la moyenne indiquée (incluse). La première commence à 0.">
                            <div className="grid gap-2">
                                {draft.mentions.map((m, i) => (
                                    <div key={i} className="flex flex-wrap items-end gap-2">
                                        <TextField
                                            label="Mention"
                                            value={m.label}
                                            onChange={(label) => update({ mentions: draft.mentions.map((x, j) => (j === i ? { ...x, label } : x)) })}
                                        />
                                        <NumberField
                                            label="À partir de"
                                            value={m.min}
                                            min={0}
                                            max={20}
                                            step={0.25}
                                            disabled={i === 0}
                                            onChange={(min) => update({ mentions: draft.mentions.map((x, j) => (j === i ? { ...x, min } : x)) })}
                                        />
                                        {i > 0 && draft.mentions.length > 2 ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon="x"
                                                aria-label={`Retirer la mention ${m.label}`}
                                                onClick={() => update({ mentions: draft.mentions.filter((_, j) => j !== i) })}
                                            >
                                                Retirer
                                            </Button>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                            {draft.mentions.length < 10 ? (
                                <div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon="plus"
                                        onClick={() => {
                                            const last = draft.mentions[draft.mentions.length - 1];
                                            update({ mentions: [...draft.mentions, { label: "Nouvelle mention", min: Math.min(20, last.min + 1) }] });
                                        }}
                                    >
                                        Ajouter une mention
                                    </Button>
                                </div>
                            ) : null}
                            <Example>
                                Avec ce barème : 9,99 → {mentionFor(9.99, draft.mentions) ?? "—"} ; 10 → {mentionFor(10, draft.mentions) ?? "—"} ; 14,5 →{" "}
                                {mentionFor(14.5, draft.mentions) ?? "—"}
                            </Example>
                        </Section>

                        <Section
                            icon="settings"
                            title="Options de l'année"
                            subtitle={`Seuil de passage : ${formatDecimal(data?.passingGrade ?? 10, 2)} (réglé dans la configuration académique).`}
                        >
                            <Toggle
                                checked={draft.promotionRank}
                                onChange={(v) => update({ promotionRank: v })}
                                label="Afficher aussi le rang par promotion"
                                help="Rang parmi tous les élèves du même niveau, en plus du rang dans la classe."
                            />
                            <Toggle
                                checked={draft.rescueAfterCouncil}
                                onChange={(v) => update({ rescueAfterCouncil: v })}
                                label="Autoriser le rachat après le conseil de classe"
                                help="Permet de faire passer un élève sous le seuil, uniquement après validation du conseil de fin d'année."
                            />
                            <Toggle
                                checked={draft.teacherFormulas}
                                onChange={(v) => update({ teacherFormulas: v })}
                                label="Chaque enseignant peut écrire la formule de sa matière"
                                help="Sinon, la formule de l'école s'applique à toutes les matières. Les formules choisies restent gelées au conseil de classe."
                            />
                            <Toggle
                                checked={draft.studentAdjustments}
                                onChange={(v) => update({ studentAdjustments: v })}
                                label="L'enseignant peut adapter le calcul pour un élève"
                                help="Ne pas compter une note précise, ou écrire une formule particulière pour un élève (motif obligatoire, signalé sur le bulletin, figé au conseil)."
                            />
                            <Toggle
                                checked={draft.excuseReasonRequired}
                                onChange={(v) => update({ excuseReasonRequired: v })}
                                label="Motif obligatoire pour une absence justifiée"
                                help="Le professeur indique le motif (billet visé) quand il marque une absence justifiée."
                            />
                            <Choice
                                name="gradeStep"
                                legend="Précision de saisie des notes"
                                value={draft.gradeStep}
                                onChange={(v) => update({ gradeStep: v as GradingSettings["gradeStep"] })}
                                options={[
                                    { value: "0.01", label: "Au centième (12,75 ; 12,33)" },
                                    { value: "0.25", label: "Au quart de point (12,25 ; 12,5 ; 12,75)" },
                                    { value: "0.5", label: "Au demi-point (12 ; 12,5)" },
                                    { value: "1", label: "Au point entier (12 ; 13)" },
                                ]}
                            />
                            <div className="flex flex-wrap gap-3">
                                <NumberField
                                    label="Pronostic CEP : moyenne visée"
                                    value={draft.cepPassMark}
                                    min={0}
                                    max={20}
                                    step={0.25}
                                    onChange={(n) => update({ cepPassMark: n })}
                                />
                                <NumberField
                                    label="Pronostic BEPC : moyenne visée"
                                    value={draft.bepcPassMark}
                                    min={0}
                                    max={20}
                                    step={0.25}
                                    onChange={(n) => update({ bepcPassMark: n })}
                                />
                            </div>
                        </Section>

                        <Section
                            icon="sparkle"
                            title="Critères d'orientation"
                            subtitle="Pour chaque série : disciplines indispensables, disciplines d'appoint, leur poids et la moyenne conseillée. Indicatif : la décision reste au conseil."
                        >
                            <div className="grid gap-2">
                                {OFFICIAL_SERIES.filter((s) => draft.orientation[s.code]).map((serie) => (
                                    <SeriesEditor
                                        key={serie.code}
                                        title={`${serie.short} · ${serie.domain}`}
                                        profile={draft.orientation[serie.code]}
                                        onChange={(profile) => update({ orientation: { ...draft.orientation, [serie.code]: profile } })}
                                    />
                                ))}
                            </div>
                        </Section>
                    </fieldset>
                ) : null}

                {draft && canEdit ? (
                    <div
                        className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
                        style={{ borderColor: "var(--eduflow-border-subtle)", background: "var(--eduflow-surface-card)" }}
                    >
                        <div style={{ fontSize: 12, minWidth: 0, flex: "1 1 220px" }} role="status" aria-live="polite">
                            {validation ? (
                                <span style={{ color: "var(--eduflow-danger-600)" }}>{validation}</span>
                            ) : saveError ? (
                                <span style={{ color: "var(--eduflow-danger-600)" }}>{saveError}</span>
                            ) : savedMessage ? (
                                <span style={{ color: "var(--eduflow-text-secondary)" }}>{savedMessage}</span>
                            ) : dirty ? (
                                <span style={{ color: "var(--eduflow-text-secondary)" }}>Modifications non enregistrées.</span>
                            ) : (
                                <span style={{ color: "var(--eduflow-text-tertiary)" }}>Règles à jour.</span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={saving || !data}
                                onClick={() => {
                                    if (
                                        data &&
                                        window.confirm("Revenir aux règles officielles du Bénin ? Rien n'est enregistré tant que vous ne cliquez pas sur Enregistrer.")
                                    ) {
                                        setSavedMessage(null);
                                        setDraft(data.defaults);
                                    }
                                }}
                            >
                                Règles officielles
                            </Button>
                            <Button variant="secondary" size="sm" disabled={!dirty || saving} onClick={() => data && setDraft(data.settings)}>
                                Annuler
                            </Button>
                            <Button
                                size="sm"
                                icon={saving ? undefined : "check"}
                                loading={saving}
                                disabled={!dirty || Boolean(validation)}
                                onClick={save}
                            >
                                Enregistrer
                            </Button>
                        </div>
                    </div>
                ) : null}
            </PageShell>
        </PageGuard>
    );
}

// ─────────────────────────── Briques d'interface ───────────────────────────

function Section({ icon, title, subtitle, children }: { icon: IconName; title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <Card padding={0}>
            <div className="flex items-center gap-2 border-b px-5 py-4" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                <Icon name={icon} size={18} color="var(--brand-700)" />
                <div style={{ minWidth: 0 }}>
                    <h2 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                        {title}
                    </h2>
                    {subtitle ? <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>{subtitle}</p> : null}
                </div>
            </div>
            <div className="grid gap-4 px-5 py-5">{children}</div>
        </Card>
    );
}

function Notice({ children }: { children: React.ReactNode }) {
    return (
        <div
            role="note"
            className="flex items-start gap-2 rounded-lg px-4 py-3"
            style={{ background: "var(--brand-50)", color: "var(--brand-800)", fontSize: 12 }}
        >
            <Icon name="info" size={16} />
            <span>{children}</span>
        </div>
    );
}

function Example({ children }: { children: React.ReactNode }) {
    return (
        <p
            className="rounded-lg px-3 py-2"
            style={{ margin: 0, fontSize: 12, background: "var(--eduflow-surface-sunken)", color: "var(--eduflow-text-secondary)" }}
        >
            {children}
        </p>
    );
}

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--eduflow-text-tertiary)",
    marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
    height: 38,
    padding: "0 10px",
    borderRadius: "var(--eduflow-radius-input)",
    border: "1px solid var(--eduflow-border-default)",
    background: "var(--eduflow-surface-card)",
    fontFamily: "inherit",
    fontSize: 13,
    color: "var(--eduflow-text-primary)",
    maxWidth: "100%",
};

function Choice({
    name,
    legend,
    value,
    onChange,
    options,
}: {
    name: string;
    legend?: string;
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string; help?: string; disabled?: boolean }>;
}) {
    return (
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            {legend ? <legend style={labelStyle}>{legend}</legend> : null}
            <div className="grid gap-2">
                {options.map((o) => (
                    <label
                        key={o.value}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2"
                        style={{
                            borderColor: value === o.value ? "var(--brand-500)" : "var(--eduflow-border-subtle)",
                            background: value === o.value ? "var(--brand-50)" : "transparent",
                            opacity: o.disabled ? 0.55 : 1,
                        }}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={o.value}
                            checked={value === o.value}
                            disabled={o.disabled}
                            onChange={() => onChange(o.value)}
                            style={{ marginTop: 3 }}
                        />
                        <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{o.label}</span>
                            {o.help ? (
                                <span style={{ display: "block", fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>{o.help}</span>
                            ) : null}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
    return (
        <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{label}</span>
                {help ? <span style={{ display: "block", fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>{help}</span> : null}
            </span>
        </label>
    );
}

function NumberField({
    label,
    value,
    min,
    max,
    step,
    disabled,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;
    onChange: (n: number) => void;
}) {
    return (
        <label className="block">
            <span style={labelStyle}>{label}</span>
            <input
                type="number"
                inputMode="decimal"
                value={Number.isFinite(value) ? value : ""}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
                style={{ ...inputStyle, width: 140 }}
            />
        </label>
    );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <label className="block">
            <span style={labelStyle}>{label}</span>
            <input type="text" value={value} maxLength={40} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: 180 }} />
        </label>
    );
}

type Profile = GradingSettings["orientation"][string];
type Role = "NONE" | "CORE" | "EXTRA";

function SeriesEditor({ title, profile, onChange }: { title: string; profile: Profile; onChange: (p: Profile) => void }) {
    const roleOf = (d: Discipline): Role =>
        profile.core[d] !== undefined ? "CORE" : profile.extra?.[d] !== undefined ? "EXTRA" : "NONE";
    const weightOf = (d: Discipline) => profile.core[d] ?? profile.extra?.[d] ?? 1;

    const setDiscipline = (d: Discipline, role: Role, weight: number) => {
        const core = { ...profile.core };
        const extra = { ...(profile.extra ?? {}) };
        delete core[d];
        delete extra[d];
        if (role === "CORE") core[d] = weight;
        if (role === "EXTRA") extra[d] = weight;
        onChange({ ...profile, core, extra: Object.keys(extra).length > 0 ? extra : undefined });
    };

    return (
        <details className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {title}
                <span style={{ fontWeight: 400, color: "var(--eduflow-text-tertiary)" }}>
                    {" "}
                    — moyenne conseillée {formatDecimal(profile.minAverage, 2)}
                </span>
            </summary>
            <div className="grid gap-3 pt-3">
                <NumberField
                    label="Moyenne conseillée"
                    value={profile.minAverage}
                    min={0}
                    max={20}
                    step={0.5}
                    onChange={(n) => onChange({ ...profile, minAverage: n })}
                />
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
                    {DISCIPLINES.map((d) => {
                        const role = roleOf(d);
                        return (
                            <div key={d} className="flex flex-wrap items-center gap-2">
                                <span style={{ fontSize: 12, width: 130 }}>{DISCIPLINE_LABELS[d]}</span>
                                <select
                                    aria-label={`Rôle de ${DISCIPLINE_LABELS[d]}`}
                                    value={role}
                                    onChange={(e) => setDiscipline(d, e.target.value as Role, weightOf(d))}
                                    style={{ ...inputStyle, height: 32, fontSize: 12 }}
                                >
                                    <option value="NONE">—</option>
                                    <option value="CORE">Indispensable</option>
                                    <option value="EXTRA">D&apos;appoint</option>
                                </select>
                                {role !== "NONE" ? (
                                    <input
                                        type="number"
                                        aria-label={`Poids de ${DISCIPLINE_LABELS[d]}`}
                                        min={1}
                                        max={10}
                                        step={1}
                                        value={weightOf(d)}
                                        onChange={(e) => setDiscipline(d, role, Number(e.target.value))}
                                        style={{ ...inputStyle, height: 32, width: 64, fontSize: 12 }}
                                    />
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        </details>
    );
}
