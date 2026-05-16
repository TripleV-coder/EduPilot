"use client";

import * as React from "react";
import { Icon, type IconName } from "./icon";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const SIZE_TOKENS: Record<Size, { h: number; px: number; fs: number; gap: number; rad: number }> = {
    sm: { h: 30, px: 12, fs: 12, gap: 6, rad: 8 },
    md: { h: 38, px: 16, fs: 13, gap: 8, rad: 10 },
    lg: { h: 46, px: 20, fs: 15, gap: 10, rad: 12 },
};

const VARIANT_TOKENS: Record<
    Variant,
    { bg: string; color: string; border: string; hov: string }
> = {
    primary: {
        bg: "var(--brand-700)",
        color: "var(--eduflow-text-on-brand)",
        border: "transparent",
        hov: "var(--brand-800)",
    },
    secondary: {
        bg: "var(--eduflow-surface-card)",
        color: "var(--eduflow-text-primary)",
        border: "var(--eduflow-border-default)",
        hov: "var(--eduflow-surface-sunken)",
    },
    ghost: {
        bg: "transparent",
        color: "var(--eduflow-text-primary)",
        border: "transparent",
        hov: "var(--eduflow-surface-sunken)",
    },
    danger: {
        bg: "var(--eduflow-danger-600)",
        color: "var(--eduflow-neutral-0)",
        border: "transparent",
        hov: "var(--eduflow-danger-700)",
    },
    soft: {
        bg: "var(--brand-50)",
        color: "var(--brand-800)",
        border: "transparent",
        hov: "var(--brand-100)",
    },
};

export interface ButtonProps
    extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
    variant?: Variant;
    size?: Size;
    icon?: IconName;
    iconRight?: IconName;
    loading?: boolean;
    full?: boolean;
    style?: React.CSSProperties;
}

export function Button({
    variant = "primary",
    size = "md",
    icon,
    iconRight,
    loading = false,
    children,
    onClick,
    disabled,
    full,
    style,
    type = "button",
    ...rest
}: ButtonProps) {
    const s = SIZE_TOKENS[size];
    const v = VARIANT_TOKENS[variant];
    const [hov, setHov] = React.useState(false);
    const isDisabled = disabled || loading;

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={isDisabled}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                height: s.h,
                padding: `0 ${s.px}px`,
                gap: s.gap,
                fontSize: s.fs,
                fontWeight: 600,
                letterSpacing: "-0.005em",
                borderRadius: s.rad,
                border: `1px solid ${v.border === "transparent" ? "transparent" : v.border}`,
                background: hov && !isDisabled ? v.hov : v.bg,
                color: v.color,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.5 : 1,
                transition:
                    "background var(--eduflow-motion-fast) var(--eduflow-ease-out), transform var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                transform: hov && !isDisabled ? "translateY(-0.5px)" : "none",
                fontFamily: "inherit",
                width: full ? "100%" : "auto",
                whiteSpace: "nowrap",
                ...style,
            }}
            {...rest}
        >
            {loading ? (
                <Spinner size={s.fs} color={v.color} />
            ) : icon ? (
                <Icon name={icon} size={s.fs + 2} />
            ) : null}
            {children}
            {iconRight ? <Icon name={iconRight} size={s.fs + 2} /> : null}
        </button>
    );
}
