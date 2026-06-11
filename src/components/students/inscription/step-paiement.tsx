"use client";

import { SubLabel } from "@/components/edu-homes/_shared";
import { type FormState, FR_AMOUNT } from "./types";
import { CostTile } from "./fields";

// Extrait de dashboard/students/inscription/page.tsx (1421 lignes) lors
// de la découpe en steps (P3.1, 2026-06-11). Logique inchangée.

export function StepPaiement({
    form,
    setForm,
    tuitionFee,
    optionsTotal,
    yearlyTotal,
}: {
    form: FormState;
    setForm: (fn: (f: FormState) => FormState) => void;
    tuitionFee: number | null;
    optionsTotal: number;
    yearlyTotal: number;
}) {
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));
    const installments = [
        { label: "1ʳᵉ tranche · à l'inscription", amount: Math.round(yearlyTotal * 0.5) },
        { label: "2ᵉ tranche · Décembre", amount: Math.round(yearlyTotal * 0.3) },
        { label: "Solde · Mars", amount: yearlyTotal - Math.round(yearlyTotal * 0.5) - Math.round(yearlyTotal * 0.3) },
    ];
    const methods: { id: FormState["paymentMethod"]; label: string; sub: string }[] = [
        { id: "mobile", label: "Mobile Money", sub: "MTN / Moov · Flutterwave" },
        { id: "bank", label: "Virement bancaire", sub: "RIB de l'école" },
        { id: "cash", label: "Espèces au secrétariat", sub: "Reçu papier" },
        { id: "card", label: "Carte bancaire", sub: "Visa / Mastercard" },
    ];
    return (
        <>
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 6px" }}>
                Paiement initial
            </h3>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Plan de paiement et mode de règlement pour la 1ʳᵉ tranche.
            </p>

            <div
                style={{
                    padding: 16,
                    background: "var(--brand-50)",
                    borderRadius: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 14,
                    marginBottom: 22,
                }}
                className="cost-grid"
            >
                <CostTile
                    label="Scolarité annuelle"
                    value={tuitionFee !== null ? FR_AMOUNT(tuitionFee) : "—"}
                />
                <CostTile label="Options" value={`+ ${FR_AMOUNT(optionsTotal)}`} />
                <CostTile label="Frais d'inscription" value="+ 0" />
                <CostTile label="Total annuel" value={FR_AMOUNT(yearlyTotal)} strong bordered />
            </div>

            <SubLabel>Échéancier</SubLabel>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                    marginTop: 8,
                    marginBottom: 22,
                }}
                className="cost-grid"
            >
                {installments.map((i) => (
                    <div
                        key={i.label}
                        style={{
                            padding: 14,
                            border: "1px solid var(--eduflow-border-subtle)",
                            borderRadius: 12,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 10,
                                color: "var(--eduflow-text-tertiary)",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                            }}
                        >
                            {i.label}
                        </div>
                        <div
                            className="eduflow-display tabular"
                            style={{
                                fontSize: 22,
                                fontWeight: 700,
                                color: "var(--eduflow-text-primary)",
                                marginTop: 4,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {FR_AMOUNT(i.amount)}
                            <span
                                style={{
                                    fontSize: 10,
                                    color: "var(--eduflow-text-tertiary)",
                                    marginLeft: 4,
                                }}
                            >
                                FCFA
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <SubLabel>Mode de paiement</SubLabel>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 10,
                    marginTop: 8,
                }}
                className="form-grid"
            >
                {methods.map((m) => {
                    const active = form.paymentMethod === m.id;
                    return (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => set("paymentMethod", m.id)}
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
                            }}
                            aria-pressed={active}
                        >
                            <div
                                style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                    border: active
                                        ? "6px solid var(--brand-600)"
                                        : "1.5px solid var(--eduflow-border-strong)",
                                    background: active ? "#fff" : "transparent",
                                    boxSizing: "border-box",
                                }}
                            />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    {m.sub}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </>
    );
}
