"use client";

import { type ClassOption, type AcademicYearOption, type FormState, FR_AMOUNT } from "./types";
import { CostTile, Field, FieldSelect } from "./fields";

// Extrait de dashboard/students/inscription/page.tsx (1421 lignes) lors
// de la découpe en steps (P3.1, 2026-06-11). Logique inchangée.

export function StepCursus({
    form,
    setForm,
    classes,
    years,
    tuitionFee,
}: {
    form: FormState;
    setForm: (fn: (f: FormState) => FormState) => void;
    classes: ClassOption[];
    years: AcademicYearOption[];
    tuitionFee: number | null;
}) {
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));
    return (
        <>
            <h2 className="eduflow-display" style={{ fontSize: 16, margin: "0 0 6px" }}>
                Cursus &amp; affectation
            </h2>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Sélectionnez la classe d'affectation.
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

            {/* Montant réel de la scolarité du niveau (frais configurés par l'école). */}
            <div
                style={{
                    padding: 16,
                    background: "var(--brand-50)",
                    borderRadius: 12,
                    marginTop: 12,
                }}
            >
                <CostTile
                    label={`Scolarité annuelle ${form.classId ? classes.find((c) => c.id === form.classId)?.name || "" : ""}`}
                    value={tuitionFee !== null ? `${FR_AMOUNT(tuitionFee)} FCFA` : "Aucun frais configuré pour ce niveau"}
                    strong
                />
            </div>
        </>
    );
}
