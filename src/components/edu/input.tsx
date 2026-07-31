"use client";

import * as React from "react";
import { Icon, type IconName } from "./icon";

export interface InputProps {
    label?: string;
    helper?: string;
    error?: string;
    icon?: IconName;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    type?: string;
    style?: React.CSSProperties;
    name?: string;
    autoComplete?: string;
    disabled?: boolean;
    id?: string;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    required?: boolean;
    "aria-label"?: string;
}

export function Input({
    label,
    helper,
    error,
    icon,
    value,
    onChange,
    placeholder,
    type = "text",
    style,
    name,
    autoComplete,
    disabled,
    id,
    min,
    max,
    step,
    required,
    "aria-label": ariaLabel,
}: InputProps) {
    const [focused, setFocused] = React.useState(false);
    const filled = focused || (value != null && value.length > 0);

    return (
        <label style={{ display: "block", position: "relative", ...style }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 46,
                    padding: "0 14px",
                    background: "var(--eduflow-surface-card)",
                    border: `1px solid ${
                        error
                            ? "var(--eduflow-danger-500)"
                            : focused
                            ? "var(--brand-600)"
                            : "var(--eduflow-border-default)"
                    }`,
                    borderRadius: "var(--eduflow-radius-input)",
                    boxShadow: focused
                        ? `0 0 0 3px ${
                              error ? "rgba(239,68,68,0.18)" : "rgba(37,99,235,0.18)"
                          }`
                        : "none",
                    transition: "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                    opacity: disabled ? 0.55 : 1,
                }}
            >
                {icon ? <Icon name={icon} size={16} color="var(--eduflow-text-tertiary)" /> : null}
                <div style={{ position: "relative", flex: 1, height: "100%" }}>
                    {label ? (
                        <span
                            style={{
                                position: "absolute",
                                left: 0,
                                pointerEvents: "none",
                                top: filled ? 4 : "50%",
                                transform: filled ? "none" : "translateY(-50%)",
                                fontSize: filled ? 10 : 13,
                                fontWeight: 500,
                                color: error
                                    ? "var(--eduflow-danger-600)"
                                    : focused
                                    ? "var(--brand-700)"
                                    : "var(--eduflow-text-tertiary)",
                                transition: "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                letterSpacing: filled ? "0.04em" : 0,
                                textTransform: filled ? "uppercase" : "none",
                            }}
                        >
                            {label}
                        </span>
                    ) : null}
                    <input
                        type={type}
                        name={name}
                        id={id}
                        min={min}
                        max={max}
                        step={step}
                        required={required}
                        aria-label={ariaLabel}
                        autoComplete={autoComplete}
                        disabled={disabled}
                        value={value ?? ""}
                        onChange={onChange}
                        placeholder={!label ? placeholder : ""}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        style={{
                            width: "100%",
                            height: "100%",
                            border: 0,
                            outline: 0,
                            background: "transparent",
                            fontFamily: "inherit",
                            fontSize: 14,
                            color: "var(--eduflow-text-primary)",
                            paddingTop: label ? 14 : 0,
                        }}
                    />
                </div>
            </div>
            {helper || error ? (
                <div
                    style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: error ? "var(--eduflow-danger-600)" : "var(--eduflow-text-tertiary)",
                    }}
                >
                    {error || helper}
                </div>
            ) : null}
        </label>
    );
}
