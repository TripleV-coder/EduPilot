"use client";

import { Icon, Spinner, type IconName } from "@/components/edu";

// Extrait de dashboard/students/inscription/page.tsx (1421 lignes) lors
// de la découpe en steps (P3.1, 2026-06-11). Logique inchangée.

export function loading_spinner_placeholder(loading: boolean) {
    if (!loading) return null;
    return (
        <div className="flex flex-col items-center gap-3 py-6">
            <Spinner size={28} color="var(--brand-600)" />
            <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                Enregistrement de l'inscription…
            </span>
        </div>
    );
}

export function CostTile({
    label,
    value,
    strong,
    bordered,
}: {
    label: string;
    value: string;
    strong?: boolean;
    bordered?: boolean;
}) {
    return (
        <div
            style={{
                borderLeft: bordered ? "1px solid var(--brand-300)" : 0,
                paddingLeft: bordered ? 14 : 0,
            }}
        >
            <div
                style={{
                    fontSize: 10,
                    color: "var(--brand-700)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: strong ? 22 : 18,
                    fontWeight: 700,
                    color: "var(--brand-900)",
                    marginTop: 4,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
                <span
                    style={{
                        fontSize: 10,
                        color: "var(--brand-700)",
                        marginLeft: 4,
                    }}
                >
                    FCFA
                </span>
            </div>
        </div>
    );
}

export function Field({
    label,
    value,
    onChange,
    placeholder,
    icon,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    icon?: IconName;
    type?: string;
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <div style={{ position: "relative" }}>
                {icon ? (
                    <span
                        style={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            display: "inline-flex",
                            pointerEvents: "none",
                            color: "var(--eduflow-text-tertiary)",
                        }}
                    >
                        <Icon name={icon} size={14} />
                    </span>
                ) : null}
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    style={{
                        width: "100%",
                        height: 38,
                        padding: icon ? "0 12px 0 34px" : "0 12px",
                        borderRadius: "var(--eduflow-radius-input)",
                        border: "1px solid var(--eduflow-border-default)",
                        background: "var(--eduflow-surface-card)",
                        fontFamily: "inherit",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--eduflow-text-primary)",
                        outline: "none",
                    }}
                />
            </div>
        </label>
    );
}

export function FieldSelect({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: value ? 600 : 500,
                    color: value
                        ? "var(--eduflow-text-primary)"
                        : "var(--eduflow-text-tertiary)",
                    cursor: "pointer",
                    outline: "none",
                }}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
