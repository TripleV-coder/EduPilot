"use client";

import * as React from "react";
import { Card } from "./card";
import type { IconName } from "./icon";

type Variant = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

/* Style « vue d'ensemble » de l'accueil validé (docs/design/directions/direction-approved.md) :
   pastille de couleur de module + libellé, valeur, note. Pas de tuile d'icône. */
const DOT: Record<Variant, string> = {
    neutral: "var(--eduflow-neutral-400)",
    brand: "var(--edu-module-blue)",
    success: "var(--edu-module-green)",
    warning: "var(--edu-module-orange)",
    danger: "var(--edu-module-pink)",
    info: "var(--edu-module-teal)",
};

export interface MetricCardProps {
    label: React.ReactNode;
    value: React.ReactNode;
    unit?: React.ReactNode;
    trend?: number;
    trendLabel?: React.ReactNode;
    /** Conservé pour compatibilité : l'icône n'est plus dessinée (style validé). */
    icon?: IconName;
    variant?: Variant;
    size?: "sm" | "md";
}

export function MetricCard({ label, value, unit, trend, trendLabel, variant = "neutral", size = "md" }: MetricCardProps) {
    // Teintes 700 : texte de tendance ≥ 4,5:1 sur fond blanc.
    const trendColor =
        trend == null ? undefined : trend >= 0 ? "var(--eduflow-success-700)" : "var(--eduflow-danger-700)";
    return (
        <Card padding={size === "sm" ? "12px 16px" : "16px 20px"}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500, color: "var(--eduflow-text-secondary)" }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: DOT[variant], flex: "none" }} />
                <span style={{ minWidth: 0 }}>{label}</span>
            </div>
            <div
                className="eduflow-tabular"
                style={{
                    fontSize: size === "sm" ? 22 : 26,
                    fontWeight: 600,
                    color: "var(--eduflow-text-primary)",
                    lineHeight: 1.2,
                    letterSpacing: "-0.02em",
                    marginTop: 4,
                }}
            >
                {value}
                {unit ? (
                    <span style={{ fontSize: "0.6em", color: "var(--eduflow-text-secondary)", fontWeight: 600, marginLeft: 4 }}>{unit}</span>
                ) : null}
            </div>
            {trend != null || trendLabel ? (
                <div className="eduflow-tabular" style={{ marginTop: 2, fontSize: 14, color: "var(--eduflow-text-secondary)" }}>
                    {trend != null ? (
                        <span style={{ color: trendColor, fontWeight: 600, marginRight: 6 }}>
                            {trend > 0 ? "+" : trend < 0 ? "−" : ""}
                            {Math.abs(trend).toLocaleString("fr-FR")} %
                        </span>
                    ) : null}
                    {trendLabel}
                </div>
            ) : null}
        </Card>
    );
}
