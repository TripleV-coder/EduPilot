"use client";

import React from "react";
import { useAnalytics, StudentSegment } from "./AnalyticsContext";
import { useSchool } from "@/components/providers/school-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

type NamedOption = { id: string; name: string };
type ClassOption = NamedOption & { level?: string | null; classLevel?: { name?: string | null } | null };
type YearOption = NamedOption & { periods?: NamedOption[] };
type SubjectOption = NamedOption;

export function AnalyticsContextBar() {
    const { schoolId, accessibleSchools, setActiveSchoolId } = useSchool();
    const {
        academicYearId, setAcademicYearId,
        periodId, setPeriodId,
        levelIds, setLevelIds,
        classIds, setClassIds,
        subjectIds, setSubjectIds,
        studentSegment, setStudentSegment,
        resetFilters
    } = useAnalytics();

    const { data: years } = useSWR(schoolId ? `/api/academic-years?schoolId=${schoolId}` : "/api/academic-years", fetcher);
    const { data: classes } = useSWR(schoolId ? `/api/classes?schoolId=${schoolId}&limit=100` : null, fetcher);
    const { data: subjects } = useSWR(schoolId ? `/api/subjects?schoolId=${schoolId}&limit=100` : null, fetcher);

    const yearOptions: YearOption[] = Array.isArray(years) ? years : years?.data || [];
    const classOptions: ClassOption[] = Array.isArray(classes) ? classes : classes?.data || classes?.classes || [];
    const subjectOptions: SubjectOption[] = Array.isArray(subjects) ? subjects : subjects?.data || [];

    const levelOptions = Array.from(
        new Set(
            classOptions
                .map((c) => c.level || c.classLevel?.name || null)
                .filter((level): level is string => Boolean(level))
        )
    );

    const handleToggle = (id: string, current: string[], setter: (ids: string[]) => void) => {
        if (current.includes(id)) setter(current.filter(i => i !== id));
        else setter([...current, id]);
    };

    const selectedFiltersCount =
        levelIds.length +
        classIds.length +
        subjectIds.length +
        (academicYearId !== "ALL" ? 1 : 0) +
        (periodId !== "ALL" ? 1 : 0) +
        (studentSegment !== StudentSegment.ALL ? 1 : 0);

    return (
        <div className="mb-6 rounded-xl border border-border bg-card/95 p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Filter className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Contexte analytique</p>
                        <p className="text-[11px] text-text-tertiary">Filtres transversaux appliques a toutes les visualisations</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-7 gap-1.5 px-2 text-[11px]">
                        <Sparkles className="h-3.5 w-3.5" />
                        {selectedFiltersCount} filtre{selectedFiltersCount > 1 ? "s" : ""} actif{selectedFiltersCount > 1 ? "s" : ""}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-3 gap-2 text-muted-foreground hover:text-primary">
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span className="text-xs">Reinitialiser</span>
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">

            {accessibleSchools.length > 1 && (
                <Select value={schoolId || "ALL"} onValueChange={(v) => setActiveSchoolId(v === "ALL" ? null : v)}>
                    <SelectTrigger className="h-10 w-[200px] text-xs">
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

            <Select value={academicYearId} onValueChange={setAcademicYearId}>
                <SelectTrigger className="h-10 w-[150px] text-xs">
                    <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Toutes les années</SelectItem>
                    {yearOptions.map((y) => (
                        <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger className="h-10 w-[150px] text-xs">
                    <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Toutes les périodes</SelectItem>
                    {yearOptions.find((y) => y.id === academicYearId)?.periods?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <MultiSelectPopover 
                label="Niveaux" 
                options={levelOptions.map((l) => ({ id: l, name: l }))} 
                selected={levelIds} 
                onToggle={(id) => handleToggle(id, levelIds, setLevelIds)} 
            />

            <MultiSelectPopover 
                label="Classes" 
                options={classOptions.map((c) => ({ id: c.id, name: c.name }))} 
                selected={classIds} 
                onToggle={(id) => handleToggle(id, classIds, setClassIds)} 
            />

            <MultiSelectPopover 
                label="Matières" 
                options={subjectOptions.map((s) => ({ id: s.id, name: s.name }))} 
                selected={subjectIds} 
                onToggle={(id) => handleToggle(id, subjectIds, setSubjectIds)} 
            />

            <Select value={studentSegment} onValueChange={(v) => setStudentSegment(v as StudentSegment)}>
                <SelectTrigger className="h-10 w-[190px] text-xs">
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

            </div>
        </div>
    );
}

function MultiSelectPopover({ label, options, selected, onToggle }: { label: string, options: { id: string, name: string }[], selected: string[], onToggle: (id: string) => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 text-xs gap-2 min-w-[120px] justify-between border-dashed">
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
