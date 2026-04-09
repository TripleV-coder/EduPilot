"use client";

import React from "react";
import { useAnalytics, StudentSegment } from "./AnalyticsContext";
import { useSchool } from "@/components/providers/school-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export function AnalyticsContextBar() {
    const { schoolId, accessibleSchools, setActiveSchoolId } = useSchool();
    const {
        establishmentId, setEstablishmentId,
        academicYearId, setAcademicYearId,
        periodId, setPeriodId,
        levelIds, setLevelIds,
        classIds, setClassIds,
        subjectIds, setSubjectIds,
        studentSegment, setStudentSegment,
        resetFilters
    } = useAnalytics();

    // Data for filters
    const { data: years } = useSWR(schoolId ? `/api/academic-years?schoolId=${schoolId}` : "/api/academic-years", fetcher);
    const { data: classes } = useSWR(schoolId ? `/api/classes?schoolId=${schoolId}&limit=100` : null, fetcher);
    const { data: subjects } = useSWR(schoolId ? `/api/subjects?schoolId=${schoolId}&limit=100` : null, fetcher);

    const yearOptions = Array.isArray(years) ? years : years?.data || [];
    const classOptions = Array.isArray(classes) ? classes : classes?.data || classes?.classes || [];
    const subjectOptions = Array.isArray(subjects) ? subjects : subjects?.data || [];

    const levelOptions = Array.from(new Set(classOptions.map((c: any) => c.level || c.classLevel?.name).filter(Boolean)));

    const handleToggle = (id: string, current: string[], setter: (ids: string[]) => void) => {
        if (current.includes(id)) setter(current.filter(i => i !== id));
        else setter([...current, id]);
    };

    return (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-xl shadow-sm mb-6">
            <div className="flex items-center gap-2 mr-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filtres</span>
            </div>

            {/* Establishment (Super Admin) */}
            {accessibleSchools.length > 1 && (
                <Select value={schoolId || "ALL"} onValueChange={(v) => setActiveSchoolId(v === "ALL" ? null : v)}>
                    <SelectTrigger className="w-[180px] h-9 text-xs">
                        <SelectValue placeholder="Établissement" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Tous les établissements</SelectItem>
                        {accessibleSchools.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            {/* Academic Year */}
            <Select value={academicYearId} onValueChange={setAcademicYearId}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Toutes les années</SelectItem>
                    {yearOptions.map((y: any) => (
                        <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Period */}
            <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Toutes les périodes</SelectItem>
                    {yearOptions.find((y: any) => y.id === academicYearId)?.periods?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Levels (Multi) */}
            <MultiSelectPopover 
                label="Niveaux" 
                options={levelOptions.map(l => ({ id: l as string, name: l as string }))} 
                selected={levelIds} 
                onToggle={(id) => handleToggle(id, levelIds, setLevelIds)} 
            />

            {/* Classes (Multi) */}
            <MultiSelectPopover 
                label="Classes" 
                options={classOptions.map((c: any) => ({ id: c.id, name: c.name }))} 
                selected={classIds} 
                onToggle={(id) => handleToggle(id, classIds, setClassIds)} 
            />

            {/* Subjects (Multi) */}
            <MultiSelectPopover 
                label="Matières" 
                options={subjectOptions.map((s: any) => ({ id: s.id, name: s.name }))} 
                selected={subjectIds} 
                onToggle={(id) => handleToggle(id, subjectIds, setSubjectIds)} 
            />

            {/* Student Segment */}
            <Select value={studentSegment} onValueChange={(v) => setStudentSegment(v as StudentSegment)}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                    <SelectValue placeholder="Segment" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={StudentSegment.ALL}>Tous les élèves</SelectItem>
                    <SelectItem value={StudentSegment.SCHOLARSHIP}>Boursiers</SelectItem>
                    <SelectItem value={StudentSegment.AT_RISK}>À risque</SelectItem>
                    <SelectItem value={StudentSegment.REPEATERS}>Redoublants</SelectItem>
                    <SelectItem value={StudentSegment.NEW}>Nouveaux</SelectItem>
                </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-3 gap-2 text-muted-foreground hover:text-primary">
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-xs">Reset</span>
            </Button>
        </div>
    );
}

function MultiSelectPopover({ label, options, selected, onToggle }: { label: string, options: { id: string, name: string }[], selected: string[], onToggle: (id: string) => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-2 min-w-[100px] justify-between border-dashed">
                    {label}
                    {selected.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{selected.length}</Badge>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2" align="start">
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {options.length === 0 && <p className="text-[10px] text-center text-muted-foreground py-2">Aucune option</p>}
                    {options.map(opt => (
                        <div key={opt.id} className="flex items-center gap-2 p-1 hover:bg-muted/50 rounded cursor-pointer" onClick={() => onToggle(opt.id)}>
                            <Checkbox checked={selected.includes(opt.id)} onCheckedChange={() => onToggle(opt.id)} />
                            <span className="text-xs truncate">{opt.name}</span>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
