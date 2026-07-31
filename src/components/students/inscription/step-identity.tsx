"use client";

import { type FormState } from "./types";
import { Field, FieldSelect } from "./fields";

// Extrait de dashboard/students/inscription/page.tsx (1421 lignes) lors
// de la découpe en steps (P3.1, 2026-06-11). Logique inchangée.

export function StepIdentity({
    form,
    setForm,
}: {
    form: FormState;
    setForm: (fn: (f: FormState) => FormState) => void;
}) {
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));
    return (
        <>
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 6px" }}>
                Identité de l'élève
            </h3>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Informations personnelles · obligatoires pour le dossier MEMP.
            </p>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    marginBottom: 14,
                }}
                className="form-grid"
            >
                <Field
                    label="Nom *"
                    value={form.lastName}
                    onChange={(v) => set("lastName", v)}
                    placeholder="HOUNSOU"
                />
                <Field
                    label="Prénom *"
                    value={form.firstName}
                    onChange={(v) => set("firstName", v)}
                    placeholder="Aïcha"
                />
                <Field
                    label="Matricule *"
                    icon="tag"
                    value={form.matricule}
                    onChange={(v) => set("matricule", v)}
                    placeholder="BJ-2026-A0142"
                />
                <Field
                    label="Date de naissance"
                    type="date"
                    icon="calendar"
                    value={form.dateOfBirth}
                    onChange={(v) => set("dateOfBirth", v)}
                />
                <FieldSelect
                    label="Genre"
                    value={form.gender}
                    onChange={(v) => set("gender", v as FormState["gender"])}
                    options={[
                        { value: "MALE", label: "Masculin" },
                        { value: "FEMALE", label: "Féminin" },
                    ]}
                    placeholder="Choisir…"
                />
                <Field
                    label="Lieu de naissance"
                    value={form.birthPlace}
                    onChange={(v) => set("birthPlace", v)}
                    placeholder="Cotonou"
                />
                <Field
                    label="Nationalité"
                    value={form.nationality}
                    onChange={(v) => set("nationality", v)}
                />
                <Field
                    label="Téléphone *"
                    value={form.phone}
                    onChange={(v) => set("phone", v)}
                    placeholder="+229 90 00 00 00"
                />
                <Field
                    label="Email *"
                    type="email"
                    value={form.email}
                    onChange={(v) => set("email", v)}
                    placeholder="eleve@ecole.bj"
                />
                <Field
                    label="Adresse"
                    value={form.address}
                    onChange={(v) => set("address", v)}
                    placeholder="Akpakpa, Cotonou"
                />
            </div>
        </>
    );
}
