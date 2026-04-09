"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export enum StudentSegment {
    ALL = "ALL",
    SCHOLARSHIP = "SCHOLARSHIP",
    AT_RISK = "AT_RISK",
    REPEATERS = "REPEATERS",
    NEW = "NEW",
}

interface AnalyticsContextType {
    establishmentId: string;
    setEstablishmentId: (id: string) => void;
    academicYearId: string;
    setAcademicYearId: (id: string) => void;
    periodId: string;
    setPeriodId: (id: string) => void;
    dateRange: { from: Date | undefined; to: Date | undefined };
    setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void;
    levelIds: string[];
    setLevelIds: (ids: string[]) => void;
    classIds: string[];
    setClassIds: (ids: string[]) => void;
    subjectIds: string[];
    setSubjectIds: (ids: string[]) => void;
    studentSegment: StudentSegment;
    setStudentSegment: (segment: StudentSegment) => void;
    resetFilters: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children, initialAcademicYearId, initialPeriodId }: { children: ReactNode, initialAcademicYearId?: string, initialPeriodId?: string }) {
    const [establishmentId, setEstablishmentId] = useState<string>("ALL");
    const [academicYearId, setAcademicYearId] = useState<string>(initialAcademicYearId || "ALL");
    const [periodId, setPeriodId] = useState<string>(initialPeriodId || "ALL");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
    const [levelIds, setLevelIds] = useState<string[]>([]);
    const [classIds, setClassIds] = useState<string[]>([]);
    const [subjectIds, setSubjectIds] = useState<string[]>([]);
    const [studentSegment, setStudentSegment] = useState<StudentSegment>(StudentSegment.ALL);

    const resetFilters = () => {
        setEstablishmentId("ALL");
        setAcademicYearId(initialAcademicYearId || "ALL");
        setPeriodId(initialPeriodId || "ALL");
        setDateRange({ from: undefined, to: undefined });
        setLevelIds([]);
        setClassIds([]);
        setSubjectIds([]);
        setStudentSegment(StudentSegment.ALL);
    };

    return (
        <AnalyticsContext.Provider value={{
            establishmentId, setEstablishmentId,
            academicYearId, setAcademicYearId,
            periodId, setPeriodId,
            dateRange, setDateRange,
            levelIds, setLevelIds,
            classIds, setClassIds,
            subjectIds, setSubjectIds,
            studentSegment, setStudentSegment,
            resetFilters,
        }}>
            {children}
        </AnalyticsContext.Provider>
    );
}

export function useAnalytics() {
    const context = useContext(AnalyticsContext);
    if (context === undefined) {
        throw new Error("useAnalytics must be used within an AnalyticsProvider");
    }
    return context;
}
