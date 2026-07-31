"use client";

import { Icon } from "@/components/edu";
import { SubLabel } from "@/components/edu-homes/_shared";
import { type ClassOption, type AcademicYearOption, type FormState, PEDA_OPTIONS, FR_AMOUNT } from "./types";
import { CostTile, Field, FieldSelect } from "./fields";

// Extrait de dashboard/students/inscription/page.tsx (1421 lignes) lors
// de la découpe en steps (P3.1, 2026-06-11). Logique inchangée.

export function StepCursus({
    form,
    setForm,
    classes,
    years,
    tuitionFee,
    optionsTotal,
    yearlyTotal,
}: {
    form: FormState;
    setForm: (fn: (f: FormState) => FormState) => void;
    classes: ClassOption[];
    years: AcademicYearOption[];
    tuitionFee: number | null;
    optionsTotal: number;
    yearlyTotal: number;
}) {
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));
    const toggleOption = (id: string) =>
        setForm((f) => ({
            ...f,
            options: { ...f.options, [id]: !f.options[id] },
        }));
    return (
        <>
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 6px" }}>
                Cursus &amp; affectation
            </h3>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Sélectionnez la classe d'affectation et le parcours pédagogique.
            </p>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    marginBottom: 22,
                }}
                className="form-grid"
            >
                <Field
                    label="École précédente"
                    icon="school"
                    value={form.previousSchool}
                    onChange={(v) => set("previousSchool", v)}
                    placeholder="EPP Akpakpa centre"
                />
                <Field
                    label="Dernier niveau validé"
                    value={form.previousLevel}
                    onChange={(v) => set("previousLevel", v)}
                    placeholder="CM2 (moyenne 13,4)"
                />
                <FieldSelect
                    label="Classe demandée *"
                    value={form.classId}
                    onChange={(v) => set("classId", v)}
                    options={classes.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Choisir une classe…"
                />
                <FieldSelect
                    label="Année académique *"
                    value={form.academicYearId}
                    onChange={(v) => set("academicYearId", v)}
                    options={years.map((y) => ({ value: y.id, label: y.name }))}
                    placeholder="Choisir l'année…"
                />
                <Field
                    label="Date d'admission"
                    type="date"
                    icon="calendar"
                    value={form.admissionDate}
                    onChange={(v) => set("admissionDate", v)}
                />
            </div>

            <SubLabel>Options pédagogiques</SubLabel>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 10,
                    marginTop: 8,
                    marginBottom: 22,
                }}
                className="options-grid"
            >
                {PEDA_OPTIONS.map((opt) => {
                    const active = Boolean(form.options[opt.id]);
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => toggleOption(opt.id)}
                            style={{
                                padding: 14,
                                borderRadius: 12,
                                border: active
                                    ? "1.5px solid var(--brand-600)"
                                    : "1px solid var(--eduflow-border-default)",
                                background: active ? "var(--brand-50)" : "transparent",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                textAlign: "left",
                                fontFamily: "inherit",
                                transition: "all var(--motion-fast, 150ms)",
                            }}
                            aria-pressed={active}
                        >
                            <div
                                style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 5,
                                    flexShrink: 0,
                                    border: active
                                        ? 0
                                        : "1.5px solid var(--eduflow-border-strong)",
                                    background: active ? "var(--brand-600)" : "transparent",
                                    display: "grid",
                                    placeItems: "center",
                                }}
                            >
                                {active ? (
                                    <Icon
                                        name="check"
                                        size={11}
                                        color="#fff"
                                        strokeWidth={3}
                                    />
                                ) : null}
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    {opt.sub}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Cost summary */}
            <div
                style={{
                    padding: 16,
                    background: "var(--brand-50)",
                    borderRadius: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 14,
                    marginTop: 12,
                }}
                className="cost-grid"
            >
                <CostTile
                    label={`Scolarité ${form.classId ? classes.find((c) => c.id === form.classId)?.name || "" : ""}`}
                    value={tuitionFee !== null ? FR_AMOUNT(tuitionFee) : "—"}
                />
                <CostTile
                    label="Options"
                    value={optionsTotal > 0 ? `+ ${FR_AMOUNT(optionsTotal)}` : "0"}
                />
                <CostTile
                    label="Frais d'inscription"
                    value="+ 0"
                />
                <CostTile
                    label="Total annuel"
                    value={FR_AMOUNT(yearlyTotal)}
                    strong
                    bordered
                />
            </div>
        </>
    );
}
