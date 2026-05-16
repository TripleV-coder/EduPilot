"use client";

import * as React from "react";

export interface BarChartDatum {
    label: string;
    /** Compare value, rendered as the muted bar. */
    compare?: number;
    /** Primary value, rendered as the brand-tinted bar with label on top. */
    value: number;
}

export interface BarChartProps {
    data: BarChartDatum[];
    /** Chart height in px. Defaults to 140. */
    height?: number;
    /** Max value used for normalization. Defaults to 100 (percentages). */
    max?: number;
    /** Hide the top label per bar. */
    hideValueLabels?: boolean;
    /** Render values with a trailing percent sign. */
    asPercent?: boolean;
    /** Suffix shown after each value (e.g. " pts", " FCFA"). */
    valueSuffix?: string;
    /** Color override for the primary bar. */
    barColor?: string;
    /** Color override for the comparison bar. */
    compareColor?: string;
}

export function BarChart({
    data,
    height = 140,
    max = 100,
    hideValueLabels,
    asPercent = true,
    valueSuffix,
    barColor = "var(--eduflow-info-700, var(--brand-700))",
    compareColor = "var(--eduflow-neutral-300)",
}: BarChartProps) {
    if (!data || data.length === 0) {
        return (
            <div
                style={{
                    height,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "var(--eduflow-text-tertiary)",
                    background: "var(--eduflow-surface-sunken)",
                    borderRadius: "var(--eduflow-radius-md)",
                }}
            >
                Aucune donnée pour la période.
            </div>
        );
    }
    const safeMax = Math.max(max, 1);
    return (
        <div
            style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 18,
                height,
                paddingTop: 8,
            }}
        >
            {data.map((d) => {
                const valuePct = Math.max(0, Math.min(100, (d.value / safeMax) * 100));
                const comparePct =
                    d.compare != null
                        ? Math.max(0, Math.min(100, (d.compare / safeMax) * 100))
                        : null;
                const formatted = asPercent
                    ? `${Math.round(d.value)}%`
                    : `${d.value}${valueSuffix ?? ""}`;
                return (
                    <div
                        key={d.label}
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            height: "100%",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-end",
                                gap: 3,
                                flex: 1,
                                width: "100%",
                                justifyContent: "center",
                            }}
                        >
                            {comparePct != null ? (
                                <div
                                    style={{
                                        width: "38%",
                                        height: `${comparePct}%`,
                                        background: compareColor,
                                        borderRadius: "4px 4px 0 0",
                                    }}
                                />
                            ) : null}
                            <div
                                style={{
                                    width: "38%",
                                    height: `${valuePct}%`,
                                    background: barColor,
                                    borderRadius: "4px 4px 0 0",
                                    position: "relative",
                                }}
                            >
                                {!hideValueLabels ? (
                                    <span
                                        className="eduflow-tabular"
                                        style={{
                                            position: "absolute",
                                            top: -16,
                                            left: "50%",
                                            transform: "translateX(-50%)",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: "var(--eduflow-info-800, var(--brand-800))",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {formatted}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <span
                            style={{
                                fontSize: 10,
                                color: "var(--eduflow-text-tertiary)",
                                fontWeight: 500,
                                textAlign: "center",
                                lineHeight: 1.1,
                            }}
                        >
                            {d.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
