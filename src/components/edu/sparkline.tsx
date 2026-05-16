"use client";

import * as React from "react";

export interface SparklineProps {
    data: number[];
    height?: number;
    color?: string;
    strokeWidth?: number;
}

export function Sparkline({
    data,
    height = 36,
    color = "var(--brand-600)",
    strokeWidth = 1.5,
}: SparklineProps) {
    if (!data?.length) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = 100;
    const points = data
        .map((v, i) => {
            const x = (i / (data.length - 1 || 1)) * w;
            const y = height - ((v - min) / range) * height;
            return `${x},${y}`;
        })
        .join(" ");

    return (
        <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${w} ${height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
