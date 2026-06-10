"use client";

import * as React from "react";

export interface LogoProps {
    size?: number;
    mono?: boolean;
}

export function Logo({ size = 32, mono = false }: LogoProps) {
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: size * 0.28,
                background: mono ? "var(--eduflow-text-primary)" : "var(--brand-800)",
                display: "grid",
                placeItems: "center",
                position: "relative",
                overflow: "hidden",
            }}
            role="img"
            aria-label="EduPilot"
        >
            <svg
                width={size * 0.6}
                height={size * 0.6}
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
            >
                <path d="M3 8 L12 4 L21 8 L12 12 Z" fill="rgba(255,255,255,0.95)" />
                <path
                    d="M6 11 V 16 C 6 18, 9 19.5, 12 19.5 C 15 19.5, 18 18, 18 16 V 11"
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth="1.6"
                    fill="none"
                    strokeLinecap="round"
                />
                <circle cx="20.5" cy="10" r="1" fill="var(--brand-300)" />
            </svg>
        </div>
    );
}
