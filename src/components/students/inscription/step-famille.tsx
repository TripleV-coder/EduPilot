"use client";

import { Card, Icon } from "@/components/edu";
import { type FormState } from "./types";
import { Field, FieldSelect } from "./fields";

// Extrait de dashboard/students/inscription/page.tsx (1421 lignes) lors
// de la découpe en steps (P3.1, 2026-06-11). Logique inchangée.

export function StepFamille({
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
                Famille / responsable légal
            </h3>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Un responsable au moins est obligatoire pour les communications école-famille.
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
                    label="Nom du responsable"
                    value={form.parentLastName}
                    onChange={(v) => set("parentLastName", v)}
                    placeholder="HOUNSOU"
                />
                <Field
                    label="Prénom du responsable"
                    value={form.parentFirstName}
                    onChange={(v) => set("parentFirstName", v)}
                    placeholder="Patrick"
                />
                <FieldSelect
                    label="Lien de parenté"
                    value={form.parentRelation}
                    onChange={(v) => set("parentRelation", v)}
                    options={[
                        { value: "Père", label: "Père" },
                        { value: "Mère", label: "Mère" },
                        { value: "Tuteur", label: "Tuteur / Tutrice" },
                        { value: "Autre", label: "Autre" },
                    ]}
                    placeholder="Choisir…"
                />
                <Field
                    label="Téléphone responsable"
                    value={form.parentPhone}
                    onChange={(v) => set("parentPhone", v)}
                    placeholder="+229 97 12 34 56"
                />
            </div>
            <Card
                padding={14}
                style={{
                    background: "var(--brand-50)",
                    borderLeft: "3px solid var(--brand-500)",
                }}
            >
                <div className="flex items-start gap-3">
                    <Icon name="info" size={18} color="var(--brand-700)" />
                    <div>
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--brand-800)",
                            }}
                        >
                            Comptes parent à activer après création
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                marginTop: 4,
                                lineHeight: 1.55,
                            }}
                        >
                            Tu pourras envoyer un code de liaison au responsable depuis la fiche élève
                            une fois l'inscription finalisée.
                        </div>
                    </div>
                </div>
            </Card>
        </>
    );
}
