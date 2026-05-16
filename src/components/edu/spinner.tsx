"use client";

import * as React from "react";

export interface SpinnerProps {
    size?: number;
    color?: string;
    style?: React.CSSProperties;
}

export function Spinner({ size = 14, color = "currentColor", style }: SpinnerProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            style={{ animation: "eduflowSpin 0.8s linear infinite", ...style }}
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2.5" strokeOpacity="0.2" />
            <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    );
}
