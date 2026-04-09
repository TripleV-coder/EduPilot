"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

interface AccessibleSchool {
    id: string;
    name: string;
    code: string;
    city?: string | null;
    isActive: boolean;
}

interface SchoolContextType {
    schoolId: string | null;
    academicYearId: string | null;
    periodId: string | null;
    setAcademicYearId: (id: string | null) => void;
    setPeriodId: (id: string | null) => void;
    setActiveSchoolId: (id: string | null) => Promise<void>;
    schoolName: string | null;
    currentPeriodName: string | null;
    accessibleSchools: AccessibleSchool[];
    isLoading: boolean;
    isSwitchingSchool: boolean;
    error: any;
    isOffline: boolean;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

// Helper to get/set cookies for fallback
const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
};

const setCookie = (name: string, value: string) => {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`;
};

const clearCookie = (name: string) => {
    if (typeof document === "undefined") return;
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
};

export function SchoolProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { data: session, status, update } = useSession();
    
    // Level 1: Hydrate from Cookies/LocalStorage for instant UI
    const [academicYearId, setAcademicYearId] = useState<string | null>(() => getCookie('edupilot_year_id'));
    const [periodId, setPeriodId] = useState<string | null>(() => getCookie('edupilot_period_id'));
    const [schoolName, setSchoolName] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [isSwitchingSchool, setIsSwitchingSchool] = useState(false);
    const previousSchoolIdRef = useRef<string | null | undefined>(undefined);

    const isGlobalMode = session?.user?.role === "SUPER_ADMIN" && !session.user.schoolId;

    const { data: schoolContextData } = useSWR(
        session?.user ? "/api/schools/context" : null,
        fetcher,
        {
            revalidateOnFocus: false,
        }
    );

    const accessibleSchools: AccessibleSchool[] = Array.isArray(schoolContextData?.schools)
        ? schoolContextData.schools
        : [];

    // Reset school-specific contexts when entering Global Mode
    useEffect(() => {
        if (isGlobalMode) {
            // For Super Admin in Global Mode, we don't want a school-specific year/period by default
            // unless they specifically select one. 
            // However, we shouldn't force reset if they already have one selected.
            // But we SHOULD ensure that if the academicYearId belongs to a school they are not part of, 
            // it doesn't cause issues.
        }
    }, [isGlobalMode]);

    useEffect(() => {
        const currentSchoolId = session?.user?.schoolId;

        if (previousSchoolIdRef.current === undefined) {
            previousSchoolIdRef.current = currentSchoolId;
            return;
        }

        if (previousSchoolIdRef.current !== currentSchoolId) {
            setAcademicYearId(null);
            setPeriodId(null);
            clearCookie("edupilot_year_id");
            clearCookie("edupilot_period_id");
            previousSchoolIdRef.current = currentSchoolId;
        }
    }, [session?.user?.schoolId]);

    // Level 2: Fetch with SWR (Automatic Fallback to Cache)
    const { data: schoolInfo, error: schoolError } = useSWR(
        session?.user?.schoolId ? `/api/schools/${session.user.schoolId}` : null,
        fetcher,
        { 
            refreshInterval: 0, 
            revalidateOnFocus: false,
            onSuccess: (data) => {
                const name = data.name || data.data?.name;
                if (name !== schoolName) setSchoolName(name);
            }
        }
    );

    const { data: academicYears, error: yearsError } = useSWR(
        isGlobalMode ? `/api/academic-years` : (session?.user?.schoolId ? `/api/academic-years?schoolId=${session.user.schoolId}` : null),
        fetcher,
        {
            onSuccess: (data) => {
                if (data && Array.isArray(data) && !academicYearId) {
                    // Only auto-select if NOT in global mode
                    if (!isGlobalMode) {
                        const current = data.find((y: any) => y.isCurrent);
                        const targetId = current?.id || data[0]?.id || null;
                        if (targetId) {
                            setAcademicYearId(targetId);
                            setCookie('edupilot_year_id', targetId);
                        }
                    }
                }
            }
        }
    );

    // Fetch periods for the selected academic year
    const { data: periods, error: periodsError } = useSWR(
        academicYearId ? `/api/periods?academicYearId=${academicYearId}` : null,
        fetcher,
        {
            onSuccess: (data) => {
                if (data && Array.isArray(data) && !periodId) {
                    const targetId = data[0]?.id || null;
                    if (targetId) {
                        setPeriodId(targetId);
                        setCookie('edupilot_period_id', targetId);
                    }
                }
            }
        }
    );

    // Persist changes to cookies
    useEffect(() => {
        if (academicYearId) setCookie('edupilot_year_id', academicYearId);
        if (periodId) setCookie('edupilot_period_id', periodId);
    }, [academicYearId, periodId]);

    // Level 3: Error & Offline Detection
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const currentPeriod = Array.isArray(periods) ? periods.find(p => p.id === periodId) : null;

    const setActiveSchoolId = async (id: string | null) => {
        if (!session?.user) return;
        if (session.user.role !== "SUPER_ADMIN" && !id) return;
        if ((session.user.schoolId || null) === id) return;

        setIsSwitchingSchool(true);
        try {
            setAcademicYearId(null);
            setPeriodId(null);
            clearCookie("edupilot_year_id");
            clearCookie("edupilot_period_id");
            await update({ schoolId: id });
            router.refresh();
        } finally {
            setIsSwitchingSchool(false);
        }
    };

    const value = {
        schoolId: session?.user?.schoolId || null,
        academicYearId: isGlobalMode ? null : academicYearId,
        periodId: isGlobalMode ? null : periodId,
        setAcademicYearId,
        setPeriodId,
        setActiveSchoolId,
        schoolName: isGlobalMode ? "Console Globale" : (schoolName || "Établissement"),
        currentPeriodName: isGlobalMode ? null : (currentPeriod?.name || null),
        accessibleSchools,
        isLoading: status === "loading",
        isSwitchingSchool,
        error: schoolError || yearsError || periodsError,
        isOffline,
    };

    // Global Fallback UI for critical failure
    if (status === "authenticated" && !isGlobalMode && !session?.user?.schoolId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-black tracking-tight">Initialisation Requise</h1>
                        <p className="text-muted-foreground text-sm">
                            Votre compte n&apos;est actuellement lié à aucun établissement actif. Veuillez contacter votre administrateur.
                        </p>
                    </div>
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full h-12 bg-primary text-white rounded-xl font-bold hover:shadow-lg transition-all"
                    >
                        Réessayer la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <SchoolContext.Provider value={value}>
            {isOffline && (
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white text-[10px] font-black uppercase py-1 text-center tracking-widest animate-in slide-in-from-top">
                    Mode Hors-Ligne &middot; Affichage des données en cache
                </div>
            )}
            {children}
        </SchoolContext.Provider>
    );
}

export function useSchool() {
    const context = useContext(SchoolContext);
    if (context === undefined) {
        throw new Error("useSchool must be used within a SchoolProvider");
    }
    return context;
}
