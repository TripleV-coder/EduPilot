"use client";

import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HeatmapData {
    classes: { id: string, name: string }[];
    subjects: { id: string, name: string }[];
    matrix: Record<string, Record<string, number>>; // classId -> subjectId -> average
}

interface PerformanceHeatmapProps {
    data: HeatmapData;
}

export function PerformanceHeatmap({ data }: PerformanceHeatmapProps) {
    const getColorClass = (value: number) => {
        if (value >= 16) return "bg-green-600 text-white";
        if (value >= 14) return "bg-green-500 text-white";
        if (value >= 12) return "bg-green-400 text-white";
        if (value >= 10) return "bg-yellow-400 text-black";
        if (value >= 8) return "bg-orange-500 text-white";
        if (value >= 5) return "bg-red-500 text-white";
        return "bg-red-700 text-white";
    };

    return (
        <TooltipProvider>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="p-2 border border-border bg-muted/50 text-xs font-bold text-left sticky left-0 z-20">Classe \ Matière</th>
                            {data.subjects.map(s => (
                                <th key={s.id} className="p-2 border border-border bg-muted/30 text-xs font-bold min-w-[100px] text-center">
                                    {s.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.classes.map(c => (
                            <tr key={c.id}>
                                <td className="p-2 border border-border bg-muted/20 text-xs font-medium sticky left-0 z-10">{c.name}</td>
                                {data.subjects.map(s => {
                                    const value = data.matrix[c.id]?.[s.id] ?? null;
                                    return (
                                        <Tooltip key={`${c.id}-${s.id}`}>
                                            <TooltipTrigger asChild>
                                                <td className={cn(
                                                    "p-2 border border-border text-center text-xs font-bold transition-all hover:scale-105 hover:z-20",
                                                    value !== null ? getColorClass(value) : "bg-muted/10 text-muted-foreground/30"
                                                )}>
                                                    {value !== null ? value.toFixed(1) : "—"}
                                                </td>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-xs font-bold">{c.name} &middot; {s.name}</p>
                                                <p className="text-lg metric-serif mt-1">{value !== null ? `${value.toFixed(2)}/20` : "Aucune donnée"}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </TooltipProvider>
    );
}
