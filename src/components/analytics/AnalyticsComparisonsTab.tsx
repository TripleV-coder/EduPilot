"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiClassComparison } from "@/components/analytics/MultiClassComparison";
import { PeriodComparison } from "@/components/analytics/PeriodComparison";
import { Badge } from "@/components/ui/badge";
import { Scale, GitCompare, Calendar } from "lucide-react";

interface AnalyticsComparisonsTabProps {
    classes: any[];
    academicYearId: string;
    periods: any[];
}

export function AnalyticsComparisonsTab({ classes, academicYearId, periods }: AnalyticsComparisonsTabProps) {
    const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-sm" data-reveal>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Scale className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-tight">Comparaisons Analytiques</h3>
                        <p className="text-[10px] text-muted-foreground font-medium">Comparez les performances entre classes ou entre périodes.</p>
                    </div>
                </div>
            </div>

            {/* Inter-Class Comparison */}
            <div className="dashboard-block" data-reveal>
                <MultiClassComparison classes={classes} academicYearId={academicYearId} />
            </div>

            {/* Longitudinal/Period Comparison */}
            <div className="space-y-4" data-reveal>
                <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <Badge variant="outline" className="px-4 py-1 text-[10px] font-black uppercase tracking-widest bg-muted/50">
                        Comparaison Longitudinale
                    </Badge>
                    <div className="h-px flex-1 bg-border" />
                </div>

                <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-bold uppercase text-muted-foreground">Classe à analyser</span>
                    </div>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                        <SelectTrigger className="w-[200px] h-9 text-xs">
                            <SelectValue placeholder="Choisir une classe" />
                        </SelectTrigger>
                        <SelectContent>
                            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {selectedClassId && (
                    <div className="dashboard-block">
                        <PeriodComparison 
                            academicYearId={academicYearId} 
                            classId={selectedClassId} 
                            periods={periods} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
