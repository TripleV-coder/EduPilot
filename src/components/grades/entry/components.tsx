"use client";

import { Badge, Icon } from "@/components/edu";

// Extrait de dashboard/grades/entry/page.tsx (1218 lignes) lors de la
// découpe (P3.1, 2026-06-11). Logique inchangée.

export type CellState = "empty" | "dirty" | "absent";

export function computeCellState({
    isAbsent,
    hasValue,
    isDirty,
}: {
    isAbsent: boolean;
    hasValue: boolean;
    isDirty: boolean;
}): CellState {
    if (isAbsent) return "absent";
    if (isDirty && hasValue) return "dirty";
    return "empty";
}

export function StateBadge({ state }: { state: CellState }) {
    if (state === "absent") {
        return (
            <Badge variant="warning" size="sm">
                Absent
            </Badge>
        );
    }
    if (state === "dirty") {
        return (
            <Badge variant="brand" size="sm" dot>
                À publier
            </Badge>
        );
    }
    return (
        <Badge variant="neutral" size="sm">
            À saisir
        </Badge>
    );
}

export function NoteCell({
    value,
    disabled,
    editing,
    dirty,
    maxGrade,
    onFocus,
    onBlur,
    onChange,
}: {
    value: string;
    disabled: boolean;
    editing: boolean;
    dirty: boolean;
    maxGrade: number;
    onFocus: () => void;
    onBlur: () => void;
    onChange: (v: string) => void;
}) {
    const active = editing && !disabled;
    const filled = !disabled && value.trim() !== "";
    return (
        <div
            className="flex h-9 items-center"
            style={{
                width: 110,
                padding: "0 12px",
                borderRadius: 10,
                border: active
                    ? "1.5px solid var(--brand-600)"
                    : filled
                    ? "1px solid var(--brand-200)"
                    : "1px solid var(--eduflow-border-default)",
                background: active
                    ? "var(--brand-50)"
                    : disabled
                    ? "var(--eduflow-neutral-100)"
                    : "var(--eduflow-surface-card)",
                transition:
                    "border-color var(--eduflow-motion-fast) var(--eduflow-ease-out), background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                boxShadow: active ? "0 0 0 3px rgba(37,99,235,0.18)" : "none",
            }}
        >
            <input
                type="number"
                step="0.25"
                min={0}
                max={maxGrade}
                value={value}
                disabled={disabled}
                onFocus={onFocus}
                onBlur={onBlur}
                onChange={(e) => onChange(e.target.value)}
                placeholder="—"
                aria-label="Note"
                className="eduflow-tabular"
                style={{
                    flex: 1,
                    border: 0,
                    outline: 0,
                    background: "transparent",
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: filled || active ? 700 : 500,
                    textAlign: "right",
                    color: disabled
                        ? "var(--eduflow-text-tertiary)"
                        : active
                        ? "var(--brand-800)"
                        : filled
                        ? "var(--eduflow-text-primary)"
                        : "var(--eduflow-text-tertiary)",
                }}
            />
            {dirty && !disabled ? (
                <span
                    aria-hidden
                    style={{
                        width: 4,
                        height: 14,
                        marginLeft: 4,
                        background: "var(--brand-600)",
                        borderRadius: 1,
                        animation: "eduflowPulse 1s ease-in-out infinite",
                    }}
                />
            ) : null}
        </div>
    );
}

export function TrendCell({
    value,
    maxGrade,
}: {
    value: number | null;
    maxGrade: number;
}) {
    if (value == null) {
        return (
            <span style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                —
            </span>
        );
    }
    const passing = maxGrade > 0 ? value >= maxGrade / 2 : true;
    const variantColor = passing
        ? "var(--eduflow-success-700)"
        : "var(--eduflow-danger-700)";
    return (
        <span
            className="eduflow-tabular inline-flex items-center gap-1"
            style={{ fontSize: 11, fontWeight: 600, color: variantColor }}
        >
            <Icon name={passing ? "arrowUp" : "arrowDown"} size={11} />
            {value.toFixed(1).replace(".", ",")}
        </span>
    );
}

export function ToggleAbsent({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (c: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="grid place-items-center"
            style={{
                width: 30,
                height: 18,
                padding: 2,
                borderRadius: 9,
                border: 0,
                background: checked
                    ? "var(--eduflow-warning-500)"
                    : "var(--eduflow-neutral-300)",
                cursor: "pointer",
                transition:
                    "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
            }}
        >
            <span
                aria-hidden
                style={{
                    display: "block",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#fff",
                    transform: checked ? "translateX(6px)" : "translateX(-6px)",
                    transition:
                        "transform var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                }}
            />
        </button>
    );
}

export function FieldSelect({
    label,
    required,
    value,
    onChange,
    options,
    placeholder,
    disabled,
}: {
    label: string;
    required?: boolean;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    disabled?: boolean;
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
                {label} {required ? <span style={{ color: "var(--eduflow-danger-600)" }}>*</span> : null}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
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
                    color: value ? "var(--eduflow-text-primary)" : "var(--eduflow-text-tertiary)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.55 : 1,
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

export function FieldText({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    required,
    min,
    step,
    full,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
    min?: number;
    step?: string | number;
    full?: boolean;
}) {
    return (
        <label className="block" style={{ gridColumn: full ? "span 2" : undefined }}>
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
                {label} {required ? <span style={{ color: "var(--eduflow-danger-600)" }}>*</span> : null}
            </span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                min={min}
                step={step}
                style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    color: "var(--eduflow-text-primary)",
                    outline: "none",
                }}
            />
        </label>
    );
}

export function Th({ children, width }: { children: React.ReactNode; width?: number }) {
    return (
        <th
            style={{
                padding: "10px 16px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--eduflow-text-tertiary)",
                width,
            }}
        >
            {children}
        </th>
    );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <Icon name="warning" size={28} color="var(--eduflow-warning-600)" />
            <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
                <div
                    style={{
                        fontSize: 13,
                        color: "var(--eduflow-text-secondary)",
                        marginTop: 4,
                    }}
                >
                    {body}
                </div>
            </div>
        </div>
    );
}
