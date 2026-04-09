"use client";

import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AttendanceHeatmapProps {
    data: Record<string, number>; // date string (YYYY-MM-DD) -> absence rate (0-100)
    year?: number;
}

export function AttendanceHeatmap({ data, year = new Date().getFullYear() }: AttendanceHeatmapProps) {
    const months = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];

    const getDaysInMonth = (monthIndex: number, year: number) => {
        const date = new Date(year, monthIndex, 1);
        const days = [];
        while (date.getMonth() === monthIndex) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const getColorClass = (rate: number) => {
        if (rate === 0) return "bg-white border-border/20";
        if (rate <= 5) return "bg-red-50 border-red-100";
        if (rate <= 10) return "bg-red-100 border-red-200";
        if (rate <= 20) return "bg-red-200 border-red-300";
        if (rate <= 35) return "bg-red-300 border-red-400";
        if (rate <= 50) return "bg-red-400 border-red-500";
        return "bg-red-600 border-red-700";
    };

    const formatDate = (date: Date) => {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${date.getFullYear()}-${m}-${d}`;
    };

    const formatDisplayDate = (date: Date) => {
        return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(date);
    };

    return (
        <TooltipProvider>
            <div className="flex flex-wrap gap-4 justify-center">
                {months.map((monthName, monthIdx) => {
                    const monthDays = getDaysInMonth(monthIdx, year);
                    
                    return (
                        <div key={monthIdx} className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground text-center">
                                {monthName}
                            </h4>
                            <div className="grid grid-cols-7 gap-1">
                                {monthDays.map(day => {
                                    const dateStr = formatDate(day);
                                    const rate = data[dateStr] ?? 0;
                                    return (
                                        <Tooltip key={dateStr}>
                                            <TooltipTrigger asChild>
                                                <div className={cn(
                                                    "w-3 h-3 rounded-[2px] border transition-transform hover:scale-150 hover:z-10 cursor-pointer",
                                                    getColorClass(rate)
                                                )} />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-[10px] font-bold">{formatDisplayDate(day)}</p>
                                                <p className="text-xs mt-1">Taux d&apos;absence : <span className="font-bold text-destructive">{rate}%</span></p>
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </TooltipProvider>
    );
}
