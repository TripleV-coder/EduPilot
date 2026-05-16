"use client";

import * as React from "react";

type Variant = "default" | "elevated" | "flat" | "inverse";

const VARIANT_TOKENS: Record<
    Variant,
    { bg: string; shadow: string; border: string; color?: string }
> = {
    default: {
        bg: "var(--eduflow-surface-card)",
        shadow: "var(--eduflow-shadow-sm)",
        border: "1px solid var(--eduflow-border-subtle)",
    },
    elevated: {
        bg: "var(--eduflow-surface-card)",
        shadow: "var(--eduflow-shadow-md)",
        border: "none",
    },
    flat: {
        bg: "var(--eduflow-surface-sunken)",
        shadow: "none",
        border: "1px solid transparent",
    },
    inverse: {
        bg: "var(--eduflow-neutral-900)",
        shadow: "var(--eduflow-shadow-md)",
        border: "none",
        color: "var(--eduflow-neutral-50)",
    },
};

export interface CardProps {
    children?: React.ReactNode;
    padding?: number | string;
    variant?: Variant;
    style?: React.CSSProperties;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    className?: string;
}

export function Card({
    children,
    padding = 20,
    variant = "default",
    style,
    onClick,
    className,
}: CardProps) {
    const v = VARIANT_TOKENS[variant];
    return (
        <div
            onClick={onClick}
            className={className}
            style={{
                background: v.bg,
                borderRadius: "var(--eduflow-radius-card)",
                padding,
                boxShadow: v.shadow,
                border: v.border,
                color: v.color,
                cursor: onClick ? "pointer" : "default",
                transition:
                    "box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out), transform var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                ...style,
            }}
        >
            {children}
        </div>
    );
}
