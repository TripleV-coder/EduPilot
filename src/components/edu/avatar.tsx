"use client";

import * as React from "react";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
type Status = "online" | "away" | "busy";

const SIZES: Record<Size, number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 };

const STATUS_COLORS: Record<Status, string> = {
    online: "var(--eduflow-success-500)",
    away: "var(--eduflow-warning-500)",
    busy: "var(--eduflow-danger-500)",
};

export interface AvatarProps {
    name?: string;
    src?: string;
    size?: Size;
    status?: Status;
    color?: string;
    style?: React.CSSProperties;
}

export function Avatar({
    name = "",
    src,
    size = "md",
    status,
    color,
    style,
}: AvatarProps) {
    const px = SIZES[size];
    const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase();

    // Hash name → hue for fallback bg. L=0.48 maintient ≥ 4.5:1 (WCAG AA)
    // pour les initiales blanches sur toutes les teintes générées.
    const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    const bg = color || `oklch(0.48 0.13 ${hue})`;

    return (
        <div
            style={{
                position: "relative",
                width: px,
                height: px,
                flexShrink: 0,
                ...style,
            }}
        >
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: src ? `center/cover url(${src})` : bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: px * 0.4,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)",
                    fontFamily: "var(--eduflow-font-display)",
                }}
            >
                {!src && initials}
            </div>
            {status ? (
                <span
                    style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: px * 0.28,
                        height: px * 0.28,
                        borderRadius: "50%",
                        background: STATUS_COLORS[status],
                        boxShadow: "0 0 0 2px var(--eduflow-surface-card)",
                    }}
                />
            ) : null}
        </div>
    );
}
