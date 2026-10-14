"use client";

/**
 * Saisie d'une formule de calcul (école ou enseignant) : champ libre, modèles
 * prêts à l'emploi, vérification immédiate avec un message en français, aide
 * sur les variables et les fonctions. La vérification est la même que celle
 * du serveur (formula.ts).
 */
import { useMemo } from "react";

import {
    ANNUAL_PRESETS,
    ANNUAL_VARIABLES,
    FUNCTIONS,
    SUBJECT_PRESETS,
    SUBJECT_VARIABLES,
    validateFormula,
    type FormulaScope,
} from "@/lib/academic/formula";

export function FormulaEditor({
    scope,
    value,
    onChange,
    periods = 3,
    disabled,
    label,
    id,
}: {
    scope: FormulaScope;
    value: string;
    onChange: (text: string) => void;
    /** Nombre de périodes de l'année (formule annuelle). */
    periods?: number;
    disabled?: boolean;
    label: string;
    id: string;
}) {
    const check = useMemo(() => validateFormula(value, scope, periods), [value, scope, periods]);
    const presets = scope === "SUBJECT" ? SUBJECT_PRESETS : ANNUAL_PRESETS;
    const variables = scope === "SUBJECT" ? SUBJECT_VARIABLES : ANNUAL_VARIABLES;

    return (
        <div className="grid gap-2">
            <label htmlFor={id} style={{ fontSize: 11, fontWeight: 600, color: "var(--eduflow-text-tertiary)" }}>
                {label}
            </label>
            <input
                id={id}
                type="text"
                value={value}
                disabled={disabled}
                maxLength={300}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={!check.ok}
                aria-describedby={`${id}-check`}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    height: 40,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: `1px solid ${check.ok ? "var(--eduflow-border-default)" : "var(--eduflow-danger-600)"}`,
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 14,
                    color: "var(--eduflow-text-primary)",
                }}
            />
            <p
                id={`${id}-check`}
                role="status"
                style={{ margin: 0, fontSize: 12, color: check.ok ? "var(--eduflow-text-secondary)" : "var(--eduflow-danger-600)" }}
            >
                {check.ok ? "✓ Formule valide : 20 partout donne 20, 0 partout donne 0, jamais hors de 0 à 20." : check.error}
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Modèles de formule">
                {presets.map((p) => (
                    <button
                        key={p.text}
                        type="button"
                        disabled={disabled}
                        title={p.help}
                        onClick={() => onChange(p.text)}
                        className="rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{
                            borderColor: value.trim() === p.text ? "var(--brand-500)" : "var(--eduflow-border-subtle)",
                            background: value.trim() === p.text ? "var(--brand-50)" : "transparent",
                        }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            <details style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Aide : comment écrire une formule</summary>
                <div className="grid gap-2 pt-2">
                    <p style={{ margin: 0 }}>
                        On écrit comme dans un tableur : nombres, <code>+ − * /</code>, parenthèses. Les éléments d&apos;une fonction se
                        séparent par <code>;</code>. Majuscules, minuscules et accents sont indifférents.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {Object.entries(variables).map(([name, info]) => (
                            <li key={name}>
                                <code>{name}</code> : {info.label}
                            </li>
                        ))}
                        {Object.entries(FUNCTIONS).map(([name, help]) => (
                            <li key={name}>
                                <code>{name.toLowerCase()}(…)</code> : {help}
                            </li>
                        ))}
                    </ul>
                    <p style={{ margin: 0 }}>
                        Une valeur absente (pas de composition, par exemple) est « vide » : <code>moyenne()</code> l&apos;ignore, mais
                        un calcul <code>+ − * /</code> avec une valeur vide rend la matière « NC ».
                    </p>
                </div>
            </details>
        </div>
    );
}
