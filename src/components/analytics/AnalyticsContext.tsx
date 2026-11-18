"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

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
    const [academicYearId, setAcademicYearIdState] = useState<string>(initialAcademicYearId || "ALL");
    const [periodId, setPeriodIdState] = useState<string>(initialPeriodId || "ALL");
    // Année et période suivent celles de l'établissement tant que la personne
    // ne les a pas choisies ici : au changement d'école, l'année de la nouvelle
    // école n'est connue qu'après coup (R-CA-05).
    const yearChosen = useRef(false);
    const periodChosen = useRef(false);
    const setAcademicYearId = (value: string) => {
        yearChosen.current = true;
        setAcademicYearIdState(value);
    };
    const setPeriodId = (value: string) => {
        periodChosen.current = true;
        setPeriodIdState(value);
    };
    useEffect(() => {
        if (!yearChosen.current) setAcademicYearIdState(initialAcademicYearId || "ALL");
    }, [initialAcademicYearId]);
    useEffect(() => {
        if (!periodChosen.current) setPeriodIdState(initialPeriodId || "ALL");
    }, [initialPeriodId]);
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
    const [levelIds, setLevelIds] = useState<string[]>([]);
    const [classIds, setClassIds] = useState<string[]>([]);
    const [subjectIds, setSubjectIds] = useState<string[]>([]);
    const [studentSegment, setStudentSegment] = useState<StudentSegment>(StudentSegment.ALL);

    const resetFilters = () => {
        setEstablishmentId("ALL");
        yearChosen.current = false;
        periodChosen.current = false;
        setAcademicYearIdState(initialAcademicYearId || "ALL");
        setPeriodIdState(initialPeriodId || "ALL");
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
