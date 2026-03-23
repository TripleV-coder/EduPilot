"use client";

import React from "react";

interface LoadingTableProps {
    rows?: number;
    columns?: number;
    cols?: number;
}

export function LoadingTable({ rows = 5, columns, cols }: LoadingTableProps) {
    const colCount = columns ?? cols ?? 4;
    return (
        <div className="w-full animate-pulse">
            {/* Header */}
            <div className="flex gap-4 mb-4 border-b pb-3">
                {Array.from({ length: colCount }).map((_, i) => (
                    <div key={`h-${i}`} className="h-4 bg-muted rounded flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div key={`r-${rowIdx}`} className="flex gap-4 mb-3">
                    {Array.from({ length: colCount }).map((_, colIdx) => (
                        <div key={`c-${colIdx}`} className="h-4 bg-muted/60 rounded flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}
