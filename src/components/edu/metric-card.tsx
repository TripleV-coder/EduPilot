"use client";

import * as React from "react";
import { Card } from "./card";
import { Icon, type IconName } from "./icon";

type Variant = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const ACCENTS: Record<Variant, { bg: string; icon: string; iconBg: string }> = {
    neutral: { bg: "var(--eduflow-surface-card)", icon: "var(--eduflow-neutral-700)", iconBg: "var(--eduflow-neutral-100)" },
    brand:   { bg: "var(--eduflow-surface-card)", icon: "var(--brand-700)",            iconBg: "var(--brand-50)" },
    success: { bg: "var(--eduflow-surface-card)", icon: "var(--eduflow-success-700)", iconBg: "var(--eduflow-success-50)" },
    warning: { bg: "var(--eduflow-surface-card)", icon: "var(--eduflow-warning-700)", iconBg: "var(--eduflow-warning-50)" },
    danger:  { bg: "var(--eduflow-surface-card)", icon: "var(--eduflow-danger-700)",  iconBg: "var(--eduflow-danger-50)"  },
    info:    { bg: "var(--eduflow-surface-card)", icon: "var(--eduflow-info-700)",    iconBg: "var(--eduflow-info-50)"    },
};

export interface MetricCardProps {
    label: React.ReactNode;
    value: React.ReactNode;
    unit?: React.ReactNode;
    trend?: number;
    trendLabel?: React.ReactNode;
    icon?: IconName;
    variant?: Variant;
    size?: "sm" | "md";
}

export function MetricCard({
    label,
    value,
    unit,
    trend,
    trendLabel,
    icon,
    variant = "neutral",
    size = "md",
}: MetricCardProps) {
    const a = ACCENTS[variant];
    const trendColor =
        trend == null
            ? null
            : trend >= 0
            ? "var(--eduflow-success-600)"
            : "var(--eduflow-danger-600)";

    return (
        <Card padding={size === "sm" ? 14 : 18} style={{ background: a.bg }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 12,
                }}
            >
                <span
                    style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--eduflow-text-secondary)",
                        letterSpacing: "0.01em",
                    }}
                >
                    {label}
                </span>
                {icon ? (
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: a.iconBg,
                            display: "grid",
                            placeItems: "center",
                        }}
                    >
                        <Icon name={icon} size={16} color={a.icon} />
                    </div>
                ) : null}
            </div>
            <div
                className="eduflow-display eduflow-tabular"
                style={{
                    fontSize: size === "sm" ? 24 : 30,
                    fontWeight: 700,
                    color: "var(--eduflow-text-primary)",
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                }}
            >
                {value}
                {unit ? (
                    <span
                        style={{
                            fontSize: "0.55em",
                            color: "var(--eduflow-text-tertiary)",
                            fontWeight: 600,
                            marginLeft: 4,
                        }}
                    >
                        {unit}
                    </span>
                ) : null}
            </div>
            {trend != null ? (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 10,
                        fontSize: 12,
                    }}
                >
                    <span
                        className="eduflow-tabular"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            color: trendColor ?? undefined,
                            fontWeight: 600,
                        }}
                    >
                        <Icon name={trend >= 0 ? "arrowUp" : "arrowDown"} size={12} />
                        {Math.abs(trend)}%
                    </span>
                    {trendLabel ? (
                        <span style={{ color: "var(--eduflow-text-tertiary)" }}>{trendLabel}</span>
                    ) : null}
                </div>
            ) : null}
        </Card>
    );
}
