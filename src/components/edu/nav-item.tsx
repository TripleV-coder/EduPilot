"use client";

import * as React from "react";
import { Icon, type IconName } from "./icon";

export interface NavItemProps {
    icon: IconName;
    label: React.ReactNode;
    count?: number | null;
    active?: boolean;
    onClick?: () => void;
}

export function NavItem({ icon, label, count, active = false, onClick }: NavItemProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 12px",
                height: 36,
                borderRadius: "var(--eduflow-radius-md)",
                background: active ? "var(--brand-700)" : "transparent",
                color: active ? "var(--eduflow-neutral-0)" : "var(--eduflow-text-secondary)",
                border: 0,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                transition: "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                textAlign: "left",
            }}
        >
            <Icon name={icon} size={16} />
            <span style={{ flex: 1 }}>{label}</span>
            {count != null ? (
                <span
                    className="eduflow-tabular"
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "1px 7px",
                        borderRadius: "var(--eduflow-radius-full)",
                        background: active
                            ? "rgba(255,255,255,0.18)"
                            : "var(--eduflow-neutral-200)",
                        color: active ? "var(--eduflow-neutral-0)" : "var(--eduflow-text-secondary)",
                    }}
                >
                    {count}
                </span>
            ) : null}
        </button>
    );
}
