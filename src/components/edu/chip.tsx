"use client";

import * as React from "react";
import { Icon } from "./icon";
import type { IconName } from "./icon";

export interface ChipProps {
    children: React.ReactNode;
    active?: boolean;
    count?: number | null;
    icon?: IconName;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
}

/**
 * Pill-style filter button matching the EduPilot v3 design.
 * Used inside FilterBar (modules: grades, finance, attendance, library).
 */
export function Chip({ children, active, count, icon, onClick, disabled }: ChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={active}
            style={{
                height: 30,
                padding: "0 12px",
                borderRadius: "var(--eduflow-radius-full)",
                border: `1px solid ${
                    active ? "var(--brand-600)" : "var(--eduflow-border-default)"
                }`,
                background: active ? "var(--brand-50, #EFF6FF)" : "transparent",
                color: active
                    ? "var(--brand-800, #1E40AF)"
                    : "var(--eduflow-text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                opacity: disabled ? 0.5 : 1,
                transition:
                    "background var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out)",
                whiteSpace: "nowrap",
            }}
        >
            {icon ? <Icon name={icon} size={13} /> : null}
            {children}
            {count != null ? (
                <span
                    className="eduflow-tabular"
                    style={{
                        fontSize: 10,
                        padding: "0 6px",
                        height: 16,
                        borderRadius: "var(--eduflow-radius-full)",
                        background: active
                            ? "var(--brand-600)"
                            : "var(--eduflow-neutral-200)",
                        color: active ? "#fff" : "var(--eduflow-text-tertiary)",
                        display: "inline-flex",
                        alignItems: "center",
                        fontWeight: 700,
                    }}
                >
                    {count}
                </span>
            ) : null}
        </button>
    );
}

export interface FilterBarProps {
    children: React.ReactNode;
    /** Hide the leading filter icon. */
    hideIcon?: boolean;
}

/**
 * Card-wrapped row of Chip filters with optional leading filter icon.
 * Matches the design's FilterBar component from pages.jsx.
 */
export function FilterBar({ children, hideIcon }: FilterBarProps) {
    return (
        <div
            style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: 12,
                background: "var(--eduflow-surface-card)",
                borderRadius: "var(--eduflow-radius-card)",
                border: "1px solid var(--eduflow-border-subtle)",
                boxShadow: "var(--eduflow-shadow-sm)",
                marginBottom: 14,
                flexWrap: "wrap",
            }}
        >
            {!hideIcon ? (
                <Icon name="filter" size={14} color="var(--eduflow-text-tertiary)" />
            ) : null}
            {children}
        </div>
    );
}
