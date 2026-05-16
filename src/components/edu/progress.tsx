"use client";

import * as React from "react";

type Variant = "brand" | "success" | "warning" | "danger";

const COLORS: Record<Variant, string> = {
    brand: "var(--brand-600)",
    success: "var(--eduflow-success-600)",
    warning: "var(--eduflow-warning-500)",
    danger: "var(--eduflow-danger-600)",
};

export interface ProgressProps {
    value?: number;
    label?: React.ReactNode;
    sublabel?: React.ReactNode;
    variant?: Variant;
    size?: "sm" | "md" | "lg";
}

export function Progress({
    value = 0,
    label,
    sublabel,
    variant = "brand",
    size = "md",
}: ProgressProps) {
    const h = size === "sm" ? 4 : size === "lg" ? 10 : 6;
    return (
        <div>
            {label || sublabel ? (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                        fontSize: 12,
                    }}
                >
                    <span style={{ color: "var(--eduflow-text-secondary)", fontWeight: 500 }}>{label}</span>
                    <span
                        className="eduflow-tabular"
                        style={{ color: "var(--eduflow-text-primary)", fontWeight: 600 }}
                    >
                        {sublabel}
                    </span>
                </div>
            ) : null}
            <div
                style={{
                    height: h,
                    background: "var(--eduflow-neutral-200)",
                    borderRadius: "var(--eduflow-radius-full)",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, value))}%`,
                        background: COLORS[variant],
                        borderRadius: "inherit",
                        transition: "width var(--eduflow-motion-base) var(--eduflow-ease-out)",
                    }}
                />
            </div>
        </div>
    );
}

export interface RingProgressProps {
    value?: number;
    size?: number;
    stroke?: number;
    variant?: Variant;
    children?: React.ReactNode;
}

export function RingProgress({
    value = 0,
    size = 60,
    stroke = 6,
    variant = "brand",
    children,
}: RingProgressProps) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (
        <div style={{ position: "relative", width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="var(--eduflow-neutral-200)"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={COLORS[variant]}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - Math.min(100, Math.max(0, value)) / 100)}
                    style={{
                        transition: "stroke-dashoffset var(--eduflow-motion-base) var(--eduflow-ease-out)",
                    }}
                />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                {children}
            </div>
        </div>
    );
}
