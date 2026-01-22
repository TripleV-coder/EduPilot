"use client";

import { useQuery } from "@tanstack/react-query";

interface SchoolStats {
    students: number;
    teachers: number;
    classes: number;
    attendance: {
        present: number;
        absent: number;
        rate: number;
    };
    payments: {
        total: number;
        count: number;
    };
    overdueBooks: number;
    userStats: {
        streak: number;
        todayCompleted: boolean;
        longestStreak: number;
    };
}

interface GradeDistribution {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
}

interface ActivityItem {
    action: string;
    entity: string;
    user: string;
    time: string;
}

export function useSchoolStats() {
    return useQuery<SchoolStats>({
        queryKey: ["analytics", "overview"],
        queryFn: async () => {
            const res = await fetch("/api/analytics?type=overview");
            if (!res.ok) throw new Error("Failed to fetch stats");
            return res.json();
        },
        refetchInterval: 60000, // Refresh every minute
    });
}

export function useGradeDistribution(classId?: string) {
    return useQuery<GradeDistribution>({
        queryKey: ["analytics", "grades", classId],
        queryFn: async () => {
            const url = classId
                ? `/api/analytics?type=grades&classId=${classId}`
                : "/api/analytics?type=grades";
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch grades");
            return res.json();
        },
    });
}

export function useRecentActivity() {
    return useQuery<ActivityItem[]>({
        queryKey: ["analytics", "activity"],
        queryFn: async () => {
            const res = await fetch("/api/analytics?type=activity");
            if (!res.ok) throw new Error("Failed to fetch activity");
            return res.json();
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });
}
