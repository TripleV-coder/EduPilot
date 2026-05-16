"use client";

import * as React from "react";
import { Badge } from "./badge";
import { Icon, type IconName } from "./icon";

type NotifType = "urgent" | "warning" | "success" | "info" | "reminder" | "sms";
type Priority = "P0" | "P1" | "P2";

const TYPE_TOKENS: Record<NotifType, { icon: IconName; color: string; bg: string }> = {
    urgent:   { icon: "danger",  color: "var(--eduflow-danger-600)",  bg: "var(--eduflow-danger-50)"  },
    warning:  { icon: "warning", color: "var(--eduflow-warning-600)", bg: "var(--eduflow-warning-50)" },
    success:  { icon: "success", color: "var(--eduflow-success-600)", bg: "var(--eduflow-success-50)" },
    info:     { icon: "info",    color: "var(--eduflow-info-600)",    bg: "var(--eduflow-info-50)"    },
    reminder: { icon: "clock",   color: "var(--brand-600)",            bg: "var(--brand-50)"            },
    sms:      { icon: "sms",     color: "var(--eduflow-neutral-700)", bg: "var(--eduflow-neutral-100)" },
};

export interface NotifItemAction {
    label: string;
    onClick?: () => void;
}

export interface NotifItemProps {
    type?: NotifType;
    title: React.ReactNode;
    body?: React.ReactNode;
    time?: React.ReactNode;
    priority?: Priority;
    actions?: (string | NotifItemAction)[];
    sender?: React.ReactNode;
}

export function NotifItem({
    type = "info",
    title,
    body,
    time,
    priority = "P2",
    actions,
    sender,
}: NotifItemProps) {
    const t = TYPE_TOKENS[type];
    return (
        <div
            style={{
                display: "flex",
                gap: 12,
                padding: "12px 14px",
                borderRadius: "var(--eduflow-radius-md)",
                background: priority === "P0" ? t.bg : "transparent",
                border:
                    priority === "P0"
                        ? `1px solid ${t.color}33`
                        : "1px solid transparent",
                transition:
                    "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
            }}
        >
            <div
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: t.bg,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                }}
            >
                <Icon name={t.icon} size={16} color={t.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                    }}
                >
                    <span
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--eduflow-text-primary)",
                        }}
                    >
                        {title}
                    </span>
                    {priority === "P0" ? (
                        <Badge variant="danger" size="sm">
                            URGENT
                        </Badge>
                    ) : null}
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
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginTop: 6,
                    }}
                >
                    {time ? (
                        <span style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                            {time}
                        </span>
                    ) : null}
                    {sender ? (
                        <span style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                            • {sender}
                        </span>
                    ) : null}
                    {actions?.map((a, i) => {
                        const label = typeof a === "string" ? a : a.label;
                        const onClick = typeof a === "string" ? undefined : a.onClick;
                        return (
                            <button
                                type="button"
                                key={`${label}-${i}`}
                                onClick={onClick}
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: t.color,
                                    background: "transparent",
                                    border: 0,
                                    cursor: "pointer",
                                    padding: 0,
                                    fontFamily: "inherit",
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
