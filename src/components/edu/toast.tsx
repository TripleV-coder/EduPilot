"use client";

import * as React from "react";
import { Icon, type IconName } from "./icon";

type Variant = "success" | "warning" | "danger" | "info";

// Teintes 700 : l'accent sert aussi de couleur de texte (bouton d'action)
// sur fond carte blanc — les teintes 600 success/warning ratent le 4.5:1.
const VARIANT_TOKENS: Record<Variant, { icon: IconName; accent: string; bg: string }> = {
    success: { icon: "success", accent: "var(--eduflow-success-700)", bg: "var(--eduflow-success-50)" },
    warning: { icon: "warning", accent: "var(--eduflow-warning-700)", bg: "var(--eduflow-warning-50)" },
    danger:  { icon: "danger",  accent: "var(--eduflow-danger-700)",  bg: "var(--eduflow-danger-50)"  },
    info:    { icon: "info",    accent: "var(--eduflow-info-700)",    bg: "var(--eduflow-info-50)"    },
};

export interface ToastProps {
    variant?: Variant;
    title: React.ReactNode;
    body?: React.ReactNode;
    action?: React.ReactNode;
    onAction?: () => void;
}

export function Toast({ variant = "info", title, body, action, onAction }: ToastProps) {
    const v = VARIANT_TOKENS[variant];
    return (
        <div
            style={{
                display: "flex",
                gap: 12,
                padding: 14,
                background: "var(--eduflow-surface-card)",
                borderRadius: "var(--eduflow-radius-lg)",
                boxShadow: "var(--eduflow-shadow-lg)",
                borderLeft: `3px solid ${v.accent}`,
                minWidth: 320,
                maxWidth: 380,
            }}
            role="status"
        >
            <div
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: v.bg,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                }}
            >
                <Icon name={v.icon} size={16} color={v.accent} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: "var(--eduflow-text-primary)",
                        marginBottom: 2,
                    }}
                >
                    {title}
                </div>
                {body ? (
                    <div
                        style={{
                            fontSize: 12,
                            color: "var(--eduflow-text-secondary)",
                            lineHeight: 1.45,
                        }}
                    >
                        {body}
                    </div>
                ) : null}
                {action ? (
                    <button
                        type="button"
                        onClick={onAction}
                        style={{
                            marginTop: 8,
                            padding: "4px 10px",
                            height: 26,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "transparent",
                            border: `1px solid ${v.accent}`,
                            color: v.accent,
                            borderRadius: 8,
                            cursor: "pointer",
                            fontFamily: "inherit",
                        }}
                    >
                        {action}
                    </button>
                ) : null}
            </div>
        </div>
    );
}
