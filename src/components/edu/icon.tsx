"use client";

import * as React from "react";

// Lucide-style outline icon set used by the EduPilot Design System.
// Single-stroke, 24×24 viewbox, currentColor by default.
export const ICON_PATHS = {
    home: (
        <>
            <path d="M3 12 12 3l9 9" />
            <path d="M5 10v10h14V10" />
        </>
    ),
    users: (
        <>
            <circle cx="9" cy="8" r="3.2" />
            <path d="M2.5 19c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5" />
            <circle cx="17" cy="9" r="2.4" />
            <path d="M21 17c-.4-2.2-1.9-3.5-4-3.5" />
        </>
    ),
    book: (
        <>
            <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15.5H6a2 2 0 0 0-2 2V4.5Z" />
            <path d="M4 18.5A2 2 0 0 1 6 20.5h14" />
        </>
    ),
    calendar: (
        <>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
        </>
    ),
    money: (
        <>
            <rect x="3" y="6" width="18" height="13" rx="2" />
            <circle cx="12" cy="12.5" r="2.5" />
            <path d="M7 9.5v.01M17 15.5v.01" />
        </>
    ),
    bell: (
        <>
            <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
            <path d="M10 19a2 2 0 0 0 4 0" />
        </>
    ),
    chart: (
        <>
            <path d="M3 3v18h18" />
            <path d="M7 14l3-3 3 3 5-6" />
        </>
    ),
    settings: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .67.39 1.27 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82c.24.61.84 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.67 0-1.27.39-1.51 1Z" />
        </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    check: <path d="m4.5 12 5 5L20 6.5" />,
    x: (
        <>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </>
    ),
    plus: (
        <>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </>
    ),
    arrowUp: (
        <>
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
        </>
    ),
    arrowDown: (
        <>
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
        </>
    ),
    arrowRight: (
        <>
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </>
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </>
    ),
    filter: <path d="M3 5h18l-7 9v6l-4-2v-4Z" />,
    download: (
        <>
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
        </>
    ),
    sparkle: (
        <>
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
        </>
    ),
    info: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v5h1" />
        </>
    ),
    warning: (
        <>
            <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4M12 17h.01" />
        </>
    ),
    danger: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
        </>
    ),
    success: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 3 3 5-6" />
        </>
    ),
    sms: (
        <>
            <path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1 4.5A8 8 0 0 1 21 12Z" />
            <path d="M8 11h.01M12 11h.01M16 11h.01" />
        </>
    ),
    school: (
        <>
            <path d="M3 10 12 5l9 5" />
            <path d="M5 9.5V19h14V9.5" />
            <path d="M9 19v-5h6v5" />
        </>
    ),
    grid: (
        <>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </>
    ),
    pencil: <path d="M17 3.5a2.1 2.1 0 0 1 3 3L8 18.5 3.5 20l1.5-4.5Z" />,
    moon: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z" />,
    sun: (
        <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </>
    ),
    flame: <path d="M12 2s4 4 4 8a4 4 0 1 1-8 0c0-1 .4-1.8 1-2.5-1.6 1.5-3 3.5-3 6.5a6 6 0 0 0 12 0c0-6-6-12-6-12Z" />,
    trophy: (
        <>
            <path d="M8 4h8v6a4 4 0 1 1-8 0V4Z" />
            <path d="M5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M9 18h6M10 14v4M14 14v4M8 21h8" />
        </>
    ),
    tag: (
        <>
            <path d="M9 3h7l5 5v7l-9 9-12-12 9-9Z" />
            <circle cx="14" cy="9" r="1.2" />
        </>
    ),
    cards: (
        <>
            <rect x="3" y="6" width="18" height="13" rx="2" />
            <path d="M3 10h18" />
        </>
    ),
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "color"> {
    name: IconName;
    size?: number;
    color?: string;
    strokeWidth?: number;
}

export function Icon({
    name,
    size = 18,
    color = "currentColor",
    strokeWidth = 1.75,
    style,
    ...rest
}: IconProps) {
    const paths = ICON_PATHS[name] ?? ICON_PATHS.info;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, ...style }}
            aria-hidden="true"
            {...rest}
        >
            {paths}
        </svg>
    );
}
