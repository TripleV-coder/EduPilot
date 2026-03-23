"use client";

import { useEffect, useState, useMemo } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Permission } from "@/lib/rbac/permissions";
import { 
  Plus, Calendar, Clock, Users, GraduationCap, 
  Filter, Download, ChevronRight, LayoutGrid, List
} from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WeeklyTimetableGrid } from "@/components/schedule/weekly-timetable-grid";
import { useSchool } from "@/components/providers/school-provider";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export default function SchedulePage() {
    const { schoolId } = useSchool();
    const [viewType, setViewMode] = useState<"weekly" | "daily">("weekly");
    const [filterType, setFilterType] = useState<"class" | "teacher">("class");
    const [selectedId, setSelectedId] = useState<string>("ALL");

    const { data: schedules, isLoading: schedulesLoading } = useSWR("/api/schedules", fetcher);
    const { data: classes } = useSWR("/api/classes", fetcher);
    const { data: teachers } = useSWR("/api/teachers", fetcher);

    const filteredSchedules = useMemo(() => {
        if (!schedules) return [];
        if (selectedId === "ALL") return schedules;
        if (filterType === "class") return schedules.filter((s: any) => s.classId === selectedId);
        // Teacher filtering would need teacherId in schedule, assuming it's available or through classSubject
        return schedules.filter((s: any) => s.classSubject?.teacherId === selectedId);
    }, [schedules, selectedId, filterType]);

    return (
        <PageGuard permission={Permission.SCHEDULE_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in pb-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader 
                        title="Emplois du Temps" 
                        description="Planifiez et visualisez l'occupation des salles et des enseignants."
                    />
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase">
                            <Download className="w-3.5 h-3.5 mr-2" />
                            {t("common.export")}
                        </Button>
                        <Button size="sm" className="h-8 text-[11px] font-bold uppercase gap-2">
                            <Plus className="w-3.5 h-3.5" />
                            Nouvel Horaire
                        </Button>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-border/50 pb-6">
                    <div className="flex items-center gap-4 bg-muted/20 p-1 rounded-xl border border-border/50">
                        <button 
                            onClick={() => { setFilterType("class"); setSelectedId("ALL"); }}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all",
                                filterType === "class" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >Par Classe</button>
                        <button 
                            onClick={() => { setFilterType("teacher"); setSelectedId("ALL"); }}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all",
                                filterType === "teacher" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >Par Enseignant</button>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
                        <div className="flex items-center gap-2">
                            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                            <Select value={selectedId} onValueChange={setSelectedId}>
                                <SelectTrigger className="h-9 w-full sm:w-[220px] bg-muted/20 border-none ring-1 ring-border/50 text-xs font-medium">
                                    <SelectValue placeholder={filterType === "class" ? "Toutes les classes" : "Tous les enseignants"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL" className="text-xs">
                                        {filterType === "class" ? "Toutes les classes" : "Tous les enseignants"}
                                    </SelectItem>
                                    {filterType === "class" 
                                        ? (Array.isArray(classes) ? classes : (classes as any)?.data || []).map((c: any) => (
                                            <SelectItem key={c.id} value={c.id} className="text-xs">Classe {c.name}</SelectItem>
                                          ))
                                        : (Array.isArray(teachers) ? teachers : (teachers as any)?.data || []).map((t: any) => (
                                            <SelectItem key={t.id} value={t.id} className="text-xs">{t.user?.firstName} {t.user?.lastName}</SelectItem>
                                          ))
                                    }
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="h-8 w-px bg-border/50 mx-2 hidden sm:block" />

                        <div className="flex items-center border border-border/50 rounded-lg overflow-hidden bg-muted/20">
                            <Button 
                                variant={viewType === "weekly" ? "default" : "ghost"} 
                                size="sm" 
                                onClick={() => setViewMode("weekly")}
                                className="h-8 rounded-none px-3 text-[10px] font-bold uppercase gap-1.5"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Semaine
                            </Button>
                            <Button 
                                variant={viewType === "daily" ? "default" : "ghost"} 
                                size="sm" 
                                onClick={() => setViewMode("daily")}
                                className="h-8 rounded-none px-3 text-[10px] font-bold uppercase gap-1.5"
                            >
                                <List className="w-3.5 h-3.5" />
                                Jour
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <WeeklyTimetableGrid schedules={filteredSchedules} />
                </div>
            </div>
        </PageGuard>
    );
}
