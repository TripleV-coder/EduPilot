"use client";

import * as React from "react";
import { Icon, type IconName } from "./icon";

type Variant = "success" | "warning" | "danger" | "info" | "neutral" | "brand";
type Size = "sm" | "md";

const VARIANT_TOKENS: Record<Variant, { bg: string; fg: string; dot: string }> = {
    success: { bg: "var(--eduflow-success-100)", fg: "var(--eduflow-success-800)", dot: "var(--eduflow-success-600)" },
    warning: { bg: "var(--eduflow-warning-100)", fg: "var(--eduflow-warning-800)", dot: "var(--eduflow-warning-600)" },
    danger:  { bg: "var(--eduflow-danger-100)",  fg: "var(--eduflow-danger-800)",  dot: "var(--eduflow-danger-600)"  },
    info:    { bg: "var(--eduflow-info-100)",    fg: "var(--eduflow-info-800)",    dot: "var(--eduflow-info-600)"    },
    neutral: { bg: "var(--eduflow-neutral-200)", fg: "var(--eduflow-neutral-700)", dot: "var(--eduflow-neutral-600)" },
    brand:   { bg: "var(--brand-100)",            fg: "var(--brand-800)",            dot: "var(--brand-600)"            },
};

export interface BadgeProps {
    variant?: Variant;
    icon?: IconName;
    children?: React.ReactNode;
    dot?: boolean;
    size?: Size;
    style?: React.CSSProperties;
}

export function Badge({
    variant = "neutral",
    icon,
    children,
    dot = false,
    size = "md",
    style,
}: BadgeProps) {
    const v = VARIANT_TOKENS[variant];
    const sm = size === "sm";
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: sm ? 4 : 6,
                height: sm ? 20 : 24,
                padding: sm ? "0 8px" : "0 10px",
                borderRadius: "var(--eduflow-radius-full)",
                background: v.bg,
                color: v.fg,
                fontSize: sm ? 11 : 12,
                fontWeight: 600,
                letterSpacing: "-0.005em",
                ...style,
            }}
        >
            {dot ? (
                <span
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: v.dot,
                    }}
                />
            ) : null}
            {icon ? <Icon name={icon} size={sm ? 11 : 13} /> : null}
            {children}
        </span>
    );
}
